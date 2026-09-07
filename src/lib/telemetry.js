/**
 * telemetry.js - Lightweight, privacy-first anonymous analytics for Checkpoint
 * Powered by Aptabase. Transmits zero financial, client, or ledger data.
 * Batches feature usage counts locally and flushes once every 24 hours to conserve quota.
 */

import { init, trackEvent } from '@aptabase/web';
import { trackerDB } from './db';
import { getAppVersion } from './updater';
import { isTauri } from './desktop';

export const APTABASE_APP_KEY = 'A-EU-7354848356';

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
let workCountQueue = Promise.resolve();
let receiptCountQueue = Promise.resolve();

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
    if (enabled && !isInitialized) {
      initTelemetry();
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
 * Dispatch an event to Aptabase only when online, and verify HTTP delivery success.
 * Returns true if the event was acknowledged by the server (res.ok), false otherwise.
 */
async function safeTrackEvent(eventName, props) {
  if (!isOnline()) {
    return false;
  }

  let deliverySucceeded = false;
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async function (...args) {
      const res = await originalFetch.apply(this, args);
      const targetUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (targetUrl && targetUrl.includes('aptabase.com')) {
        if (res && res.ok) {
          deliverySucceeded = true;
        }
      }
      return res;
    };

    await trackEvent(eventName, props);
    return deliverySucceeded;
  } catch (err) {
    return false;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/**
 * Initialize Aptabase telemetry on application startup.
 * Uses an initPromise latch so concurrent calls or flush triggers wait for initialization.
 * Non-blocking, fails gracefully when offline or in restricted networks.
 */
export async function initTelemetry() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const enabled = await isTelemetryEnabled();
      if (!enabled) {
        return;
      }

      const version = await getAppVersion();
      const isDev = !!(import.meta.env && import.meta.env.DEV);
      const currentEnv = isDev ? 'development' : 'production';

      init(APTABASE_APP_KEY, {
        appVersion: version || '0.0.0',
        isDebug: isDev,
      });

      isInitialized = true;

      // Send daily app_started event (once per calendar day or if version/env changes)
      if (isOnline()) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const lastStartedDate = await trackerDB.getSetting(STORAGE_KEYS.LAST_APP_STARTED_DATE, '');
        const lastReportedVersion = await trackerDB.getSetting(STORAGE_KEYS.LAST_REPORTED_VERSION, '');
        const lastReportedEnv = await trackerDB.getSetting(STORAGE_KEYS.LAST_REPORTED_ENV, '');

        if (lastStartedDate !== todayStr || lastReportedVersion !== version || lastReportedEnv !== currentEnv) {
          const sent = await safeTrackEvent('app_started', {
            platform: isTauri() ? 'windows_desktop' : 'web_preview',
            version: version || '0.0.0',
            env: currentEnv,
          });

          // Only stamp date if the event was confirmed delivered
          if (sent) {
            await trackerDB.setSetting(STORAGE_KEYS.LAST_APP_STARTED_DATE, todayStr);
            await trackerDB.setSetting(STORAGE_KEYS.LAST_REPORTED_VERSION, version || '0.0.0');
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
 */
export function incrementLocalWorkCount() {
  workCountQueue = workCountQueue
    .then(async () => {
      try {
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
 */
export function incrementLocalReceiptCount() {
  receiptCountQueue = receiptCountQueue
    .then(async () => {
      try {
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
 */
export async function flushDailyTelemetry() {
  if (initPromise) {
    await initPromise;
  }
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
      const version = await getAppVersion();
      const isDev = !!(import.meta.env && import.meta.env.DEV);

      const dispatched = await safeTrackEvent('daily_summary', {
        works_created: pendingWorks,
        receipts_exported: pendingReceipts,
        version: version || '0.0.0',
        platform: isTauri() ? 'windows_desktop' : 'web_preview',
        env: isDev ? 'development' : 'production',
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
