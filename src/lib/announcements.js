/**
 * announcements.js - GitHub-hosted static announcement engine for Checkpoint
 * Fetches announcements.json directly from GitHub raw CDN.
 * Fully decoupled from updater, offline-resilient, zero server required.
 */

import { trackerDB } from './db';

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

  if (!id || !title) return null;

  const type = ['info', 'success', 'warning', 'critical'].includes(item.type)
    ? item.type
    : 'info';

  const publishedAt = item.published_at || item.publishedAt || new Date().toISOString();
  const expiresAt = item.expires_at || item.expiresAt || null;
  const dismissible = item.dismissible !== false;
  const pinned = Boolean(item.pinned);

  let action = null;
  if (item.action && typeof item.action === 'object' && item.action.label && item.action.url) {
    if (isSafeActionUrl(item.action.url)) {
      action = {
        label: String(item.action.label).trim(),
        url: String(item.action.url).trim(),
        type: item.action.type || 'external_link',
      };
    }
  }

  return {
    id,
    type,
    title,
    message,
    publishedAt,
    expiresAt,
    dismissible,
    pinned,
    action,
  };
}

/**
 * Retrieve local announcement persistence state from SQLite / IndexedDB
 */
export async function getAnnouncementState() {
  try {
    const saved = await trackerDB.getSetting(ANNOUNCEMENT_STORAGE_KEY, null);
    if (saved && typeof saved === 'object') {
      return {
        seenIds: Array.isArray(saved.seenIds) ? saved.seenIds : [],
        dismissedIds: Array.isArray(saved.dismissedIds) ? saved.dismissedIds : [],
        lastFetchedAt: saved.lastFetchedAt || null,
        cachedAnnouncements: Array.isArray(saved.cachedAnnouncements) ? saved.cachedAnnouncements : [],
      };
    }
  } catch (e) {
    console.warn('[Announcements] Failed to read local announcement state:', e);
  }
  return { ...DEFAULT_STATE };
}

/**
 * Save announcement state to SQLite / IndexedDB
 */
export async function saveAnnouncementState(state) {
  try {
    await trackerDB.setSetting(ANNOUNCEMENT_STORAGE_KEY, state);
  } catch (e) {
    console.warn('[Announcements] Failed to save local announcement state:', e);
  }
}

/**
 * Fetch announcement feed with timeout and fallback.
 * Never throws — always returns an array (cached or newly fetched, or empty array).
 */
export async function fetchAnnouncements(timeoutMs = 5000) {
  const localState = await getAnnouncementState();
  const now = Date.now();

  const fetchUrl = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${url}?_t=${now}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
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
      // Degrade gracefully offline without interrupting startup
      console.info('[Announcements] Remote feed unavailable (offline or unreachable), using cached announcements.');
      return filterActiveAnnouncements(localState.cachedAnnouncements, localState.dismissedIds);
    }
  }

  if (!rawData || !Array.isArray(rawData.announcements)) {
    return filterActiveAnnouncements(localState.cachedAnnouncements, localState.dismissedIds);
  }

  const sanitizedList = rawData.announcements
    .map(sanitizeAnnouncement)
    .filter(Boolean);

  // Update local cache
  localState.cachedAnnouncements = sanitizedList;
  localState.lastFetchedAt = now;
  await saveAnnouncementState(localState);

  return filterActiveAnnouncements(sanitizedList, localState.dismissedIds);
}

/**
 * Filter out expired and dismissed announcements
 */
export function filterActiveAnnouncements(announcements, dismissedIds = []) {
  if (!Array.isArray(announcements)) return [];
  const now = Date.now();
  const dismissedSet = new Set(dismissedIds);

  return announcements.filter((item) => {
    if (!item || !item.id) return false;
    if (dismissedSet.has(item.id)) return false;
    if (item.expiresAt) {
      const expTime = new Date(item.expiresAt).getTime();
      if (!isNaN(expTime) && expTime < now) {
        return false;
      }
    }
    return true;
  });
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

/**
 * Reset local announcement state (useful for settings / testing)
 */
export async function resetAnnouncementState() {
  await saveAnnouncementState({ ...DEFAULT_STATE });
}
