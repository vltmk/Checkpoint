/**
 * Limiting a statement to a period. The balances stay whole; only the list of events and the opening and closing
 * figures change. Events are in date order, and each carries the running balance after it (runningMinor).
 */
export const STATEMENT_PERIODS = ['all', '30', '90', 'year'];

const DAY = 86400000;

/** Start of a period in epoch ms, or null for all time. */
export function periodStart(period, now = Date.now()) {
  if (period === '30') return now - 30 * DAY;
  if (period === '90') return now - 90 * DAY;
  if (period === 'year') return new Date(new Date(now).getFullYear(), 0, 1).getTime();
  return null;
}

/**
 * The events inside a period, the balance carried in just before it (opening) and the balance at the end (closing).
 * With no period, everything is shown and the opening is zero.
 */
export function statementPeriod(events, since) {
  const closing = events.length ? events[events.length - 1].runningMinor ?? 0 : 0;
  if (since === null) return { shown: events, opening: 0, closing };
  const before = events.filter((e) => e.at < since);
  const shown = events.filter((e) => e.at >= since);
  const opening = before.length ? before[before.length - 1].runningMinor ?? 0 : 0;
  return { shown, opening, closing };
}
