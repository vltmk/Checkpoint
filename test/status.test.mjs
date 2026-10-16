import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const currenciesCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'currencies.js'), 'utf8').replace(/\r\n/g, '\n');
const i18nCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'i18n.jsx'), 'utf8').replace(/\r\n/g, '\n');
const badgeCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'Badge.jsx'), 'utf8').replace(/\r\n/g, '\n');
const ledgerCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'views', 'LedgerView.jsx'), 'utf8').replace(/\r\n/g, '\n');
const ledgerQueryCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'ledgerQuery.js'), 'utf8');
const analyticsCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'views', 'AnalyticsView.jsx'), 'utf8').replace(/\r\n/g, '\n');

test('STATUSES includes Failed in currencies.js', () => {
  assert.ok(currenciesCode.includes("export const STATUSES = ['Paid', 'Pending', 'Working', 'On Hold', 'Failed'];"));
});

test('STATUS_CONFIG contains complete cycle with Failed in currencies.js', () => {
  assert.ok(currenciesCode.includes("Failed: {\n    label: 'ناموفق',\n    color: 'rose'"));
  assert.ok(currenciesCode.includes("next: 'Failed'"));
  assert.ok(currenciesCode.includes("next: 'Paid'"));
});

test('STATUS_LABELS has Persian label for Failed in currencies.js', () => {
  assert.ok(currenciesCode.includes("Failed: 'ناموفق'"));
});

test('i18n.jsx has translations for Failed in both English and Persian', () => {
  assert.ok(i18nCode.includes("'status.Failed': 'Failed'"));
  assert.ok(i18nCode.includes("'status.Failed': 'ناموفق'"));
  assert.ok(i18nCode.includes("'receipt.orderValueFailed': 'Order Value (Unpaid)'"));
  assert.ok(i18nCode.includes("'receipt.orderValueFailed': 'مبلغ سفارش (پرداخت‌نشده)'"));
});

test('STATUS_STYLES in Badge.jsx defines dual-theme classes for Failed', () => {
  assert.ok(badgeCode.includes('Failed: {'));
  assert.ok(badgeCode.includes('text-rose-700'));
  assert.ok(badgeCode.includes('dark:text-rose-400'));
  assert.ok(badgeCode.includes('bg-rose-500/10'));
  assert.ok(badgeCode.includes('dark:bg-rose-950/30'));
  assert.ok(badgeCode.includes('bg-rose-600 dark:bg-rose-400'));
});

test('LedgerView.jsx properly excludes Failed from day earnings and pending', () => {
  assert.ok(ledgerCode.includes("item.status === 'Failed' ? 0 : convertEntryCurrency"));
  assert.ok(ledgerQueryCode.includes("else if (e.status === 'Failed')"));
  assert.ok(ledgerQueryCode.includes("totalFailed +="));
});

test('AnalyticsView.jsx properly calculates lostRevenue and excludes Failed from earnings', () => {
  assert.ok(analyticsCode.includes("e.status === 'Failed'"));
  assert.ok(analyticsCode.includes("lostRevenue +="));
  assert.ok(analyticsCode.includes("e.status !== 'Failed'"));
});

test('Financial calculation simulation ignores Failed from earned and pending', () => {
  const mockEntries = [
    { id: '1', status: 'Paid', income: 100 },
    { id: '2', status: 'Pending', income: 50 },
    { id: '3', status: 'Working', income: 30 },
    { id: '4', status: 'Failed', income: 80 },
  ];

  let totalPaid = 0;
  let totalPending = 0;
  let totalFailed = 0;
  let paidCount = 0;
  let failedCount = 0;

  mockEntries.forEach((e) => {
    if (e.status === 'Paid') {
      totalPaid += e.income;
      paidCount++;
    } else if (e.status === 'Failed') {
      totalFailed += e.income;
      failedCount++;
    } else {
      totalPending += e.income;
    }
  });

  const totalValue = totalPaid + totalPending + totalFailed;
  const completionRate = Math.round((paidCount / mockEntries.length) * 100);

  // Paid is 100
  assert.equal(totalPaid, 100);
  // Pending is only Pending (50) + Working (30) = 80. Failed (80) is NOT pending!
  assert.equal(totalPending, 80);
  // Failed is 80
  assert.equal(totalFailed, 80);
  // Total potential value is 260
  assert.equal(totalValue, 260);
  // Completion rate is 1 / 4 = 25%
  assert.equal(completionRate, 25);
});
