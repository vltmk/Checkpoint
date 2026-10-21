// Money workflows end to end on real SQLite: the G2G middleman case and cross-currency payouts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { settleUp, addAdvance, receivePayout, markSharePaid, markOrderCollected, previewSettleUp } from '../src/lib/ledger/actions.js';
import { partyBalance, exposureByCurrency, orderMoneyState, payerReceivables } from '../src/lib/ledger/engine.js';
import { bucketsByCurrency } from '../src/lib/ledger/money.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap), { now: () => '2026-10-01T00:00:00.000Z' });
  await store.init();
  return store;
}

async function g2gScenario(store) {
  const g2g = await store.ensureParty('platform', 'G2G');
  const ali = await store.ensureParty('booster', 'Ali');
  const sara = await store.ensureParty('booster', 'Sara');
  const mk = (id, day, gross, fee) => ({ id, lifecycle: 'done', currency: 'TOMAN', grossMinor: gross, platformFeeMinor: fee, payerId: g2g.id, dateTime: `2026-09-0${day}T10:00:00Z`, title: id });
  await store.saveOrder({ order: mk('o1', 1, 1000000, 100000), shares: [{ partyId: ali.id, amountMinor: 300000 }, { partyId: sara.id, amountMinor: 200000 }] });
  await store.saveOrder({ order: mk('o2', 2, 500000, 50000), shares: [{ partyId: ali.id, amountMinor: 250000 }] });
  return { g2g, ali, sara };
}

test('one lump to Ali covers two works; the leftover is advance credit', async () => {
  const store = await makeStore();
  const { ali } = await g2gScenario(store);
  await settleUp(store, { partyId: ali.id, amountMinor: 600000, currency: 'TOMAN', rates: RATES });
  const bal = partyBalance(await store.loadContext(), ali.id);
  assert.deepEqual(bal.payable, {});
  assert.equal(bucketsByCurrency(bal.advance).TOMAN, 50000);
});

test('previewSettleUp matches what settleUp writes, and excluded works are skipped', async () => {
  const store = await makeStore();
  const { ali } = await g2gScenario(store);
  const ctx = await store.loadContext();
  const first = ctx.shares.find((s) => s.orderId === 'o1' && s.partyId === ali.id);
  const preview = previewSettleUp(ctx, { partyId: ali.id, amountMinor: 250000, currency: 'TOMAN', rates: RATES, excludeIds: [first.id] });
  assert.deepEqual(preview.allocations.map((a) => a.targetId), [ctx.shares.find((s) => s.orderId === 'o2').id]);
  await settleUp(store, { partyId: ali.id, amountMinor: 250000, currency: 'TOMAN', rates: RATES, excludeIds: [first.id] });
  assert.equal(bucketsByCurrency(partyBalance(await store.loadContext(), ali.id).payable).TOMAN, 300000);
});

test('paying a Toman amount against a USD work records the locked rates and applies at that rate', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: { id: 'u1', lifecycle: 'done', currency: 'USD', grossMinor: 10000, platformFeeMinor: 0, payerId: 'x', dateTime: '2026-09-01T10:00:00Z' }, shares: [{ partyId: ali.id, amountMinor: 5000 }] });
  const pay = await settleUp(store, { partyId: ali.id, amountMinor: 2000000, currency: 'TOMAN', rates: RATES });
  assert.equal(pay.rates.usdRateTOMAN, 100000);
  const bal = partyBalance(await store.loadContext(), ali.id);
  assert.equal(bucketsByCurrency(bal.payable).USD, 3000); // 20 USD paid of 50
});

