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
  LAST_FLUSH: 'checkpoint_telemetry_last_flush_timestamp',
  PENDING_WORKS: 'checkpoint_telemetry_pending_works_count',
  PENDING_RECEIPTS: 'checkpoint_telemetry_pending_receipts_count',
  LAST_APP_STARTED_DATE: 'checkpoint_telemetry_last_app_started_date',
};

let isInitialized = false;

/**
 * Initialize Aptabase telemetry on application startup.
 * Non-blocking, fails gracefully when offline or in restricted networks.
 */
export async function initTelemetry() {
  if (isInitialized) return;
  isInitialized = true;

  try {
    const version = await getAppVersion();

    init(APTABASE_APP_KEY, {
      appVersion: version || '0.0.0',
    });

    const isDev = import.meta.env && import.meta.env.DEV;

    // Send daily app_started event (once per calendar day)
    const todayStr = new Date().toISOString().slice(0, 10);
    const lastStartedDate = await trackerDB.getSetting(STORAGE_KEYS.LAST_APP_STARTED_DATE, '');

    if (lastStartedDate !== todayStr) {
      await trackEvent('app_started', {
        platform: isTauri() ? 'windows_desktop' : 'web_preview',
        version: version || '0.0.0',
        env: isDev ? 'development' : 'production',
      });
      await trackerDB.setSetting(STORAGE_KEYS.LAST_APP_STARTED_DATE, todayStr);
    }

    // Check if daily summary flush is due
    await flushDailyTelemetry();
  } catch (err) {
    // Fail completely silently in offline or restricted environments
    console.debug('[Telemetry] Offline or failed to initialize:', err);
  }
}

/**
 * Locally increment work created count without sending immediate network requests.
 */
export async function incrementLocalWorkCount() {
  try {
    const current = Number(await trackerDB.getSetting(STORAGE_KEYS.PENDING_WORKS, '0')) || 0;
    await trackerDB.setSetting(STORAGE_KEYS.PENDING_WORKS, String(current + 1));
  } catch (e) {
    // Fail silently
  }
}

/**
 * Locally increment receipt exported count without sending immediate network requests.
 */
export async function incrementLocalReceiptCount() {
  try {
    const current = Number(await trackerDB.getSetting(STORAGE_KEYS.PENDING_RECEIPTS, '0')) || 0;
    await trackerDB.setSetting(STORAGE_KEYS.PENDING_RECEIPTS, String(current + 1));
  } catch (e) {
    // Fail silently
  }
}

/**
 * Flush accumulated 24-hour metrics rollup in a single summary event.
 * Resets local counters upon successful dispatch.
 */
export async function flushDailyTelemetry() {
  if (!isInitialized) return;

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
      const isDev = import.meta.env && import.meta.env.DEV;

      await trackEvent('daily_summary', {
        works_created: pendingWorks,
        receipts_exported: pendingReceipts,
        version: version || '0.0.0',
        platform: isTauri() ? 'windows_desktop' : 'web_preview',
        env: isDev ? 'development' : 'production',
      });

      // Reset pending counts after flush
      await trackerDB.setSetting(STORAGE_KEYS.PENDING_WORKS, '0');
      await trackerDB.setSetting(STORAGE_KEYS.PENDING_RECEIPTS, '0');
    }

    await trackerDB.setSetting(STORAGE_KEYS.LAST_FLUSH, String(now));
  } catch (err) {
    console.debug('[Telemetry] Flush skipped or offline:', err);
  }
}
