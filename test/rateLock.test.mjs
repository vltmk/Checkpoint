// Every job keeps the exchange rates of the day it was logged; later rate changes must not move what it earned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { buildContext } from '../src/lib/ledger/engine.js';
import { bucketKey, decodeBucketKey, collapseBuckets, convertMinor } from '../src/lib/ledger/money.js';
import { cockpitSummary, marginReport } from '../src/lib/ledger/selectors.js';
import { boosterOverview, payerList } from '../src/lib/ledger/boosterSelectors.js';
import { sanitizeRow, cleanRates } from '../src/lib/ledger/ledgerSchema.js';
import { rateFormFor, rateFieldsFromForm } from '../src/lib/ledger/rateLock.js';

const DAY1 = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.1 };
const TODAY = { goldRateTOMAN: 4000, usdRateTOMAN: 120000, eurRateUSD: 1.2 }; // everything got more expensive
const NOW = Date.parse('2026-10-20T00:00:00Z');
const iso = (d) => new Date(NOW + d * 86400000).toISOString();
const parties = [{ id: 'g2g', kind: 'platform', name: 'G2G' }, { id: 'ali', kind: 'booster', name: 'Ali' }];
const partyById = new Map(parties.map((p) => [p.id, p]));

const lock = (r = DAY1) => ({ goldRateTOMAN: r.goldRateTOMAN, usdRateTOMAN: r.usdRateTOMAN, eurRateUSD: r.eurRateUSD });
const job = (id, currency, grossMinor, over = {}) => ({ id, lifecycle: 'done', currency, grossMinor, platformFeeMinor: 0, payerId: 'g2g', dateTime: iso(-1), rates: lock(), exchangeRate: DAY1.goldRateTOMAN, rateUnit: '1k', ...over });
const cockpit = (orders, rates) => cockpitSummary(buildContext({ orders, shares: [], payments: [], allocations: [] }), parties, { rates, displayCurrency: 'TOMAN', now: NOW });

test('a USD job is worth the same Toman after the dollar gets more expensive', () => {
  const orders = [job('o1', 'USD', 10000)]; // $100
  const then = cockpit(orders, DAY1);
  const now = cockpit(orders, TODAY);
  assert.equal(then.realizedMarginMinor, 10000000); // 100 x 100,000
  assert.equal(now.realizedMarginMinor, 10000000, 'the dollar is up 20% today, but this job was made at 100,000');
});

test('a gold job keeps its gold rate, and an EUR job keeps its EUR and USD rates', () => {
  const gold = [job('g', 'GOLD', 1000000)]; // 1,000,000 gold at 3,200 per 1k
  assert.equal(cockpit(gold, TODAY).realizedMarginMinor, 3200000);
  const eur = [job('e', 'EUR', 5000)]; // 50 EUR = 55 USD = 5,500,000 Toman on the day
  assert.equal(cockpit(eur, DAY1).realizedMarginMinor, 5500000);
  assert.equal(cockpit(eur, TODAY).realizedMarginMinor, 5500000);
});

test('a job in Toman shown in USD uses the dollar rate of its own day', () => {
  const orders = [job('t', 'TOMAN', 10000000)];
  const asUsd = (rates) => cockpitSummary(buildContext({ orders, shares: [], payments: [], allocations: [] }), parties, { rates, displayCurrency: 'USD', now: NOW }).realizedMarginMinor;
  assert.equal(asUsd(DAY1), 10000);
  assert.equal(asUsd(TODAY), 10000, 'not 8,333 cents: the Toman job is valued at the dollar of the day it was logged');
});

test('jobs logged on different days each keep their own rate, and a new job uses the new one', () => {
  const orders = [job('old', 'USD', 10000), job('new', 'USD', 10000, { rates: lock(TODAY) })];
  assert.equal(cockpit(orders, TODAY).realizedMarginMinor, 10000000 + 12000000);
});

test('a job with no saved rates still follows the current rates (until it is locked)', () => {
  const o = job('legacy', 'USD', 10000, { rates: null, exchangeRate: null });
  assert.equal(cockpit([o], DAY1).realizedMarginMinor, 10000000);
  assert.equal(cockpit([o], TODAY).realizedMarginMinor, 12000000);
});

