import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext } from '../src/lib/ledger/engine.js';
import { partyAging } from '../src/lib/ledger/selectors.js';
import { payerAging } from '../src/lib/ledger/boosterSelectors.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const NOW = Date.parse('2026-10-20T00:00:00Z');
const ago = (days) => new Date(NOW - days * 86400000).toISOString();

test('a booster\'s earned, unpaid shares fall into the band for how long they have waited', () => {
  const ctx = buildContext({
    orders: [
      { id: 'a', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 0, payerId: 'g2g', dateTime: ago(10) },
      { id: 'b', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 0, payerId: 'g2g', dateTime: ago(100) },
      { id: 'c', lifecycle: 'working', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 0, payerId: 'g2g', dateTime: ago(100) },
    ],
    shares: [
      { id: 'sa', orderId: 'a', partyId: 'ali', amountMinor: 300000, state: 'done' },
      { id: 'sb', orderId: 'b', partyId: 'ali', amountMinor: 200000, state: 'done' },
      { id: 'sc', orderId: 'c', partyId: 'ali', amountMinor: 999000, state: 'open' },
    ],
    payments: [],
    allocations: [],
  });
  const { buckets, isApproximate } = partyAging(ctx, 'ali', { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.deepEqual(buckets, { '0-7': 0, '8-30': 300000, '31-90': 0, '90+': 200000 });
  assert.equal(isApproximate, false, 'an open share is not waiting yet, so it is left out');
});

test('a client\'s finished, unpaid jobs age by band, and a part-paid job ages by what is still owed', () => {
  const ctx = buildContext({
    orders: [
      { id: 'j1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: 'client', dateTime: ago(5) },
      { id: 'j2', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: 'client', dateTime: ago(40) },
      { id: 'j3', lifecycle: 'working', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: 'client', dateTime: ago(5) },
    ],
    shares: [],
    payments: [{ id: 'p', direction: 'in', partyId: 'client', amountMinor: 400000, currency: 'TOMAN', kind: 'settlement', dateTime: ago(3) }],
    allocations: [{ id: 'a', paymentId: 'p', targetType: 'order', targetId: 'j2', appliedMinor: 400000, consumedMinor: 400000 }],
  });
  const { buckets } = payerAging(ctx, 'client', { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.deepEqual(buckets, { '0-7': 900000, '8-30': 0, '31-90': 500000, '90+': 0 });
});

import { statementPeriod, periodStart } from '../src/lib/ledger/statementPeriod.js';
import { payerOwedByCurrency } from '../src/lib/ledger/boosterSelectors.js';

test('a period limits the list, and carries the balance in as the opening and out as the closing', () => {
  const day = (d) => NOW - d * 86400000;
  const events = [
    { id: 'e1', at: day(200), runningMinor: 100 },
    { id: 'e2', at: day(50), runningMinor: 300 },
    { id: 'e3', at: day(5), runningMinor: 250 },
  ];
  const since = periodStart('30', NOW);
  const view = statementPeriod(events, since);
  assert.deepEqual(view.shown.map((e) => e.id), ['e3']);
  assert.equal(view.opening, 300, 'the balance carried in is what the last event before the period left');
  assert.equal(view.closing, 250);
  const all = statementPeriod(events, null);
  assert.equal(all.shown.length, 3);
  assert.equal(all.opening, 0);
});

test('what a client owes is split by the currency each job was priced in', () => {
  const ctx = buildContext({
    orders: [
      { id: 'u1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 0, payerId: 'c', dateTime: ago(3) },
      { id: 'u2', lifecycle: 'done', currency: 'USD', grossMinor: 2500, platformFeeMinor: 0, payerId: 'c', dateTime: ago(3) },
      { id: 'u3', lifecycle: 'working', currency: 'USD', grossMinor: 9000, platformFeeMinor: 0, payerId: 'c', dateTime: ago(3) },
    ],
    shares: [],
    payments: [],
    allocations: [],
  });
  assert.deepEqual(payerOwedByCurrency(ctx, 'c'), { TOMAN: 1000000, USD: 2500 });
});
