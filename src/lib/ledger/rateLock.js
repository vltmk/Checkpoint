/**
 * rateLock.js - the exchange rates saved with each order.
 *
 * Every order keeps the gold, USD and EUR rates of the day it was logged (`order.rates`, with the gold rate also in
 * `order.exchangeRate` and its unit in `order.rateUnit`). Totals and statistics value the order with those, never with
 * today's rates, so a later price change does not move money that was already made.
 */
import { parseAmountShorthand } from './money.js';

const positive = (n) => (Number(n) > 0 ? Number(n) : null);

/** Text for the three rate inputs of an order form: the order's own saved rates, else the current ones. */
export function rateFormFor(order, currentRates = {}) {
  const saved = order?.rates || {};
  const gold = positive(order?.exchangeRate) ?? positive(saved.goldRateTOMAN) ?? positive(currentRates.goldRateTOMAN);
  const usd = positive(saved.usdRateTOMAN) ?? positive(currentRates.usdRateTOMAN);
  const eur = positive(saved.eurRateUSD) ?? positive(currentRates.eurRateUSD);
  const text = (n) => (n ? String(n) : '');
  return { gold: text(gold), usd: text(usd), eur: text(eur) };
}

/**
 * The order fields to save from the rate inputs. A blank or unreadable input keeps the order's saved rate, and
 * only then falls back to the current one, so a typo can never leave an order unpriced.
 */
export function rateFieldsFromForm(form, { base = null, currentRates = {} } = {}) {
  const fallback = rateFormFor(base, currentRates);
  const read = (typed, kept) => {
    const n = parseAmountShorthand(typed);
    return n !== null && n > 0 ? n : positive(kept);
  };
  const gold = read(form?.gold, fallback.gold);
  const usd = read(form?.usd, fallback.usd);
  const eur = read(form?.eur, fallback.eur);
  const perOne = base?.rateUnit === '1';
  return {
    exchangeRate: gold,
    rateUnit: perOne ? '1' : '1k',
    rates: { goldRateTOMAN: gold, usdRateTOMAN: usd, eurRateUSD: eur, ...(perOne ? { isPerOneGold: true } : {}) },
  };
}
