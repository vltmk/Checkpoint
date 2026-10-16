import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAutoBackupDue } from '../src/lib/autoBackup.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);

test('a backup that never ran is due for every frequency', () => {
  for (const frequency of ['on_start', 'daily', 'weekly']) {
    assert.equal(isAutoBackupDue({ frequency, lastRunMs: 0, nowMs: NOW, source: 'change' }), true, frequency);
  }
});

test('daily backups wait 24 hours between runs', () => {
  assert.equal(isAutoBackupDue({ frequency: 'daily', lastRunMs: NOW - 23 * HOUR, nowMs: NOW }), false);
  assert.equal(isAutoBackupDue({ frequency: 'daily', lastRunMs: NOW - DAY, nowMs: NOW }), true);
});

test('weekly backups wait 7 days between runs', () => {
  assert.equal(isAutoBackupDue({ frequency: 'weekly', lastRunMs: NOW - 6 * DAY, nowMs: NOW }), false);
  assert.equal(isAutoBackupDue({ frequency: 'weekly', lastRunMs: NOW - 7 * DAY, nowMs: NOW }), true);
});

test('on_start backups run on launch or settings change, never on the periodic timer', () => {
  assert.equal(isAutoBackupDue({ frequency: 'on_start', lastRunMs: NOW - HOUR, nowMs: NOW, source: 'change' }), true);
  assert.equal(isAutoBackupDue({ frequency: 'on_start', lastRunMs: NOW - HOUR, nowMs: NOW, source: 'interval' }), false);
});

test('unknown or missing frequency falls back to daily', () => {
  assert.equal(isAutoBackupDue({ frequency: 'hourly', lastRunMs: NOW - HOUR, nowMs: NOW }), false);
  assert.equal(isAutoBackupDue({ lastRunMs: NOW - 2 * DAY, nowMs: NOW }), true);
});
