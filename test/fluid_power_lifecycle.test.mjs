import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('renderer.js implements zero-overhead RAF culling, rate limiting, and focus auto-sleep', () => {
  const rendererCode = fs.readFileSync(
    path.join(rootDir, 'src/components/ui/fluid/renderer.js'),
    'utf8'
  );

  // 1. Zero-overhead RAF cancellation on pause
  assert.match(rendererCode, /cancelAnimationFrame\(animationFrame\)/);
  assert.match(rendererCode, /animationFrame\s*=\s*0/);

  // 2. High-refresh monitor rate limiting (cadence clamping)
  assert.match(rendererCode, /minFrameInterval\s*=\s*1000\s*\/\s*targetFps\s*-\s*1\.5/);
  assert.match(rendererCode, /now\s*-\s*lastRenderTime\s*<\s*minFrameInterval/);

  // 3. Inactivity & Window Blur auto-sleep
  assert.match(rendererCode, /idleTimeout\s*=\s*isBatterySaver\s*\?\s*15000\s*:\s*45000/);
  assert.match(rendererCode, /now\s*-\s*lastBlurTime\s*>\s*5000/);

  // 4. Wake method and battery awareness
  assert.match(rendererCode, /wake\s*=\s*\(\)\s*=>/);
  assert.match(rendererCode, /navigator\.getBattery/);
  assert.match(rendererCode, /isBatterySaver\s*=\s*!battery\.charging\s*\|\|\s*battery\.level\s*<=\s*0\.2/);
});

test('CockpitFluid.jsx integrates with desktop window lifecycle and pointer wake events', () => {
  const cockpitFluidCode = fs.readFileSync(
    path.join(rootDir, 'src/components/ui/fluid/CockpitFluid.jsx'),
    'utf8'
  );

  // Subscribes to desktop lifecycle
  assert.match(cockpitFluidCode, /subscribeWindowVisibility/);
  assert.match(cockpitFluidCode, /subscribeWindowFocus/);

  // Combines offscreen culling with window visibility
  assert.match(cockpitFluidCode, /const shouldPause\s*=\s*!isIntersecting\s*\|\|\s*!isVisible/);
  assert.match(cockpitFluidCode, /rendererRef\.current\.setPaused\(shouldPause\)/);

  // Wakes on pointer interaction
  assert.match(cockpitFluidCode, /container\.addEventListener\("pointermove",\s*handleWake/);
  assert.match(cockpitFluidCode, /container\.addEventListener\("pointerdown",\s*handleWake/);

  // Supports user preference enabled prop
  assert.match(cockpitFluidCode, /enabled\s*=\s*true/);
  assert.match(cockpitFluidCode, /if\s*\(!enabled\)\s*return;/);
});

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

test('i18n contains English and Persian translations for cockpit fluid settings', () => {
  const i18nCode = fs.readFileSync(
    path.join(rootDir, 'src/lib/i18n.jsx'),
    'utf8'
  );

  // English
  assert.match(i18nCode, /'settings\.cockpitVisuals':\s*'Power Saver'/);
  assert.match(i18nCode, /'settings\.cockpitFluid':\s*'Cockpit Animation'/);

  // Persian
  assert.match(i18nCode, /'settings\.cockpitVisuals':\s*'صرفه‌جویی در مصرف انرژی'/);
  assert.match(i18nCode, /'settings\.cockpitFluid':\s*'انیمیشن کاکپیت'/);
});

test('SettingsModal renders Cockpit Fluid Simulation toggle control', () => {
  const settingsModalCode = fs.readFileSync(
    path.join(rootDir, 'src/components/SettingsModal.jsx'),
    'utf8'
  );

  assert.match(settingsModalCode, /cockpitFluidEnabled\s*=\s*true/);
  assert.match(settingsModalCode, /onCockpitFluidEnabledChange/);
  assert.match(settingsModalCode, /t\('settings\.cockpitFluid'\)/);
  assert.match(settingsModalCode, /t\('settings\.cockpitFluidDesc'\)/);
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
