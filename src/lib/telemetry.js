/**
 * telemetry.js - Lightweight, privacy-first anonymous analytics for Checkpoint
 * Powered by Aptabase. Transmits zero financial, client, or ledger data.
 * Batches feature usage counts locally and flushes once every 24 hours to conserve quota.
 *
 * Events are POSTed directly to the Aptabase ingestion API (instead of through the SDK's
 * trackEvent, which swallows delivery errors) so delivery can be verified without
 * monkey-patching the global fetch.
 */

import { trackerDB } from './db';
import { getAppVersion } from './updater';
import { isTauri } from './desktop';

export const APTABASE_APP_KEY = 'A-EU-7354848356';
const APTABASE_EVENT_URL = 'https://eu.aptabase.com/api/v0/event';
const SDK_VERSION = 'checkpoint-direct/1.0.0';
const SESSION_IDLE_MS = 60 * 60 * 1000;

const STORAGE_KEYS = {
  ENABLED: 'checkpoint_telemetry_enabled',
  LAST_FLUSH: 'checkpoint_telemetry_last_flush_timestamp',
  PENDING_WORKS: 'checkpoint_telemetry_pending_works_count',
  PENDING_RECEIPTS: 'checkpoint_telemetry_pending_receipts_count',
  LAST_APP_STARTED_DATE: 'checkpoint_telemetry_last_app_started_date',
  LAST_REPORTED_VERSION: 'checkpoint_telemetry_last_reported_version',
  LAST_REPORTED_ENV: 'checkpoint_telemetry_last_reported_env',
};

let initPromise = null;
let isInitialized = false;
let currentVersion = '0.0.0';
let sessionId = null;
let lastActivityMs = 0;
let workCountQueue = Promise.resolve();
let receiptCountQueue = Promise.resolve();

function isDevBuild() {
  return !!(import.meta.env && import.meta.env.DEV);
}

/**
 * Check if the user has telemetry enabled (defaults to true).
 */
export async function isTelemetryEnabled() {
  try {
    const val = await trackerDB.getSetting(STORAGE_KEYS.ENABLED, true);
    return val !== false && val !== 'false';
  } catch (e) {
    return true;
  }
}

/**
 * Set user telemetry preference.
 */
export async function setTelemetryEnabled(enabled) {
  try {
    await trackerDB.setSetting(STORAGE_KEYS.ENABLED, Boolean(enabled));
    if (enabled) {
      if (!isInitialized) {
        initTelemetry();
      }
    } else {
      // Counts gathered while opted out must never be sent after a later opt-in.
      await trackerDB.setSetting(STORAGE_KEYS.PENDING_WORKS, '0');
      await trackerDB.setSetting(STORAGE_KEYS.PENDING_RECEIPTS, '0');
    }
  } catch (e) {
    // Fail silently
  }
}

/**
 * Check if current runtime has network connectivity.
 */
function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * Session ids rotate after an hour of inactivity, mirroring the Aptabase SDK.
 */
function getSessionId() {
  const now = Date.now();
  if (!sessionId || now - lastActivityMs > SESSION_IDLE_MS) {
    const seconds = Math.floor(now / 1000).toString();
    const random = Math.floor(Math.random() * 1e8).toString().padStart(8, '0');
    sessionId = seconds + random;
  }
  lastActivityMs = now;
  return sessionId;
}

/**
 * Detect the desktop platform for the `platform` property.
 */
function detectPlatform() {
  if (!isTauri()) return 'web_preview';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/Windows/i.test(ua)) return 'windows_desktop';
  if (/Mac/i.test(ua)) return 'macos_desktop';
  if (/Linux/i.test(ua)) return 'linux_desktop';
  return 'desktop';
}

/**
 * POST one event to Aptabase. Resolves true only when the server answers 2xx.
 * Never throws and never touches global state.
 */
async function sendEvent(eventName, props) {
  if (isDevBuild() || !isOnline()) {
    return false;
  }

  try {
    const res = await fetch(APTABASE_EVENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Key': APTABASE_APP_KEY,
      },
      credentials: 'omit',
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
        eventName,
        systemProps: {
          locale: (typeof navigator !== 'undefined' && navigator.language) || '',
          isDebug: false,
          appVersion: currentVersion,
          sdkVersion: SDK_VERSION,
        },
        props,
      }),
    });
    return Boolean(res && res.ok);
  } catch (err) {
    return false;
  }
}

/**
 * Initialize telemetry on application startup.
 * Uses an initPromise latch so concurrent calls wait for the same initialization.
 * Non-blocking, fails gracefully when offline or in restricted networks.
 */
