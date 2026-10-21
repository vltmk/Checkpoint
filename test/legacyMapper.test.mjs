// Legacy work_entries -> v2 ledger mapping. The migration must not change what users' money says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapLegacyEntries, partyIdFor, UNASSIGNED_PARTY_ID } from '../src/lib/ledger/legacyMapper.js';
import { buildContext, orderMarginMinor, partyBalance, orderMoneyState } from '../src/lib/ledger/engine.js';
import { toMinor } from '../src/lib/ledger/money.js';

function adv(over = {}) {
  return {
    id: 'job_1', title: 'Mythic+ boost', game: 'World of Warcraft', source: 'G2G', currency: 'TOMAN',
    pot: 1000000, income: 400000, teammates: ['Ali', 'Sara'], teammateCuts: { Ali: '300000', Sara: '300000' },
    teammateNotes: { Ali: 'fast' }, status: 'Working', dateTime: '2026-09-01T10:00', sourcePaid: false, boosterPaid: false,
    exchangeRate: 3200, rateUnit: '1k', ...over,
  };
}

function ctxOf(mapped) {
  return buildContext(mapped);
}

test('advertiser order maps to shares and keeps the legacy margin exactly', () => {
  const m = mapLegacyEntries([adv()], { profile: 'advertiser' });
  const ctx = ctxOf(m);
  assert.equal(m.orders.length, 1);
  assert.equal(m.shares.length, 2);
  assert.equal(orderMarginMinor(ctx, m.orders[0]), 400000);
  assert.deepEqual(m.flags, []);
  assert.equal(m.shares.find((s) => s.partyId === partyIdFor('booster', 'Ali')).note, 'fast');
  assert.equal(m.orders[0].payerId, partyIdFor('platform', 'G2G'));
});

test('boosterPaid and sourcePaid become synthetic payments with full allocations', () => {
  const m = mapLegacyEntries([adv({ status: 'Paid', sourcePaid: true, boosterPaid: true })]);
  const ctx = ctxOf(m);
  const st = orderMoneyState(ctx, m.orders[0]);
  assert.equal(st.collected, true);
  assert.equal(st.boostersPaid, true);
  assert.ok(m.payments.every((p) => p.origin === 'migrated'));
  assert.deepEqual(partyBalance(ctx, partyIdFor('booster', 'Ali')).payable, {});
});

test('unpaid done order leaves the booster balance payable', () => {
  const m = mapLegacyEntries([adv({ status: 'Paid' })]);
  const ctx = ctxOf(m);
  assert.equal(partyBalance(ctx, partyIdFor('booster', 'Ali')).payable.TOMAN, 300000);
});

test('booster names are one person regardless of case and whitespace', () => {
  const m = mapLegacyEntries([adv({ teammates: ['Ali', ' ali '], teammateCuts: { Ali: '600000' } })]);
  assert.equal(m.shares.length, 1);
  assert.equal(m.parties.filter((p) => p.kind === 'booster').length, 1);
});

test('pool without a booster is kept under Unassigned so margin does not change', () => {
  const m = mapLegacyEntries([adv({ teammates: [], teammateCuts: {} })]);
  const ctx = ctxOf(m);
  assert.equal(m.shares.length, 1);
  assert.equal(m.shares[0].partyId, UNASSIGNED_PARTY_ID);
  assert.equal(orderMarginMinor(ctx, m.orders[0]), 400000);
  assert.ok(m.flags.some((f) => f.code === 'unassigned_pool'));
});

test('no stored cuts: even split is assumed and flagged', () => {
  const m = mapLegacyEntries([adv({ teammateCuts: {} })]);
  assert.deepEqual(m.shares.map((s) => s.amountMinor), [300000, 300000]);
  assert.ok(m.flags.some((f) => f.code === 'even_split_assumed'));
});

test('cuts below the pool: remainder goes to Unassigned, margin preserved, flagged', () => {
  const m = mapLegacyEntries([adv({ teammateCuts: { Ali: '300000', Sara: '200000' } })]);
  const ctx = ctxOf(m);
  assert.equal(orderMarginMinor(ctx, m.orders[0]), 400000);
  assert.ok(m.flags.some((f) => f.code === 'unassigned_pool' && f.amountMinor === 100000));
});

test('cuts above the pool are flagged, never silently trimmed', () => {
  const m = mapLegacyEntries([adv({ teammateCuts: { Ali: '500000', Sara: '300000' } })]);
  assert.ok(m.flags.some((f) => f.code === 'cuts_exceed_pool'));
  assert.equal(m.shares.reduce((s, x) => s + x.amountMinor, 0), 800000);
});

test('failed orders get cancelled shares and no synthetic payments', () => {
  const m = mapLegacyEntries([adv({ status: 'Failed', sourcePaid: true, boosterPaid: true })]);
  assert.ok(m.shares.every((s) => s.state === 'cancelled'));
  assert.equal(m.payments.length, 0);
});

test('USD orders are flagged approximate; amounts are stored in cents', () => {
  const m = mapLegacyEntries([adv({ currency: 'USD', pot: 100.5, income: 40.25, teammateCuts: { Ali: '30', Sara: '30.25' } })]);
  assert.equal(m.orders[0].grossMinor, 10050);
  assert.ok(m.flags.some((f) => f.code === 'approximate_rate'));
});