test('reports and the Booster screens use the saved rates too', () => {
  const orders = [job('o1', 'USD', 10000, { lifecycle: 'done' })];
  const ctx = buildContext({ orders, shares: [], payments: [], allocations: [] });
  const report = marginReport(ctx, partyById, { rates: TODAY, displayCurrency: 'TOMAN', groupBy: 'month' });
  assert.equal(report.total?.marginMinor ?? report.rows.reduce((s, r) => s + r.marginMinor, 0), 10000000);
  const monthKey = (d) => String(d).slice(0, 7);
  const overview = boosterOverview(ctx, parties, { rates: TODAY, displayCurrency: 'TOMAN', now: NOW, monthKey });
  assert.equal(overview.owedMinor ?? overview.owed?.minor ?? overview.owedNowMinor, 10000000);
  const payers = payerList(ctx, parties, { rates: TODAY, displayCurrency: 'TOMAN', now: NOW });
  assert.equal(payers[0].owedMinor, 10000000);
});

test('bucket keys carry the lock, decode back, and convert at the locked rates', () => {
  const opts = { customRate: 3200, isPerOneGold: false, rates: { usdRateTOMAN: 100000, eurRateUSD: 1.1 } };
  const key = bucketKey('USD', opts);
  assert.equal(key, 'USD|3200|1k|100000|1.1');
  assert.deepEqual(decodeBucketKey(key), { currency: 'USD', opts: { customRate: 3200, isPerOneGold: false, rates: { usdRateTOMAN: 100000, eurRateUSD: 1.1 } } });
  assert.equal(collapseBuckets({ [key]: 10000 }, 'TOMAN', TODAY).minor, 10000000);
  assert.equal(convertMinor(10000, 'USD', 'TOMAN', TODAY, opts), 10000000);
  assert.equal(bucketKey('USD'), 'USD');
  assert.equal(bucketKey('GOLD', { customRate: 3200 }), 'GOLD|3200|1k');
});

test('lockOrderRates freezes orders that have no rates, keeps the ones that do, and is safe to repeat', async () => {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  await store.saveOrder({ order: { id: 'a', lifecycle: 'done', currency: 'USD', grossMinor: 5000, platformFeeMinor: 0, dateTime: iso(-3), title: 'a' }, shares: [] });
  await store.saveOrder({ order: { id: 'b', lifecycle: 'done', currency: 'GOLD', grossMinor: 100000, platformFeeMinor: 0, dateTime: iso(-2), title: 'b', exchangeRate: 7000, rateUnit: '1' }, shares: [] });
  await store.saveOrder({ order: { id: 'c', lifecycle: 'done', currency: 'USD', grossMinor: 5000, platformFeeMinor: 0, dateTime: iso(-1), title: 'c', rates: lock(DAY1) }, shares: [] });
  assert.equal(await store.lockOrderRates(TODAY), 2);
  const rows = Object.fromEntries((await store.loadAll()).orders.map((o) => [o.id, o]));
  assert.deepEqual(rows.a.rates, { goldRateTOMAN: 4000, usdRateTOMAN: 120000, eurRateUSD: 1.2 });
  assert.equal(rows.b.rates.goldRateTOMAN, 7000, 'a gold rate the order already had is kept');
  assert.equal(rows.b.rates.isPerOneGold, true);
  assert.deepEqual(rows.c.rates, lock(DAY1), 'an order that already had rates is never touched');
  assert.equal(await store.lockOrderRates({ goldRateTOMAN: 9999, usdRateTOMAN: 999999, eurRateUSD: 9 }), 0);
  assert.equal(rows.a.updatedAt, (await store.loadAll()).orders.find((o) => o.id === 'a').updatedAt);
  assert.equal(await store.lockOrderRates({}), 0, 'with no usable rates nothing is locked');
});

