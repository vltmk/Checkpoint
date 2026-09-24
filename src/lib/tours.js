/**
 * tours.js - In-App Guided Tours & Feature Spotlights Engine
 * Manages display rules and persistence for walkthrough tours such as
 * the Booster profile "Gold Exchange Ratio" topbar tour.
 */

import { compareSemver } from './semver.js';
import { getStaticAppVersion } from './updater.js';

export const GOLD_RATIO_TOUR_SEEN_KEY = 'checkpoint_gold_ratio_tour_seen_version';

/**
 * Determines whether the Booster "Gold Exchange Ratio" topbar tour should load.
 *
 * Rules:
 * 1. Must load only once per user on initial use.
 * 2. Must load after each app update only (currentVersion > lastSeenVersion).
 * 3. Must NOT load every time the user reloads or opens the app within the same version.
 *
 * @param {Object} params
 * @param {string} [params.currentVersion] - Current app semver (e.g. '4.1.0')
 * @param {string|null} [params.lastSeenVersion] - Version when user last saw/dismissed the tour
 * @param {string|null} [params.lastKnownVersion] - Last known app version from previous runs
 * @returns {boolean}
 */
export function shouldShowGoldRatioTour({
  currentVersion,
  lastSeenVersion = null,
  lastKnownVersion = null,
} = {}) {
  const version = currentVersion !== undefined ? currentVersion : getStaticAppVersion();
  if (!version) return false;

  // 1. If user has previously seen/dismissed the tour on a recorded version
  if (lastSeenVersion) {
    return compareSemver(version, lastSeenVersion) > 0;
  }

  // 2. If tour has not yet been explicitly recorded:
  // If the user has already run this version (lastKnownVersion === currentVersion),
  // they are merely reloading/reopening the app on the same version, so do not load.
  if (lastKnownVersion && compareSemver(version, lastKnownVersion) === 0) {
    return false;
  }

  // Otherwise, it is either a brand new user (lastKnownVersion is null/empty)
  // or a user launching a new version after an upgrade (currentVersion > lastKnownVersion).
  return true;
}

/**
 * Synchronously retrieves the last seen tour version from localStorage (if available).
 */
export function getStoredGoldRatioTourSeenVersion() {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(GOLD_RATIO_TOUR_SEEN_KEY) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Persists the tour seen version to both localStorage and SQLite / IndexedDB.
 */
export async function markGoldRatioTourSeen(version, db = null) {
  const targetVersion = version || getStaticAppVersion();
  if (!targetVersion) return;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(GOLD_RATIO_TOUR_SEEN_KEY, targetVersion);
    } catch (e) {}
  }

  try {
    const activeDb = db || (await import('./db.js')).trackerDB;
    if (activeDb?.setSetting) {
      await activeDb.setSetting(GOLD_RATIO_TOUR_SEEN_KEY, targetVersion);
    }
  } catch (e) {
    // Graceful fallback if SQLite/IDB unavailable or in headless test environment
  }
}
