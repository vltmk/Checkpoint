/**
 * updater.js - Official Tauri 2 Updater client integration for Checkpoint
 * Uses GitHub Releases + latest.json. Non-blocking, offline-safe, with download progress.
 */

import { isTauri } from './desktop';
import packageJson from '../../package.json';

let runtimeAppVersion = null;

/**
 * Obtain the current application version dynamically.
 * In desktop Tauri runtime, queries the official Tauri API (@tauri-apps/api/app -> getVersion).
 * In browser/dev mode, falls back to package.json metadata.
 */
export async function getAppVersion() {
  if (runtimeAppVersion) return runtimeAppVersion;

  if (isTauri()) {
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      const v = await getVersion();
      if (v && typeof v === 'string') {
        runtimeAppVersion = v;
        return v;
      }
    } catch (e) {
      console.warn('[Updater] Failed to obtain app version from Tauri API:', e);
    }
  }

  runtimeAppVersion = packageJson.version || '0.0.0';
  return runtimeAppVersion;
}

/**
 * Check if a newer version of Checkpoint is available.
 * Non-blocking, with strict timeout and offline graceful handling.
 */
export async function checkForUpdate({ timeoutMs = 8000 } = {}) {
  const currentVersion = await getAppVersion();

  if (!isTauri()) {
    return {
      available: false,
      currentVersion,
      reason: 'not_tauri',
    };
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater');

    // Run check with timeout to prevent hung requests on spotty networks
    const checkPromise = check();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Update check timeout')), timeoutMs)
    );

    const update = await Promise.race([checkPromise, timeoutPromise]);

    if (update && update.available) {
      const releaseTag = update.version.startsWith('v') ? update.version : `v${update.version}`;
      return {
        available: true,
        currentVersion: update.currentVersion || currentVersion,
        version: update.version,
        date: update.date || null,
        body: update.body || '',
        releaseUrl: `https://github.com/vltmk/Checkpoint/releases/tag/${releaseTag}`,
        rawUpdate: update,
      };
    }

    return {
      available: false,
      currentVersion: update?.currentVersion || currentVersion,
      rawUpdate: update,
    };
  } catch (err) {
    const msg = err?.message || String(err);
    console.info('[Updater] Update check failed or offline:', msg);
    const isNotFound =
      msg.includes('404') ||
      msg.toLowerCase().includes('not found') ||
      msg.toLowerCase().includes('could not fetch valid release') ||
      msg.toLowerCase().includes('invalid json');
    const isOffline =
      !isNotFound &&
      (msg.includes('timeout') ||
        msg.includes('network') ||
        msg.includes('dns') ||
        msg.includes('connection refused'));
    return {
      available: false,
      currentVersion,
      error: msg,
      isNotFound,
      isOffline,
      isDev: import.meta.env.DEV,
    };
  }
}

/**
 * Download and install update with chunk progress reporting.
 * @param {object} rawUpdate - The raw update handle returned from check()
 * @param {function} onProgress - Callback receiving { downloadedBytes, totalBytes, percent }
 */
export async function installUpdate(rawUpdate, onProgress = () => {}) {
  if (!rawUpdate || typeof rawUpdate.downloadAndInstall !== 'function') {
    throw new Error('Invalid update handle provided for installation');
  }

  let totalBytes = 0;
  let downloadedBytes = 0;

  await rawUpdate.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        totalBytes = event.data?.contentLength || 0;
        downloadedBytes = 0;
        onProgress({ downloadedBytes: 0, totalBytes, percent: 0, status: 'started' });
        break;
      case 'Progress':
        downloadedBytes += event.data?.chunkLength || 0;
        const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
        onProgress({ downloadedBytes, totalBytes, percent, status: 'downloading' });
        break;
      case 'Finished':
        onProgress({ downloadedBytes: totalBytes, totalBytes, percent: 100, status: 'finished' });
        break;
    }
  });

  return true;
}

/**
 * Relaunch the application after an update has been installed
 */
export async function relaunchApp() {
  if (!isTauri()) {
    window.location.reload();
    return;
  }

  try {
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (err) {
    console.error('[Updater] Failed to relaunch app via plugin-process:', err);
    window.location.reload();
  }
}
