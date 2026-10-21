// Ledger store against real SQLite (node:sqlite): schema, writes, validation, void, migration and health.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore, LedgerValidationError } from '../src/lib/ledger/ledgerStore.js';
import { LEDGER_TABLE_NAMES } from '../src/lib/ledger/ledgerSchema.js';
import { partyBalance, allocateToParty, orderMarginMinor, orderTargetsFor, allocateFifo, exposureByCurrency } from '../src/lib/ledger/engine.js';
import { partyIdFor } from '../src/lib/ledger/legacyMapper.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };

// tauri-plugin-sql shape on top of node:sqlite
function makeDb() {
  const db = new DatabaseSync(':memory:');
  return {
    raw: db,
    async execute(sql, params = []) { db.prepare(sql).run(...params); },
    async select(sql, params = []) { return db.prepare(sql).all(...params); },
  };
}

async function makeStore() {
  const db = makeDb();
  const store = createLedgerStore(createSqliteBackend(db), { now: () => '2026-10-01T00:00:00.000Z' });
  await store.init();
  return { db, store };
}

const order = (over = {}) => ({
  id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000,
  payerId: 'g2g', dateTime: '2026-09-01T10:00:00Z', title: 'Boost', ...over,
});

test('schema creates every ledger table and is safe to run twice', async () => {
  const { db, store } = await makeStore();
  await store.init();
  const names = (await db.select("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r.name);
  for (const t of LEDGER_TABLE_NAMES) assert.ok(names.includes(t), `missing ${t}`);
});

test('order + shares round-trip and margin is derived from them', async () => {
  const { store } = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  const sara = await store.ensureParty('booster', 'Sara');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 300000 }, { partyId: sara.id, amountMinor: 200000 }] });
  const ctx = await store.loadContext();
  assert.equal(orderMarginMinor(ctx, ctx.orderById.get('o1')), 400000);
  assert.equal(partyBalance(ctx, ali.id).payable.TOMAN, 300000);
});

test('ensureParty resolves the same person by name, regardless of case', async () => {
  const { store } = await makeStore();
  const a = await store.ensureParty('booster', 'Ali');
  const b = await store.ensureParty('booster', ' ali ');
  assert.equal(a.id, b.id);
  assert.equal((await store.loadAll()).parties.length, 1);
});

test('removing a booster from an order cancels the share instead of deleting it', async () => {
  const { store } = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  const sara = await store.ensureParty('booster', 'Sara');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 300000 }, { partyId: sara.id, amountMinor: 200000 }] });
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 300000 }] });
  const data = await store.loadAll();
  assert.equal(data.shares.length, 2);
  assert.equal(data.shares.find((s) => s.partyId === sara.id).state, 'cancelled');
  const ctx = await store.loadContext();
  assert.equal(orderMarginMinor(ctx, ctx.orderById.get('o1')), 600000);
});

test('settle up across works, then partial overpay is rejected', async () => {
  const { store } = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order({ id: 'o1', dateTime: '2026-09-01T00:00:00Z' }), shares: [{ partyId: ali.id, amountMinor: 300000 }] });
  await store.saveOrder({ order: order({ id: 'o2', dateTime: '2026-09-02T00:00:00Z' }), shares: [{ partyId: ali.id, amountMinor: 250000 }] });
  let ctx = await store.loadContext();
  const { allocations, remainderMinor } = allocateToParty(ctx, { partyId: ali.id, amountMinor: 400000, currency: 'TOMAN', rates: RATES });
  assert.equal(remainderMinor, 0);
  await store.recordPayment({ payment: { direction: 'out', partyId: ali.id, amountMinor: 400000, currency: 'TOMAN', kind: 'settlement' }, allocations });
  ctx = await store.loadContext();
  assert.equal(partyBalance(ctx, ali.id).payable.TOMAN, 150000);

  const bad = allocateFifo({ amountMinor: 999999, currency: 'TOMAN', rates: RATES, targets: [] });
  assert.equal(bad.allocations.length, 0);
  const share2 = ctx.shares.find((s) => s.orderId === 'o2');
  await assert.rejects(
    store.recordPayment({
      payment: { direction: 'out', partyId: ali.id, amountMinor: 999999, currency: 'TOMAN', kind: 'settlement' },
      allocations: [{ targetType: 'share', targetId: share2.id, appliedMinor: 999999, consumedMinor: 999999 }],
    }),
    LedgerValidationError,
  );
});

test('validation: bad amounts, kinds, lifecycles and fee > price are refused', async () => {
  const { store } = await makeStore();
  await assert.rejects(store.recordPayment({ payment: { direction: 'out', partyId: 'x', amountMinor: 0, currency: 'TOMAN', kind: 'settlement' } }), LedgerValidationError);
  await assert.rejects(store.recordPayment({ payment: { direction: 'sideways', amountMinor: 5, currency: 'TOMAN', kind: 'settlement' } }), LedgerValidationError);
  await assert.rejects(store.saveOrder({ order: order({ lifecycle: 'weird' }) }), LedgerValidationError);
  await assert.rejects(store.saveOrder({ order: order({ platformFeeMinor: 2000000 }) }), LedgerValidationError);
  await assert.rejects(store.saveOrder({ order: order(), shares: [{ partyId: 'a', amountMinor: 1 }, { partyId: 'a', amountMinor: 2 }] }), LedgerValidationError);
});

