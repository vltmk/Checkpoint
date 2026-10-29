/**
 * dateFilter.js - the date range behind the Orders / Jobs period filter. Pure, so the boundaries are tested.
 * Days are the user's local calendar days: "Today" runs from local midnight, and a custom "to" date includes that whole day.
 */
export const DATE_PRESETS = ['all', 'today', '7', '30', 'month', 'lastMonth', 'custom'];

const DAY = 86400000;
const startOfDay = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
// "YYYY-MM-DD" from a date input, read as a local day; null when empty or unreadable
const parseDay = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
};

/** { from, to } in epoch ms, `to` exclusive; either may be null (open ended). */
export function dateBounds(preset, custom = {}, now = Date.now()) {
  const today = startOfDay(now);
  const d = new Date(now);
  if (preset === 'today') return { from: today, to: today + DAY };
  if (preset === '7') return { from: today - 6 * DAY, to: null };
  if (preset === '30') return { from: today - 29 * DAY, to: null };
  if (preset === 'month') return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: null };
  if (preset === 'lastMonth') return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), to: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
  if (preset === 'custom') {
    const from = parseDay(custom.from);
    const to = parseDay(custom.to);
    return { from, to: to === null ? null : new Date(new Date(to).getFullYear(), new Date(to).getMonth(), new Date(to).getDate() + 1).getTime() };
  }
  return { from: null, to: null };
}

/** True when the ISO timestamp falls in the bounds. An unreadable date is kept out of any bounded range. */
export function inDateBounds(iso, { from, to }) {
  if (from === null && to === null) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return (from === null || t >= from) && (to === null || t < to);
}
