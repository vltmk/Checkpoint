/**
 * updater.js - Official Tauri 2 Updater client integration for Checkpoint
 * Uses GitHub Releases + latest.json. Non-blocking, offline-safe, with download progress.
 */

import { isTauri } from './desktop.js';
import packageJson from '../../package.json' with { type: 'json' };

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
 * Obtain the statically packaged application version synchronously.
 */
export function getStaticAppVersion() {
  return runtimeAppVersion || packageJson.version || '0.0.0';
}

/**
 * Check if a newer version of Checkpoint is available.
 * Non-blocking, with strict timeout and offline graceful handling.
 */
export async function checkForUpdate({ timeoutMs = 12000 } = {}) {
  const currentVersion = await getAppVersion();

  // In non-Tauri browser environments, skip desktop update checks
  if (!isTauri()) {
    return {
      available: false,
      currentVersion,
    };
  }

  // If in Tauri desktop runtime, run official Tauri updater plugin
  try {
    const { check } = await import('@tauri-apps/plugin-updater');

    // Run check with timeout to prevent hung requests on spotty networks
    const checkPromise = check();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Update check timeout')), timeoutMs)
    );

    const update = await Promise.race([checkPromise, timeoutPromise]);

    if (update && update.available) {
      const cleanTag = update.version.replace(/^v/i, '');
      const releaseTag = update.version.startsWith('v') ? update.version : `v${update.version}`;
      return {
        available: true,
        currentVersion: update.currentVersion || currentVersion,
        version: cleanTag,
        date: update.date || null,
        body: update.body || '',
        releaseUrl: `https://github.com/vltmk/Checkpoint/releases/tag/${releaseTag}`,
        rawUpdate: update,
      };
    }

    if (update && !update.available) {
      return {
        available: false,
        currentVersion: update?.currentVersion || currentVersion,
        rawUpdate: update,
      };
    }
  } catch (err) {
    const msg = err?.message || String(err);
    console.info('[Updater] Official updater plugin check error:', msg);
  }

  return {
    available: false,
    currentVersion,
  };
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

/**
 * Helper to determine if an updater error is caused by Windows Smart App Control
 * or local OS security execution policies (e.g., error 1260 / blocked by group policy).
 * @param {Error|string} error
 * @returns {boolean}
 */
export function isWindowsSecurityBlockedError(error) {
  if (!error) return false;
  const msg = (typeof error === 'string' ? error : error?.message || String(error)).toLowerCase();
  return (
    msg.includes('1260') ||
    msg.includes('group policy') ||
    msg.includes('smart app control') ||
    msg.includes('smartappcontrol') ||
    msg.includes('smartscreen') ||
    msg.includes('access_disabled_by_policy') ||
    msg.includes('virus or potentially unwanted software') ||
    msg.includes('operation did not complete successfully') ||
    (msg.includes('access is denied') && msg.includes('os error 5'))
  );
}

/**
 * Construct the official direct standalone installer URL on GitHub Releases.
 * @param {string} version
 * @returns {string}
 */
export function getStandaloneInstallerUrl(version) {
  if (!version) return 'https://github.com/vltmk/Checkpoint/releases/latest';
  const cleanTag = version.replace(/^v/i, '');
  const releaseTag = version.startsWith('v') ? version : `v${version}`;
  return `https://github.com/vltmk/Checkpoint/releases/download/${releaseTag}/CHECKPOINT_${cleanTag}_x64-setup.exe`;
}

