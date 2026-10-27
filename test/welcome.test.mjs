// When the welcome screen shows, and when the notification center starts over.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME_RELEASE, crossesNotificationReset, welcomeMode } from '../src/lib/welcome.js';
import { RELEASE_NOTES_REGISTRY } from '../src/lib/releaseNotes.js';

test('a first run always gets the full welcome', () => {
  assert.equal(welcomeMode({ onboardingCompleted: false, seenVersion: null, appVersion: '5.2.0' }), 'new');
  assert.equal(welcomeMode({ onboardingCompleted: false, seenVersion: null, appVersion: WELCOME_RELEASE }), 'new');
});

test('an existing user sees the returning welcome once, from the release that brings it', () => {
  assert.equal(welcomeMode({ onboardingCompleted: true, seenVersion: null, appVersion: '5.2.0' }), null);
  assert.equal(welcomeMode({ onboardingCompleted: true, seenVersion: null, appVersion: WELCOME_RELEASE }), 'returning');
  assert.equal(welcomeMode({ onboardingCompleted: true, seenVersion: null, appVersion: '5.3.4' }), 'returning');
  assert.equal(welcomeMode({ onboardingCompleted: true, seenVersion: WELCOME_RELEASE, appVersion: '5.3.4' }), null);
  assert.equal(welcomeMode({ onboardingCompleted: true, seenVersion: '5.2.0', appVersion: WELCOME_RELEASE }), 'returning');
});

test('the notification center resets only when crossing into the reset release', () => {
  assert.equal(crossesNotificationReset('5.2.0', '5.3.0'), true);
  assert.equal(crossesNotificationReset('4.5.0', '5.3.1'), true);
  assert.equal(crossesNotificationReset('5.3.0', '5.3.1'), false); // already reset once
  assert.equal(crossesNotificationReset(null, '5.3.0'), false); // fresh install: nothing to reset
  assert.equal(crossesNotificationReset('5.1.0', '5.2.0'), false); // not there yet
});

test('the welcome has patch notes to show, in both languages and of the same length', () => {
  const notes = RELEASE_NOTES_REGISTRY[WELCOME_RELEASE];
  assert.ok(notes, `add ${WELCOME_RELEASE} to the release notes`);
  assert.ok(notes.items.en.length > 0 && notes.items.en.length <= 5, 'short notes');
  assert.equal(notes.items.en.length, notes.items.fa.length);
});