test('booster profile: expenses become out-payments, team pot gives teammate shares', () => {
  const m = mapLegacyEntries(
    [
      { id: 'e1', title: 'Repair', currency: 'GOLD', income: -5000, status: 'Paid', dateTime: '2026-09-02T10:00' },
      { id: 'j1', title: 'Raid', currency: 'GOLD', income: 6000, pot: 10000, teamMode: true, teammates: ['Zed'], teammateCuts: { Zed: '4000' }, status: 'Paid', dateTime: '2026-09-03T10:00', exchangeRate: 3200, rateUnit: '1k' },
    ],
    { profile: 'booster' },
  );
  assert.equal(m.orders.length, 1);
  assert.equal(m.payments.find((p) => p.kind === 'expense').amountMinor, 5000);
  assert.equal(orderMarginMinor(ctxOf(m), m.orders[0]), 6000);
  assert.equal(m.shares[0].amountMinor, 4000);
});

test('mapping is deterministic, idempotent in ids, and does not mutate input', () => {
  const input = [adv(), adv({ id: 'job_2', teammates: ['Reza'], teammateCuts: { Reza: '600000' } })];
  const snapshot = JSON.stringify(input);
  const a = mapLegacyEntries(input);
  const b = mapLegacyEntries(JSON.parse(snapshot));
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(a, b);
  const ids = [...a.orders, ...a.shares, ...a.payments, ...a.allocations].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
});

// Randomized invariant: for every non-failed advertiser order, either the derived margin equals the legacy
// income, or the order is flagged for review. No silent change of anyone's profit.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('randomized: margin is preserved or the order is flagged', () => {
  const r = rng(42);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const entries = [];
  for (let i = 0; i < 400; i++) {
    const currency = pick(['TOMAN', 'GOLD', 'USD', 'EUR', 'WOW_GOLD', 'BOGUS']);
    const pot = r() < 0.15 ? null : Math.round(r() * 1e6) / (currency === 'USD' || currency === 'EUR' ? 100 : 1);
    const income = pot === null ? Math.round(r() * 1e5) : Math.round(r() * (pot || 1) * 100) / 100;
    const names = Array.from({ length: Math.floor(r() * 4) }, () => pick(['Ali', 'ali', 'Sara', 'رضا', ' Zed ', '']));
    const cuts = {};
    for (const n of names) if (r() < 0.6) cuts[n] = String(Math.round(r() * (pot || 1) * 0.5));
    entries.push({
      id: `j${i}`, title: 't', currency, pot, income, teammates: names, teammateCuts: cuts,
      status: pick(['Paid', 'Pending', 'Working', 'On Hold', 'Failed']),
      source: pick(['G2G', '', 'FunPay', 'Some Client']), dateTime: '2026-08-01T00:00',
      sourcePaid: r() < 0.5, boosterPaid: r() < 0.5, exchangeRate: 3200, rateUnit: '1k',
    });
  }
  const m = mapLegacyEntries(entries);
  const ctx = ctxOf(m);
  const flagged = (id, ...codes) => m.flags.some((f) => f.orderId === id && codes.includes(f.code));
  let checked = 0;
  for (const e of entries) {
    if (e.status === 'Failed') continue;
    const order = ctx.orderById.get(`ord_${e.id}`);
    assert.ok(order, `order missing for ${e.id}`);
    const margin = orderMarginMinor(ctx, order);
    const legacy = toMinor(e.income, order.currency);
    // cuts typed to the cent may leave up to one unit per booster of rounding dust; anything larger must be flagged
    const dust = Math.max(1, new Set((e.teammates || []).map((n) => String(n).trim().toLowerCase()).filter(Boolean)).size);
    if (Math.abs(margin - legacy) > dust) {
      assert.ok(flagged(order.id, 'cuts_exceed_pool', 'missing_pot'), `${e.id}: margin ${margin} != income ${legacy} and not flagged`);
    } else checked++;
  }
  assert.ok(checked > 200, 'most orders should preserve margin exactly');
  // no payment may be applied beyond what it holds, and no share applied beyond its amount
  const consumed = new Map();
  for (const a of m.allocations) consumed.set(a.paymentId, (consumed.get(a.paymentId) || 0) + a.consumedMinor);
  for (const p of m.payments) assert.ok((consumed.get(p.id) || 0) <= p.amountMinor);
});

test('platform fee from the old calculator becomes the fee, not an Unassigned booster', () => {
  // G2G 10% of 1,000,000 = 100,000; boosters 300k + 300k; advertiser kept 300k. pot - income = 700k.
  const m = mapLegacyEntries([adv({ pot: 1000000, income: 300000, platformFee: 10, teammateCuts: { Ali: '300000', Sara: '300000' } })]);
  const ctx = ctxOf(m);
  assert.equal(m.orders[0].platformFeeMinor, 100000);
  assert.equal(m.shares.some((s) => s.partyId === UNASSIGNED_PARTY_ID), false);
  assert.equal(orderMarginMinor(ctx, m.orders[0]), 300000);
  assert.deepEqual(m.flags, []);
});

test('platform fee with no stored cuts: even split is taken after the fee', () => {
  const m = mapLegacyEntries([adv({ pot: 1000000, income: 300000, platformFee: 10, teammateCuts: {} })]);
  const ctx = ctxOf(m);
  assert.equal(m.orders[0].platformFeeMinor, 100000);
  assert.deepEqual(m.shares.map((s) => s.amountMinor), [300000, 300000]);
  assert.equal(orderMarginMinor(ctx, m.orders[0]), 300000);
});

test('a collected order with a platform fee is collected for the net amount', () => {
  const m = mapLegacyEntries([adv({ pot: 1000000, income: 300000, platformFee: 10, status: 'Paid', sourcePaid: true })]);
  const ctx = ctxOf(m);
  assert.equal(orderMoneyState(ctx, m.orders[0]).collected, true);
  assert.equal(m.payments.find((p) => p.direction === 'in').amountMinor, 900000);
});
