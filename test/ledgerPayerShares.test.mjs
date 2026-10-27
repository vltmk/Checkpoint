// A teammate the client pays directly ("paidBy: 'payer'"): it lowers my margin, is never a debt of mine,
// and lowers what the client owes me. Shares without the field keep today's "I pay them" behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore, LedgerValidationError } from '../src/lib/ledger/ledgerStore.js';
import { buildContext, orderMarginMinor, orderMoneyState, orderReceivableMinor, partyBalance } from '../src/lib/ledger/engine.js';
import { markOrderCollected, markSharePaid } from '../src/lib/ledger/actions.js';
import { boosterOverview, payerList } from '../src/lib/ledger/boosterSelectors.js';
import { peopleList } from '../src/lib/ledger/selectors.js';
import { sanitizeRow } from '../src/lib/ledger/ledgerSchema.js';
import { ledgerFingerprint } from '../src/lib/ledger/backup.js';
import { buildReceipt } from '../src/lib/ledger/receipt.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const NOW = Date.parse('2026-10-21T12:00:00Z');
const monthKey = (iso) => String(iso || '').slice(0, 7);

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  return store;
}

const job = (id, over) => ({ id, lifecycle: 'done', currency: 'USD', grossMinor: 10000, platformFeeMinor: 0, payerId: null, dateTime: '2026-10-20T10:00:00Z', title: id, ...over });

async function world() {
  const store = await makeStore();
  const client = await store.ensureParty('client', 'Client');
  const reza = await store.ensureParty('booster', 'Reza');
  const sara = await store.ensureParty('booster', 'Sara');
  // $100 job: Reza is paid by the client ($30), Sara is paid by me ($20), I keep $50
  await store.saveOrder({
    order: job('j1', { payerId: client.id }),
    shares: [
      { partyId: reza.id, amountMinor: 3000, paidBy: 'payer' },
      { partyId: sara.id, amountMinor: 2000 },
    ],
  });
  return { store, client, reza, sara };
}

test('a client-paid teammate lowers my margin and what the client owes, but is no debt of mine', async () => {
  const { store, reza, sara } = await world();
  const data = await store.loadAll();
  const ctx = buildContext(data);
  const order = ctx.orderById.get('j1');
  assert.equal(orderMarginMinor(ctx, order), 5000);
  assert.equal(orderReceivableMinor(order, ctx), 7000); // the client hands Reza his $30 themselves
  assert.equal(orderReceivableMinor(order), 10000); // without a context the payer shares are unknown
  const money = orderMoneyState(ctx, order);
  assert.equal(money.receivableMinor, 7000);
  assert.equal(money.shareTotalMinor, 5000);
  assert.equal(money.payerShareMinor, 3000);
  assert.equal(money.sharePaidMinor, 3000); // Reza counts as settled, Sara does not
  assert.equal(money.boostersPaid, false);
  assert.deepEqual(partyBalance(ctx, reza.id).payable, {});
  assert.equal(Object.values(partyBalance(ctx, sara.id).payable)[0], 2000);
});

test('collecting the order takes only what the client owes me; Reza can never be "paid" by me', async () => {
  const { store, client, reza } = await world();
  await markOrderCollected(store, 'j1', { rates: RATES });
  const data = await store.loadAll();
  const ctx = buildContext(data);
  assert.equal(orderMoneyState(ctx, ctx.orderById.get('j1')).collected, true);
  const payment = data.payments.find((p) => p.direction === 'in');
  assert.equal(payment.amountMinor, 7000);
  const rezaShare = data.shares.find((s) => s.partyId === reza.id);
  await assert.rejects(() => markSharePaid(store, rezaShare.id, { rates: RATES }), LedgerValidationError);
  const row = payerList(ctx, data.parties, { rates: RATES, displayCurrency: 'USD', now: NOW }).find((r) => r.party.id === client.id);
  assert.equal(row.owedMinor, 0);
});

test('the team list and the overview only count teammates I pay', async () => {
  const { store, reza, sara } = await world();
  const data = await store.loadAll();
  const ctx = buildContext(data);
  const people = peopleList(ctx, data.parties, { rates: RATES, displayCurrency: 'USD', now: NOW });
  assert.equal(people.find((p) => p.party.id === reza.id).totalOrders, 0);
  assert.equal(people.find((p) => p.party.id === sara.id).display.owedNowMinor, 2000);
  const ov = boosterOverview(ctx, data.parties, { rates: RATES, displayCurrency: 'USD', now: NOW, monthKey });
  assert.equal(ov.owedMinor, 7000);
  assert.equal(ov.teamOwedMinor, 2000);
  assert.equal(ov.teamOnOwedMinor, 2000); // Sara's cut of the $70 still to come
  assert.equal(ov.earnedMinor, 5000);
});

