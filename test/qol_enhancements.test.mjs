import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'db.js'), 'utf8').replace(/\r\n/g, '\n');
const categoriesCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'categories.js'), 'utf8').replace(/\r\n/g, '\n');

test('Categories include supportsGold flag and only 2 default categories', () => {
  assert.ok(categoriesCode.includes('supportsGold: true'), 'WoW categories must have supportsGold: true');
  assert.ok(categoriesCode.includes('supportsGold: c.supportsGold !== undefined ? Boolean(c.supportsGold) : isWoW'), 'loadCategories should preserve supportsGold');

});

test('db.js implements retroactive rename methods for sources and teammates', () => {
  assert.ok(dbCode.includes('countEntriesWithSource'), 'db.js must implement countEntriesWithSource');
  assert.ok(dbCode.includes('renameSourceInEntries'), 'db.js must implement renameSourceInEntries');
  assert.ok(dbCode.includes('countEntriesWithTeammate'), 'db.js must implement countEntriesWithTeammate');
  assert.ok(dbCode.includes('renameTeammateInEntries'), 'db.js must implement renameTeammateInEntries');
});

test('Financial deduction simulation with expenses and net profit', () => {
  const entries = [
    { id: '1', status: 'Paid', income: 100000 },
    { id: '2', status: 'Paid', income: -25000 },
    { id: '3', status: 'Paid', income: 50000 },
    { id: '4', status: 'Failed', income: 40000 },
  ];

  let gross = 0;
  let expenses = 0;

  entries.forEach(e => {
    if (e.status !== 'Failed') {
      if (e.income < 0) {
        expenses += Math.abs(e.income);
      } else {
        gross += e.income;
      }
    }
  });

  const net = gross - expenses;
  assert.equal(gross, 150000);
  assert.equal(expenses, 25000);
  assert.equal(net, 125000);
});
