/**
 * money.js - integer minor-unit money for the v2 ledger.
 *
 * Every amount is stored as an integer in the currency's smallest unit (TOMAN/GOLD: 1, USD/EUR: cent).
 * Conversions always go through convertCurrency() in ../currencies.js, the single conversion path.
 */
import { convertCurrency } from '../currencies.js';

export const CURRENCY_DECIMALS = { TOMAN: 0, GOLD: 0, USD: 2, EUR: 2 };

export function normalizeCurrency(code) {
  if (code === 'WOW_GOLD') return 'GOLD';
  return CURRENCY_DECIMALS[code] !== undefined ? code : 'TOMAN';
}

export function decimalsOf(code) {
  return CURRENCY_DECIMALS[normalizeCurrency(code)];
}

/** Major units (e.g. 12.5 USD) -> integer minor units (1250). Non-finite input becomes 0. */
export function toMinor(major, currency) {
  const n = Number(major);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimalsOf(currency);
  return Math.round(n * factor);
}

export function fromMinor(minor, currency) {
  const n = Number(minor);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** decimalsOf(currency);
}

/**
 * Convert an integer minor amount between currencies using a rates snapshot
 * ({ goldRateTOMAN, usdRateTOMAN, eurRateUSD }). opts.customRate / opts.isPerOneGold carry a locked gold rate, and
 * opts.rates ({ usdRateTOMAN, eurRateUSD }) carries the USD and EUR rates locked on the order or payment: when
 * present they replace the current ones, so the amount keeps the value it had on its own day.
 */
export function convertMinor(minor, from, to, rates = {}, opts = {}) {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (f === t) return Math.round(Number(minor) || 0);
  const major = fromMinor(minor, f);
  const out = convertCurrency(major, f, t, withLockedRates(rates, opts), opts.customRate ?? null, Boolean(opts.isPerOneGold));
  return toMinor(out, t);
}

/** The current rates with the USD / EUR rates of a lock laid over them (the EUR/Toman rate is then derived from the lock). */
export function withLockedRates(rates = {}, opts = {}) {
  const lock = opts?.rates;
  if (!lock) return rates;
  const usd = Number(lock.usdRateTOMAN);
  const eur = Number(lock.eurRateUSD);
  const out = { ...rates };
  if (usd > 0) out.usdRateTOMAN = usd;
  if (eur > 0) out.eurRateUSD = eur;
  if (usd > 0 || eur > 0) out.eurRateTOMAN = undefined;
  return out;
}

// --- Shorthand amount parsing -------------------------------------------------------------

const DIGIT_MAP = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

const SUFFIXES = [
  ['میلیارد', 1e9],
  ['میلیون', 1e6],
  ['هزار', 1e3],
  ['billion', 1e9],
  ['million', 1e6],
  ['thousand', 1e3],
  ['mil', 1e6],
  ['b', 1e9],
  ['m', 1e6],
  ['k', 1e3],
];

/**
 * Parse typed amounts: "3m", "250k", "1.5m", "3,000,000", "۳ میلیون", "۲۵۰ هزار".
 * Returns a finite non-negative number in major units, or null when the text is not an amount.
 */
export function parseAmountShorthand(input) {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : null;
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d]);
  s = s.replace(/[٬,،_\s]+(?=\d{3}(\D|$))/g, '').replace(/٫/g, '.');
  const m = s.match(/^(\d+(?:\.\d+)?|\.\d+)\s*([a-zآ-ی]*)$/);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const word = m[2];
  if (!word) return base;
  const hit = SUFFIXES.find(([k]) => k === word);
  if (!hit) return null;
  return base * hit[1];
}

/** Sum integer minor amounts per currency. rows: [{ currency, minor }] -> { USD: 1250, TOMAN: 5000 } */
export function sumByCurrency(rows) {
  const out = {};
  for (const r of rows) {
    const c = normalizeCurrency(r.currency);
    out[c] = (out[c] || 0) + (Number(r.minor) || 0);
  }
  return out;
}

/**
 * Bucket keys. Money is summed per currency, but an amount that carries locked rates must keep converting at THOSE
 * rates everywhere, so each distinct lock gets its own bucket:
 *   "USD"                      no lock: converts at the current rates
 *   "GOLD|7000|1"              locked gold rate only (classic per 1, retail per 1k)
 *   "TOMAN|3200|1k|95000|1.08" full lock: gold rate | gold unit | USD in Toman | EUR in USD
 * Read buckets with bucketsByCurrency() / collapseBuckets(), never by currency code directly.
 */
export function bucketKey(currency, opts) {
  const c = normalizeCurrency(currency);
  const gold = Number(opts?.customRate) > 0 ? Number(opts.customRate) : '';
  const unit = opts?.isPerOneGold ? '1' : '1k';
  const usd = Number(opts?.rates?.usdRateTOMAN) > 0 ? Number(opts.rates.usdRateTOMAN) : '';
  const eur = Number(opts?.rates?.eurRateUSD) > 0 ? Number(opts.rates.eurRateUSD) : '';
  if (usd !== '' || eur !== '') return `${c}|${gold}|${unit}|${usd}|${eur}`;
  return c === 'GOLD' && gold !== '' ? `GOLD|${gold}|${unit}` : c;
}

export function decodeBucketKey(key) {
  if (typeof key === 'string' && key.includes('|')) {
    const [cur, gold, unit, usd, eur] = key.split('|');
    const opts = { customRate: Number(gold) > 0 ? Number(gold) : null, isPerOneGold: unit === '1' };
    if (Number(usd) > 0 || Number(eur) > 0) opts.rates = { usdRateTOMAN: Number(usd) || null, eurRateUSD: Number(eur) || null };
    return { currency: normalizeCurrency(cur), opts };
  }
  return { currency: normalizeCurrency(key), opts: undefined };
}

/** Merge locked-rate variants back into plain currency totals: { 'GOLD|3200|1k': 5, GOLD: 2 } -> { GOLD: 7 }. */
export function bucketsByCurrency(buckets) {
  const out = {};
  for (const [key, minor] of Object.entries(buckets || {})) {
    const { currency } = decodeBucketKey(key);
    out[currency] = (out[currency] || 0) + minor;
  }
  return out;
}

/** Collapse buckets to one display currency, honouring locked gold rates. isApproximate is true when currencies mixed. */
export function collapseBuckets(buckets, displayCurrency, rates = {}) {
  const display = normalizeCurrency(displayCurrency);
  let total = 0;
  let mixed = false;
  for (const [key, minor] of Object.entries(buckets || {})) {
    if (!minor) continue;
    const { currency, opts } = decodeBucketKey(key);
    if (currency !== display) mixed = true;
    total += convertMinor(minor, currency, display, rates, opts);
  }
  return { minor: total, currency: display, isApproximate: mixed };
}
