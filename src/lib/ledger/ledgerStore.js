/**
 * ledgerStore.js - reads and writes v2 ledger records through a backend (see ledgerBackends.js).
 *
 * Write ordering replaces transactions (the sql plugin's connection pool doesn't support them): the record
 * that makes a change visible is always written LAST. A payment's allocations are written before the payment,
 * an order's shares before the order; the engine ignores allocations whose payment is missing and shares
 * whose order is missing, so a crash mid-write leaves no visible half-state.
 */
import { LEDGER_SCHEMA_VERSION, sanitizeRow } from './ledgerSchema.js';
import { mapLegacyEntries, partyIdFor, slug } from './legacyMapper.js';
import { buildContext, orderReceivableMinor, isShareActive } from './engine.js';
import { normalizeCurrency } from './money.js';
import { isDemoId } from './sampleData.js';

const TABLE_KEYS = {
  parties: 'parties',
  orders: 'orders',
  order_shares: 'shares',
  payments: 'payments',
  payment_allocations: 'allocations',
  ledger_flags: 'flags',
};

// Restore and merge write dependants first and the rows that make them count (orders, payments) last,
// so an interruption leaves records the engine ignores rather than half-applied money.
const WRITE_ORDER = ['parties', 'order_shares', 'payment_allocations', 'ledger_flags', 'orders', 'payments'];

// Bookkeeping keys in ledger_meta that describe this device's state, not the ledger. They never travel in backups.
const LOCAL_META = new Set(['inflight', 'interrupted']);

const isSafeMinor = (n) => Number.isSafeInteger(n);

export const LIFECYCLES = ['pending', 'working', 'on_hold', 'done', 'failed', 'disputed', 'refunded'];
export const PAYMENT_KINDS = ['settlement', 'advance', 'expense', 'refund', 'adjustment'];