test('intermediary flow: platform pays a lump, boosters were paid earlier, exposure appears and clears', async () => {
  const { store } = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 300000 }] });
  let ctx = await store.loadContext();
  const share = ctx.shares[0];
  await store.recordPayment({
    payment: { direction: 'out', partyId: ali.id, amountMinor: 300000, currency: 'TOMAN', kind: 'settlement' },
    allocations: [{ targetType: 'share', targetId: share.id, appliedMinor: 300000, consumedMinor: 300000 }],
  });
  ctx = await store.loadContext();
  assert.equal(exposureByCurrency(ctx).TOMAN, 300000);
  const targets = orderTargetsFor(ctx, 'g2g');
  const { allocations } = allocateFifo({ amountMinor: 900000, currency: 'TOMAN', rates: RATES, targets });
  await store.recordPayment({ payment: { direction: 'in', partyId: 'g2g', amountMinor: 900000, currency: 'TOMAN', kind: 'settlement' }, allocations });
  ctx = await store.loadContext();
  assert.equal(exposureByCurrency(ctx).TOMAN, undefined);
});

test('void restores the balance and cannot be repeated', async () => {
  const { store } = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 300000 }] });
  const share = (await store.loadAll()).shares[0];
  const pay = await store.recordPayment({
    payment: { direction: 'out', partyId: ali.id, amountMinor: 300000, currency: 'TOMAN', kind: 'settlement' },
    allocations: [{ targetType: 'share', targetId: share.id, appliedMinor: 300000, consumedMinor: 300000 }],
  });
  await store.voidPayment(pay.id, 'sent to the wrong person');
  const ctx = await store.loadContext();
  assert.equal(partyBalance(ctx, ali.id).payable.TOMAN, 300000);
  assert.equal((await store.loadAll()).payments.length, 2); // nothing was deleted
  await assert.rejects(store.voidPayment(pay.id), LedgerValidationError);
});

test('crash between allocations and payment header leaves no visible half-state', async () => {
  const { store } = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 300000 }] });
  const share = (await store.loadAll()).shares[0];
  // simulate the crash: the allocation row was written, the payment header never was
  await store.backend.upsert('payment_allocations', { id: 'a_orphan', paymentId: 'pay_never', targetType: 'share', targetId: share.id, appliedMinor: 300000, consumedMinor: 300000 });
  const ctx = await store.loadContext();
  assert.equal(partyBalance(ctx, ali.id).payable.TOMAN, 300000);
  assert.ok((await store.integrityReport()).some((i) => i.type === 'orphan_allocation'));
});

const legacy = (over = {}) => ({
  id: 'job_1', title: 'Boost', game: 'WoW', source: 'G2G', currency: 'TOMAN', pot: 1000000, income: 400000,
  teammates: ['Ali', 'Sara'], teammateCuts: { Ali: '300000', Sara: '300000' }, status: 'Paid',
  dateTime: '2026-09-01T10:00', sourcePaid: true, boosterPaid: false, exchangeRate: 3200, rateUnit: '1k', ...over,
});

test('migration: dry-run counts match what is written, rerun is a no-op, legacy rows untouched', async () => {
  const { store } = await makeStore();
  const entries = [legacy(), legacy({ id: 'job_2', teammates: ['Ali'], teammateCuts: {}, pot: 600000, income: 100000 })];
  const preview = store.previewLegacyMigration(entries, 'advertiser');
  const snapshotCalls = [];
  const res = await store.migrateLegacy(entries, { profile: 'advertiser', beforeWrite: async () => snapshotCalls.push(1) });
  assert.equal(res.migrated, true);
  assert.equal(snapshotCalls.length, 1);
  const data = await store.loadAll();
  assert.equal(data.orders.length, preview.orders);
  assert.equal(data.shares.length, preview.shares);
  assert.equal(data.payments.length, preview.payments);
  assert.equal(await store.getMeta('schemaVersion'), '2');

  const again = await store.migrateLegacy(entries, { profile: 'advertiser', beforeWrite: async () => snapshotCalls.push(1) });
  assert.equal(again.migrated, false);
  assert.equal(snapshotCalls.length, 1);
  assert.equal((await store.loadAll()).orders.length, preview.orders);
});

test('migration: a failing safety snapshot writes nothing', async () => {
  const { store } = await makeStore();
  await assert.rejects(store.migrateLegacy([legacy()], { beforeWrite: async () => { throw new Error('disk full'); } }));
  assert.equal((await store.loadAll()).orders.length, 0);
  assert.equal(await store.getMeta('schemaVersion'), null);
});

test('migration: a crash midway is recovered by rerunning (no duplicates)', async () => {
  const { store } = await makeStore();
  const entries = [legacy(), legacy({ id: 'job_2' })];
  // first run dies after some rows are written: emulate by writing a subset, with no version marker
  const orig = store.backend.upsert;
  let n = 0;
  store.backend.upsert = async (...a) => { if (++n > 6) throw new Error('crash'); return orig(...a); };
  await assert.rejects(store.migrateLegacy(entries, { profile: 'advertiser' }));
  store.backend.upsert = orig;
  assert.equal(await store.getMeta('schemaVersion'), null);
  await store.migrateLegacy(entries, { profile: 'advertiser' });
  const data = await store.loadAll();
  assert.equal(new Set(data.orders.map((o) => o.id)).size, data.orders.length);
  assert.equal(data.orders.length, 2);
  assert.deepEqual(await store.integrityReport(), []);
});

test('migrated people can be paid, and the new payment resolves to the same person id', async () => {
  const { store } = await makeStore();
  await store.migrateLegacy([legacy()], { profile: 'advertiser' });
  const ali = await store.ensureParty('booster', 'ali');
  assert.equal(ali.id, partyIdFor('booster', 'Ali'));
  const ctx = await store.loadContext();
  assert.equal(partyBalance(ctx, ali.id).payable.TOMAN, 300000);
});
