import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RELEASE_NOTES_REGISTRY, getReleaseNotesForVersion, getAggregatedReleaseNotes } from '../src/lib/releaseNotes.js';
import { mergeNotificationsIntoHistory } from '../src/lib/notificationMerge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARABIC = /[؀-ۿ]/;
const version = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8')).version;

test('every bundled release has Farsi and English notes with the same number of items', () => {
  for (const [ver, entry] of Object.entries(RELEASE_NOTES_REGISTRY)) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, ver);
    assert.ok(entry.title.fa && entry.title.en && entry.summary.fa && entry.summary.en, `${ver} has titles and summaries in both languages`);
    assert.match(entry.title.fa, ARABIC, ver);
    assert.match(entry.summary.fa, ARABIC, ver);
    assert.ok(entry.items.fa.length > 0, ver);
    assert.equal(entry.items.fa.length, entry.items.en.length, `${ver}: Farsi and English item counts match`);
    entry.items.fa.forEach((item, i) => {
      assert.match(item.text, ARABIC, `${ver} item ${i} is Farsi`);
      assert.equal(item.tag, entry.items.en[i].tag, `${ver} item ${i} has the same tag in both languages`);
    });
  }
});

test('the version being built has release notes, so a release can never go out without them', () => {
  assert.ok(RELEASE_NOTES_REGISTRY[version], `add v${version} to RELEASE_NOTES_REGISTRY`);
});

test('old versions are not carried around: the registry holds the current release only', () => {
  assert.deepEqual(Object.keys(RELEASE_NOTES_REGISTRY), [version]);
});

test('in-app notes are Farsi whatever language the app asks for, and upgrading from an old version shows the new notes', () => {
  assert.match(getReleaseNotesForVersion(version, 'en').title, ARABIC);
  const jump = getAggregatedReleaseNotes('4.5.0', version, 'en');
  assert.equal(jump.length, 1);
  assert.equal(jump[0].version, version);
});

test('the release script prints Farsi first, then English, and refuses a version with no notes', () => {
  const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'extractReleaseNotes.mjs'), `v${version}`], { encoding: 'utf8' });
  const [fa, en] = out.split('\n---\n');
  assert.match(fa, ARABIC);
  assert.ok(!ARABIC.test(en), 'the English half has no Farsi');
  assert.match(en, /### Highlights & Changes/);
  const missing = spawnSync(process.execPath, [path.join(root, 'scripts', 'extractReleaseNotes.mjs'), 'v99.0.0'], { encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /No release notes for v99\.0\.0/);
});

const OLD_ENGLISH_WELCOME = { id: 'welcome-v4.5.0', source: 'system', type: 'success', title: 'Updated to Checkpoint v4.5.0', message: 'English', items: [{ text: 'English note' }], read: true, dismissed: false, data: { version: '4.5.0' }, publishedAt: '2026-09-01T00:00:00Z' };

test('the notification centre shows the installed version\'s notes in Farsi and drops the old ones', () => {
  const list = mergeNotificationsIntoHistory([OLD_ENGLISH_WELCOME], { currentVersion: version });
  assert.equal(list.some((n) => n.id === 'welcome-v4.5.0'), false, 'the old English card is gone');
  const card = list.find((n) => n.id === `welcome-v${version}`);
  assert.ok(card, 'the installed version has its card even without an upgrade launch');
  assert.match(card.title, ARABIC);
  assert.match(card.message, ARABIC);
  assert.ok(card.items.length > 0 && card.items.every((i) => ARABIC.test(i.text)));
  assert.match(card.action.label, ARABIC);
});

test('reading or dismissing the card sticks, and it does not duplicate on the next start', () => {
  let list = mergeNotificationsIntoHistory([], { currentVersion: version });
  list = list.map((n) => (n.id === `welcome-v${version}` ? { ...n, read: true } : n));
  list = mergeNotificationsIntoHistory(list, { currentVersion: version });
  assert.equal(list.filter((n) => n.id === `welcome-v${version}`).length, 1);
  assert.equal(list.find((n) => n.id === `welcome-v${version}`).read, true);
  const dismissed = list.map((n) => (n.id === `welcome-v${version}` ? { ...n, dismissed: true } : n));
  const again = mergeNotificationsIntoHistory(dismissed, { currentVersion: version });
  assert.equal(again.find((n) => n.id === `welcome-v${version}`).dismissed, true);
});

test('an available update carries Farsi notes taken from the Farsi half of the GitHub release body', () => {
  const body = 'خلاصه فارسی\n\n### نکات و تغییرات\n- [NEW] قابلیت جدید\n\n---\n\nEnglish summary\n\n### Highlights & Changes\n- [NEW] New thing';
  const list = mergeNotificationsIntoHistory([], { updateInfo: { available: true, version: '9.9.9', body }, currentVersion: version });
  const update = list.find((n) => n.id === 'update-9.9.9');
  assert.ok(update, 'an update newer than the installed version is listed (this threw before: compareSemver was never imported)');
  assert.match(update.title, ARABIC);
  assert.equal(update.message, 'خلاصه فارسی');
  assert.deepEqual(update.items.map((i) => i.text), ['قابلیت جدید']);
});

test('announcements from the remote feed are kept alongside, untouched by the notes cleanup', () => {
  const list = mergeNotificationsIntoHistory([], { currentVersion: version, announcements: [{ id: 'a1', type: 'info', title: 'Hello', message: 'World', publishedAt: '2026-10-01T00:00:00Z' }] });
  assert.ok(list.some((n) => n.id === 'announcement-a1'));
});
