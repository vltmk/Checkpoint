/**
 * notificationMerge.js - pure logic that merges update, "what's new" and announcement items into the stored
 * notification history. Kept free of storage so it can be tested on its own.
 */
import { getReleaseNotesForVersion, getAggregatedReleaseNotes, RELEASE_NOTES_REGISTRY } from './releaseNotes.js';
import { compareSemver } from './semver.js';

/**
 * Synchronize and merge active announcements & updates into persistent notification history.
 * Preserves user's read and dismissed flags while pruning stale update notifications.
 */
export function mergeNotificationsIntoHistory(
  existingList = [],
  { updateInfo = null, announcements = null, currentVersion = null, postUpdateInfo: postUpdateRequest = null } = {}
) {
  let postUpdateInfo = postUpdateRequest;
  const existingMap = new Map();
  for (const item of existingList) {
    if (item && item.id) {
      existingMap.set(item.id, item);
    }
  }

  const merged = [];
  const processedIds = new Set();
  const installed = currentVersion ? String(currentVersion).replace(/^v/i, '').trim() : '';

  // 1. Process Update Notification (Only if version is strictly newer than current installed version)
  if (updateInfo && updateInfo.available && updateInfo.version) {
    const isNewer = currentVersion ? compareSemver(updateInfo.version, currentVersion) > 0 : true;
    if (isNewer) {
      const updateId = `update-${updateInfo.version}`;
      const previous = existingMap.get(updateId);
      // patch notes are always Farsi in the app; the release body (Farsi, then English) is reduced to its Farsi part
      const notes = getReleaseNotesForVersion(updateInfo.version, 'fa', updateInfo.body);

      merged.push({
        id: updateId,
        source: 'updater',
        type: 'info',
        title: `نسخه ${updateInfo.version} Checkpoint در دسترس است`,
        message: notes.summary || 'نسخه جدیدی از Checkpoint آماده دانلود و نصب است.',
        items: (notes.items || []).slice(0, 4),
        publishedAt: updateInfo.date || new Date().toISOString(),
        read: previous ? Boolean(previous.read) : false,
        dismissed: previous ? Boolean(previous.dismissed) : false,
        pinned: true,
        action: {
          label: 'نصب به‌روزرسانی',
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

  // 2. "What's New" card for the installed version. It comes with the launch right after an upgrade, and is also kept
  // for the installed version whenever the bundled notes have an entry for it, so it never depends on that one launch.
  if (!postUpdateInfo && installed && RELEASE_NOTES_REGISTRY[installed]) {
    postUpdateInfo = { version: installed, language: 'fa' };
  }
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
        title: primaryNote.title || `به‌روزرسانی به نسخه ${postUpdateInfo.version}`,
        message: primaryNote.summary || 'Checkpoint با موفقیت به‌روزرسانی شد.',
        items: allItems.length > 0 ? allItems : (postUpdateInfo.items || []),
        publishedAt: primaryNote.date ? new Date(primaryNote.date).toISOString() : new Date().toISOString(),
        read: previous ? Boolean(previous.read) : false,
        dismissed: false,
        pinned: true,
        action: {
          label: 'مشاهده لیست تغییرات',
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
        items: ann.items || null,
        publishedAt: ann.publishedAt || new Date().toISOString(),
        expiresAt: ann.expiresAt || null,
        dismissible: ann.dismissible !== false,
        pinned: Boolean(ann.pinned),
        read: previous ? Boolean(previous.read) : false,
        dismissed: false,
        action: ann.action || null,
        actions: ann.actions || (ann.action ? [ann.action] : []),
        dir: ann.dir || null,
        lang: ann.lang || null,
      });
      processedIds.add(annId);
    }
  }

  // 4. Retain existing notifications that were not replaced, but prune obsolete update notifications
  for (const item of existingList) {
    if (!item || processedIds.has(item.id)) continue;

    // Patch notes of other versions are history, not news: only the installed version's card is kept
    if (installed && item.id.startsWith('welcome-v') && String(item.data?.version || item.id.replace(/^welcome-v/, '')) !== installed) {
      continue;
    }

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
