import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { computeWithdrawal, receivePayout, settleUp } from '../src/lib/ledger/actions.js';
import { buildContext, marginSummary, expensesByCurrency } from '../src/lib/ledger/engine.js';
import { bucketsByCurrency } from '../src/lib/ledger/money.js';
import { marginReport, cockpitSummary } from '../src/lib/ledger/selectors.js';
import { suggestedFeePct, withdrawalRule, findKnownPlatform } from '../src/lib/ledger/platforms.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const NOW = Date.parse('2026-10-21T00:00:00Z');

function wrap(db) {
  return { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
}
async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const store = createLedgerStore(createSqliteBackend(wrap(db)));
  await store.init();
  return store;
}

test('fee already taken out: what landed is the entered amount, the platform released more', () => {
  // 2% + $1 flat; $97 landed
  const r = computeWithdrawal({ enteredMinor: 9700, pct: 2, flatMinor: 100, takenOut: true });
  assert.equal(r.netMinor, 9700);
  assert.equal(r.releasedMinor - r.feeMinor, 9700);
  assert.equal(r.feeMinor, r.releasedMinor - 9700);
  // the fee is 2% of released + $1 (within a cent of rounding)
  assert.ok(Math.abs(r.feeMinor - (Math.round(r.releasedMinor * 0.02) + 100)) <= 1);
});

test('fee on top: the entered amount is what the platform released and the fee is extra', () => {
  const r = computeWithdrawal({ enteredMinor: 10000, pct: 2, flatMinor: 100, takenOut: false });
  assert.equal(r.releasedMinor, 10000);
  assert.equal(r.feeMinor, 300); // 2% of 100.00 + 1.00
  assert.equal(r.netMinor, 9700);
});

test('no fee, nothing changes; a fee can never exceed the amount; bad input is safe', () => {
  assert.deepEqual(computeWithdrawal({ enteredMinor: 5000 }), { releasedMinor: 5000, feeMinor: 0, netMinor: 5000 });
  const big = computeWithdrawal({ enteredMinor: 100, pct: 50, flatMinor: 99999, takenOut: false });
  assert.ok(big.feeMinor <= 100 && big.netMinor >= 0);
  const odd = computeWithdrawal({ enteredMinor: NaN, pct: 'x', flatMinor: -5 });
  assert.equal(odd.releasedMinor, 0);
  const huge = computeWithdrawal({ enteredMinor: 1000, pct: 500, takenOut: true });
  assert.ok(Number.isFinite(huge.releasedMinor));
});

async function scenario(store) {
  const g2g = await store.ensureParty('platform', 'G2G');
  const ali = await store.ensureParty('booster', 'Ali');
  const mk = (id, game, day, gross) => ({ id, game, lifecycle: 'done', currency: 'USD', grossMinor: gross, platformFeeMinor: 0, payerId: g2g.id, dateTime: `2026-0${day}-10T10:00:00Z`, title: id });
  await store.saveOrder({ order: mk('o1', 'WoW', 8, 7500), shares: [{ partyId: ali.id, amountMinor: 3000 }] });
  await store.saveOrder({ order: mk('o2', 'Diablo', 9, 2500), shares: [{ partyId: ali.id, amountMinor: 1000 }] });
  return { g2g, ali };
}

test('a payout with a fee books a linked expense, and voiding the payout voids the fee with it', async () => {
  const store = await makeStore();
  const { g2g } = await scenario(store);
  const w = computeWithdrawal({ enteredMinor: 9500, pct: 0, flatMinor: 500, takenOut: true }); // released 100.00, fee 5.00
  const pay = await receivePayout(store, { payerId: g2g.id, amountMinor: w.releasedMinor, feeMinor: w.feeMinor, currency: 'USD', rates: RATES });
  let data = await store.loadAll();
  const fee = data.payments.find((p) => p.kind === 'expense');
  assert.equal(fee.amountMinor, 500);
  assert.equal(fee.relatedPaymentId, pay.id);
  assert.equal(bucketsByCurrency(expensesByCurrency(buildContext(data))).USD, 500);
  await store.voidPayment(pay.id);
  data = await store.loadAll();
  assert.equal(bucketsByCurrency(expensesByCurrency(buildContext(data))).USD, undefined, 'the fee goes with its voided payout');
});

