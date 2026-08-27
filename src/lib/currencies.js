/**
 * currencies.js - Currency definitions, formatters, and conversion engine for CHECKPOINT
 * Strictly supports Iranian Toman (تومان) and World of Warcraft Gold (G).
 */

export const CURRENCIES = {
  TOMAN: {
    code: 'TOMAN',
    symbol: '',
    name: 'Toman (تومان)',
    suffix: ' تومان',
    isFiat: true,
  },
  GOLD: {
    code: 'GOLD',
    symbol: '',
    name: 'GOLD (G)',
    suffix: ' G',
    isFiat: false,
    game: 'World of Warcraft',
  },
};

export const GAMES = [
  'World of Warcraft',
  'World of Warcraft Classic',
];

export const JOB_SOURCES = [
  'G2G',
  'FunPay',
  'Discord Direct',
  'Guild Run',
  'Eldorado',
  'Personal Client',
];

export const STATUSES = ['Paid', 'Pending', 'Working', 'On Hold'];

export const STATUS_LABELS = {
  Paid: 'پرداخت شده',
  Pending: 'درحال انتظار',
  Working: 'درحال انجام',
  'On Hold': 'توقف موقت',
};

export const STATUS_CONFIG = {
  Paid: {
    label: 'پرداخت شده',
    color: 'emerald',
    badgeClass: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/40',
    dotClass: 'bg-emerald-400',
    next: 'Pending',
  },
  Pending: {
    label: 'درحال انتظار',
    color: 'amber',
    badgeClass: 'bg-amber-950/40 text-amber-400 border border-amber-800/40 hover:bg-amber-900/40',
    dotClass: 'bg-amber-400',
    next: 'Working',
  },
  Working: {
    label: 'درحال انجام',
    color: 'blue',
    badgeClass: 'bg-blue-950/40 text-blue-400 border border-blue-800/40 hover:bg-blue-900/40',
    dotClass: 'bg-blue-400',
    next: 'On Hold',
  },
  'On Hold': {
    label: 'توقف موقت',
    color: 'zinc',
    badgeClass: 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800',
    dotClass: 'bg-zinc-500',
    next: 'Paid',
  },
};

import { toPersianDigits } from './i18n';

/**
 * Extract numeric and unit parts for customized typography styling
 */
export function formatMoneyParts(amount, currencyCode = 'TOMAN', compact = false, usePersianDigits = false) {
  const code = currencyCode === 'WOW_GOLD' ? 'GOLD' : (currencyCode === 'USD' ? 'TOMAN' : (currencyCode || 'TOMAN'));
  const cur = CURRENCIES[code] || CURRENCIES.TOMAN;
  const num = Number(amount || 0);

  let formattedNum = '0';
  let magnitude = '';
  if (!isNaN(num)) {
    if (compact && Math.abs(num) >= 1000000) {
      formattedNum = (num / 1000000).toFixed(1);
      magnitude = 'M';
    } else if (compact && Math.abs(num) >= 1000) {
      formattedNum = (num / 1000).toFixed(1);
      magnitude = 'k';
    } else {
      formattedNum = Math.round(num).toLocaleString('en-US');
    }
  }

  // Only convert to Persian digits if requested and NOT Gold (as per rule)
  if (usePersianDigits && code !== 'GOLD') {
    formattedNum = toPersianDigits(formattedNum);
  }

  const unit = cur.suffix.trim();
  const full = code === 'GOLD'
    ? `\u200E${formattedNum}${magnitude} G\u200E`
    : (magnitude ? `\u200E${formattedNum}${magnitude}\u200E${cur.suffix}` : `${formattedNum}${cur.suffix}`);

  return {
    amount: formattedNum,
    magnitude,
    unit,
    full,
  };
}

/**
 * Format numeric currency amount for display
 */
export function formatMoney(amount, currencyCode = 'TOMAN', compact = false, usePersianDigits = false) {
  return formatMoneyParts(amount, currencyCode, compact, usePersianDigits).full;
}

/**
 * Robust Bi-Directional Currency Converter
 * Converts between TOMAN and GOLD directly.
 * Standard rate is per 1,000 Gold (WoW Retail), but supports per 1 Gold (WoW Classic).
 */
export function convertCurrency(amount, fromCurrency, toCurrency, rates = {}, customRate = null, isPerOneGold = false) {
  const val = Number(amount || 0);
  if (isNaN(val) || val === 0) return 0;

  const normalize = (c) => {
    if (c === 'WOW_GOLD') return 'GOLD';
    if (c === 'USD') return 'TOMAN';
    return c || 'TOMAN';
  };

  const from = normalize(fromCurrency);
  const to = normalize(toCurrency);

  // Same currency -> 1:1
  if (from === to) return val;

  const rate = Number(customRate) > 0
    ? Number(customRate)
    : (Number(rates?.goldRateTOMAN) > 0 ? Number(rates.goldRateTOMAN) : 3200);

  // 1. From GOLD to TOMAN
  if (from === 'GOLD' && to === 'TOMAN') {
    return isPerOneGold ? val * rate : (val / 1000) * rate;
  }

  // 2. From TOMAN to GOLD
  if (from === 'TOMAN' && to === 'GOLD') {
    if (rate <= 0) return 0;
    return isPerOneGold ? val / rate : (val / rate) * 1000;
  }

  return val;
}

/**
 * Convert a full entry object using its locked historical exchangeRate and rateUnit
 */
export function convertEntryCurrency(entry, targetCurrency, defaultRates = {}) {
  if (!entry) return 0;
  const inc = parseFloat(entry.income) || 0;
  const cur = entry.currency || 'TOMAN';
  const isClassic = entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic';
  const defaultRate = isClassic ? 7000 : (Number(defaultRates?.goldRateTOMAN) || 3200);
  const entryRate = Number(entry.exchangeRate) > 0 ? Number(entry.exchangeRate) : defaultRate;
  return convertCurrency(inc, cur, targetCurrency, defaultRates, entryRate, isClassic);
}


