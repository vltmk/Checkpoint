import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWindowsSecurityBlockedError, getStandaloneInstallerUrl } from '../src/lib/updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('isWindowsSecurityBlockedError: correctly identifies Windows SAC and policy error codes', () => {
  // Common Windows error 1260 formats from Tauri updater
  assert.equal(isWindowsSecurityBlockedError('os error 1260'), true);
  assert.equal(isWindowsSecurityBlockedError('OS error 1260 (This program is blocked by group policy.)'), true);
  assert.equal(isWindowsSecurityBlockedError('Failed to run installer: This program is blocked by group policy.'), true);
  assert.equal(isWindowsSecurityBlockedError('Smart App Control blocked the application'), true);
  assert.equal(isWindowsSecurityBlockedError('smartappcontrol blocked installer'), true);
  assert.equal(isWindowsSecurityBlockedError('SmartScreen prevented an unrecognized app from starting'), true);
  assert.equal(isWindowsSecurityBlockedError('ERROR_ACCESS_DISABLED_BY_POLICY'), true);
  assert.equal(isWindowsSecurityBlockedError('The operation did not complete successfully because the file contains a virus or potentially unwanted software'), true);
  assert.equal(isWindowsSecurityBlockedError('Access is denied (os error 5)'), true);

  // Standard non-security errors should return false
  assert.equal(isWindowsSecurityBlockedError('Update check timeout'), false);
  assert.equal(isWindowsSecurityBlockedError('Network request failed: 404 Not Found'), false);
  assert.equal(isWindowsSecurityBlockedError('Failed to fetch latest.json'), false);
  assert.equal(isWindowsSecurityBlockedError(''), false);
  assert.equal(isWindowsSecurityBlockedError(null), false);
  assert.equal(isWindowsSecurityBlockedError(undefined), false);
});

test('getStandaloneInstallerUrl: correctly constructs standalone installer link', () => {
  assert.equal(
    getStandaloneInstallerUrl('4.2.0'),
    'https://github.com/vltmk/Checkpoint/releases/download/v4.2.0/CHECKPOINT_4.2.0_x64-setup.exe'
  );
  assert.equal(
    getStandaloneInstallerUrl('v4.2.0'),
    'https://github.com/vltmk/Checkpoint/releases/download/v4.2.0/CHECKPOINT_4.2.0_x64-setup.exe'
  );
  assert.equal(
    getStandaloneInstallerUrl(''),
    'https://github.com/vltmk/Checkpoint/releases/latest'
  );
});

test('UpdateModal.jsx wires Smart App Control error UX and fallback download', () => {
  const updateModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'UpdateModal.jsx'), 'utf8');
  assert.ok(updateModalCode.includes('ShieldAlert'), 'Should import ShieldAlert icon');
  assert.ok(updateModalCode.includes('isWindowsSecurityBlockedError'), 'Should import isWindowsSecurityBlockedError');
  assert.ok(updateModalCode.includes('getStandaloneInstallerUrl'), 'Should import getStandaloneInstallerUrl');
  assert.ok(updateModalCode.includes('Smart App Control'), 'Should contain Smart App Control badge');
  assert.ok(updateModalCode.includes('handleDownloadInstaller'), 'Should implement handleDownloadInstaller');
});

test('i18n contains English and Persian translations for Windows Security / SAC block', () => {
  const i18nCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'i18n.jsx'), 'utf8');
  assert.ok(i18nCode.includes("'update.securityBlockedTitle'"), 'Must define securityBlockedTitle');
  assert.ok(i18nCode.includes("'update.securityBlockedDesc'"), 'Must define securityBlockedDesc');
  assert.ok(i18nCode.includes("'update.settingsPreserved'"), 'Must define settingsPreserved');
  assert.ok(i18nCode.includes("'update.downloadInstaller'"), 'Must define downloadInstaller');
  assert.ok(i18nCode.includes('مسدود شده توسط امنیت ویندوز'), 'Must contain Persian translation');
  assert.ok(i18nCode.includes('Blocked by Windows Security'), 'Must contain English translation');
});
