// The live feed decides what is shown; the bundled copy is only for when the feed cannot be reached.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterActiveAnnouncements, pickAnnouncementFeed } from '../src/lib/announcementFeed.js';

const feed = JSON.parse(fs.readFileSync(new URL('../announcements.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-10-28T12:00:00Z');
const ann = (id, over = {}) => ({ id, title: id, message: 'm', expiresAt: null, ...over });

test('a loaded feed is the whole truth: retired items in the bundled copy do not come back', () => {
  const remote = [ann('new')];
  const bundled = [ann('old-v4'), ann('new')];
  assert.deepEqual(pickAnnouncementFeed({ remote, bundled }).map((a) => a.id), ['new']);
  // an empty live feed means "nothing to show", not "fall back"
  assert.deepEqual(pickAnnouncementFeed({ remote: [], bundled }), []);
});

test('offline: the last fetched copy first, the bundled copy only when nothing was cached', () => {
  const bundled = [ann('bundled')];
  assert.deepEqual(pickAnnouncementFeed({ remote: null, cached: [ann('cached')], bundled }).map((a) => a.id), ['cached']);
  assert.deepEqual(pickAnnouncementFeed({ remote: null, cached: [], bundled }).map((a) => a.id), ['bundled']);
});

test('in development, local additions to the bundled file show before they are pushed', () => {
  const out = pickAnnouncementFeed({ remote: [ann('live')], bundled: [ann('draft')], devMerge: true });
  assert.deepEqual(out.map((a) => a.id), ['live', 'draft']);
});

test('expired and dismissed announcements are not shown', () => {
  const list = [ann('a'), ann('b', { expiresAt: '2026-10-01T00:00:00Z' }), ann('c')];
  assert.deepEqual(filterActiveAnnouncements(list, ['c'], NOW).map((a) => a.id), ['a']);
});

test('the live feed retires the old v3, v4 and open-source notes and keeps one short Farsi entry', () => {
  const active = filterActiveAnnouncements(feed.announcements.map((a) => ({ ...a, expiresAt: a.expires_at })), [], NOW);
  assert.equal(active.length, 1);
  assert.match(active[0].title + active[0].message, /[؀-ۿ]/, 'the entry is in Farsi');
  for (const old of ['2026-09-13-checkpoint-v4-release-fa', '2026-09-08-checkpoint-v3-overview-fa', '2026-08-27-checkpoint-free-opensource-fa']) {
    // kept in the feed with a past expiry, so the copies bundled in 5.3.0 are overridden instead of added back
    assert.ok(feed.announcements.some((a) => a.id === old && Date.parse(a.expires_at) < NOW), old);
  }
  // every announcement passes the app's own rules: an id, a title and a message
  for (const a of feed.announcements) assert.ok(a.id && a.title && a.message, a.id);
});