test('reports spread the fee over the orders the payout paid, by game, month and platform', async () => {
  const store = await makeStore();
  const { g2g } = await scenario(store);
  // one payout covering both orders (75 + 25 = 100), fee $5 -> $3.75 on WoW, $1.25 on Diablo
  await receivePayout(store, { payerId: g2g.id, amountMinor: 10000, feeMinor: 500, currency: 'USD', rates: RATES });
  const data = await store.loadAll();
  const ctx = buildContext(data);
  const partyById = new Map(data.parties.map((p) => [p.id, p]));
  const byGame = marginReport(ctx, partyById, { rates: RATES, displayCurrency: 'USD', groupBy: 'game' });
  const wow = byGame.rows.find((r) => r.key === 'WoW');
  const dia = byGame.rows.find((r) => r.key === 'Diablo');
  assert.equal(wow.expensesMinor, 375);
  assert.equal(dia.expensesMinor, 125);
  assert.equal(wow.keepMinor, wow.marginMinor - 375);
  assert.equal(byGame.totals.expensesMinor, 500);
  const byPlatform = marginReport(ctx, partyById, { rates: RATES, displayCurrency: 'USD', groupBy: 'platform' });
  assert.equal(byPlatform.rows.find((r) => r.key === 'G2G').expensesMinor, 500);
  const byMonth = marginReport(ctx, partyById, { rates: RATES, displayCurrency: 'USD', groupBy: 'month' });
  assert.equal(byMonth.rows.length, 2);
  assert.equal(byMonth.totals.expensesMinor, 500);
});

test('an expense with no payout (a repair bill) lands on its own month and platform "not set"', async () => {
  const store = await makeStore();
  await scenario(store);
  await store.recordPayment({ payment: { direction: 'out', partyId: null, amountMinor: 700, currency: 'USD', kind: 'expense', dateTime: '2026-09-15T00:00:00Z', note: 'repair' } });
  const data = await store.loadAll();
  const ctx = buildContext(data);
  const partyById = new Map(data.parties.map((p) => [p.id, p]));
  const byMonth = marginReport(ctx, partyById, { rates: RATES, displayCurrency: 'USD', groupBy: 'month' });
  assert.equal(byMonth.rows.find((r) => r.key === '2026-09').expensesMinor, 700);
  assert.equal(byMonth.totals.expensesMinor, 700);
});

test('the cockpit "what you keep" includes withdrawal fees', async () => {
  const store = await makeStore();
  const { g2g } = await scenario(store);
  await receivePayout(store, { payerId: g2g.id, amountMinor: 10000, feeMinor: 500, currency: 'USD', rates: RATES });
  const data = await store.loadAll();
  const ctx = buildContext(data);
  const margin = bucketsByCurrency(marginSummary(ctx).realized).USD; // 75-30 + 25-10 = 60.00
  assert.equal(margin, 6000);
  const c = cockpitSummary(ctx, data.parties, { rates: RATES, displayCurrency: 'USD', now: NOW });
  assert.equal(c.realizedMarginMinor, 5500);
});

test('an older database gains the new columns in place, and keeps its rows', async () => {
  const db = new DatabaseSync(':memory:');
  // the shape of the tables before settings / relatedPaymentId existed
  db.exec(`CREATE TABLE parties (id TEXT PRIMARY KEY, kind TEXT, name TEXT, handle TEXT, defaultCurrency TEXT, note TEXT, archived INTEGER, createdAt TEXT, updatedAt TEXT);
           CREATE TABLE payments (id TEXT PRIMARY KEY, direction TEXT, partyId TEXT, dateTime TEXT, amountMinor INTEGER, currency TEXT, rates TEXT, kind TEXT, method TEXT, note TEXT, voidsPaymentId TEXT, origin TEXT, legacyId TEXT, createdAt TEXT);
           INSERT INTO parties (id, kind, name, archived) VALUES ('p1', 'booster', 'Ali', 0);
           INSERT INTO payments (id, direction, amountMinor, currency, kind) VALUES ('pay1', 'out', 500, 'USD', 'settlement');`);
  const store = createLedgerStore(createSqliteBackend(wrap(db)));
  await store.init();
  await store.init(); // running twice is harmless
  const data = await store.loadAll();
  assert.equal(data.parties[0].name, 'Ali');
  assert.equal(data.parties[0].settings, null);
  assert.equal(data.payments[0].amountMinor, 500);
  await store.savePartySettings('p1', { feePct: 9.99 });
  assert.equal((await store.loadAll()).parties[0].settings.feePct, 9.99);
});

