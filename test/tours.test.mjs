import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  shouldShowGoldRatioTour,
  GOLD_RATIO_TOUR_SEEN_KEY,
} from '../src/lib/tours.js';
import { SHARED_SYNC_SETTING_KEYS } from '../src/lib/profiles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('shouldShowGoldRatioTour: returns true for a brand new user', () => {
  const result = shouldShowGoldRatioTour({
    currentVersion: '4.1.0',
    lastSeenVersion: null,
    lastKnownVersion: null,
  });
  assert.equal(result, true, 'Brand new users must see the tour on first launch');
});

test('shouldShowGoldRatioTour: returns false on reload when tour was already seen for this version', () => {
  const result = shouldShowGoldRatioTour({
    currentVersion: '4.1.0',
    lastSeenVersion: '4.1.0',
    lastKnownVersion: '4.1.0',
  });
  assert.equal(result, false, 'Users reloading the app on the same version must NOT see the tour');
});

test('shouldShowGoldRatioTour: returns true after an app update', () => {
  const result = shouldShowGoldRatioTour({
    currentVersion: '4.2.0',
    lastSeenVersion: '4.1.0',
    lastKnownVersion: '4.1.0',
  });
  assert.equal(result, true, 'Tour must show after an app update (currentVersion > lastSeenVersion)');
});

test('shouldShowGoldRatioTour: returns false on reload for existing users who already ran this version', () => {
  const result = shouldShowGoldRatioTour({
    currentVersion: '4.1.0',
    lastSeenVersion: null,
    lastKnownVersion: '4.1.0',
  });
  assert.equal(result, false, 'Existing users reloading the current version must not be spammed with tour');
});

test('shouldShowGoldRatioTour: returns true when upgrading from older version without prior tour key', () => {
  const result = shouldShowGoldRatioTour({
    currentVersion: '4.2.0',
    lastSeenVersion: null,
    lastKnownVersion: '4.1.0',
  });
  assert.equal(result, true, 'Upgrading from older version must show the tour');
});

test('shouldShowGoldRatioTour: returns false when currentVersion is empty', () => {
  const result = shouldShowGoldRatioTour({
    currentVersion: '',
    lastSeenVersion: null,
    lastKnownVersion: null,
  });
  assert.equal(result, false, 'Must not show tour when current version is unresolved');
});

test('profiles.js: SHARED_SYNC_SETTING_KEYS includes GOLD_RATIO_TOUR_SEEN_KEY', () => {
  assert.ok(
    SHARED_SYNC_SETTING_KEYS.includes(GOLD_RATIO_TOUR_SEEN_KEY),
    `SHARED_SYNC_SETTING_KEYS must contain ${GOLD_RATIO_TOUR_SEEN_KEY} for cross-profile persistence`
  );
});

test('Navbar.jsx: integrates tour persistence and dual-theme styling', () => {
  const navbarSource = fs.readFileSync(path.join(__dirname, '../src/components/Navbar.jsx'), 'utf8');

  // Verify tour imports and functions
  assert.ok(navbarSource.includes('shouldShowGoldRatioTour'), 'Navbar must import shouldShowGoldRatioTour');
  assert.ok(navbarSource.includes('markGoldRatioTourSeen'), 'Navbar must import markGoldRatioTourSeen');
  assert.ok(navbarSource.includes('getStoredGoldRatioTourSeenVersion'), 'Navbar must import getStoredGoldRatioTourSeenVersion');
  assert.ok(navbarSource.includes('dismissTour'), 'Navbar must have dismissTour handler');

  // Verify showTourGuide is restricted to non-advertiser (booster profile) and respects shouldShowTour
  assert.ok(
    navbarSource.includes("activeProfileId !== 'advertiser'") || navbarSource.includes("activeProfileId === 'booster'"),
    'Tour guide must be restricted to Booster profile'
  );

  // Verify dual-theme support on tour floating card
  assert.ok(navbarSource.includes('bg-white dark:bg-zinc-950'), 'Tour card must support Light and Dark background palettes');
  assert.ok(navbarSource.includes('border-zinc-200 dark:border-zinc-800'), 'Tour card must support Light and Dark border palettes');
  assert.ok(navbarSource.includes('text-zinc-900 dark:text-zinc-100'), 'Tour card title must support dual-theme text contrast');

  // Verify declaration order to prevent TDZ ReferenceError
  const showTourDeclIdx = navbarSource.indexOf('const showTourGuide =');
  const effectUsageIdx = navbarSource.indexOf('!isRatesOpen && !showTourGuide');
  assert.ok(showTourDeclIdx !== -1, 'showTourGuide must be declared');
  assert.ok(effectUsageIdx !== -1, 'effect using showTourGuide must exist');
  assert.ok(showTourDeclIdx < effectUsageIdx, 'showTourGuide must be declared before any useEffect referencing it');
});