test('shares saved before the field existed keep the "I pay them" behaviour', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: job('j2'), shares: [{ partyId: ali.id, amountMinor: 4000 }] });
  const data = await store.loadAll();
  const ctx = buildContext(data);
  assert.equal(data.shares[0].paidBy ?? null, null);
  assert.equal(orderReceivableMinor(ctx.orderById.get('j2'), ctx), 10000);
  assert.equal(Object.values(partyBalance(ctx, ali.id).payable)[0], 4000);
});

test('switching a teammate I already paid to "client pays" is refused', async () => {
  const { store, sara, reza } = await world();
  const sharaShare = (await store.loadAll()).shares.find((s) => s.partyId === sara.id);
  await markSharePaid(store, sharaShare.id, { rates: RATES });
  await assert.rejects(
    () => store.saveOrder({ order: job('j1'), shares: [{ partyId: reza.id, amountMinor: 3000, paidBy: 'payer' }, { partyId: sara.id, amountMinor: 2000, paidBy: 'payer' }] }),
    LedgerValidationError,
  );
});

test('client-paid teammates cannot add up to more than the job', async () => {
  const store = await makeStore();
  const a = await store.ensureParty('booster', 'A');
  await assert.rejects(() => store.saveOrder({ order: job('j3'), shares: [{ partyId: a.id, amountMinor: 20000, paidBy: 'payer' }] }), LedgerValidationError);
});

test('backups keep who pays a teammate, drop junk values, and the fingerprint notices the change', async () => {
  const row = sanitizeRow('order_shares', { id: 's1', orderId: 'o1', partyId: 'p1', amountMinor: 5, state: 'open', paidBy: 'payer' });
  assert.equal(row.paidBy, 'payer');
  assert.equal(sanitizeRow('order_shares', { id: 's2', orderId: 'o1', partyId: 'p1', amountMinor: 5, state: 'open', paidBy: 'everyone' }).paidBy, null);
  const base = { parties: [], orders: [], shares: [{ id: 's1', amountMinor: 5, state: 'open' }], payments: [], allocations: [] };
  const flipped = { ...base, shares: [{ id: 's1', amountMinor: 5, state: 'open', paidBy: 'payer' }] };
  assert.notEqual(ledgerFingerprint(base), ledgerFingerprint(flipped));
});

test('after voiding the payment, a teammate I had paid can be switched to "client pays"', async () => {
  const { store, sara, reza } = await world();
  const saraShare = (await store.loadAll()).shares.find((s) => s.partyId === sara.id);
  const payment = await markSharePaid(store, saraShare.id, { rates: RATES });
  await store.voidPayment(payment.id, 'wrong');
  await store.saveOrder({ order: job('j1', { payerId: (await store.loadAll()).orders[0].payerId }), shares: [{ partyId: reza.id, amountMinor: 3000, paidBy: 'payer' }, { partyId: sara.id, amountMinor: 2000, paidBy: 'payer' }] });
  const data = await store.loadAll();
  assert.equal(data.shares.filter((s) => s.paidBy === 'payer').length, 2);
});

test('the receipt shows a client-paid teammate as settled, and money allocated to one is credit, not lost', async () => {
  const { store, reza } = await world();
  const data = await store.loadAll();
  const vm = buildReceipt(data, 'j1');
  assert.equal(vm.shares.find((s) => s.name === 'Reza').paid, true);
  assert.equal(vm.shares.find((s) => s.name === 'Sara').paid, false);
  // a backup can bring in an allocation that points at a client-paid share: the money returns as credit
  const share = data.shares.find((s) => s.partyId === reza.id);
  const payment = { id: 'pay_x', direction: 'out', partyId: reza.id, amountMinor: 3000, currency: 'USD', kind: 'settlement', dateTime: '2026-10-21T00:00:00Z' };
  const ctx = buildContext({ ...data, payments: [payment], allocations: [{ id: 'al_x', paymentId: 'pay_x', targetType: 'share', targetId: share.id, appliedMinor: 3000, consumedMinor: 3000 }] });
  assert.equal(Object.values(partyBalance(ctx, reza.id).advance)[0], 3000);
});
