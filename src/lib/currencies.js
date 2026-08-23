/**
 * currencies.js - Currency definitions, formatters, and conversion engine for Nodra Vault
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

export const SUPPORTED_CURRENCY_CODES = ['TOMAN', 'GOLD'];

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

export const STATUS_CONFIG = {
  Paid: {
    label: 'Paid',
    color: 'emerald',
    badgeClass: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/40',
    dotClass: 'bg-emerald-400',
    next: 'Pending',
  },
  Pending: {
    label: 'Pending',
    color: 'amber',
    badgeClass: 'bg-amber-950/40 text-amber-400 border border-amber-800/40 hover:bg-amber-900/40',
    dotClass: 'bg-amber-400',
    next: 'Working',
  },
  Working: {
    label: 'Working',
    color: 'blue',
    badgeClass: 'bg-blue-950/40 text-blue-400 border border-blue-800/40 hover:bg-blue-900/40',
    dotClass: 'bg-blue-400',
    next: 'On Hold',
  },
  'On Hold': {
    label: 'On Hold',
    color: 'zinc',
    badgeClass: 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800',
    dotClass: 'bg-zinc-500',
    next: 'Paid',
  },
};

/**
 * Extract numeric and unit parts for customized typography styling
 */
export function formatMoneyParts(amount, currencyCode = 'TOMAN', compact = false) {
  const code = currencyCode === 'WOW_GOLD' ? 'GOLD' : (currencyCode === 'USD' ? 'TOMAN' : (currencyCode || 'TOMAN'));
  const cur = CURRENCIES[code] || CURRENCIES.TOMAN;
  const num = Number(amount || 0);

  let formattedNum = '0';
  if (!isNaN(num)) {
    if (compact && Math.abs(num) >= 1000000) {
      formattedNum = (num / 1000000).toFixed(1) + 'M';
    } else if (compact && Math.abs(num) >= 1000) {
      formattedNum = (num / 1000).toFixed(1) + 'k';
    } else {
      formattedNum = Math.round(num).toLocaleString('en-US');
    }
  }

  const unit = cur.suffix.trim();
  return {
    amount: formattedNum,
    unit,
    full: `${formattedNum}${cur.suffix}`,
  };
}

/**
 * Format numeric currency amount for display
 */
export function formatMoney(amount, currencyCode = 'TOMAN', compact = false) {
  return formatMoneyParts(amount, currencyCode, compact).full;
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

/**
 * Format converted secondary string (e.g. "≈ 320,000 تومان" or "≈ 100,000 G")
 */
export function formatConvertedSecondary(amount, fromCurrency, targetCurrency, rates = {}, customRate = null, isPerOneGold = false) {
  const normalize = (c) => {
    if (c === 'WOW_GOLD') return 'GOLD';
    if (c === 'USD') return 'TOMAN';
    return c || 'TOMAN';
  };

  const from = normalize(fromCurrency);
  const to = normalize(targetCurrency);

  if (from === to) return null;

  const converted = convertCurrency(amount, from, to, rates, customRate, isPerOneGold);
  return `≈ ${formatMoney(converted, to)}`;
}


