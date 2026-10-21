import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, groupByDay } from '../src/lib/ledger/grouping.js';

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

test('dayKey is the local calendar day, and empty for an unreadable date', () => {
  assert.equal(dayKey(at(2026, 10, 21, 23, 50)), '2026-10-21');
  assert.equal(dayKey(at(2026, 1, 3, 0, 5)), '2026-01-03');
  assert.equal(dayKey('not a date'), '');
  assert.equal(dayKey(undefined), '');
});

test('rows are grouped by day, keeping their order inside and between days', () => {
  const rows = [
    { id: 'a', t: at(2026, 10, 21, 18) },
    { id: 'b', t: at(2026, 10, 21, 9) },
    { id: 'c', t: at(2026, 10, 19, 14) },
    { id: 'd', t: at(2026, 10, 19, 8) },
    { id: 'e', t: at(2026, 10, 3, 8) },
  ];
  const groups = groupByDay(rows, (r) => r.t);
  assert.deepEqual(groups.map((g) => g.key), ['2026-10-21', '2026-10-19', '2026-10-03']);
  assert.deepEqual(groups.map((g) => g.rows.map((r) => r.id)), [['a', 'b'], ['c', 'd'], ['e']]);
  assert.equal(groups[0].iso, rows[0].t);
});

test('rows without a readable date share one group instead of crashing', () => {
  const groups = groupByDay([{ id: 'x', t: '' }, { id: 'y', t: 'junk' }], (r) => r.t);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'unknown');
  assert.equal(groups[0].rows.length, 2);
  assert.deepEqual(groupByDay([], () => ''), []);
});
