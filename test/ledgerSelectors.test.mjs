import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext } from '../src/lib/ledger/engine.js';
import { cockpitSummary, peopleList, orderRows, partyStatement, statementSummaryLines } from '../src/lib/ledger/selectors.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const DAY = 86400000;
const NOW = Date.parse('2026-10-20T00:00:00Z');
const iso = (d) => new Date(NOW + d * DAY).toISOString();

const parties = [
  { id: 'ali', kind: 'booster', name: 'Ali' },
  { id: 'sara', kind: 'booster', name: 'Sara' },
  { id: 'g2g', kind: 'platform', name: 'G2G' },
];
const partyById = new Map(parties.map((p) => [p.id, p]));

function fixture() {
  return {
    orders: [
      { id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: 'g2g', dateTime: iso(-12), expectedPayoutAt: iso(-8) },
      { id: 'o2', lifecycle: 'working', currency: 'TOMAN', grossMinor: 500000, platformFeeMinor: 50000, payerId: 'g2g', dateTime: iso(-2) },
    ],
    shares: [
      { id: 's1', orderId: 'o1', partyId: 'ali', amountMinor: 300000, state: 'done' },
      { id: 's2', orderId: 'o1', partyId: 'sara', amountMinor: 200000, state: 'done' },
      { id: 's3', orderId: 'o2', partyId: 'ali', amountMinor: 250000, state: 'open' },
    ],
    payments: [{ id: 'p1', direction: 'out', partyId: 'sara', amountMinor: 50000, currency: 'TOMAN', kind: 'settlement', dateTime: iso(-5) }],
    allocations: [{ id: 'a1', paymentId: 'p1', targetType: 'share', targetId: 's2', appliedMinor: 50000, consumedMinor: 50000 }],
  };
}