test('a saved order keeps its rates through an edit, and the rates survive a backup round trip', async () => {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  const saved = await store.saveOrder({ order: { id: 'a', lifecycle: 'done', currency: 'USD', grossMinor: 5000, platformFeeMinor: 0, dateTime: iso(-3), title: 'a', rates: lock(DAY1), exchangeRate: 3200, rateUnit: '1k' }, shares: [] });
  await store.saveOrder({ order: { ...saved, title: 'renamed' }, shares: [] });
  const exported = await store.exportAll();
  assert.deepEqual(exported.orders[0].rates, lock(DAY1));
  const db2 = new DatabaseSync(':memory:');
  const store2 = createLedgerStore(createSqliteBackend({ async execute(sql, p = []) { db2.prepare(sql).run(...p); }, async select(sql, p = []) { return db2.prepare(sql).all(...p); } }));
  await store2.init();
  await store2.importAll(exported);
  assert.deepEqual((await store2.loadAll()).orders[0].rates, lock(DAY1));
});

test('imported rates are cleaned: junk, negative or absurd values are dropped, not trusted', () => {
  assert.equal(cleanRates('x'), null);
  assert.equal(cleanRates([1, 2]), null);
  assert.equal(cleanRates({ usdRateTOMAN: -5, goldRateTOMAN: 'a', eurRateUSD: NaN }), null);
  assert.deepEqual(cleanRates({ usdRateTOMAN: 95000, goldRateTOMAN: 1e15, eurRateUSD: 1.1, evil: 1 }), { goldRateTOMAN: null, usdRateTOMAN: 95000, eurRateUSD: 1.1 });
  const row = sanitizeRow('orders', { id: 'x', lifecycle: 'done', currency: 'USD', grossMinor: 100, platformFeeMinor: 0, rates: { usdRateTOMAN: 'DROP TABLE', eurRateUSD: 1.1 } });
  assert.deepEqual(row.rates, { goldRateTOMAN: null, usdRateTOMAN: null, eurRateUSD: 1.1 });
});

test('the order form: new jobs start from today, edits show the job\'s own rates, a bad entry keeps the saved rate', () => {
  assert.deepEqual(rateFormFor(null, TODAY), { gold: '4000', usd: '120000', eur: '1.2' });
  const old = job('o', 'USD', 1000);
  assert.deepEqual(rateFormFor(old, TODAY), { gold: '3200', usd: '100000', eur: '1.1' });
  const typed = rateFieldsFromForm({ gold: '3,200', usd: '۱۰۰۰۰۰', eur: 'oops' }, { base: old, currentRates: TODAY });
  assert.equal(typed.rates.usdRateTOMAN, 100000, 'Persian digits are read');
  assert.equal(typed.rates.eurRateUSD, 1.1, 'unreadable text keeps the saved EUR rate, not today\'s');
  assert.equal(typed.exchangeRate, 3200);
  const edited = rateFieldsFromForm({ gold: '3200', usd: '98000', eur: '1.1' }, { base: old, currentRates: TODAY });
  assert.equal(edited.rates.usdRateTOMAN, 98000, 'an older job can be corrected');
  const blankNew = rateFieldsFromForm({ gold: '', usd: '', eur: '' }, { base: null, currentRates: TODAY });
  assert.deepEqual(blankNew.rates, { goldRateTOMAN: 4000, usdRateTOMAN: 120000, eurRateUSD: 1.2 });
});

test('a payment keeps its own rates: a fee paid in USD is worth what it was on the day', () => {
  const orders = [job('o1', 'TOMAN', 10000000)];
  const payments = [{ id: 'f', direction: 'out', partyId: null, amountMinor: 1000, currency: 'USD', kind: 'expense', dateTime: iso(-1), rates: lock(DAY1) }];
  const ctx = buildContext({ orders, shares: [], payments, allocations: [] });
  const s = (rates) => cockpitSummary(ctx, parties, { rates, displayCurrency: 'TOMAN', now: NOW }).realizedMarginMinor;
  assert.equal(s(DAY1), 10000000 - 1000000); // $10 fee at 100,000
  assert.equal(s(TODAY), 10000000 - 1000000);
});
