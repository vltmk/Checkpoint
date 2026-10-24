import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeWithdrawal, enteredForReleased } from '../src/lib/ledger/actions.js';

test('fill exact: the typed amount releases the target, fee taken out, and no unit less would', () => {
  for (const [pct, flatMinor] of [[5, 0], [3, 500], [12.5, 1234], [0.5, 7]]) {
    for (const target of [1000000, 999999, 123457, 1]) {
      const entered = enteredForReleased({ releasedMinor: target, pct, flatMinor, takenOut: true });
      const released = computeWithdrawal({ enteredMinor: entered, pct, flatMinor, takenOut: true }).releasedMinor;
      assert.ok(released >= target, `released ${released} covers ${target} at ${pct}%+${flatMinor}`);
      if (entered > 0) {
        const less = computeWithdrawal({ enteredMinor: entered - 1, pct, flatMinor, takenOut: true }).releasedMinor;
        assert.ok(less < target, 'one unit less would not cover the target');
      }
    }
  }
});

test('fill exact: fee on top, or no fee, types the target itself', () => {
  assert.equal(enteredForReleased({ releasedMinor: 500000, pct: 5, flatMinor: 0, takenOut: false }), 500000);
  assert.equal(enteredForReleased({ releasedMinor: 500000, pct: 0, flatMinor: 0, takenOut: true }), 500000);
  assert.equal(enteredForReleased({ releasedMinor: 0, pct: 5, flatMinor: 0, takenOut: true }), 0);
});

import { computeWithdrawalLayers } from '../src/lib/ledger/actions.js';

const LAYERS = [
  { label: 'Platform', pct: 10, flatMinor: 0 },
  { label: 'Bank', pct: 1, flatMinor: 0 },
  { label: 'Transfer', pct: 0, flatMinor: 20000 },
];

test('fee layers: each layer is booked on its own and the lines add up to the fee', () => {
  const r = computeWithdrawalLayers({ enteredMinor: 1000000, layers: LAYERS, takenOut: true });
  assert.equal(r.feeLines.reduce((s, l) => s + l.feeMinor, 0), r.feeMinor);
  assert.equal(r.releasedMinor - r.feeMinor, 1000000, 'what reached you is the typed amount');
  assert.deepEqual(r.feeLines.map((l) => l.label), ['Platform', 'Bank', 'Transfer']);
  // each percent is of the amount the platform released, not of what is left after the layer before
  assert.equal(r.feeLines[0].feeMinor, Math.round(r.releasedMinor * 0.10));
  assert.equal(r.feeLines[1].feeMinor, Math.round(r.releasedMinor * 0.01));
});

test('fee layers on top: the typed amount is the released amount and every layer comes out of it', () => {
  const r = computeWithdrawalLayers({ enteredMinor: 1000000, layers: LAYERS, takenOut: false });
  assert.equal(r.releasedMinor, 1000000);
  assert.equal(r.feeMinor, 100000 + 10000 + 20000);
  assert.equal(r.netMinor, 1000000 - r.feeMinor);
});

test('a single layer behaves exactly like the old one-rule fee', () => {
  const one = computeWithdrawalLayers({ enteredMinor: 777777, layers: [{ pct: 3, flatMinor: 500 }], takenOut: true });
  assert.deepEqual([one.releasedMinor, one.feeMinor, one.netMinor], [computeWithdrawal({ enteredMinor: 777777, pct: 3, flatMinor: 500 }).releasedMinor, computeWithdrawal({ enteredMinor: 777777, pct: 3, flatMinor: 500 }).feeMinor, 777777]);
});

test('fill exact works through several layers, to the unit', () => {
  for (const target of [900000, 1234567]) {
    const entered = enteredForReleased({ releasedMinor: target, layers: LAYERS, takenOut: true });
    assert.ok(computeWithdrawalLayers({ enteredMinor: entered, layers: LAYERS, takenOut: true }).releasedMinor >= target);
    assert.ok(computeWithdrawalLayers({ enteredMinor: entered - 1, layers: LAYERS, takenOut: true }).releasedMinor < target);
  }
});
