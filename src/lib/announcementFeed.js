/**
 * announcementFeed.js - which announcements are shown, as pure functions (no network, no storage).
 *
 * The live feed (announcements.json on GitHub's main branch) is the truth. The copy bundled in the app is only for
 * when the feed cannot be reached and nothing was cached yet: merging it in on every start would bring back
 * announcements that were retired from the live feed after that build shipped.
 */

/**
 * The list to show, before expiry and dismissals are applied.
 *  remote:  the sanitised live feed, or null when it could not be read
 *  cached:  what the last successful fetch saved
 *  bundled: the copy shipped with the app
 *  devMerge: in development, local additions to the bundled file show up before they are pushed
 */
export function pickAnnouncementFeed({ remote = null, cached = [], bundled = [], devMerge = false }) {
  if (Array.isArray(remote)) {
    if (!devMerge) return remote;
    const merged = [...remote];
    for (const item of bundled) if (!merged.some((r) => r.id === item.id)) merged.push(item);
    return merged;
  }
  return cached.length > 0 ? cached : bundled;
}

/** Drop expired and dismissed announcements. */
export function filterActiveAnnouncements(announcements, dismissedIds = [], now = Date.now()) {
  if (!Array.isArray(announcements)) return [];
  const dismissedSet = new Set(dismissedIds);
  return announcements.filter((item) => {
    if (!item || !item.id) return false;
    if (dismissedSet.has(item.id)) return false;
    if (item.expiresAt) {
      const expTime = new Date(item.expiresAt).getTime();
      if (!Number.isNaN(expTime) && expTime < now) return false;
    }
    return true;
  });
}
