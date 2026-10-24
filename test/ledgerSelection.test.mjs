import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext } from '../src/lib/ledger/engine.js';
import { orderRows } from '../src/lib/ledger/selectors.js';
import { rangeSelect, toggleId, pruneSelection, selectionRecap, targetsTotalMinor } from '../src/lib/ledger/selection.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const NOW = Date.parse('2026-10-20T00:00:00Z');
const iso = (d) => new Date(NOW + d * 86400000).toISOString();
const parties = [{ id: 'ali', kind: 'booster', name: 'Ali' }, { id: 'g2g', kind: 'platform', name: 'G2G' }];
const partyById = new Map(parties.map((p) => [p.id, p]));

// o1: Toman, finished, Ali's share 300k. o2: USD order with its own locked rate (90,000), $50, Ali's $25 share, still open.
// o3: failed, so it is counted but adds no money.
function fixture() {
  return buildContext({
    orders: [
      { id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: 'g2g', dateTime: iso(-3) },
      { id: 'o2', lifecycle: 'working', currency: 'USD', grossMinor: 5000, platformFeeMinor: 0, payerId: 'g2g', dateTime: iso(-2), rates: { usdRateTOMAN: 90000, eurRateUSD: 1.08 } },
      { id: 'o3', lifecycle: 'failed', currency: 'TOMAN', grossMinor: 999000, platformFeeMinor: 0, payerId: 'g2g', dateTime: iso(-1) },
    ],
    shares: [
      { id: 's1', orderId: 'o1', partyId: 'ali', amountMinor: 300000, state: 'done' },
      { id: 's2', orderId: 'o2', partyId: 'ali', amountMinor: 2500, state: 'open' },
    ],
    payments: [],
    allocations: [],
  });
}

test('range select covers the span between anchor and target, in either direction', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(rangeSelect(ids, 'b', 'd'), ['b', 'c', 'd']);
  assert.deepEqual(rangeSelect(ids, 'd', 'b'), ['b', 'c', 'd']);
  assert.deepEqual(rangeSelect(ids, 'zz', 'c'), ['c'], 'an unknown anchor selects just the target');
  assert.deepEqual(rangeSelect(ids, 'a', 'zz'), [], 'an unknown target selects nothing');
});

test('toggle returns a new Set and leaves the old one alone', () => {
  const before = new Set(['a']);
  const added = toggleId(before, 'b');
  assert.deepEqual([...added], ['a', 'b']);
  assert.deepEqual([...before], ['a']);
  assert.deepEqual([...toggleId(added, 'a')], ['b']);
});

test('pruning drops ids that left the list, and keeps the same Set when nothing changed', () => {
  const sel = new Set(['a', 'b', 'gone']);
  const pruned = pruneSelection(sel, ['a', 'b', 'c']);
  assert.deepEqual([...pruned], ['a', 'b']);
  const same = new Set(['a']);
  assert.equal(pruneSelection(same, ['a', 'b']), same);
});

test('recap values each order at its own locked rate and counts dead orders without money', () => {
  const rows = orderRows(fixture(), partyById);
  const recap = selectionRecap(rows, { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(recap.count, 3);
  assert.equal(recap.liveCount, 2);
  assert.equal(recap.deadCount, 1);
  // o1 keeps 900k - 300k = 600k; o2 keeps $25 at its own 90,000 lock = 2,250,000
  assert.equal(recap.keep.minor, 2850000);
  assert.deepEqual(recap.keep.byCurrency, { TOMAN: 600000, USD: 2500 });
  // gross: 1,000,000 Toman, plus $50 at the order's 90,000 lock = 4,500,000
  assert.equal(recap.gross.minor, 1000000 + 4500000);
  assert.equal(recap.fee.minor, 100000);
  assert.equal(recap.isApproximate, true);
  assert.equal(recap.keepAverage.minor, Math.round(2850000 / 2));
});

test('recap collects what is still owed on live orders, and nothing on a dead one', () => {
  const rows = orderRows(fixture(), partyById);
  const recap = selectionRecap(rows, { rates: RATES, displayCurrency: 'TOMAN' });
  // o1 is paid nothing yet, so the full 900k receivable is still to collect; o3 (failed) is not counted
  assert.deepEqual(recap.toCollect.byCurrency, { TOMAN: 900000, USD: 5000 });
  assert.equal(recap.collected.minor, 0);
});

test('an empty selection gives zeros and no average', () => {
  const recap = selectionRecap([], { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(recap.count, 0);
  assert.equal(recap.keep.minor, 0);
  assert.equal(recap.keepAverage, null);
  assert.equal(recap.keepMin, null);
  assert.equal(recap.isApproximate, false);
});

test('targets total converts each target at its own rate, so the amount filled from a selection matches what it covers', () => {
  const targets = [
    { outstandingMinor: 300000, currency: 'TOMAN' },
    { outstandingMinor: 2500, currency: 'USD' },
  ];
  const rates = { usdRateTOMAN: 100000 };
  assert.equal(targetsTotalMinor(targets, 'TOMAN', rates), 300000 + 2500000);
  assert.equal(targetsTotalMinor(targets, 'USD', rates), 300 + 2500);
  assert.equal(targetsTotalMinor([], 'TOMAN', rates), 0);
});

import { payerStatement } from '../src/lib/ledger/boosterSelectors.js';

test('client credit: money they sent beyond their jobs, and nothing from a voided payment or a part-paid job', () => {
  const job = { id: 'j1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: 'client', dateTime: iso(-3) };
  const paid = { id: 'in1', direction: 'in', partyId: 'client', amountMinor: 1000000, currency: 'TOMAN', kind: 'settlement', dateTime: iso(-2) };
  const allocation = { id: 'a1', paymentId: 'in1', targetType: 'order', targetId: 'j1', appliedMinor: 900000, consumedMinor: 900000 };

  const overpaid = payerStatement(buildContext({ orders: [job], shares: [], payments: [paid], allocations: [allocation] }), 'client', { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(overpaid.creditMinor, 100000, '1,000,000 in, 900,000 taken by the job: 100,000 is credit');

  const voided = { id: 'v1', direction: 'in', partyId: 'client', amountMinor: 1000000, currency: 'TOMAN', kind: 'adjustment', voidsPaymentId: 'in1', dateTime: iso(-1) };
  const cancelled = payerStatement(buildContext({ orders: [job], shares: [], payments: [paid, voided], allocations: [allocation] }), 'client', { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(cancelled.creditMinor, 0, 'a voided payment is no credit');

  const partly = payerStatement(buildContext({
    orders: [job], shares: [], payments: [{ ...paid, amountMinor: 500000 }],
    allocations: [{ ...allocation, appliedMinor: 500000, consumedMinor: 500000 }],
  }), 'client', { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(partly.creditMinor, 0, 'money all taken by a part-paid job is not credit');
});
