/**
 * grouping.js - day groups for the Orders / Jobs lists.
 *
 * Rows arrive newest first. They are grouped by the user's local calendar day (so a job logged at 23:50 stays on that
 * day), keeping the incoming order inside every group and between groups.
 */

/** Local calendar day of an ISO timestamp as "YYYY-MM-DD", or '' when the date cannot be read. */
export function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** [{ key, iso, rows }] in the order the days first appear. `iso` is the first row's timestamp, for labelling the day. */
export function groupByDay(rows, getIso) {
  const groups = [];
  const index = new Map();
  for (const row of rows) {
    const iso = getIso(row);
    const key = dayKey(iso) || 'unknown';
    let g = index.get(key);
    if (!g) {
      g = { key, iso, rows: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.rows.push(row);
  }
  return groups;
}
