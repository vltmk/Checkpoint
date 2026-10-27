// Closing a short payment: the shortfall clears the order, but it is not cash and it is not credit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { receivePayout, writeOffOrder } from '../src/lib/ledger/actions.js';
import { canCloseShort, orderReceivedMinor, payerCreditBuckets, writtenOffByOrder } from '../src/lib/ledger/engine.js';
import { payerList } from '../src/lib/ledger/boosterSelectors.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap), { now: () => '2026-10-01T00:00:00.000Z' });
  await store.init();
  return store;
}

// A finished order worth 900,000 Toman to us (1,000,000 gross less a 100,000 fee), with 300,000 owed to a booster.
async function scenario(store) {
  const g2g = await store.ensureParty('platform', 'G2G');
  const ali = await store.ensureParty('booster', 'Ali');
  const order = { id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: g2g.id, dateTime: '2026-09-01T10:00:00Z', title: 'o1' };
  await store.saveOrder({ order, shares: [{ partyId: ali.id, amountMinor: 300000 }] });
  return { g2g, ali };
}

test('a shortfall written off clears the order, but is not cash and not credit', async () => {
  const store = await makeStore();
  const { g2g, ali } = await scenario(store);
  await receivePayout(store, { payerId: g2g.id, amountMinor: 500000, currency: 'TOMAN', rates: RATES });
  await writeOffOrder(store, 'o1', { rates: RATES, note: 'G2G released less' });

  const ctx = await store.loadContext();
  assert.equal(writtenOffByOrder(ctx).get('o1'), 400000, 'the 400,000 shortfall is recorded as written off');
  assert.equal(orderReceivedMinor(ctx, 'o1'), 900000, 'the order is now fully settled');
  assert.deepEqual(payerCreditBuckets(ctx, g2g.id), {}, 'a write-off is never credit with the payer');

  const list = payerList(ctx, [g2g, ali], { rates: RATES, displayCurrency: 'TOMAN', now: Date.parse('2026-10-20T00:00:00Z') });
  const row = list.find((r) => r.key === g2g.id);
  assert.equal(row.collectedMinor, 500000, 'collected counts only the cash that arrived');
  assert.equal(row.owedMinor, 0, 'nothing is owed once it is closed short');
});

test('closing short twice is refused, and voiding the write-off reopens what was owed', async () => {
  const store = await makeStore();
  const { g2g } = await scenario(store);
  await receivePayout(store, { payerId: g2g.id, amountMinor: 500000, currency: 'TOMAN', rates: RATES });
  await writeOffOrder(store, 'o1', { rates: RATES });
  await assert.rejects(() => writeOffOrder(store, 'o1', { rates: RATES }), /Nothing is left to close/);

  const writeOffId = (await store.loadContext()).payments.find((p) => p.kind === 'writeoff').id;
  await store.voidPayment(writeOffId, 'closed by mistake');
  const ctx = await store.loadContext();
  assert.equal(orderReceivedMinor(ctx, 'o1'), 500000, 'voiding it gives the 400,000 back as outstanding');
  assert.equal(writtenOffByOrder(ctx).get('o1') || 0, 0);
});

test('voiding a payout also voids every fee layer booked on it', async () => {
  const store = await makeStore();
  const { g2g } = await scenario(store);
  const payout = await receivePayout(store, {
    payerId: g2g.id, amountMinor: 500000, currency: 'TOMAN', rates: RATES,
    feeLines: [{ label: 'Platform', feeMinor: 50000 }, { label: 'Bank', feeMinor: 5000 }],
  });
  let ctx = await store.loadContext();
  assert.equal(ctx.effectivePayments.filter((p) => p.kind === 'expense').length, 2, 'both layers are booked');

  await store.voidPayment(payout.id, 'undone');
  ctx = await store.loadContext();
  assert.equal(ctx.effectivePayments.filter((p) => p.kind === 'expense').length, 0, 'no fee layer survives the void');
  assert.equal(orderReceivedMinor(ctx, 'o1'), 0, 'the order is owed again');
});

test('Close short is only offered on a finished order a payout has partly paid', async () => {
  const store = await makeStore();
  const g2g = await store.ensureParty('platform', 'G2G');
  const base = { lifecycle: 'done', currency: 'TOMAN', grossMinor: 900000, platformFeeMinor: 0, payerId: g2g.id, title: 't' };
  await store.saveOrder({ order: { ...base, id: 'o1', dateTime: '2026-09-01T10:00:00Z' }, shares: [] });
  await store.saveOrder({ order: { ...base, id: 'o2', dateTime: '2026-09-02T10:00:00Z' }, shares: [] }); // left out of the payout
  await store.saveOrder({ order: { ...base, id: 'o3', dateTime: '2026-09-03T10:00:00Z', lifecycle: 'working' }, shares: [] });
  // the payout covers part of o1 only; o2 was unticked, so nothing is applied to it
  await receivePayout(store, { payerId: g2g.id, amountMinor: 500000, currency: 'TOMAN', rates: RATES, excludeIds: ['o2'] });
  let ctx = await store.loadContext();
  assert.equal(canCloseShort(ctx, ctx.orderById.get('o1')), true, 'partly paid: the payer paid less than it was written for');
  assert.equal(canCloseShort(ctx, ctx.orderById.get('o2')), false, 'untouched by the payout: it is just waiting');
  assert.equal(canCloseShort(ctx, ctx.orderById.get('o3')), false, 'not finished yet');
  // once closed short it is settled, so there is nothing left to close
  await writeOffOrder(store, 'o1', { rates: RATES });
  ctx = await store.loadContext();
  assert.equal(canCloseShort(ctx, ctx.orderById.get('o1')), false);
  // a failed order is never offered, even with money on it
  await store.setLifecycle('o2', 'failed');
  ctx = await store.loadContext();
  assert.equal(canCloseShort(ctx, ctx.orderById.get('o2')), false);
});

test('Orders tabs: a finished order stays Active until it is paid both ways, then moves to Done', async () => {
  const { orderRows, orderTab, isUnsettled } = await import('../src/lib/ledger/selectors.js');
  const { markSharePaid, markOrderCollected } = await import('../src/lib/ledger/actions.js');
  const store = await makeStore();
  await scenario(store); // o1: done, 900,000 to collect, 300,000 owed to Ali
  const tab = async () => {
    const data = await store.loadAll();
    const ctx = await store.loadContext();
    const row = orderRows(ctx, new Map(data.parties.map((p) => [p.id, p]))).find((r) => r.order.id === 'o1');
    return { tab: orderTab(row), unsettled: isUnsettled(row) };
  };
  assert.deepEqual(await tab(), { tab: 'active', unsettled: true }, 'nothing paid yet');
  await markOrderCollected(store, 'o1', { rates: RATES });
  assert.deepEqual(await tab(), { tab: 'active', unsettled: true }, 'collected, but Ali is still owed');
  const share = (await store.loadAll()).shares[0];
  await markSharePaid(store, share.id, { rates: RATES });
  assert.deepEqual(await tab(), { tab: 'done', unsettled: false }, 'paid both ways');
  await store.setLifecycle('o1', 'working');
  assert.equal((await tab()).tab, 'active', 'work in progress is Active whatever the money says');
  await store.setLifecycle('o1', 'failed');
  assert.deepEqual(await tab(), { tab: 'closed', unsettled: false }, 'failed orders only show under All');
});
