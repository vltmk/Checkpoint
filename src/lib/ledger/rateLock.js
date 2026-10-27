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
  return { gold: text(gold), goldUnit: order?.rateUnit === '1' ? '1' : '1k', usd: text(usd), eur: text(eur) };
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
  // the unit is chosen on the form (gold priced per 1 or per 1,000); an old form without one keeps the order's
  const perOne = (form?.goldUnit || base?.rateUnit) === '1';
  return {
    exchangeRate: gold,
    rateUnit: perOne ? '1' : '1k',
    rates: { goldRateTOMAN: gold, usdRateTOMAN: usd, eurRateUSD: eur, ...(perOne ? { isPerOneGold: true } : {}) },
  };
}

/**
 * What a new gold job starts with: { rate, unit, source }.
 *  - the last job for the same game keeps both its rate and its unit (source 'game')
 *  - otherwise the unit is the game's own setting, and a rate is only borrowed from another gold job (or the app's
 *    saved rate, which is per 1,000) when that rate is in the same unit: 3,200 per 1,000 gold means nothing per 1
 *  - with nothing usable the rate is empty and the person types it (source '')
 */
export function goldRateStart(orders = [], game = '', { categoryUnit = '1k', fallbackPer1k = null } = {}) {
  const same = lastGoldRate(orders, game);
  if (same?.sameGame) return { rate: same.rate, unit: same.unit, source: 'game' };
  const unit = categoryUnit === '1' ? '1' : '1k';
  if (same && same.unit === unit) return { rate: same.rate, unit, source: 'any' };
  if (unit === '1k' && positive(fallbackPer1k)) return { rate: positive(fallbackPer1k), unit, source: 'app' };
  return { rate: null, unit, source: '' };
}

/**
 * The gold rate to start a new gold-priced job with: the rate of the latest gold job for the same game, else of the
 * latest gold job of any game, else null (the caller falls back to the last saved rate). Each game's gold is its own
 * currency, so a rate is only ever borrowed from the same game first.
 * Returns { rate, unit: '1' | '1k', sameGame } or null.
 */
export function lastGoldRate(orders = [], game = '') {
  const key = String(game || '').trim().toLowerCase();
  const gold = orders
    .filter((o) => String(o.currency || '').toUpperCase() === 'GOLD' && positive(o.exchangeRate ?? o.rates?.goldRateTOMAN))
    .sort((a, b) => Date.parse(b.dateTime || '') - Date.parse(a.dateTime || ''));
  const pick = (key && gold.find((o) => String(o.game || '').trim().toLowerCase() === key)) || null;
  const o = pick || gold[0];
  if (!o) return null;
  return { rate: positive(o.exchangeRate ?? o.rates?.goldRateTOMAN), unit: o.rateUnit === '1' ? '1' : '1k', sameGame: Boolean(pick) };
}
