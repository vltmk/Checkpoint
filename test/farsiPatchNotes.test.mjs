import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getReleaseNotesForVersion, getAggregatedReleaseNotes } from '../src/lib/releaseNotes.js';

const ARABIC = /[؀-ۿ]/;

test('bundled patch notes are Farsi whatever language the app asks for', () => {
  for (const lang of ['en', 'fa', undefined]) {
    const n = getReleaseNotesForVersion('5.0.0', lang);
    assert.match(n.title, ARABIC);
    assert.match(n.summary, ARABIC);
    assert.ok(n.items.length > 0 && n.items.every((i) => ARABIC.test(i.text)));
  }
  assert.ok(getAggregatedReleaseNotes('4.3.0', '5.0.0', 'en').every((n) => ARABIC.test(n.title)));
});

test('a GitHub release body that holds Farsi then English shows only the Farsi part', () => {
  const body = 'خلاصه فارسی\n\n### Highlights & Changes\n- [NEW] قابلیت جدید\n- [FIX] رفع خطا\n\n---\n\nEnglish summary\n\n### Highlights & Changes\n- [NEW] New thing\n- [FIX] Fixed bug';
  const n = getReleaseNotesForVersion('9.9.9', 'en', body);
  assert.equal(n.summary, 'خلاصه فارسی');
  assert.deepEqual(n.items.map((i) => i.text), ['قابلیت جدید', 'رفع خطا']);
  assert.deepEqual(n.items.map((i) => i.tag), ['new', 'fix']);
});

test('a body with no Farsi still produces notes, and an empty one gets the Farsi generic note', () => {
  assert.deepEqual(getReleaseNotesForVersion('9.9.8', 'en', '- [NEW] Only English').items.map((i) => i.text), ['Only English']);
  assert.match(getReleaseNotesForVersion('9.9.7', 'en').title, ARABIC);
});
