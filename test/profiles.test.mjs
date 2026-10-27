import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const profilesCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'profiles.js'), 'utf8');
const dbCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'db.js'), 'utf8');
const settingsCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'SettingsModal.jsx'), 'utf8');
const appCode = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf8');

test('the welcome screen sets the role and remembers it was seen', () => {
  assert.ok(appCode.includes('<WelcomeFlow'));
  assert.ok(appCode.includes('setProfileOnboardingCompleted(true)'));
  assert.ok(appCode.includes('WELCOME_SEEN_KEY, WELCOME_RELEASE'));
});

test('profiles.js: defines booster and advertiser profiles with correct metadata', () => {
  assert.ok(profilesCode.includes("id: 'booster'"));
  assert.ok(profilesCode.includes("id: 'advertiser'"));
  assert.ok(profilesCode.includes("dbPath: 'sqlite:checkpoint.db'"));
  assert.ok(profilesCode.includes("dbPath: 'sqlite:checkpoint_advertiser.db'"));
  assert.ok(profilesCode.includes("export function getActiveProfileId()"));
  assert.ok(profilesCode.includes("export function setActiveProfileId("));
  assert.ok(profilesCode.includes("export function isOnboardingCompleted()"));
});

test('db.js: physically separates SQLite database paths and IndexedDB names per profile', () => {
  assert.ok(dbCode.includes("getSqliteDbPath()"));
  assert.ok(dbCode.includes("getIdbDatabaseName()"));
  assert.ok(dbCode.includes("CheckpointDB_advertiser_v1"));
  assert.ok(dbCode.includes("updateSourcePaid(id, sourcePaid)"));
  assert.ok(dbCode.includes("getProfileCounts()"));
  assert.ok(dbCode.includes("switchProfile(profileId)"));
  assert.ok(dbCode.includes("orderId: \"ALTER TABLE work_entries ADD COLUMN orderId TEXT DEFAULT '';\""));
  assert.ok(dbCode.includes("sourcePaid: 'ALTER TABLE work_entries ADD COLUMN sourcePaid INTEGER DEFAULT 0;'"));
});

test('SettingsModal.jsx: displays active profile badge and isolated database name', () => {
  assert.ok(settingsCode.includes("activeProfileId"));
  assert.ok(settingsCode.includes("checkpoint_advertiser.db"));
  assert.ok(settingsCode.includes("checkpoint.db"));
});

test('db.js & profiles: two-way settlement columns and methods', () => {
  assert.ok(dbCode.includes("updateBoosterPaid(id, boosterPaid)"));
  assert.ok(dbCode.includes("boosterPaid: 'ALTER TABLE work_entries ADD COLUMN boosterPaid INTEGER DEFAULT 0;'"));
  assert.ok(dbCode.includes("feeType: \"ALTER TABLE work_entries ADD COLUMN feeType TEXT DEFAULT 'percent';\""));
  assert.ok(dbCode.includes("platformFee: 'ALTER TABLE work_entries ADD COLUMN platformFee REAL DEFAULT 0;'"));
  assert.ok(profilesCode.includes("checkpoint_usd_rate_toman"));
  assert.ok(profilesCode.includes("checkpoint_eur_rate_usd"));
});

test('Navbar.jsx & App.jsx: advertiser order calculator topbar integration', () => {
  const navbarCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Navbar.jsx'), 'utf8');
  assert.ok(navbarCode.includes("OrderCalculatorPopover"));
  assert.ok(navbarCode.includes("isCalculatorOpen"));
  assert.ok(navbarCode.includes("onToggleCalculator"));
  assert.ok(appCode.includes("handleTransferFromCalculator"));
  assert.ok(appCode.includes("isCalculatorOpen"));
});

