/**
 * notifications.js - Persistent local Notification Center engine for Checkpoint
 * Stores and manages update alerts, announcement feed items, and local system notifications.
 * Fully offline-first, persisted directly in SQLite / IndexedDB settings.
 */

import { trackerDB } from './db';
import { markAnnouncementDismissed, markAnnouncementSeen } from './announcements';

export const NOTIFICATIONS_STORAGE_KEY = 'checkpoint_notifications_history';

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
 * Preserves user's read and dismissed flags.
 */
export function mergeNotificationsIntoHistory(existingList = [], { updateInfo = null, announcements = null } = {}) {
  const existingMap = new Map();
  for (const item of existingList) {
    if (item && item.id) {
      existingMap.set(item.id, item);
    }
  }

  const merged = [];
  const processedIds = new Set();

  // 1. Process Update Notification
  if (updateInfo && updateInfo.available && updateInfo.version) {
    const updateId = `update-${updateInfo.version}`;
    const previous = existingMap.get(updateId);
    merged.push({
      id: updateId,
      source: 'updater',
      type: 'info',
      title: `Checkpoint v${updateInfo.version} Available`,
      message: updateInfo.body
        ? `A new version of Checkpoint is ready to download. ${updateInfo.body.slice(0, 140)}...`
        : `A new version of Checkpoint is ready to download and install.`,
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

  // 2. Process Remote Announcements (if provided)
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
      });
      processedIds.add(annId);
    }
  }

  // 3. Retain ALL existing notifications (announcements, updater, system) that were not replaced
  for (const item of existingList) {
    if (!item || processedIds.has(item.id)) continue;
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
