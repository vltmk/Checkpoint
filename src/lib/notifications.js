/**
 * notifications.js - Persistent local Notification Center engine for Checkpoint
 * Stores and manages update alerts, announcement feed items, and local system notifications.
 * Fully offline-first, persisted directly in SQLite / IndexedDB settings.
 */

import { trackerDB } from './db';
import { markAnnouncementDismissed, markAnnouncementSeen } from './announcements';
import {
  getReleaseNotesForVersion,
  getAggregatedReleaseNotes,
  parseMarkdownChangelog,
} from './releaseNotes';

export const NOTIFICATIONS_STORAGE_KEY = 'checkpoint_notifications_history';

/**
 * Compare two semver strings (e.g. "2.1.4" vs "2.1.5", ignores leading 'v').
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1, v2) {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean1 = String(v1).replace(/^v/i, '').trim();
  const clean2 = String(v2).replace(/^v/i, '').trim();

  const p1 = clean1.split('.').map((x) => parseInt(x, 10) || 0);
  const p2 = clean2.split('.').map((x) => parseInt(x, 10) || 0);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Load all stored notifications from SQLite / IndexedDB
 */
export async function getStoredNotifications() {
  try {
    const list = await trackerDB.getSetting(NOTIFICATIONS_STORAGE_KEY, []);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('[Notifications] Failed to load stored notifications:', e);
    return [];
  }
}

/**
 * Save notification list to SQLite / IndexedDB
 */
export async function saveStoredNotifications(notifications) {
  try {
    const cleanList = Array.isArray(notifications) ? notifications : [];
    // Keep max 50 recent notifications
    const trimmed = cleanList.slice(0, 50);
    await trackerDB.setSetting(NOTIFICATIONS_STORAGE_KEY, trimmed);
  } catch (e) {
    console.warn('[Notifications] Failed to save notifications:', e);
  }
}

/**
 * Synchronize and merge active announcements & updates into persistent notification history.
 * Preserves user's read and dismissed flags while pruning stale update notifications.
 */
