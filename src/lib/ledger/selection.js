/**
 * Multi-row selection on the Orders and Jobs lists, and the numbers the recap bar shows.
 * Pure logic (no React): the list hook and the bar only call these.
 * Rows are orderRows() view models from selectors.js.
 */
import { bucketKey, bucketsByCurrency, collapseBuckets, convertMinor } from './money.js';
import { orderRateOpts } from './engine.js';

/**
 * What a set of payment targets (engine target objects: outstandingMinor, currency, opts) comes to in one currency.
 * Each target converts at its own locked rate, the same way allocation does, so filling the amount from a selection
 * lands on what that selection actually covers.
 */
export function targetsTotalMinor(targets, currency, rates = {}) {
  return targets.reduce((sum, t) => sum + convertMinor(t.outstandingMinor, t.currency, currency, rates, t.opts), 0);
}

/** Ids from the anchor to the target, inclusive, in list order. An unknown anchor selects just the target. */
export function rangeSelect(orderedIds, anchorId, targetId) {
  const b = orderedIds.indexOf(targetId);
  if (b < 0) return [];
  const a = orderedIds.indexOf(anchorId);
  if (a < 0) return [targetId];
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return orderedIds.slice(lo, hi + 1);
}

/** A new Set with the id added, or removed if it was there. */
export function toggleId(selected, id) {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Drops selected ids that are no longer in the list (an order deleted, or filtered out, under the selection).
 * Returns the same Set when nothing changed, so React state does not churn.
 */
export function pruneSelection(selected, orderedIds) {
  const live = new Set(orderedIds);
  const next = new Set([...selected].filter((id) => live.has(id)));
  return next.size === selected.size ? selected : next;
}

const addTo = (buckets, key, minor) => {
  buckets[key] = (buckets[key] || 0) + (Number(minor) || 0);
};

/**
 * Totals for the selected rows.
 * Dead rows (failed or refunded) are counted but add no money.
 * Each order is valued at its own locked rates: `byCurrency` gives the native per-currency totals,
 * and the converted total comes from collapseBuckets so a rate change cannot move money already made.
 *
 * Measures (each `{ minor, currency, isApproximate, byCurrency }`):
 *   gross      what the orders are priced at
 *   fee        platform fees taken out
 *   boosters   shares for the people doing the work (receivable minus keep)
 *   keep       what is left after fees and boosters (orderRows `marginMinor`)
 *   toCollect  still owed by the payer on live orders
 *   collected  already received on live orders
 */
export function selectionRecap(rows, { rates = {}, displayCurrency }) {
  const buckets = { gross: {}, fee: {}, boosters: {}, keep: {}, toCollect: {}, collected: {} };
  let liveCount = 0;
  let keepMin = null;
  let keepMax = null;
  for (const r of rows) {
    if (r.dead) continue;
    liveCount += 1;
    const o = r.order;
    const key = bucketKey(o.currency, orderRateOpts(o));
    addTo(buckets.gross, key, o.grossMinor);
    addTo(buckets.fee, key, o.platformFeeMinor);
    addTo(buckets.boosters, key, r.receivableMinor - r.marginMinor);
    addTo(buckets.keep, key, r.marginMinor);
    addTo(buckets.toCollect, key, Math.max(0, r.money.receivableMinor - r.money.receivedMinor));
    addTo(buckets.collected, key, r.money.receivedMinor);
    const keepHere = convertMinor(r.marginMinor, o.currency, displayCurrency, rates, orderRateOpts(o));
    keepMin = keepMin === null ? keepHere : Math.min(keepMin, keepHere);
    keepMax = keepMax === null ? keepHere : Math.max(keepMax, keepHere);
  }

  const measured = Object.fromEntries(Object.entries(buckets).map(([name, b]) => [name, { ...collapseBuckets(b, displayCurrency, rates), byCurrency: bucketsByCurrency(b) }]));
  const { keep } = measured;
  return {
    count: rows.length,
    liveCount,
    deadCount: rows.length - liveCount,
    ...measured,
    // averages divide by live orders only; a dead order has no keep to average
    keepAverage: liveCount ? { minor: Math.round(keep.minor / liveCount), currency: keep.currency, isApproximate: keep.isApproximate } : null,
    keepMin,
    keepMax,
    isApproximate: Object.values(measured).some((m) => m.isApproximate),
  };
}