test('advance first, work later: credit nets against what is owed', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await addAdvance(store, { partyId: ali.id, amountMinor: 100000, currency: 'TOMAN', rates: RATES });
  await store.saveOrder({ order: { id: 'a1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 500000, platformFeeMinor: 0, payerId: 'x', dateTime: '2026-09-01T10:00:00Z' }, shares: [{ partyId: ali.id, amountMinor: 300000 }] });
  const bal = partyBalance(await store.loadContext(), ali.id);
  assert.equal(bucketsByCurrency(bal.payable).TOMAN, 300000);
  assert.equal(bucketsByCurrency(bal.advance).TOMAN, 100000);
});

test('mark share paid pays exactly what is outstanding, once', async () => {
  const store = await makeStore();
  const { ali } = await g2gScenario(store);
  await settleUp(store, { partyId: ali.id, amountMinor: 100000, currency: 'TOMAN', rates: RATES });
  const share = (await store.loadAll()).shares.find((s) => s.orderId === 'o1' && s.partyId === ali.id);
  const pay = await markSharePaid(store, share.id, { rates: RATES });
  assert.equal(pay.amountMinor, 200000);
  await assert.rejects(markSharePaid(store, share.id, { rates: RATES }));
});

test('G2G middleman: boosters paid first, then one platform payout with a withdrawal fee clears exposure', async () => {
  const store = await makeStore();
  const { g2g, ali, sara } = await g2gScenario(store);
  await settleUp(store, { partyId: ali.id, amountMinor: 550000, currency: 'TOMAN', rates: RATES });
  await settleUp(store, { partyId: sara.id, amountMinor: 200000, currency: 'TOMAN', rates: RATES });
  assert.equal(bucketsByCurrency(exposureByCurrency(await store.loadContext())).TOMAN, 750000);

  await receivePayout(store, { payerId: g2g.id, amountMinor: 1350000, currency: 'TOMAN', rates: RATES, feeMinor: 20000 });
  const ctx = await store.loadContext();
  assert.equal(bucketsByCurrency(exposureByCurrency(ctx)).TOMAN, undefined);
  assert.ok(ctx.orders.every((o) => orderMoneyState(ctx, o).collected));
  const r = payerReceivables(ctx, g2g.id, Date.parse('2026-10-01'));
  assert.deepEqual(r.held, {});
  assert.deepEqual(r.releasable, {});
  const fee = ctx.effectivePayments.find((p) => p.kind === 'expense');
  assert.equal(fee.amountMinor, 20000);
});

test('a partial platform payout leaves the newest order partly collected', async () => {
  const store = await makeStore();
  const { g2g } = await g2gScenario(store);
  await receivePayout(store, { payerId: g2g.id, amountMinor: 1000000, currency: 'TOMAN', rates: RATES });
  const ctx = await store.loadContext();
  assert.equal(orderMoneyState(ctx, ctx.orderById.get('o1')).collected, true);
  assert.equal(orderMoneyState(ctx, ctx.orderById.get('o2')).partlyCollected, true);
});

test('mark order collected is exact and cannot be repeated', async () => {
  const store = await makeStore();
  await g2gScenario(store);
  const pay = await markOrderCollected(store, 'o2', { rates: RATES });
  assert.equal(pay.amountMinor, 450000);
  await assert.rejects(markOrderCollected(store, 'o2', { rates: RATES }));
});

test('proofs attach to payments and orders, only as images, and go away with the order', async () => {
  const store = await makeStore();
  const { ali } = await g2gScenario(store);
  const pay = await settleUp(store, { partyId: ali.id, amountMinor: 1, currency: 'TOMAN', rates: RATES });
  await store.addProof({ ownerType: 'payment', ownerId: pay.id, name: 'receipt.png', data: 'data:image/png;base64,AAAA' });
  await store.addProof({ ownerType: 'order', ownerId: 'o1', name: 'screen.png', data: 'data:image/png;base64,BBBB' });
  await assert.rejects(store.addProof({ ownerType: 'order', ownerId: 'o1', data: 'javascript:alert(1)' }));
  assert.equal((await store.listProofs('payment', pay.id)).length, 1);
  await store.deleteOrder('o1');
  assert.equal((await store.listProofs('order', 'o1')).length, 0);
  assert.equal((await store.listProofs('payment', pay.id)).length, 1);
});

test('export then import restores everything, including proofs and the version marker', async () => {
  const a = await makeStore();
  const { ali } = await g2gScenario(a);
  const pay = await settleUp(a, { partyId: ali.id, amountMinor: 300000, currency: 'TOMAN', rates: RATES });
  await a.addProof({ ownerType: 'payment', ownerId: pay.id, data: 'data:image/png;base64,AAAA' });
  await a.migrateLegacy([], { profile: 'advertiser' });
  const dump = JSON.parse(JSON.stringify(await a.exportAll()));
  const b = await makeStore();
  await b.importAll(dump);
  assert.deepEqual(await b.exportAll(), await a.exportAll());
  assert.equal(await b.getMeta('schemaVersion'), '2');
});

test('importing an old v1 backup into an upgraded ledger merges without overwriting', async () => {
  const store = await makeStore();
  await store.migrateLegacy([], { profile: 'advertiser' });
  const e = { id: 'job_9', title: 'Old', currency: 'TOMAN', pot: 500000, income: 100000, teammates: ['Reza'], teammateCuts: { Reza: '400000' }, status: 'Working', source: 'FunPay', dateTime: '2026-08-01T10:00', exchangeRate: 3200, rateUnit: '1k' };
  await store.importLegacyEntries([e], { profile: 'advertiser' });
  await store.saveOrder({ order: { ...(await store.loadAll()).orders[0], title: 'Edited by user' }, shares: [{ partyId: (await store.loadAll()).shares[0].partyId, amountMinor: 400000 }] });
  await store.importLegacyEntries([e], { profile: 'advertiser' });
  const data = await store.loadAll();
  assert.equal(data.orders.length, 1);
  assert.equal(data.orders[0].title, 'Edited by user');
});
