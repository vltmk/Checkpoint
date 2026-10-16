// Scheduling rules for automated folder backups. Kept free of React and Tauri so they can be unit tested.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a scheduled backup should run now.
 * - source 'interval' is the periodic background timer; 'on_start' backups never run from it.
 * - source 'change' is a launch or a settings change (folder, toggle, frequency); on_start runs there.
 * - daily / weekly backups run once their interval has passed since the last run (or never ran).
 */
export function isAutoBackupDue({
  frequency = 'daily',
  lastRunMs = 0,
  nowMs = Date.now(),
  source = 'interval',
} = {}) {
  if (frequency === 'on_start') return source !== 'interval';
  if (!(lastRunMs > 0)) return true;
  const intervalMs = frequency === 'weekly' ? 7 * DAY_MS : DAY_MS;
  return nowMs - lastRunMs >= intervalMs;
}
