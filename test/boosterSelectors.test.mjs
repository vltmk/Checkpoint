import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { buildContext, orderTargetsFor, allocateFifo } from '../src/lib/ledger/engine.js';
import { receivePayout, markOrderCollected } from '../src/lib/ledger/actions.js';
import { payerList, payerStatement, boosterOverview } from '../src/lib/ledger/boosterSelectors.js';
import { mapLegacyEntries, UNKNOWN_PAYER_ID } from '../src/lib/ledger/legacyMapper.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const NOW = Date.parse('2026-10-21T12:00:00Z');
const monthKey = (iso) => String(iso || '').slice(0, 7);
const DAY = 86400000;
const iso = (d) => new Date(NOW - d * DAY).toISOString();

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  return store;
}
const job = (id, over) => ({ id, lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 0, payerId: null, dateTime: iso(1), title: id, ...over });

async function world() {
  const store = await makeStore();
  const guild = await store.ensureParty('client', 'Guild');
  const adv = await store.ensureParty('client', 'Advertiser Joe');
  await store.saveOrder({ order: job('j1', { payerId: guild.id, dateTime: iso(12), grossMinor: 2000000 }), shares: [] }); // done, unpaid, 12 days old
  await store.saveOrder({ order: job('j2', { payerId: guild.id, dateTime: iso(3), grossMinor: 500000 }), shares: [] }); // done, unpaid
  await store.saveOrder({ order: job('j3', { payerId: adv.id, lifecycle: 'working', dateTime: iso(0), grossMinor: 700000 }), shares: [] }); // in progress
  await store.saveOrder({ order: job('j4', { payerId: null, dateTime: iso(2), grossMinor: 300000 }), shares: [] }); // no payer, unpaid
  await markOrderCollected(store, 'j2', { rates: RATES });
  return { store, guild, adv };
}

test('who owes me: finished unpaid jobs are owed, work in progress is shown separately', async () => {
  const { store } = await world();
  const data = await store.loadAll();
  const rows = payerList(buildContext(data), data.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  const guild = rows.find((r) => r.party.name === 'Guild');
  assert.equal(guild.owedMinor, 2000000); // j1 unpaid; j2 was collected
  assert.equal(guild.collectedMinor, 500000);
  assert.equal(guild.agingDays, 12);
  const adv = rows.find((r) => r.party.name === 'Advertiser Joe');
  assert.equal(adv.owedMinor, 0);
  assert.equal(adv.progressMinor, 700000);
  const none = rows.find((r) => r.key === '');
  assert.equal(none.owedMinor, 300000);
  assert.equal(rows[0].party.name, 'Guild'); // biggest debt first
});

test('a client statement runs a balance: finished jobs add, payments subtract, in-progress jobs wait', async () => {
  const { store, guild } = await world();
  const data = await store.loadAll();
  const st = payerStatement(buildContext(data), guild.id, { rates: RATES, displayCurrency: 'TOMAN' });
  assert.deepEqual(st.events.map((e) => e.type), ['job', 'job', 'payment']);
  assert.equal(st.owedMinor, 2000000);
  assert.equal(st.balanceMinor, 2000000);
  assert.equal(st.events.at(-1).runningMinor, 2000000);
  const adv = data.parties.find((p) => p.name === 'Advertiser Joe');
  const st2 = payerStatement(buildContext(data), adv.id, { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(st2.owedMinor, 0);
  assert.equal(st2.progressMinor, 700000);
  assert.equal(st2.balanceMinor, 0);
});

test('the no-payer bucket is one thing: unknown-placeholder orders and payer-less orders group together', () => {
  const m = mapLegacyEntries([{ id: 'x', title: 't', currency: 'TOMAN', income: 400000, status: 'Pending', source: '', dateTime: '2026-10-01T00:00' }], { profile: 'booster' });
  assert.equal(m.orders[0].payerId, UNKNOWN_PAYER_ID);
  const ctx = buildContext({ ...m, parties: m.parties });
  const rows = payerList(ctx, m.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, '');
  assert.equal(rows[0].owedMinor, 400000);
});

test('overview: owed now, this month earned and spent, and net', async () => {
  const { store } = await world();
  await store.recordPayment({ payment: { direction: 'out', partyId: null, amountMinor: 120000, currency: 'TOMAN', kind: 'expense', dateTime: iso(2), note: 'repair' } });
  await store.recordPayment({ payment: { direction: 'out', partyId: null, amountMinor: 999999, currency: 'TOMAN', kind: 'expense', dateTime: '2026-08-01T00:00:00Z', note: 'old' } });
  const data = await store.loadAll();
  const ov = boosterOverview(buildContext(data), data.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW, monthKey });
  assert.equal(ov.owedMinor, 2300000); // j1 2.0M + j4 0.3M (j2 is collected)
  assert.equal(ov.progressMinor, 700000);
  assert.equal(ov.earnedMinor, 3500000 - 0); // all four jobs are in October: 2.0+0.5+0.7+0.3
  assert.equal(ov.spentMinor, 120000);
  assert.equal(ov.keptMinor, 3380000);
  assert.equal(ov.allTimeSpentMinor, 1119999);
  assert.equal(ov.jobsThisMonth, 4);
  assert.equal(ov.oldestDays, 12);
  assert.ok(ov.attention.some((a) => a.type === 'client_overdue' && a.days === 12));
  assert.ok(ov.recentPayments.some((p) => p.kind === 'expense' && p.note === 'repair'));
  assert.ok(ov.recentPayments.some((p) => p.direction === 'in'));
});

test('overview with a team split: what I keep excludes teammates, and I can see what I owe them', async () => {
  const store = await makeStore();
  const t = await store.ensureParty('booster', 'Teammate');
  await store.saveOrder({ order: job('t1', { grossMinor: 1000000 }), shares: [{ partyId: t.id, amountMinor: 400000 }] });
  const data = await store.loadAll();
  const ov = boosterOverview(buildContext(data), data.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW, monthKey });
  assert.equal(ov.earnedMinor, 600000);
  assert.equal(ov.teamOwedMinor, 400000);
  assert.equal(ov.owedMinor, 1000000); // the client owes the full pot
});

test('receiving a payment from "no payer" works and clears those jobs', async () => {
  const { store } = await world();
  const ctx = buildContext(await store.loadAll());
  const t = orderTargetsFor(ctx, '');
  assert.deepEqual(t.map((x) => x.id), ['j4']);
  await receivePayout(store, { payerId: '', amountMinor: 300000, currency: 'TOMAN', rates: RATES });
  const data = await store.loadAll();
  const pay = data.payments.find((p) => p.amountMinor === 300000);
  assert.equal(pay.partyId, null);
  const ov = boosterOverview(buildContext(data), data.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW, monthKey });
  assert.equal(ov.owedMinor, 2000000);
  void allocateFifo;
});

test('amounts in other currencies convert at the locked or current rate and mark the result approximate', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: job('g1', { currency: 'GOLD', grossMinor: 500, exchangeRate: 7000, rateUnit: '1' }), shares: [] });
  await store.saveOrder({ order: job('u1', { currency: 'USD', grossMinor: 1000, dateTime: iso(1) }), shares: [] });
  const data = await store.loadAll();
  const ov = boosterOverview(buildContext(data), data.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW, monthKey });
  assert.equal(ov.owedMinor, 500 * 7000 + 10 * 100000);
  assert.equal(ov.isApproximate, true);
});
