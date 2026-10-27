/**
 * welcome.js - when the welcome screen shows, and the one-time notification reset that ships with it. Pure: the
 * caller reads and writes the settings.
 */
import { compareSemver } from './semver.js';

/** The release that brings the new welcome screen. Everyone who installs it sees the welcome once. */
export const WELCOME_RELEASE = '5.3.0';

/** The release from which the notification center starts over with only its patch notes. */
export const NOTIFICATION_RESET_RELEASE = '5.3.0';

/** The setting that remembers the last welcome a person saw (a version, so a later release can show it again). */
export const WELCOME_SEEN_KEY = 'checkpoint_welcome_seen';

/**
 * Which welcome to show, if any:
 *  - 'new'       first run: nothing was ever chosen (no profile picked yet)
 *  - 'returning' an existing user on WELCOME_RELEASE or later who has not seen this welcome yet
 *  - null        nothing to show
 */
export function welcomeMode({ onboardingCompleted, seenVersion, appVersion }) {
  if (!onboardingCompleted) return 'new';
  if (!appVersion || compareSemver(appVersion, WELCOME_RELEASE) < 0) return null;
  if (seenVersion && compareSemver(seenVersion, WELCOME_RELEASE) >= 0) return null;
  return 'returning';
}

/**
 * True when this start is the first one on NOTIFICATION_RESET_RELEASE (or later) after an older version: the stored
 * notifications are dropped and replaced by the new patch notes. A fresh install has nothing to reset.
 */
export function crossesNotificationReset(lastKnownVersion, appVersion) {
  if (!lastKnownVersion || !appVersion) return false;
  return compareSemver(lastKnownVersion, NOTIFICATION_RESET_RELEASE) < 0 && compareSemver(appVersion, NOTIFICATION_RESET_RELEASE) >= 0;
}