let idCounter = 0;
export function newLedgerId(prefix) {
  idCounter = (idCounter + 1) % 1679616;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rand}`;
}

export class LedgerValidationError extends Error {}

export function createLedgerStore(backend, { now = () => new Date().toISOString() } = {}) {
  const stamp = () => now();

  async function loadAll() {
    const out = {};
    for (const [table, key] of Object.entries(TABLE_KEYS)) out[key] = await backend.selectAll(table);
    return out;
  }

  async function loadContext() {
    return buildContext(await loadAll());
  }

  async function getMeta(key) {
    const rows = await backend.selectAll('ledger_meta');
    return rows.find((r) => r.id === key)?.value ?? null;
  }

  async function setMeta(key, value) {
    await backend.upsert('ledger_meta', { id: key, value: String(value) });
  }

  // --- one write at a time -------------------------------------------------------------------------------
  // Validation reads the ledger and the write follows; two writes interleaving could both pass validation
  // (double-clicking "Mark paid" would pay twice). Every mutation therefore runs through this queue.
  let queue = Promise.resolve();
  const serial = (fn) => {
    const run = queue.then(() => fn());
    queue = run.then(() => {}, () => {});
    return run;
  };

  // --- interrupted-write journal -------------------------------------------------------------------------
  // There are no transactions, so a multi-row write that is cut off (power loss, crash) can leave a half-state.
  // Each such write leaves a marker while it runs; if one is found at the next start, the app tells the user
  // which record to check instead of silently showing numbers that may be off.
  const markInflight = (op, id) => setMeta('inflight', JSON.stringify({ op, id: id || null, at: stamp() }));
  const clearInflight = () => backend.remove('ledger_meta', 'inflight');
  // The marker goes up after validation and comes down when the last row is written. If a write throws halfway,
  // the marker stays, which is exactly the signal that something needs checking.
  async function guarded(op, id, fn) {
    await markInflight(op, id);
    const result = await fn();
    await clearInflight();
    return result;
  }

  /** At startup: turn a leftover marker into an `interrupted` record the UI can show until dismissed. */
  async function takeInterrupted() {
    const left = await getMeta('inflight');
    if (left) {
      await setMeta('interrupted', left);
      await backend.remove('ledger_meta', 'inflight');
    }
    const rec = left || (await getMeta('interrupted'));
    try { return rec ? JSON.parse(rec) : null; } catch { return { op: 'unknown' }; }
  }

  async function dismissInterrupted() {
    await backend.remove('ledger_meta', 'interrupted');
  }

  // --- parties ---

  async function saveParty(party) {
    if (!party?.name || !String(party.name).trim()) throw new LedgerValidationError('A name is required.');
    const kind = party.kind || 'booster';
    const name = String(party.name).trim();
    const all = await backend.selectAll('parties');
    // two people of the same kind cannot share a name (renaming "Sara" to "Ali" must not merge or duplicate)
    if (all.some((p) => p.id !== party.id && !isDemoId(p.id) && p.kind === kind && slug(p.name) === slug(name))) {
      throw new LedgerValidationError('Someone with that name already exists.');
    }
    const row = {
      archived: 0,
      ...party,
      kind,
      name,
      id: party.id || partyIdFor(kind, name),
      updatedAt: stamp(),
      createdAt: party.createdAt || stamp(),
    };
    await backend.upsert('parties', row);
    return row;
  }

  /**
   * "Ali" typed again, in any case or spelling, resolves to the existing person instead of a duplicate. The match
   * is on the name (not the id), so a person who was renamed is still found by their new name.
   */
  async function ensureParty(kind, name, extra = {}) {
    const all = await backend.selectAll('parties');
    // sample-workspace people never absorb a real person who happens to share a name
    const existing = all.find((p) => !isDemoId(p.id) && p.kind === kind && slug(p.name) === slug(name));
    if (existing) return existing;
    let id = partyIdFor(kind, name);
    while (all.some((p) => p.id === id)) id += '_';
    return saveParty({ id, kind, name, ...extra });
  }

  /** Merge into a person's saved settings (e.g. a platform's default fee and withdrawal rule). */
  async function savePartySettings(partyId, patch) {
    const party = (await backend.selectAll('parties')).find((p) => p.id === partyId);
    if (!party) throw new LedgerValidationError('Person not found.');
    const settings = { ...(party.settings || {}), ...patch };
    if (patch.withdraw) settings.withdraw = { ...(party.settings?.withdraw || {}), ...patch.withdraw };
    await backend.upsert('parties', { ...party, settings, updatedAt: stamp() });
    return settings;
  }

  // --- orders ---

  /**
   * Save an order and its booster shares. Removing a booster from an order cancels their share (kept for
   * history) instead of deleting it, so payments already applied to it return to that person as credit.
   */
  async function saveOrder({ order, shares = [] }) {
    if (!order?.id) throw new LedgerValidationError('Order id is required.');
    if (!LIFECYCLES.includes(order.lifecycle)) throw new LedgerValidationError(`Unknown lifecycle: ${order.lifecycle}`);
    const gross = Math.round(Number(order.grossMinor));
    const fee = Math.round(Number(order.platformFeeMinor) || 0);
    if (!isSafeMinor(gross) || gross < 0) throw new LedgerValidationError('Gross price must be zero or more.');
    if (fee < 0 || fee > gross) throw new LedgerValidationError('Platform fee must be between zero and the price.');
    const seen = new Set();
    for (const s of shares) {
      if (!s.partyId) throw new LedgerValidationError('Every share needs a person.');
      const amt = Math.round(Number(s.amountMinor));
      if (!isSafeMinor(amt) || amt < 0) throw new LedgerValidationError('Share amounts cannot be negative.');
      if (seen.has(s.partyId)) throw new LedgerValidationError('A person can only appear once per order.');
      seen.add(s.partyId);
    }

    const existingShares = (await backend.selectAll('order_shares')).filter((s) => s.orderId === order.id);
    const prevOrder = (await backend.selectAll('orders')).find((o) => o.id === order.id);
    // Amounts already paid on this order were applied in its old currency; re-reading them as another currency
    // would turn 300,000 Toman into 300,000 cents. Changing currency is only possible before any money moved.
    if (prevOrder && normalizeCurrency(prevOrder.currency) !== normalizeCurrency(order.currency)) {
      const shareIds = new Set(existingShares.map((s) => s.id));
      const allocs = await backend.selectAll('payment_allocations');
      if (allocs.some((a) => a.targetId === order.id || shareIds.has(a.targetId))) {
        throw new LedgerValidationError(`Payments were already recorded in ${prevOrder.currency}. Void them before changing this order's currency.`);
      }
    }
    await markInflight('saveOrder', order.id);
    const shareState = order.lifecycle === 'done' ? 'done' : 'open';
    for (const s of shares) {
      const prev = existingShares.find((x) => x.partyId === s.partyId);
      await backend.upsert('order_shares', {
        note: '',
        ...s,
        id: prev?.id || s.id || newLedgerId('shr'),
        orderId: order.id,
        amountMinor: Math.round(Number(s.amountMinor)),
        state: s.state && s.state !== 'cancelled' ? s.state : shareState,
        createdAt: prev?.createdAt || stamp(),
        updatedAt: stamp(),
      });
    }
    // header last: the order row makes the new shares count
    const row = {
      kind: 'income',
      ...order,
      currency: normalizeCurrency(order.currency),
      grossMinor: gross,
      platformFeeMinor: fee,
      createdAt: prevOrder?.createdAt || stamp(),
      updatedAt: stamp(),
    };
    await backend.upsert('orders', row);
    for (const prev of existingShares) {
      if (!seen.has(prev.partyId) && prev.state !== 'cancelled') {
        await backend.upsert('order_shares', { ...prev, state: 'cancelled', updatedAt: stamp() });
      }
    }
    // reviewing a migrated order and saving it settles the "check this" notes on it
    for (const f of await backend.selectWhere('ledger_flags', 'orderId', order.id)) {
      if (!f.resolved) await backend.upsert('ledger_flags', { ...f, resolved: 1 });
    }
    await clearInflight();
    return row;
  }

  /**
   * Move an order through its lifecycle. Marking it done makes its live shares earned (payable); moving it back
   * out of done returns them to in-progress, so they stop showing as due.
   */
  async function setLifecycle(orderId, lifecycle) {
    if (!LIFECYCLES.includes(lifecycle)) throw new LedgerValidationError(`Unknown lifecycle: ${lifecycle}`);
    const order = (await backend.selectAll('orders')).find((o) => o.id === orderId);
    if (!order) throw new LedgerValidationError('Order not found.');
    const from = lifecycle === 'done' ? 'open' : 'done';
    const to = lifecycle === 'done' ? 'done' : 'open';
    for (const s of (await backend.selectAll('order_shares')).filter((x) => x.orderId === orderId && x.state === from)) {
      await backend.upsert('order_shares', { ...s, state: to, updatedAt: stamp() });
    }
    await backend.upsert('orders', { ...order, lifecycle, updatedAt: stamp() });
  }

  /**
   * Save the day's rates on every order that has none yet (orders from before rates were saved per job). They are
   * frozen at the rates given, so a later rate change stops moving them. An order keeps any gold rate it already had.
   * Returns how many orders were locked. Safe to repeat: orders that already have rates are never touched.
   */
  async function lockOrderRates(rates) {
    const snap = {
      goldRateTOMAN: Number(rates?.goldRateTOMAN) > 0 ? Number(rates.goldRateTOMAN) : null,
      usdRateTOMAN: Number(rates?.usdRateTOMAN) > 0 ? Number(rates.usdRateTOMAN) : null,
      eurRateUSD: Number(rates?.eurRateUSD) > 0 ? Number(rates.eurRateUSD) : null,
    };
    if (!snap.usdRateTOMAN && !snap.eurRateUSD) return 0;
    let locked = 0;
    for (const o of await backend.selectAll('orders')) {
      if (o.rates || o.kind === 'expense') continue;
      const gold = Number(o.exchangeRate) > 0 ? Number(o.exchangeRate) : snap.goldRateTOMAN;
      // updatedAt is left alone: locking is housekeeping, not an edit
      await backend.upsert('orders', { ...o, rates: { ...snap, goldRateTOMAN: gold, ...(o.rateUnit === '1' ? { isPerOneGold: true } : {}) } });
      locked += 1;
    }
    return locked;
  }

  async function deleteOrder(orderId) {
    await markInflight('deleteOrder', orderId);
    // shares and allocations first, header last
    const shares = (await backend.selectAll('order_shares')).filter((s) => s.orderId === orderId);
    const allocs = await backend.selectAll('payment_allocations');
    for (const a of allocs) {
      if (a.targetId === orderId || shares.some((s) => s.id === a.targetId)) await backend.remove('payment_allocations', a.id);
    }
    for (const s of shares) await backend.remove('order_shares', s.id);
    await backend.removeWhere('ledger_proofs', 'ownerId', orderId);
    await backend.remove('orders', orderId);
    await clearInflight();
  }

  // --- payments ---

  /**
   * Record money moving. Allocations are validated here so the ledger can't go over-applied:
   * consumed amounts may not exceed the payment, and nothing may be applied beyond what's outstanding.
   */
  async function recordPayment({ payment, allocations = [] }) {
    if (!['in', 'out'].includes(payment?.direction)) throw new LedgerValidationError('Payment direction must be in or out.');
    if (!PAYMENT_KINDS.includes(payment.kind)) throw new LedgerValidationError(`Unknown payment kind: ${payment.kind}`);
    const amount = Math.round(Number(payment.amountMinor));
    if (!isSafeMinor(amount) || amount <= 0) throw new LedgerValidationError('Amount must be greater than zero.');
    const consumed = allocations.reduce((s, a) => s + Math.round(Number(a.consumedMinor) || 0), 0);
    if (!isSafeMinor(consumed) || consumed > amount) throw new LedgerValidationError('Allocations use more than the payment amount.');

    const ctx = await loadContext();
    for (const a of allocations) {
      if (!(Number(a.appliedMinor) > 0)) throw new LedgerValidationError('Applied amounts must be positive.');
      if (a.targetType === 'share') {
        const share = ctx.shares.find((s) => s.id === a.targetId);
        if (!share) throw new LedgerValidationError('Allocation points at a missing share.');
        if (!isShareActive(share, ctx.orderById.get(share.orderId))) throw new LedgerValidationError('That share is cancelled.');
        const outstanding = share.amountMinor - (ctx.appliedByTarget.get(`share:${share.id}`) || 0);
        if (a.appliedMinor > outstanding) throw new LedgerValidationError('That would pay a share more than it is owed.');
      } else if (a.targetType === 'order') {
        const order = ctx.orderById.get(a.targetId);
        if (!order) throw new LedgerValidationError('Allocation points at a missing order.');
        const outstanding = orderReceivableMinor(order) - (ctx.appliedByTarget.get(`order:${order.id}`) || 0);
        if (a.appliedMinor > outstanding) throw new LedgerValidationError('That would collect more than the order is worth.');
      } else {
        throw new LedgerValidationError('Unknown allocation target.');
      }
    }

    const id = payment.id || newLedgerId('pay');
    if (allocations.length) await markInflight('recordPayment', id);
    for (const a of allocations) {
      await backend.upsert('payment_allocations', {
        ...a,
        id: a.id || newLedgerId('alc'),
        paymentId: id,
        appliedMinor: Math.round(a.appliedMinor),
        consumedMinor: Math.round(a.consumedMinor),
      });
    }
    // header last: the payment row is what makes the allocations count
    const row = {
      method: '',
      note: '',
      origin: 'user',
      ...payment,
      id,
      amountMinor: amount,
      currency: normalizeCurrency(payment.currency),
      dateTime: payment.dateTime || stamp(),
      createdAt: stamp(),
    };
    await backend.upsert('payments', row);
    if (allocations.length) await clearInflight();
    return row;
  }

  /** Payments are append-only. A void is a marker row, and everything it covers stops counting. */
  async function voidPayment(paymentId, note = '') {
    const all = await backend.selectAll('payments');
    const target = all.find((p) => p.id === paymentId);
    if (!target) throw new LedgerValidationError('Payment not found.');
    if (target.voidsPaymentId) throw new LedgerValidationError('A void marker cannot be voided.');
    if (all.some((p) => p.voidsPaymentId === paymentId)) throw new LedgerValidationError('Already voided.');
    return backend.upsert('payments', {
      id: newLedgerId('void'),
      direction: target.direction,
      partyId: target.partyId,
      dateTime: stamp(),
      amountMinor: target.amountMinor,
      currency: target.currency,
      kind: 'adjustment',
      note,
      voidsPaymentId: paymentId,
      origin: 'user',
      createdAt: stamp(),
    });
  }

  // --- migration ---

  /** What migrating would create, without writing anything. */
  function previewLegacyMigration(entries, profile) {
    const m = mapLegacyEntries(entries, { profile });
    const byCode = {};
    for (const f of m.flags) byCode[f.code] = (byCode[f.code] || 0) + 1;
    return {
      parties: m.parties.length,
      orders: m.orders.length,
      shares: m.shares.length,
      payments: m.payments.length,
      allocations: m.allocations.length,
      flags: byCode,
      flaggedOrders: new Set(m.flags.filter((f) => f.code !== 'approximate_rate').map((f) => f.orderId)).size,
    };
  }

  /**
   * Idempotent: every row is inserted with ignore semantics keyed by a deterministic id, and the schema
   * version is written LAST, so a crash simply reruns the whole thing. Legacy rows are never touched.
   * `beforeWrite` lets the caller take the safety snapshot first; if it throws, nothing is written.
   */
  async function migrateLegacy(entries, { profile = 'advertiser', beforeWrite } = {}) {
    if (Number(await getMeta('schemaVersion')) >= LEDGER_SCHEMA_VERSION) return { migrated: false, reason: 'already_current' };
    if (beforeWrite) await beforeWrite();
    await writeMapped(entries, profile);
    await setMeta('schemaVersion', LEDGER_SCHEMA_VERSION);
    await setMeta('migratedAt', stamp());
    return { migrated: true, counts: previewLegacyMigration(entries, profile) };
  }

  /**
   * Merge legacy-shaped entries into an already-upgraded ledger (e.g. importing a v1 backup file).
   * Deterministic ids plus ignore semantics make this safe to repeat: existing records are never overwritten.
   */
  async function importLegacyEntries(entries, { profile = 'advertiser' } = {}) {
    await writeMapped(entries, profile);
    return previewLegacyMigration(entries, profile);
  }

  async function writeMapped(entries, profile) {
    const m = mapLegacyEntries(entries, { profile });
    for (const p of m.parties) {
      await backend.upsert('parties', { archived: 0, createdAt: stamp(), updatedAt: stamp(), ...p }, { ignore: true });
    }
    for (const s of m.shares) await backend.upsert('order_shares', { createdAt: stamp(), updatedAt: stamp(), ...s }, { ignore: true });
    for (const a of m.allocations) await backend.upsert('payment_allocations', a, { ignore: true });
    for (const p of m.payments) await backend.upsert('payments', { createdAt: stamp(), ...p }, { ignore: true });
    for (const o of m.orders) await backend.upsert('orders', { createdAt: stamp(), updatedAt: stamp(), ...o }, { ignore: true });
    for (const f of m.flags) {
      const { orderId, code, ...detail } = f;
      await backend.upsert('ledger_flags', { id: `flag_${orderId}_${code}`, orderId, code, detail, resolved: 0, createdAt: stamp() }, { ignore: true });
    }
  }

  // --- proofs (screenshots on orders and payments) ---

  async function addProof({ ownerType, ownerId, name, data, size }) {
    if (!['order', 'payment'].includes(ownerType) || !ownerId) throw new LedgerValidationError('A proof needs an owner.');
    if (typeof data !== 'string' || !data.startsWith('data:image/')) throw new LedgerValidationError('Proofs must be images.');
    const row = { id: newLedgerId('prf'), ownerType, ownerId, name: name || 'proof', data, size: size || data.length, createdAt: stamp() };
    await backend.upsert('ledger_proofs', row);
    return row;
  }

  async function listProofs(ownerType, ownerId) {
    return (await backend.selectWhere('ledger_proofs', 'ownerId', ownerId)).filter((p) => p.ownerType === ownerType);
  }

  async function countProofsByOwner() {
    // ids only matter here, but selectAll is the one portable read; proofs are few and this runs on demand
    const rows = await backend.selectAll('ledger_proofs');
    const counts = {};
    for (const r of rows) counts[`${r.ownerType}:${r.ownerId}`] = (counts[`${r.ownerType}:${r.ownerId}`] || 0) + 1;
    return counts;
  }

  async function removeProof(id) {
    await backend.remove('ledger_proofs', id);
  }

  // --- backup, restore, reset ---

  /** Everything in the ledger, for snapshots and JSON export. Includes meta so a restore keeps the version. */
  async function exportAll() {
    const data = await loadAll();
    const meta = (await backend.selectAll('ledger_meta'))
      .filter((r) => !LOCAL_META.has(r.id))
      .reduce((m, r) => ({ ...m, [r.id]: r.value }), {});
    return { ...data, proofs: await backend.selectAll('ledger_proofs'), meta };
  }

  /** Replace the ledger with an exported copy (clears first). Orders and payments go in last; meta last of all. */
  async function importAll(data) {
    // validate first: a bad file must not wipe the current ledger and then fail halfway
    const clean = collectClean(data);
    await clearAll();
    await markInflight('importAll', null);
    for (const [table, rows] of clean.rows) for (const row of rows) await backend.upsert(table, row);
    for (const [k, v] of Object.entries(data?.meta || {})) {
      if (LOCAL_META.has(k)) continue;
      if (typeof v === 'string' || typeof v === 'number') await setMeta(k, v);
    }
    await clearInflight();
    return { skipped: clean.skipped };
  }

  /** Validate every row of an untrusted export. Nothing is written here; rows that fail are counted, not stored. */
  function collectClean(data) {
    const rows = [];
    let skipped = 0;
    const take = (table, list) => {
      const kept = [];
      for (const row of Array.isArray(list) ? list : []) {
        const c = sanitizeRow(table, row);
        if (c) kept.push(c);
        else skipped += 1;
      }
      rows.push([table, kept]);
    };
    const keyOf = Object.fromEntries(Object.entries(TABLE_KEYS));
    for (const table of WRITE_ORDER) take(table, data?.[keyOf[table]]);
    take('ledger_proofs', data?.proofs);
    return { rows, skipped };
  }

  /**
   * Add an exported ledger to the current one without replacing anything that already exists (ids that are
   * already present keep their local version). This is what importing a backup file into a used profile does.
   */
  async function mergeAll(data) {
    const clean = collectClean(data);
    await markInflight('mergeAll', null);
    for (const [table, rows] of clean.rows) for (const row of rows) await backend.upsert(table, row, { ignore: true });
    // an imported ledger means this database is on the v2 model; never lower a version that is already set
    if (Number(await getMeta('schemaVersion')) < LEDGER_SCHEMA_VERSION) await setMeta('schemaVersion', LEDGER_SCHEMA_VERSION);
    await clearInflight();
    return { skipped: clean.skipped };
  }

  /**
   * Remove the sample workspace. Only records whose id starts with demo_ go; anything the user made stays.
   * Deletes the dependants first and the headers last, like every other multi-row write.
   */
  async function removeDemo() {
    const data = await loadAll();
    const demo = isDemoId;
    await markInflight('removeDemo', null);
    // a payment the user recorded against a sample person has nowhere to go once that person is gone
    const demoPaymentIds = new Set(data.payments.filter((p) => demo(p.id) || demo(p.partyId) || demo(p.voidsPaymentId)).map((p) => p.id));
    for (const a of data.allocations) {
      if (demo(a.id) || demoPaymentIds.has(a.paymentId) || demo(a.targetId)) await backend.remove('payment_allocations', a.id);
    }
    for (const p of await backend.selectAll('ledger_proofs')) {
      if (demo(p.id) || demo(p.ownerId)) await backend.remove('ledger_proofs', p.id);
    }
    for (const s of data.shares) if (demo(s.id)) await backend.remove('order_shares', s.id);
    for (const p of data.payments) if (demoPaymentIds.has(p.id)) await backend.remove('payments', p.id);
    for (const o of data.orders) if (demo(o.id)) await backend.remove('orders', o.id);
    for (const p of data.parties) if (demo(p.id)) await backend.remove('parties', p.id);
    await clearInflight();
  }

  async function clearAll() {
    // meta last: with the version marker gone, a later startup re-migrates from legacy rows instead of trusting emptiness
    for (const table of Object.keys(TABLE_KEYS)) await backend.clear(table);
    await backend.clear('ledger_proofs');
    await backend.clear('ledger_meta');
  }

  async function resolveFlag(flagId) {
    const f = (await backend.selectAll('ledger_flags')).find((x) => x.id === flagId);
    if (f) await backend.upsert('ledger_flags', { ...f, resolved: 1 });
  }

  // --- health ---

  /** Structural checks for the Data health page. Returns a list of human-checkable problems. */
  async function integrityReport() {
    const data = await loadAll();
    const orderIds = new Set(data.orders.map((o) => o.id));
    const shareIds = new Set(data.shares.map((s) => s.id));
    const paymentIds = new Set(data.payments.map((p) => p.id));
    const issues = [];
    for (const s of data.shares) if (!orderIds.has(s.orderId)) issues.push({ type: 'orphan_share', id: s.id });
    for (const a of data.allocations) {
      if (!paymentIds.has(a.paymentId)) issues.push({ type: 'orphan_allocation', id: a.id });
      else if (a.targetType === 'share' ? !shareIds.has(a.targetId) : !orderIds.has(a.targetId)) {
        issues.push({ type: 'dangling_allocation', id: a.id });
      }
    }
    const ctx = buildContext(data);
    // a share edited below what was paid is not an error: the extra is the person's credit (see partyBalance)
    for (const o of data.orders) {
      if ((ctx.appliedByTarget.get(`order:${o.id}`) || 0) > orderReceivableMinor(o)) issues.push({ type: 'overcollected_order', id: o.id });
    }
    return issues;
  }

  return {
    backend,
    init: () => backend.ensureSchema(),
    loadAll,
    loadContext,
    getMeta,
    setMeta,
    // every mutation runs one at a time (see serial)
    saveParty: (a) => serial(() => saveParty(a)),
    savePartySettings: (...a) => serial(() => savePartySettings(...a)),
    ensureParty: (...a) => serial(() => ensureParty(...a)),
    saveOrder: (a) => serial(() => saveOrder(a)),
    setLifecycle: (...a) => serial(() => setLifecycle(...a)),
    lockOrderRates: (a) => serial(() => lockOrderRates(a)),
    deleteOrder: (a) => serial(() => deleteOrder(a)),
    recordPayment: (a) => serial(() => recordPayment(a)),
    voidPayment: (...a) => serial(() => voidPayment(...a)),
    previewLegacyMigration,
    migrateLegacy: (...a) => serial(() => migrateLegacy(...a)),
    importLegacyEntries: (...a) => serial(() => importLegacyEntries(...a)),
    addProof: (a) => serial(() => addProof(a)),
    listProofs,
    countProofsByOwner,
    removeProof: (a) => serial(() => removeProof(a)),
    resolveFlag: (a) => serial(() => resolveFlag(a)),
    integrityReport,
    exportAll,
    importAll: (a) => serial(() => importAll(a)),
    mergeAll: (a) => serial(() => mergeAll(a)),
    removeDemo: () => serial(() => removeDemo()),
    clearAll: () => serial(() => clearAll()),
    takeInterrupted,
    dismissInterrupted,
  };
}
