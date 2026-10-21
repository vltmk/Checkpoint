/**
 * quote.js - turns a calculator quote into the starting point of a new order.
 *
 * The calculator rounds each booster's cut on its own, so `perBoosterCut * count` can be a cent or a few Toman off the
 * pool the quote promised. The order form splits the pool itself, in minor units, so the seller's margin on the saved
 * order is exactly what the quote showed.
 */
import { toMinor, fromMinor, normalizeCurrency } from './money.js';

export function splitEvenly(total, count) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const out = Array(count).fill(base);
  out[0] += total - base * count;
  return out;
}

/** Share amounts (as input text, one per booster) for a quote; null when the quote carries no booster money. */
export function quoteShareTexts(quote, currency) {
  const cur = normalizeCurrency(currency);
  const n = Math.max(1, Number(quote?.boosterCount) || 1);
  const pool = Number(quote?.boosterPool);
  const each = Number(quote?.perBoosterCut);
  let minors;
  if (Number.isFinite(pool) && pool > 0) minors = splitEvenly(toMinor(pool, cur), n);
  else if (Number.isFinite(each) && each > 0) minors = Array(n).fill(toMinor(each, cur));
  else return null;
  return minors.map((m) => (m ? String(fromMinor(m, cur)) : ''));
}
