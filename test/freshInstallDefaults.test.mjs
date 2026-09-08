import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const quickAddCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'QuickAddModal.jsx'), 'utf8');
const workModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'WorkModal.jsx'), 'utf8');
const sourceComboboxCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'SourceCombobox.jsx'), 'utf8');
const teammatesComboboxCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'TeammatesCombobox.jsx'), 'utf8');
const dbCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'db.js'), 'utf8');
const categoriesCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'categories.js'), 'utf8');
const currenciesCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'currencies.js'), 'utf8');
const receiptModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ReceiptModal.jsx'), 'utf8');

test('QuickAddModal: does not use or store sticky LAST_SOURCE_KEY and always resets source to empty', () => {
  assert.ok(!quickAddCode.includes('LAST_SOURCE_KEY'));
  assert.ok(quickAddCode.includes("setSource('');"));
  assert.ok(quickAddCode.includes("localStorage.removeItem('checkpoint_quick_last_source');"));
  assert.ok(quickAddCode.includes('source: source.trim(),'));
  assert.ok(!quickAddCode.includes("source: source.trim() || 'Direct Client'"));
});

test('WorkModal: does not default source to Direct Client and sanitizes legacy drafts', () => {
  assert.ok(!workModalCode.includes("formData.source.trim() || 'Direct Client'"));
  assert.ok(workModalCode.includes("parsed.source === 'Direct Client' ? '' : parsed.source"));
  assert.ok(workModalCode.includes("source: formData.source ? formData.source.trim() : ''"));
});

test('db.js: does not inject Direct Client into SQLite schema, migrations, or saveEntry', () => {
  assert.ok(!dbCode.includes("ALTER TABLE work_entries ADD COLUMN source TEXT DEFAULT 'Direct Client';"));
  assert.ok(!dbCode.includes("source TEXT DEFAULT 'Direct Client'"));
  assert.ok(!dbCode.includes("cleanEntry.source || 'Direct Client'"));
  assert.ok(dbCode.includes("finalSource = typeof cleanEntry.source === 'string' ? cleanEntry.source.trim() : ''"));
});

test('SourceCombobox & TeammatesCombobox: disable browser autocomplete and default to empty lists', () => {
  assert.ok(sourceComboboxCode.includes('autoComplete="off"'));
  assert.ok(teammatesComboboxCode.includes('autoComplete="off"'));
  assert.ok(sourceComboboxCode.includes('return [];'));
  assert.ok(teammatesComboboxCode.includes('return [];'));
});

test('categories.js: DEFAULT_CATEGORIES contains only World of Warcraft categories', () => {
  assert.ok(categoriesCode.includes('cat_wow_retail'));
  assert.ok(categoriesCode.includes('cat_wow_classic'));
  assert.ok(!categoriesCode.includes('cat_diablo'));
  assert.ok(!categoriesCode.includes('cat_valorant'));
  assert.ok(!categoriesCode.includes('cat_poe'));
});

test('currencies.js and ReceiptModal: empty source displays as dash instead of Direct Client', () => {
  assert.ok(currenciesCode.includes("Source     = ${entry.source || '-'}$"));
  assert.ok(!currenciesCode.includes("Source     = ${entry.source || 'Direct Client'}$"));
  assert.ok(receiptModalCode.includes("Job Source: ${safeEntry.source || '-'}$"));
  assert.ok(!receiptModalCode.includes("Job Source: ${safeEntry.source || 'Direct Client'}$"));
});

test('db.js: REQUIRED_WORK_ENTRY_COLUMNS and migrations include pot, teamInputMode, and teammateCuts', () => {
  assert.ok(dbCode.includes("'pot'"));
  assert.ok(dbCode.includes("'teamInputMode'"));
  assert.ok(dbCode.includes("'teammateCuts'"));
  assert.ok(dbCode.includes("pot: 'ALTER TABLE work_entries ADD COLUMN pot REAL DEFAULT NULL;'"));
  assert.ok(dbCode.includes("teamInputMode: \"ALTER TABLE work_entries ADD COLUMN teamInputMode TEXT DEFAULT 'pot';\""));
  assert.ok(dbCode.includes("teammateCuts: \"ALTER TABLE work_entries ADD COLUMN teammateCuts TEXT DEFAULT '{}';\""));
  assert.ok(dbCode.includes('w.pot, w.teamInputMode, w.teammateCuts'));
  assert.ok(dbCode.includes('cleanEntry.pot = finalPot;'));
  assert.ok(dbCode.includes('cleanEntry.teamInputMode = finalTeamInputMode;'));
});

test('WorkModal: preserves teamInputMode and pot on editingEntry and submission', () => {
  assert.ok(workModalCode.includes("teamInputMode: editingEntry.teamInputMode || (editingEntry.pot !== null && editingEntry.pot !== undefined ? 'pot' : 'income')"));
  assert.ok(workModalCode.includes("teamInputMode: formData.teamMode ? formData.teamInputMode : 'pot'"));
});

