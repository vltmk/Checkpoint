import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportReceipt, reportReceiptDiscord, reportReceiptText } from '../src/lib/ledger/reportReceipt.js';

const words = {
  title: 'Sales report', count: 'Orders', volume: 'Volume', fee: 'Platform fee', team: 'Boosters', margin: 'Margin',
  expenses: 'Expenses', average: 'Average per order', keep: 'You keep', topTitle: 'Best month', approx: 'Approximate',
};
const fmt = { money: (m) => `$${(m / 100).toFixed(2)}`, num: (n) => String(n), label: (k) => k || 'Not set' };
const row = (key, over) => ({ key, orders: 1, volumeMinor: 10000, feeMinor: 0, boostersMinor: 0, marginMinor: 10000, expensesMinor: 0, keepMinor: 10000, ...over });
const report = (rows) => ({
  rows,
  totals: rows.reduce((t, r) => Object.fromEntries(Object.keys(t).map((k) => [k, t[k] + r[k]])), { orders: 0, volumeMinor: 0, feeMinor: 0, boostersMinor: 0, marginMinor: 0, expensesMinor: 0, keepMinor: 0 }),
  isApproximate: false,
});

test('a booster with no fees, team or expenses gets only the lines that say something', () => {
  const rr = buildReportReceipt(report([row('2026-10'), row('2026-09', { keepMinor: 5000, marginMinor: 5000, volumeMinor: 5000 })]), { fmt, words, period: 'All time', profile: 'booster' });
  assert.deepEqual(rr.lines.map(([k]) => k), ['Orders', 'Average per order']);
  assert.equal(rr.keep, '$150.00');
  assert.deepEqual(rr.top, [['2026-10', '$100.00'], ['2026-09', '$50.00']]);
});

test('fees, the team and expenses show as deductions, and the margin is shown before expenses', () => {
  const rr = buildReportReceipt(report([row('G2G', { feeMinor: 500, boostersMinor: 4000, marginMinor: 5500, expensesMinor: 500, keepMinor: 5000 })]), { fmt, words, period: '30 days' });
  assert.deepEqual(rr.lines, [
    ['Orders', '1'], ['Volume', '$100.00'], ['Platform fee', '−$5.00'], ['Boosters', '−$40.00'],
    ['Margin', '$55.00'], ['Expenses', '−$5.00'], ['Average per order', '$50.00'],
  ]);
  assert.equal(rr.keep, '$50.00');
});

test('the top list keeps at most five groups, best first, and skips groups that kept nothing', () => {
  const rows = [1, 2, 3, 4, 5, 6].map((n) => row(`m${n}`, { keepMinor: n * 100 })).concat(row('zero', { keepMinor: 0 }));
  const rr = buildReportReceipt(report(rows), { fmt, words, period: 'All time' });
  assert.deepEqual(rr.top.map(([k]) => k), ['m6', 'm5', 'm4', 'm3', 'm2']);
});

test('text and Discord copies carry the period, every line and the total', () => {
  const rr = buildReportReceipt(report([row('2026-10')]), { fmt, words, period: 'All time · Month', generatedAt: 'Made Oct 27' });
  const text = reportReceiptText(rr);
  assert.match(text, /SALES REPORT · CHECKPOINT/);
  assert.match(text, /All time · Month/);
  assert.match(text, /You keep: \$100\.00/);
  const discord = reportReceiptDiscord(rr);
  assert.ok(discord.startsWith('```ini') && discord.endsWith('```'));
  assert.match(discord, /You keep\s+= \$100\.00/);
});
