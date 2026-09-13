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
const workModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'WorkModal.jsx'), 'utf8');
const ledgerCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'views', 'LedgerView.jsx'), 'utf8');
const analyticsCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'views', 'AnalyticsView.jsx'), 'utf8');
const receiptCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ReceiptModal.jsx'), 'utf8');
const settingsCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'SettingsModal.jsx'), 'utf8');
const onboardingCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'ProfileOnboardingModal.jsx'), 'utf8');
const appCode = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf8');

test('ProfileOnboardingModal supports onSelectRole and onComplete dismiss callbacks', () => {
  assert.ok(onboardingCode.includes('onSelectRole'));
  assert.ok(onboardingCode.includes('onComplete'));
  assert.ok(appCode.includes('onSelectRole='));
  assert.ok(appCode.includes('onComplete='));
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

test('WorkModal.jsx: implements Order ID, sourcePaid toggle, and fee presets for Advertiser', () => {
  assert.ok(workModalCode.includes("isAdvertiser"));
  assert.ok(workModalCode.includes("orderId"));
  assert.ok(workModalCode.includes("sourcePaid"));
  assert.ok(workModalCode.includes("handleAdvertiserFeeRateChange"));
});

test('LedgerView.jsx: displays Net Profit, Order ID chip, and 1-click sourcePaid settlement pill', () => {
  assert.ok(ledgerCode.includes("activeProfileId"));
  assert.ok(ledgerCode.includes("onUpdateSourcePaid"));
  assert.ok(ledgerCode.includes("settlementFilter"));
  assert.ok(ledgerCode.includes("sourcePaid"));
});

test('AnalyticsView.jsx: renders Advertiser KPIs and Cashflow Float balance card', () => {
  assert.ok(analyticsCode.includes("isAdvertiser"));
  assert.ok(analyticsCode.includes("totalClientVolume"));
  assert.ok(analyticsCode.includes("totalBoosterPayouts"));
  assert.ok(analyticsCode.includes("pendingInflow"));
  assert.ok(analyticsCode.includes("pendingOutflow"));
  assert.ok(analyticsCode.includes("marginPercentage"));
});

test('ReceiptModal.jsx: supports dual mode toggle for Client Receipt and Booster Payout Slip', () => {
  assert.ok(receiptCode.includes("activeProfileId"));
  assert.ok(receiptCode.includes("receiptMode"));
  assert.ok(receiptCode.includes("isAdvertiser"));
  assert.ok(receiptCode.includes("handleCopyText"));
  assert.ok(receiptCode.includes("handleCopyDiscord"));
});

test('SettingsModal.jsx: displays active profile badge and isolated database name', () => {
  assert.ok(settingsCode.includes("activeProfileId"));
  assert.ok(settingsCode.includes("checkpoint_advertiser.db"));
  assert.ok(settingsCode.includes("checkpoint.db"));
});
