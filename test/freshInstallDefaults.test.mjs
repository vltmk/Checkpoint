import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'db.js'), 'utf8');
const categoriesCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'categories.js'), 'utf8');
const currenciesCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'currencies.js'), 'utf8');

test('db.js: does not inject Direct Client into SQLite schema, migrations, or saveEntry', () => {
  assert.ok(!dbCode.includes("ALTER TABLE work_entries ADD COLUMN source TEXT DEFAULT 'Direct Client';"));
  assert.ok(!dbCode.includes("source TEXT DEFAULT 'Direct Client'"));
  assert.ok(!dbCode.includes("cleanEntry.source || 'Direct Client'"));
  assert.ok(dbCode.includes("finalSource = typeof cleanEntry.source === 'string' ? cleanEntry.source.trim() : ''"));
});

test('categories.js: DEFAULT_CATEGORIES contains only World of Warcraft categories', () => {
  assert.ok(categoriesCode.includes('cat_wow_retail'));
  assert.ok(categoriesCode.includes('cat_wow_classic'));
  assert.ok(!categoriesCode.includes('cat_diablo'));
  assert.ok(!categoriesCode.includes('cat_valorant'));
  assert.ok(!categoriesCode.includes('cat_poe'));
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