export function mergeNotificationsIntoHistory(
  existingList = [],
  { updateInfo = null, announcements = null, currentVersion = null, postUpdateInfo = null } = {}
) {
  const existingMap = new Map();
  for (const item of existingList) {
    if (item && item.id) {
      existingMap.set(item.id, item);
    }
  }

  const merged = [];
  const processedIds = new Set();

  // 1. Process Update Notification (Only if version is strictly newer than current installed version)
  if (updateInfo && updateInfo.available && updateInfo.version) {
    const isNewer = currentVersion ? compareSemver(updateInfo.version, currentVersion) > 0 : true;
    if (isNewer) {
      const updateId = `update-${updateInfo.version}`;
      const previous = existingMap.get(updateId);
      const parsedItems = updateInfo.body ? parseMarkdownChangelog(updateInfo.body) : [];

      merged.push({
        id: updateId,
        source: 'updater',
        type: 'info',
        title: `Checkpoint v${updateInfo.version} Available`,
        message: updateInfo.body
          ? `A new version of Checkpoint is ready to download. ${updateInfo.body.slice(0, 140)}...`
          : `A new version of Checkpoint is ready to download and install.`,
        items: parsedItems.slice(0, 4),
        publishedAt: updateInfo.date || new Date().toISOString(),
        read: previous ? Boolean(previous.read) : false,
        dismissed: previous ? Boolean(previous.dismissed) : false,
        pinned: true,
        action: {
          label: 'Install Update',
          type: 'open_update_modal',
          url: updateInfo.releaseUrl,
        },
        data: {
          version: updateInfo.version,
          releaseUrl: updateInfo.releaseUrl,
        },
      });
      processedIds.add(updateId);
    }
  }

  // 2. Process Post-Update "What's New" Welcome Card
  if (postUpdateInfo && postUpdateInfo.version) {
    const welcomeId = `welcome-v${postUpdateInfo.version}`;
    const previous = existingMap.get(welcomeId);
    if (!previous || !previous.dismissed) {
      const language = postUpdateInfo.language || 'en';
      const notesList = postUpdateInfo.fromVersion
        ? getAggregatedReleaseNotes(postUpdateInfo.fromVersion, postUpdateInfo.version, language)
        : [getReleaseNotesForVersion(postUpdateInfo.version, language, postUpdateInfo.body)];

      const primaryNote = notesList[0] || getReleaseNotesForVersion(postUpdateInfo.version, language);
      const allItems = [];

      for (const n of notesList) {
        if (Array.isArray(n.items)) {
          for (const it of n.items) {
            allItems.push({
              tag: it.tag || null,
              text: it.text || String(it),
              version: notesList.length > 1 ? n.version : undefined,
            });
          }
        }
      }

      merged.push({
        id: welcomeId,
        source: 'system',
        type: 'success',
        title: primaryNote.title || `Updated to Checkpoint v${postUpdateInfo.version}`,
        message: primaryNote.summary || (postUpdateInfo.body
          ? `Checkpoint was successfully updated. Highlights: ${postUpdateInfo.body.slice(0, 160)}...`
          : `You are running the latest version of Checkpoint. Enjoy improved speed and reliability.`),
        items: allItems.length > 0 ? allItems : (postUpdateInfo.items || []),
        publishedAt: primaryNote.date ? new Date(primaryNote.date).toISOString() : new Date().toISOString(),
        read: previous ? Boolean(previous.read) : false,
        dismissed: false,
        pinned: true,
        action: {
          label: language === 'fa' ? 'مشاهده لیست تغییرات' : 'View Changelog',
          type: 'external_link',
          url: postUpdateInfo.releaseUrl || `https://github.com/vltmk/Checkpoint/releases/tag/v${postUpdateInfo.version}`,
        },
        data: {
          version: postUpdateInfo.version,
          releaseUrl: postUpdateInfo.releaseUrl,
        },
      });
      processedIds.add(welcomeId);
    }
  }

  // 3. Process Remote Announcements (if provided)
  if (Array.isArray(announcements)) {
    for (const ann of announcements) {
      const annId = `announcement-${ann.id}`;
      const previous = existingMap.get(annId);

      // If user already dismissed it previously, respect dismissal
      if (previous && previous.dismissed) {
        continue;
      }

      merged.push({
        id: annId,
        announcementId: ann.id,
        source: 'announcement',
        type: ann.type || 'info',
        title: ann.title,
        message: ann.message,
        publishedAt: ann.publishedAt || new Date().toISOString(),
        expiresAt: ann.expiresAt || null,
        dismissible: ann.dismissible !== false,
        pinned: Boolean(ann.pinned),
        read: previous ? Boolean(previous.read) : false,
        dismissed: false,
        action: ann.action || null,
        dir: ann.dir || null,
        lang: ann.lang || null,
      });
      processedIds.add(annId);
    }
  }

  // 4. Retain existing notifications that were not replaced, but prune obsolete update notifications
  for (const item of existingList) {
    if (!item || processedIds.has(item.id)) continue;

    // Prune stale updater notifications for versions at or below current installed version
    if (item.source === 'updater' && currentVersion) {
      const itemVersion = item.data?.version || item.id.replace(/^update-/, '');
      if (itemVersion && compareSemver(itemVersion, currentVersion) <= 0) {
        continue; // Prune obsolete update prompt
      }
    }

    merged.push(item);
  }

  // Sort by pinned first, then newest publishedAt
  merged.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  });

  return merged;
}

/**
 * Count active unread notifications
 */
export function countUnreadNotifications(notifications = []) {
  if (!Array.isArray(notifications)) return 0;
  return notifications.filter((n) => !n.read && !n.dismissed).length;
}

/**
 * Mark a specific notification as read
 */
export async function markNotificationAsRead(id, currentList = []) {
  const updated = currentList.map((item) => {
    if (item.id === id) {
      return { ...item, read: true };
    }
    return item;
  });

  // If announcement, mark seen in announcement store
  const target = currentList.find((item) => item.id === id);
  if (target && target.announcementId) {
    await markAnnouncementSeen(target.announcementId);
  }

  await saveStoredNotifications(updated);
  return updated;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(currentList = []) {
  const updated = currentList.map((item) => ({ ...item, read: true }));

  for (const item of currentList) {
    if (item.announcementId) {
      await markAnnouncementSeen(item.announcementId);
    }
  }

  await saveStoredNotifications(updated);
  return updated;
}

/**
 * Dismiss a notification (soft dismissal for persistent history)
 */
export async function dismissNotificationItem(id, currentList = []) {
  const target = currentList.find((item) => item.id === id);
  if (target && target.announcementId) {
    await markAnnouncementDismissed(target.announcementId);
  }

  const updated = currentList.map((item) => {
    if (item.id === id) {
      return { ...item, dismissed: true, read: true };
    }
    return item;
  });
  await saveStoredNotifications(updated);
  return updated;
}

/**
 * Clear all notifications (excluding pinned unread notifications)
 */
export async function clearAllNotificationHistory(currentList = []) {
  for (const item of currentList) {
    if (item && item.announcementId) {
      await markAnnouncementDismissed(item.announcementId);
    }
  }
  const preserved = currentList.filter((n) => n.pinned && !n.read);
  await saveStoredNotifications(preserved);
  return preserved;
}

