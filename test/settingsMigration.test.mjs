import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMigratedValue } from '../src/lib/settingsMigration.js';

test('the localStorage mirror wins over older database rows', () => {
  const value = chooseMigratedValue([
    { value: 'USD', fromLocalStorage: true },
    { value: 'EUR', updatedAt: 1792095621 },
    { value: 'TOMAN', updatedAt: 1792095625 },
  ]);
  assert.equal(value, 'USD');
});

test('without a mirror, the newest database row wins', () => {
  const value = chooseMigratedValue([
    { value: 'EUR', updatedAt: 1792095621 },
    { value: 'TOMAN', updatedAt: 1792095625 },
  ]);
  assert.equal(value, 'TOMAN');
});

test('an older mirror still wins, because it is the latest write across profiles', () => {
  const value = chooseMigratedValue([
    { value: '4.0.0', fromLocalStorage: true },
    { value: '2.1.4', updatedAt: 1787648362 },
  ]);
  assert.equal(value, '4.0.0');
});

test('returns null when no candidate has a value', () => {
  assert.equal(chooseMigratedValue([]), null);
  assert.equal(chooseMigratedValue([{ value: null, fromLocalStorage: true }, { value: undefined, updatedAt: 1 }]), null);
});

test('an empty string is a real value, not a missing one', () => {
  assert.equal(chooseMigratedValue([{ value: '', updatedAt: 5 }]), '');
});

test('form drafts are keyed by profile, so a Booster draft never opens in the Advertiser profile', async () => {
  const fs = await import('node:fs');
  const hook = fs.readFileSync(new URL('../src/components/ledger/useFormDraft.js', import.meta.url), 'utf8');
  assert.match(hook, /DRAFT_PREFIX\}\$\{profileId\}_/);
});
