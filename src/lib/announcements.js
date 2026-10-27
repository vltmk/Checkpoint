/**
 * announcements.js - GitHub-hosted static announcement engine for Checkpoint
 * Fetches announcements.json directly from GitHub raw CDN.
 * Fully decoupled from updater, offline-resilient, zero server required.
 */

import { trackerDB } from './db';
import { isRTL } from './utils';
import localAnnouncementsFeed from '../../announcements.json';
import { filterActiveAnnouncements, pickAnnouncementFeed } from './announcementFeed';

export { filterActiveAnnouncements };

export const ANNOUNCEMENT_STORAGE_KEY = 'checkpoint_announcements_state';

const PRIMARY_FEED_URL = 'https://raw.githubusercontent.com/vltmk/Checkpoint/main/announcements.json';
const FALLBACK_FEED_URL = 'https://cdn.jsdelivr.net/gh/vltmk/Checkpoint@main/announcements.json';

const DEFAULT_STATE = {
  seenIds: [],
  dismissedIds: [],
  lastFetchedAt: null,
  cachedAnnouncements: [],
};

/**
 * Validate that an external action URL is safe (strictly HTTPS or trusted HTTP localhost).
 */
export function isSafeActionUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost');
  } catch (e) {
    return false;
  }
}

/**
 * Sanitize and validate single raw announcement item from feed.
 */
export function sanitizeAnnouncement(item) {
  if (!item || typeof item !== 'object') return null;
  const id = typeof item.id === 'string' ? item.id.trim() : null;
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const message = typeof item.message === 'string' ? item.message.trim() : '';

  if (!id || !title || !message) return null;

  const parseAction = (act) => {
    if (!act || typeof act !== 'object') return null;
    const url = typeof act.url === 'string' ? act.url.trim() : '';
    const label = typeof act.label === 'string' ? act.label.trim() : 'View Details';
    const type = act.type || (url.endsWith('.exe') ? 'download' : 'external_link');
    const variant = act.variant === 'primary' ? 'primary' : 'secondary';
    if (url && isSafeActionUrl(url)) {
      return {
        label,
        url,
        type,
        variant,
      };
    }
    return null;
  };

  let safeActions = [];
  if (Array.isArray(item.actions)) {
    safeActions = item.actions.map(parseAction).filter(Boolean);
  } else if (item.action) {
    const single = parseAction(item.action);
    if (single) safeActions.push(single);
  }

  const explicitDir = item.dir === 'rtl' || item.dir === 'ltr' ? item.dir : null;
  const lang = typeof item.lang === 'string' ? item.lang.trim().toLowerCase() : null;
  const computedDir = explicitDir || (lang === 'fa' || lang === 'per' || lang === 'ar' || isRTL(title) || isRTL(message) ? 'rtl' : 'ltr');

  let safeItems = null;
  if (Array.isArray(item.items)) {
    safeItems = item.items
      .filter((it) => it && (typeof it === 'string' || typeof it === 'object'))
      .map((it) => {
        if (typeof it === 'string') return { text: it.trim() };
        return {
          text: typeof it.text === 'string' ? it.text.trim() : '',
          tag: typeof it.tag === 'string' ? it.tag.trim() : null,
          version: typeof it.version === 'string' ? it.version.trim() : null,
        };
      })
      .filter((it) => it.text);
  }

  return {
    id,
    type: ['info', 'warning', 'critical', 'success'].includes(item.type) ? item.type : 'info',
    title,
    message,
    items: safeItems,
    publishedAt: item.published_at || item.publishedAt || new Date().toISOString(),
    expiresAt: item.expires_at || item.expiresAt || null,
    dismissible: item.dismissible !== false,
    pinned: Boolean(item.pinned),
    action: safeActions[0] || null,
    actions: safeActions,
    dir: computedDir,
    lang: lang || (computedDir === 'rtl' ? 'fa' : 'en'),
  };
}

/**
 * Obtain persistent local announcement state
 */
export async function getAnnouncementState() {
  try {
    const saved = await trackerDB.getSetting(ANNOUNCEMENT_STORAGE_KEY, null);
    if (saved) {
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
      if (parsed && typeof parsed === 'object') {
        return {
          seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds : [],
          dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
          lastFetchedAt: parsed.lastFetchedAt || null,
          cachedAnnouncements: Array.isArray(parsed.cachedAnnouncements) ? parsed.cachedAnnouncements : [],
        };
      }
    }
  } catch (err) {
    console.warn('[Announcements] Failed to load local announcement state:', err);
  }
  return { ...DEFAULT_STATE };
}

/**
 * Save persistent local announcement state
 */
export async function saveAnnouncementState(state) {
  try {
    await trackerDB.setSetting(ANNOUNCEMENT_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[Announcements] Failed to save local announcement state:', err);
  }
}

/**
 * Fetch announcement feed with timeout and fallback.
 * Never throws — always returns an array (cached or newly fetched, or empty array).
 */
export async function fetchAnnouncements(timeoutMs = 5000) {
  const localState = await getAnnouncementState();
  const now = Date.now();

  const localBundledList = Array.isArray(localAnnouncementsFeed?.announcements)
    ? localAnnouncementsFeed.announcements
        .map(sanitizeAnnouncement)
        .filter(Boolean)
    : [];

  const fetchUrl = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${url}?_t=${now}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  let rawData = null;
  try {
    rawData = await fetchUrl(PRIMARY_FEED_URL);
  } catch (primaryErr) {
    try {
      rawData = await fetchUrl(FALLBACK_FEED_URL);
    } catch (fallbackErr) {
      console.info('[Announcements] Remote feed unavailable, using the cached or bundled feed.');
      rawData = null;
    }
  }

  const remote = rawData && Array.isArray(rawData.announcements)
    ? rawData.announcements.map(sanitizeAnnouncement).filter(Boolean)
    : null;
  const list = pickAnnouncementFeed({
    remote,
    cached: localState.cachedAnnouncements,
    bundled: localBundledList,
    devMerge: Boolean(import.meta.env?.DEV),
  });

  if (remote) {
    // only a successful fetch replaces the cache, so an outage never empties it
    localState.cachedAnnouncements = list;
    localState.lastFetchedAt = now;
    await saveAnnouncementState(localState);
  }

  return filterActiveAnnouncements(list, localState.dismissedIds);
}


/**
 * Mark an announcement as seen
 */
export async function markAnnouncementSeen(id) {
  if (!id) return;
  const state = await getAnnouncementState();
  if (!state.seenIds.includes(id)) {
    state.seenIds.push(id);
    await saveAnnouncementState(state);
  }
}

/**
 * Mark an announcement as dismissed
 */
export async function markAnnouncementDismissed(id) {
  if (!id) return;
  const state = await getAnnouncementState();
  if (!state.dismissedIds.includes(id)) {
    state.dismissedIds.push(id);
  }
  if (!state.seenIds.includes(id)) {
    state.seenIds.push(id);
  }
  await saveAnnouncementState(state);
}
