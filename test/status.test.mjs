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
const ledgerQueryCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'ledgerQuery.js'), 'utf8');

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
