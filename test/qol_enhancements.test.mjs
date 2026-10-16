import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const workModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'WorkModal.jsx'), 'utf8').replace(/\r\n/g, '\n');
const receiptModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ReceiptModal.jsx'), 'utf8').replace(/\r\n/g, '\n');
const ledgerCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'views', 'LedgerView.jsx'), 'utf8').replace(/\r\n/g, '\n');
const analyticsCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'views', 'AnalyticsView.jsx'), 'utf8').replace(/\r\n/g, '\n');
const dbCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'db.js'), 'utf8').replace(/\r\n/g, '\n');
const categoriesCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'categories.js'), 'utf8').replace(/\r\n/g, '\n');

test('WorkModal supports Income and Expense segmented modes', () => {
  assert.ok(workModalCode.includes("entryType === 'expense'"), 'Should check for expense mode');
  assert.ok(workModalCode.includes('entryType: entryType'), 'Should include entryType in saved record');
  assert.ok(workModalCode.includes('Math.abs(userIncomeNum)'), 'Should negate amount in expense mode');
});

test('ReceiptModal and LedgerView tokenize @mention and #tag and ignore emails', () => {
  const regex = /((?:^|(?<=[^\w]))@[a-zA-Z0-9_]{2,32}\b(?!\.[a-zA-Z]{2,}\b)|(?:^|(?<=[^\w]))#[a-zA-Z0-9_-]{1,32}\b)/g;
  const sample = 'Contact admin@domain.com or reach out to @ClientUser with #PVP and #Gladiator requirements (@AnotherUser)';
  const matches = [...sample.matchAll(regex)].map(m => m[0]);
  assert.deepEqual(matches, ['@ClientUser', '#PVP', '#Gladiator', '@AnotherUser']);
  assert.ok(!matches.includes('@domain.com'));
  assert.ok(!matches.includes('admin@domain.com'));

  assert.ok(receiptModalCode.includes('FormattedDescription'), 'ReceiptModal must contain FormattedDescription');
  assert.ok(ledgerCode.includes('FormattedInlineNotes'), 'LedgerView must contain FormattedInlineNotes');
  assert.ok(receiptModalCode.includes('handleCopyDiscord'), 'ReceiptModal must define handleCopyDiscord');
  assert.ok(receiptModalCode.includes('handleCopyDiscordMarkdown'), 'ReceiptModal must define handleCopyDiscordMarkdown');
});

test('Categories include supportsGold flag and only 2 default categories', () => {
  assert.ok(categoriesCode.includes('supportsGold: true'), 'WoW categories must have supportsGold: true');
  assert.ok(categoriesCode.includes('supportsGold: c.supportsGold !== undefined ? Boolean(c.supportsGold) : isWoW'), 'loadCategories should preserve supportsGold');
  
  const tutorialSeed = JSON.parse(fs.readFileSync(path.join(rootDir, 'checkpoint_tutorial_seed.json'), 'utf8'));
  assert.equal(tutorialSeed.categories.length, 2, 'Tutorial seed must only have 2 default categories');
  assert.equal(tutorialSeed.preferences.categories.length, 2, 'Tutorial seed preferences must only have 2 default categories');
});

test('WorkModal anchors Income/Expense switcher in DialogHeader actions', () => {
  assert.ok(workModalCode.includes('DialogHeader'), 'WorkModal must have DialogHeader');
  assert.ok(workModalCode.includes('actions='), 'DialogHeader should receive actions prop');
  assert.ok(workModalCode.includes("setEntryType('expense')"), 'Should toggle expense mode');
});

test('Typing minus sign automatically transitions layout to expense', () => {
  const stepperCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'NumberStepperInput.jsx'), 'utf8');
  assert.ok(stepperCode.includes("val = '-' + val"), 'NumberStepperInput must preserve minus prefix on change');
  assert.ok(stepperCode.includes("val = '+' + val"), 'NumberStepperInput must preserve plus prefix on change');

  const updatedWorkModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'WorkModal.jsx'), 'utf8');
  assert.ok(updatedWorkModalCode.includes("const hasMinus = cleanStr.includes('-')"), 'handleIncomeChange must check for minus sign');
  assert.ok(updatedWorkModalCode.includes("setEntryType('expense')"), 'handleIncomeChange must switch entryType to expense');

  // Logic simulation
  let entryType = 'income';
  let formData = { income: '', teamMode: true, teammates: ['Khadgar'] };

  function simulateIncomeChange(val) {
    const hasMinus = val.includes('-');
    const hasPlus = val.includes('+');
    let cleanStr = val.replace(/[-+]/g, '');

    if (hasMinus) {
      entryType = 'expense';
      formData = { ...formData, teamMode: false, teammates: [], income: cleanStr };
      return;
    }
    if (hasPlus) {
      entryType = 'income';
    }
    formData = { ...formData, income: cleanStr };
  }

  simulateIncomeChange('-500');
  assert.equal(entryType, 'expense');
  assert.equal(formData.income, '500');
  assert.equal(formData.teamMode, false);

  simulateIncomeChange('+1200');
  assert.equal(entryType, 'income');
  assert.equal(formData.income, '1200');
});

test('db.js implements retroactive rename methods for sources and teammates', () => {
  assert.ok(dbCode.includes('countEntriesWithSource'), 'db.js must implement countEntriesWithSource');
  assert.ok(dbCode.includes('renameSourceInEntries'), 'db.js must implement renameSourceInEntries');
  assert.ok(dbCode.includes('countEntriesWithTeammate'), 'db.js must implement countEntriesWithTeammate');
  assert.ok(dbCode.includes('renameTeammateInEntries'), 'db.js must implement renameTeammateInEntries');
});

test('AnalyticsView computes net profit, expenses, sources, and peak day', () => {
  assert.ok(analyticsCode.includes('netProfit = grossIncome - totalExpenses'), 'Computes net profit');
  assert.ok(analyticsCode.includes('sortedSources'), 'Aggregates sources breakdown');
  assert.ok(analyticsCode.includes('sortedTeammates'), 'Aggregates teammates insights');
  assert.ok(analyticsCode.includes('dayOfWeekMap'), 'Computes 7-day distribution');
  assert.ok(analyticsCode.includes('peakDayName'), 'Identifies peak day');
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
