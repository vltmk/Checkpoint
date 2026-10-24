// Closing a short payment: the shortfall clears the order, but it is not cash and it is not credit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { receivePayout, writeOffOrder } from '../src/lib/ledger/actions.js';
import { orderReceivedMinor, payerCreditBuckets, writtenOffByOrder } from '../src/lib/ledger/engine.js';
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