test('cockpit: owed now, committed, owed to me and margin come out of the same ledger', () => {
  const ctx = buildContext(fixture());
  const c = cockpitSummary(ctx, parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.equal(c.owedNowMinor, 300000 + 150000); // Ali 300k, Sara 200k - 50k paid
  assert.equal(c.committedMinor, 250000);
  assert.equal(c.owedToMeMinor, 900000 + 450000); // G2G owes both orders (net of fee)
  assert.equal(c.realizedMarginMinor, 400000);
  assert.equal(c.pipelineMarginMinor, 200000);
  assert.equal(c.payers[0].overdueMinor, 900000); // o1 is 8 days past its payout date
  assert.equal(c.isApproximate, false);
});

test('people are sorted by what I owe, biggest first, and carry aging', () => {
  const ctx = buildContext(fixture());
  const rows = peopleList(ctx, parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.deepEqual(rows.map((r) => r.party.id), ['ali', 'sara']);
  assert.equal(rows[0].agingDays, 12);
  assert.equal(rows[0].openOrders, 1);
  assert.equal(rows[0].totalOrders, 2);
});

test('order rows expose the waterfall and per-person paid state', () => {
  const ctx = buildContext(fixture());
  const rows = orderRows(ctx, partyById);
  const o1 = rows.find((r) => r.order.id === 'o1');
  assert.equal(o1.receivableMinor, 900000);
  assert.equal(o1.marginMinor, 400000);
  assert.equal(o1.shares.find((s) => s.party.id === 'sara').partlyPaid, true);
  assert.equal(o1.shares.find((s) => s.party.id === 'ali').paid, false);
  assert.equal(rows[0].order.id, 'o2'); // newest first
});

test('statement: running balance rises with shares and falls with payments; voids are skipped', () => {
  const f = fixture();
  f.payments.push({ id: 'pv', direction: 'out', partyId: 'sara', amountMinor: 50000, currency: 'TOMAN', kind: 'adjustment', voidsPaymentId: 'p1', dateTime: iso(-4) });
  const ctx = buildContext(f);
  const st = partyStatement(ctx, 'sara', { rates: RATES, displayCurrency: 'TOMAN' });
  assert.deepEqual(st.events.map((e) => e.type), ['share', 'payment']);
  assert.equal(st.events[1].voided, true);
  assert.equal(st.events[1].runningMinor, 200000);
  assert.equal(st.display.owedNowMinor, 200000);
});

test('statement summary lists unpaid earned shares and the latest payments', () => {
  const ctx = buildContext(fixture());
  const st = partyStatement(ctx, 'sara', { rates: RATES, displayCurrency: 'TOMAN' });
  const { unpaid, payments } = statementSummaryLines(st);
  assert.equal(unpaid.length, 1);
  assert.equal(payments.length, 1);
});

test('mixed-currency balances are flagged approximate', () => {
  const f = fixture();
  f.orders[1].currency = 'USD';
  f.orders[1].grossMinor = 5000;
  f.orders[1].platformFeeMinor = 0;
  f.shares[2].amountMinor = 2500;
  const ctx = buildContext(f);
  const c = cockpitSummary(ctx, parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.equal(c.isApproximate, true);
  assert.equal(c.committedMinor, 2500000); // 25.00 USD at 100,000 T
});

import { marginReport, boosterReport } from '../src/lib/ledger/selectors.js';

test('margin report groups by month, platform and game, and skips dead orders', () => {
  const f = fixture();
  f.orders[0].game = 'WoW';
  f.orders[1].game = 'Diablo';
  f.orders.push({ id: 'o3', lifecycle: 'failed', currency: 'TOMAN', grossMinor: 999999, platformFeeMinor: 0, payerId: 'g2g', dateTime: iso(-1), game: 'WoW' });
  const ctx = buildContext(f);
  const byGame = marginReport(ctx, partyById, { rates: RATES, displayCurrency: 'TOMAN', groupBy: 'game' });
  assert.deepEqual(byGame.rows.map((r) => [r.key, r.marginMinor]), [['WoW', 400000], ['Diablo', 200000]]);
  assert.equal(byGame.totals.marginMinor, 600000);
  const byPlatform = marginReport(ctx, partyById, { rates: RATES, displayCurrency: 'TOMAN', groupBy: 'platform' });
  assert.equal(byPlatform.rows.length, 1);
  assert.equal(byPlatform.rows[0].key, 'G2G');
  assert.equal(byPlatform.rows[0].feeMinor, 150000);
  const byMonth = marginReport(ctx, partyById, { rates: RATES, displayCurrency: 'TOMAN', groupBy: 'month' });
  assert.ok(byMonth.rows.every((r) => /^\d{4}-\d{2}$/.test(r.key)));
});

test('booster report: earned = paid + owed, sorted by earnings', () => {
  const ctx = buildContext(fixture());
  const rows = boosterReport(ctx, parties, { rates: RATES, displayCurrency: 'TOMAN' });
  assert.deepEqual(rows.map((r) => r.party.id), ['ali', 'sara']);
  assert.equal(rows[0].earnedMinor, 550000);
  assert.equal(rows[1].paidMinor, 50000);
  assert.equal(rows[1].owedMinor, 150000);
});

import { reportSummary, toCsv } from '../src/lib/ledger/selectors.js';

test('margin report can be limited to a period, and the summary reads off it', () => {
  const f = fixture();
  f.orders[0].game = 'WoW';
  f.orders[1].game = 'Diablo';
  const ctx = buildContext(f);
  const opts = { rates: RATES, displayCurrency: 'TOMAN', groupBy: 'game' };
  const recent = marginReport(ctx, partyById, { ...opts, sinceMs: NOW - 5 * DAY });
  assert.deepEqual(recent.rows.map((r) => r.key), ['Diablo']);
  assert.equal(recent.totals.orders, 1);
  const all = marginReport(ctx, partyById, opts);
  assert.equal(all.totals.orders, 2);
  const s = reportSummary(all);
  assert.equal(s.keepMinor, 600000);
  assert.equal(s.avgPerOrderMinor, 300000);
  assert.equal(s.top.key, 'WoW');
  assert.equal(reportSummary(recent).top, null); // one group: nothing to rank
});

test('csv quotes cells and defuses spreadsheet formulas', () => {
  assert.equal(toCsv([['a,b', 'say "hi"', '=SUM(A1)', 5, -2]]), `"a,b","say ""hi""",'=SUM(A1),5,-2`);
});

test('statement: a payment lists the orders it covered, and a share is dated by its latest live payment', () => {
  const f = fixture();
  f.allocations.push({ id: 'a2', paymentId: 'p1', targetType: 'share', targetId: 's1', appliedMinor: 0, consumedMinor: 0 });
  const ctx = buildContext(f);
  const sara = partyStatement(ctx, 'sara', { rates: RATES, displayCurrency: 'TOMAN' });
  const pay = sara.events.find((e) => e.type === 'payment');
  assert.equal(pay.covers.length, 1, 'zero-amount allocations to other parties are not listed');
  assert.equal(pay.covers[0].order.id, 'o1');
  assert.equal(pay.covers[0].share.id, 's2');
  assert.equal(pay.covers[0].appliedMinor, 50000);
  assert.equal(sara.events.find((e) => e.type === 'share').paidAt, Date.parse(iso(-5)));

  const ali = partyStatement(ctx, 'ali', { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(ali.events.find((e) => e.id === 's1').paidAt, null, 'an unpaid share has no paid date');
});

test('statement: a voided payment does not date the share it touched', () => {
  const f = fixture();
  f.payments.push({ id: 'pv', direction: 'out', partyId: 'sara', amountMinor: 50000, currency: 'TOMAN', kind: 'adjustment', voidsPaymentId: 'p1', dateTime: iso(-4) });
  const ctx = buildContext(f);
  const sara = partyStatement(ctx, 'sara', { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(sara.events.find((e) => e.type === 'share').paidAt, null);
});
