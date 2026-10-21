import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore, LedgerValidationError } from '../src/lib/ledger/ledgerStore.js';
import { markOrderCollected, markSharePaid, receivePayout, previewReceivePayout, undoPaid, settleUp } from '../src/lib/ledger/actions.js';
import { buildContext, orderMoneyState, partyBalance, expensesByCurrency, paymentsAppliedTo } from '../src/lib/ledger/engine.js';
import { bucketsByCurrency } from '../src/lib/ledger/money.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  return store;
}
const job = (id, over) => ({ id, lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 0, payerId: 'g', dateTime: '2026-09-01T00:00:00Z', title: id, ...over });
const collected = async (store, id) => { const c = await store.loadContext(); return orderMoneyState(c, c.orderById.get(id)).collected; };

test('undoing "mark paid" brings the job back to unpaid, keeps the history, and can be repeated', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: job('j1'), shares: [] });
  await markOrderCollected(store, 'j1', { rates: RATES });
  assert.equal(await collected(store, 'j1'), true);
  await undoPaid(store, 'order', 'j1');
  assert.equal(await collected(store, 'j1'), false);
  const data = await store.loadAll();
  assert.equal(data.payments.length, 2); // the payment and its void marker are both kept
  await markOrderCollected(store, 'j1', { rates: RATES }); // a misclick can be redone correctly
  assert.equal(await collected(store, 'j1'), true);
  assert.deepEqual(await store.integrityReport(), []);
});

test('undo only reverses the latest payment when a job was paid in parts', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: job('j1'), shares: [] });
  await receivePayout(store, { payerId: 'g', amountMinor: 400000, currency: 'TOMAN', rates: RATES });
  await receivePayout(store, { payerId: 'g', amountMinor: 600000, currency: 'TOMAN', rates: RATES });
  assert.equal(await collected(store, 'j1'), true);
  await undoPaid(store, 'order', 'j1');
  const c = await store.loadContext();
  const st = orderMoneyState(c, c.orderById.get('j1'));
  assert.equal(st.receivedMinor, 400000);
  assert.equal(st.partlyCollected, true);
});

test('a job paid as part of a bigger payout is not silently un-paid, and the whole payout can be voided', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: job('j1', { dateTime: '2026-09-01T00:00:00Z' }), shares: [] });
  await store.saveOrder({ order: job('j2', { dateTime: '2026-09-02T00:00:00Z' }), shares: [] });
  const lump = await receivePayout(store, { payerId: 'g', amountMinor: 2000000, currency: 'TOMAN', rates: RATES });
  await assert.rejects(undoPaid(store, 'order', 'j1'), LedgerValidationError);
  assert.equal(await collected(store, 'j2'), true, 'the other job was not touched');
  const applied = paymentsAppliedTo(await store.loadContext(), 'order', 'j1');
  assert.equal(applied[0].exclusive, false);
  await store.voidPayment(lump.id);
  assert.equal(await collected(store, 'j1'), false);
  assert.equal(await collected(store, 'j2'), false);
});

test('undo on something never paid says so', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: job('j1'), shares: [] });
  await assert.rejects(undoPaid(store, 'order', 'j1'), /Nothing was paid/);
});

test('undoing a booster share payment restores what is owed', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: job('j1'), shares: [{ partyId: ali.id, amountMinor: 300000 }] });
  const share = (await store.loadAll()).shares[0];
  await markSharePaid(store, share.id, { rates: RATES });
  assert.deepEqual(partyBalance(await store.loadContext(), ali.id).payable, {});
  await undoPaid(store, 'share', share.id);
  assert.equal(bucketsByCurrency(partyBalance(await store.loadContext(), ali.id).payable).TOMAN, 300000);
  assert.deepEqual(partyBalance(await store.loadContext(), ali.id).advance, {});
});

test('undoing a payout that had a withdrawal fee removes the fee too', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: job('j1'), shares: [] });
  await receivePayout(store, { payerId: 'g', amountMinor: 1000000, feeMinor: 20000, currency: 'TOMAN', rates: RATES });
  assert.equal(bucketsByCurrency(expensesByCurrency(await store.loadContext())).TOMAN, 20000);
  await undoPaid(store, 'order', 'j1');
  assert.equal(bucketsByCurrency(expensesByCurrency(await store.loadContext())).TOMAN, undefined);
});

test('payment received settles finished jobs before jobs still in progress, even when the unfinished one is older', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: job('old_working', { lifecycle: 'working', dateTime: '2026-08-01T00:00:00Z' }), shares: [] });
  await store.saveOrder({ order: job('newer_done', { dateTime: '2026-09-15T00:00:00Z' }), shares: [] });
  const ctx = await store.loadContext();
  const preview = previewReceivePayout(ctx, { payerId: 'g', amountMinor: 1000000, currency: 'TOMAN', rates: RATES });
  assert.deepEqual(preview.allocations.map((a) => a.targetId), ['newer_done']);
  await receivePayout(store, { payerId: 'g', amountMinor: 1000000, currency: 'TOMAN', rates: RATES });
  assert.equal(await collected(store, 'newer_done'), true);
  assert.equal(await collected(store, 'old_working'), false);
});

test('"mark paid" on one job and "payment received" for the payer always agree: marking a job already covered is refused', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: job('j1', { dateTime: '2026-09-01T00:00:00Z' }), shares: [] });
  await store.saveOrder({ order: job('j2', { dateTime: '2026-09-02T00:00:00Z' }), shares: [] });
  await receivePayout(store, { payerId: 'g', amountMinor: 1000000, currency: 'TOMAN', rates: RATES }); // covers j1 (oldest)
  await assert.rejects(markOrderCollected(store, 'j1', { rates: RATES }), /Already collected/);
  await markOrderCollected(store, 'j2', { rates: RATES });
  assert.equal(await collected(store, 'j1'), true);
  assert.equal(await collected(store, 'j2'), true);
  void settleUp;
});
