import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('desktop.js exports reactive window lifecycle tracking methods', async () => {
  const desktop = await import('../src/lib/desktop.js');

  assert.equal(typeof desktop.subscribeWindowVisibility, 'function');
  assert.equal(typeof desktop.subscribeWindowFocus, 'function');
  assert.equal(typeof desktop.isWindowVisible, 'function');
  assert.equal(typeof desktop.isWindowFocused, 'function');

  // Verify subscription dispatches initial state and updates
  let visibilityNotified = [];
  const unsubscribeVis = desktop.subscribeWindowVisibility((v) => {
    visibilityNotified.push(v);
  });

  assert.ok(visibilityNotified.length >= 1);
  desktop.setWindowVisibility(false);
  assert.equal(desktop.isWindowVisible(), false);
  assert.equal(visibilityNotified[visibilityNotified.length - 1], false);

  desktop.setWindowVisibility(true);
  assert.equal(desktop.isWindowVisible(), true);
  assert.equal(visibilityNotified[visibilityNotified.length - 1], true);

  unsubscribeVis();

  // Verify focus subscription
  let focusNotified = [];
  const unsubscribeFocus = desktop.subscribeWindowFocus((f) => {
    focusNotified.push(f);
  });

  assert.ok(focusNotified.length >= 1);
  desktop.setWindowFocus(false);
  assert.equal(desktop.isWindowFocused(), false);
  assert.equal(focusNotified[focusNotified.length - 1], false);

  desktop.setWindowFocus(true);
  assert.equal(desktop.isWindowFocused(), true);
  assert.equal(focusNotified[focusNotified.length - 1], true);

  unsubscribeFocus();
});

test('Simulated cadence limiter clamps frame rate on 144Hz-360Hz intervals', () => {
  const targetFps = 60;
  const minInterval = 1000 / targetFps - 1.5; // ~15.16ms

  let lastRender = 0;
  let renderPassCount = 0;

  const simulateTick = (now) => {
    if (lastRender > 0 && now - lastRender < minInterval) {
      return false; // throttled / skipped
    }
    renderPassCount++;
    lastRender = now;
    return true; // executed
  };

  // Simulate 240Hz monitor (~4.16ms per RAF tick) over 1 second (240 ticks)
  let executed = 0;
  let skipped = 0;
  for (let frame = 0; frame < 240; frame++) {
    const timeMs = frame * (1000 / 240);
    if (simulateTick(timeMs)) {
      executed++;
    } else {
      skipped++;
    }
  }

  // At 60 FPS cap on 240Hz, executed frames should be ~60, skipped frames ~180
  assert.ok(executed >= 59 && executed <= 61, `Expected ~60 executed frames, got ${executed}`);
  assert.ok(skipped >= 179 && skipped <= 181, `Expected ~180 skipped frames, got ${skipped}`);
});
