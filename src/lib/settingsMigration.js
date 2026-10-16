/**
 * settingsMigration.js - picks the value to keep when a setting exists in more than one place.
 *
 * Before the settings store was unified, each profile database had its own copy of the shared settings,
 * and localStorage held a mirror that was written on every change. The mirror is the most recent write
 * across profiles, so it wins. Without a mirror, the newest database row wins.
 */

const hasValue = (value) => value !== null && value !== undefined;

/**
 * @param {Array<{ value: string|null, updatedAt?: number, fromLocalStorage?: boolean }>} candidates
 * @returns {string|null} the chosen raw value, or null when no candidate has a value
 */
export function chooseMigratedValue(candidates) {
  const usable = (candidates || []).filter((c) => c && hasValue(c.value));
  const mirror = usable.find((c) => c.fromLocalStorage);
  if (mirror) return mirror.value;

  let newest = null;
  for (const candidate of usable) {
    if (!newest || (Number(candidate.updatedAt) || 0) > (Number(newest.updatedAt) || 0)) {
      newest = candidate;
    }
  }
  return newest ? newest.value : null;
}
