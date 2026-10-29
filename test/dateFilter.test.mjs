import test from 'node:test';
import assert from 'node:assert/strict';
import { dateBounds, inDateBounds } from '../src/lib/ledger/dateFilter.js';

const now = new Date(2026, 9, 29, 15, 30).getTime(); // Oct 29 2026, 15:30 local
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();

test('all time keeps everything, even an unreadable date', () => {
  assert.equal(inDateBounds('nope', dateBounds('all')), true);
});
test('today starts at local midnight', () => {
  const b = dateBounds('today', {}, now);
  assert.equal(inDateBounds(at(2026, 10, 29, 0), b), true);
  assert.equal(inDateBounds(at(2026, 10, 28, 23), b), false);
  assert.equal(inDateBounds(at(2026, 10, 30, 0), b), false);
});
test('7 days is today and the six days before', () => {
  const b = dateBounds('7', {}, now);
  assert.equal(inDateBounds(at(2026, 10, 23, 1), b), true);
  assert.equal(inDateBounds(at(2026, 10, 22, 23), b), false);
});
test('this month and last month', () => {
  assert.equal(inDateBounds(at(2026, 10, 1, 0), dateBounds('month', {}, now)), true);
  assert.equal(inDateBounds(at(2026, 9, 30, 23), dateBounds('month', {}, now)), false);
  const last = dateBounds('lastMonth', {}, now);
  assert.equal(inDateBounds(at(2026, 9, 15), last), true);
  assert.equal(inDateBounds(at(2026, 10, 1, 0), last), false);
});
test('last month across a year boundary', () => {
  const jan = new Date(2026, 0, 10).getTime();
  assert.equal(inDateBounds(at(2025, 12, 31), dateBounds('lastMonth', {}, jan)), true);
});
test('a custom range includes both end days, and either end may be empty', () => {
  const b = dateBounds('custom', { from: '2026-10-10', to: '2026-10-12' }, now);
  assert.equal(inDateBounds(at(2026, 10, 12, 23), b), true);
  assert.equal(inDateBounds(at(2026, 10, 13, 0), b), false);
  assert.equal(inDateBounds(at(2026, 10, 9, 23), b), false);
  assert.equal(inDateBounds(at(2020, 1, 1), dateBounds('custom', { to: '2026-10-12' }, now)), true);
  assert.equal(inDateBounds('nope', b), false);
});