export async function initTelemetry() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const enabled = await isTelemetryEnabled();
      if (!enabled || isDevBuild()) {
        // Release the latch so a later opt-in can start telemetry without a restart.
        initPromise = null;
        return;
      }

      currentVersion = (await getAppVersion()) || '0.0.0';
      const currentEnv = 'production';
      const platform = detectPlatform();
      isInitialized = true;

      // Send daily app_started event (once per calendar day or if version/env changes)
      if (isOnline()) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const lastStartedDate = await trackerDB.getSetting(STORAGE_KEYS.LAST_APP_STARTED_DATE, '');
        const lastReportedVersion = await trackerDB.getSetting(STORAGE_KEYS.LAST_REPORTED_VERSION, '');
        const lastReportedEnv = await trackerDB.getSetting(STORAGE_KEYS.LAST_REPORTED_ENV, '');

        if (lastStartedDate !== todayStr || lastReportedVersion !== currentVersion || lastReportedEnv !== currentEnv) {
          const sent = await sendEvent('app_started', {
            platform,
            version: currentVersion,
            env: currentEnv,
          });

          // Only stamp date if the event was confirmed delivered
          if (sent) {
            await trackerDB.setSetting(STORAGE_KEYS.LAST_APP_STARTED_DATE, todayStr);
            await trackerDB.setSetting(STORAGE_KEYS.LAST_REPORTED_VERSION, currentVersion);
            await trackerDB.setSetting(STORAGE_KEYS.LAST_REPORTED_ENV, currentEnv);
          }
        }
      }

      // Check if daily summary flush is due
      await flushDailyTelemetry();
    } catch (err) {
      isInitialized = false;
      initPromise = null;
      console.debug('[Telemetry] Offline or failed to initialize:', err);
    }
  })();

  return initPromise;
}

/**
 * Locally increment work created count without sending immediate network requests.
 * Serialized in-memory to prevent concurrency drops under rapid actions.
 * Counts are not recorded while telemetry is disabled.
 */
export function incrementLocalWorkCount() {
  workCountQueue = workCountQueue
    .then(async () => {
      try {
        if (!(await isTelemetryEnabled())) return;
        const current = Number(await trackerDB.getSetting(STORAGE_KEYS.PENDING_WORKS, '0')) || 0;
        await trackerDB.setSetting(STORAGE_KEYS.PENDING_WORKS, String(current + 1));
      } catch (e) {
        // Fail silently
      }
    })
    .catch(() => {});
  return workCountQueue;
}

/**
 * Locally increment receipt exported count without sending immediate network requests.
 * Serialized in-memory to prevent concurrency drops under rapid actions.
 * Counts are not recorded while telemetry is disabled.
 */
export function incrementLocalReceiptCount() {
  receiptCountQueue = receiptCountQueue
    .then(async () => {
      try {
        if (!(await isTelemetryEnabled())) return;
        const current = Number(await trackerDB.getSetting(STORAGE_KEYS.PENDING_RECEIPTS, '0')) || 0;
        await trackerDB.setSetting(STORAGE_KEYS.PENDING_RECEIPTS, String(current + 1));
      } catch (e) {
        // Fail silently
      }
    })
    .catch(() => {});
  return receiptCountQueue;
}

/**
 * Flush accumulated 24-hour metrics rollup in a single summary event.
 * Resets local counters ONLY upon verified successful network delivery.
 * Safe to call from inside initTelemetry: it must not await initPromise, which would deadlock.
 */
export async function flushDailyTelemetry() {
  if (!isInitialized) return;

  const enabled = await isTelemetryEnabled();
  if (!enabled || !isOnline()) return;

  try {
    const now = Date.now();
    const lastFlushStr = await trackerDB.getSetting(STORAGE_KEYS.LAST_FLUSH, '');
    const lastFlush = lastFlushStr ? Number(lastFlushStr) : 0;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    // If 24 hours haven't passed and we have a previous flush, wait
    if (lastFlush && now - lastFlush < TWENTY_FOUR_HOURS) {
      return;
    }

    const pendingWorks = Number(await trackerDB.getSetting(STORAGE_KEYS.PENDING_WORKS, '0')) || 0;
    const pendingReceipts = Number(await trackerDB.getSetting(STORAGE_KEYS.PENDING_RECEIPTS, '0')) || 0;

    // Only send summary if there is meaningful activity
    if (pendingWorks > 0 || pendingReceipts > 0) {
      const dispatched = await sendEvent('daily_summary', {
        works_created: pendingWorks,
        receipts_exported: pendingReceipts,
        version: currentVersion,
        platform: detectPlatform(),
        env: isDevBuild() ? 'development' : 'production',
      });

      if (!dispatched) {
        // Network offline or failed: preserve counters for next flush attempt
        return;
      }

      // Reset pending counts only after confirmed delivery
      await trackerDB.setSetting(STORAGE_KEYS.PENDING_WORKS, '0');
      await trackerDB.setSetting(STORAGE_KEYS.PENDING_RECEIPTS, '0');
    }

    await trackerDB.setSetting(STORAGE_KEYS.LAST_FLUSH, String(now));
  } catch (err) {
    console.debug('[Telemetry] Flush skipped or offline:', err);
  }
}
