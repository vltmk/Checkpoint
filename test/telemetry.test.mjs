import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const telemetryCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'telemetry.js'), 'utf8').replace(/\r\n/g, '\n');
const i18nCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'i18n.jsx'), 'utf8').replace(/\r\n/g, '\n');

test('telemetry posts directly to Aptabase EU and does not patch global fetch', () => {
  assert.ok(telemetryCode.includes("https://eu.aptabase.com/api/v0/event"));
  assert.ok(!telemetryCode.includes("from '@aptabase/web'"), 'SDK import removed');
  assert.ok(!telemetryCode.includes('globalThis.fetch ='), 'no global fetch monkey-patching');
  assert.ok(telemetryCode.includes('return Boolean(res && res.ok);'), 'delivery verified by HTTP status');
});

test('initTelemetry releases the latch when disabled so a later opt-in works without restart', () => {
  const disabledBranch = telemetryCode.match(/if \(!enabled \|\| isDevBuild\(\)\) \{[\s\S]*?return;\n\s*\}/);
  assert.ok(disabledBranch, 'disabled branch exists');
  assert.ok(disabledBranch[0].includes('initPromise = null;'), 'latch reset in disabled branch');
});

test('flushDailyTelemetry does not await initPromise (would deadlock when called from init)', () => {
  const flush = telemetryCode.slice(telemetryCode.indexOf('export async function flushDailyTelemetry'));
  assert.ok(!flush.includes('await initPromise'), 'no self-await inside init chain');
});

test('local counters are not incremented while telemetry is disabled', () => {
  const gated = telemetryCode.match(/if \(!\(await isTelemetryEnabled\(\)\)\) return;/g) || [];
  assert.equal(gated.length, 2, 'both work and receipt counters are gated');
});

test('disabling telemetry clears pending counters', () => {
  assert.ok(telemetryCode.includes("setSetting(STORAGE_KEYS.PENDING_WORKS, '0')"));
  assert.ok(telemetryCode.includes("setSetting(STORAGE_KEYS.PENDING_RECEIPTS, '0')"));
});

test('telemetry copy does not claim crash statistics are collected', () => {
  const en = i18nCode.match(/'settings\.telemetryDesc': '([^']*)'/);
  assert.ok(en, 'English telemetry description exists');
  assert.ok(!/crash/i.test(en[1]), 'no crash claim in English copy');
});

// Anonymous metrics are on by default on a fresh install and after an update: only an explicit "off" turns them off.
test('anonymous metrics default to on when nothing was ever saved', () => {
  const appCode = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf8');
  assert.match(appCode, /setTelemetryEnabledState\]\s*=\s*useState\(\(\)\s*=>\s*\{\s*return parseBooleanSetting\(null, true\);/);
  assert.match(appCode, /parseBooleanSetting\(savedTelemetry, true\)/);
  assert.match(telemetryCode, /getSetting\(STORAGE_KEYS\.ENABLED, true\)/);
});

test('no migration or update path writes telemetry off on its own', () => {
  const sources = ['App.jsx', 'lib/db.js', 'lib/settingsMigration.js', 'lib/updater.js']
    .map((f) => path.join(rootDir, 'src', f))
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, 'utf8'));
  for (const src of sources) {
    assert.doesNotMatch(src, /setSetting\(\s*['"]checkpoint_telemetry_enabled['"]\s*,\s*false/);
  }
});