test('platform settings merge and persist: default fee and withdrawal rule', async () => {
  const store = await makeStore();
  const g2g = await store.ensureParty('platform', 'G2G');
  await store.savePartySettings(g2g.id, { feePct: 8.5 });
  await store.savePartySettings(g2g.id, { withdraw: { pct: 2, flatMinor: 100 } });
  await store.savePartySettings(g2g.id, { withdraw: { takenOut: false } });
  const saved = (await store.loadAll()).parties.find((p) => p.id === g2g.id);
  assert.equal(saved.settings.feePct, 8.5);
  assert.deepEqual(withdrawalRule(saved), { pct: 2, flatMinor: 100, flatCurrency: null, takenOut: false, layers: [{ label: "", pct: 2, flatMinor: 100 }] });
  assert.equal(suggestedFeePct(saved.name, saved), 8.5);
});

test('platform suggestions: remembered fee wins, then the known table, then zero; bad rules fall back safely', () => {
  assert.equal(suggestedFeePct('G2G', null), 9.99);
  assert.equal(suggestedFeePct('FunPay', null), 7);
  assert.equal(suggestedFeePct('BlazingBoost', null), 0); // unknown until the seller tells us
  assert.equal(suggestedFeePct('Some client', null), 0);
  assert.equal(findKnownPlatform('  blazing boost ')?.id, 'blazingboost');
  assert.equal(findKnownPlatform('Personal client'), null);
  assert.deepEqual(withdrawalRule({ settings: { withdraw: { pct: -5, flatMinor: 1.5, takenOut: undefined } } }), { pct: 0, flatMinor: 0, flatCurrency: null, takenOut: true, layers: [] });
  assert.deepEqual(withdrawalRule(null), { pct: 0, flatMinor: 0, flatCurrency: null, takenOut: true, layers: [] });
});

test('settling a booster is unaffected by fees (expenses never touch a booster balance)', async () => {
  const store = await makeStore();
  const { g2g, ali } = await scenario(store);
  await receivePayout(store, { payerId: g2g.id, amountMinor: 10000, feeMinor: 500, currency: 'USD', rates: RATES });
  await settleUp(store, { partyId: ali.id, amountMinor: 4000, currency: 'USD', rates: RATES });
  const ctx = buildContext(await store.loadAll());
  const { partyBalance } = await import('../src/lib/ledger/engine.js');
  assert.deepEqual(partyBalance(ctx, ali.id).payable, {});
  assert.deepEqual(partyBalance(ctx, ali.id).advance, {});
});

test('fee layers are remembered per platform, in order; an older single rule still reads as one layer', async () => {
  const store = await makeStore();
  const g2g = await store.ensureParty('platform', 'G2G');
  await store.savePartySettings(g2g.id, { withdraw: { pct: 11, flatMinor: 500, flatCurrency: 'TOMAN', takenOut: true, layers: [{ label: 'Platform', pct: 10, flatMinor: 0 }, { label: 'Bank', pct: 1, flatMinor: 500 }] } });
  const saved = (await store.loadAll()).parties.find((p) => p.id === g2g.id);
  assert.deepEqual(withdrawalRule(saved).layers, [{ label: 'Platform', pct: 10, flatMinor: 0 }, { label: 'Bank', pct: 1, flatMinor: 500 }]);
  assert.deepEqual(withdrawalRule({ settings: { withdraw: { pct: 2, flatMinor: 100 } } }).layers, [{ label: '', pct: 2, flatMinor: 100 }]);
});
