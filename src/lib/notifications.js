/**
 * notifications.js - Persistent local Notification Center engine for Checkpoint
 * Stores and manages update alerts, announcement feed items, and local system notifications.
 * Fully offline-first, persisted directly in SQLite / IndexedDB settings.
 */

import { trackerDB } from './db';
import { markAnnouncementDismissed, markAnnouncementSeen } from './announcements';
import { mergeNotificationsIntoHistory } from './notificationMerge.js';

export const NOTIFICATIONS_STORAGE_KEY = 'checkpoint_notifications_history';

export { compareSemver } from './semver.js';
export { mergeNotificationsIntoHistory };

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

