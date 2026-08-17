/**
 * currencies.js - Currency definitions, formatters, and conversion engine for Nodra Vault
 */

export const CURRENCIES = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'USD ($)',
    suffix: '',
    isFiat: true,
    flag: '🇺🇸',
  },
  TOMAN: {
    code: 'TOMAN',
    symbol: '',
    name: 'Toman (تومان)',
    suffix: ' تومان',
    isFiat: true,
    flag: '🇮🇷',
  },
  GOLD: {
    code: 'GOLD',
    symbol: '🪙 ',
    name: 'GOLD',
    suffix: ' GOLD',
    isFiat: false,
    game: 'World of Warcraft',
  },
};

export const SUPPORTED_CURRENCY_CODES = ['USD', 'TOMAN', 'GOLD'];

export const GAMES = [
  'World of Warcraft',
  'World of Warcraft Classic',
];

export const STATUSES = ['Paid', 'Pending', 'Working', 'On Hold'];

export const STATUS_CONFIG = {
  Paid: {
    label: 'Paid',
    color: 'emerald',
    badgeClass: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40',
    dotClass: 'bg-emerald-400',
    next: 'Pending',
  },
  Pending: {
    label: 'Pending',
    color: 'amber',
    badgeClass: 'bg-amber-950/40 text-amber-400 border border-amber-800/40',
    dotClass: 'bg-amber-400',
    next: 'Working',
  },
  Working: {
    label: 'Working',
    color: 'blue',
    badgeClass: 'bg-blue-950/40 text-blue-400 border border-blue-800/40',
    dotClass: 'bg-blue-400',
    next: 'On Hold',
  },
  'On Hold': {
    label: 'On Hold',
    color: 'zinc',
    badgeClass: 'bg-zinc-900 text-zinc-400 border border-zinc-800',
    dotClass: 'bg-zinc-500',
    next: 'Paid',
  },
};

/**
 * Format numeric currency amount for display
 */
export function formatMoney(amount, currencyCode = 'USD', compact = false) {
  const code = currencyCode === 'WOW_GOLD' ? 'GOLD' : (currencyCode || 'USD');
  const cur = CURRENCIES[code] || CURRENCIES.USD;
  const num = Number(amount || 0);

  if (isNaN(num)) return `0${cur.suffix}`;

  let formattedNum;
  if (compact && Math.abs(num) >= 1000000) {
    formattedNum = (num / 1000000).toFixed(1) + 'M';
  } else if (compact && Math.abs(num) >= 1000) {
    formattedNum = (num / 1000).toFixed(1) + 'k';
  } else if (code === 'TOMAN' || code === 'GOLD') {
    formattedNum = Math.round(num).toLocaleString('en-US');
  } else {
    formattedNum = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (cur.symbol && cur.suffix) {
    return `${cur.symbol}${formattedNum}${cur.suffix}`;
  } else if (cur.symbol) {
    return `${cur.symbol}${formattedNum}`;
  } else if (cur.suffix) {
    return `${formattedNum}${cur.suffix}`;
  }
  return formattedNum;
}

/**
 * Robust Bi-Directional Currency Converter
 * Converts any amount from fromCurrency to toCurrency using configurable rates.
 * 
 * Rates Object:
 * {
 *   goldRateUSD: number (rate per 1,000 GOLD in USD, e.g. 0.035)
 *   goldRateTOMAN: number (rate per 1,000 GOLD in TOMAN, e.g. 3200)
 * }
 */
export function convertCurrency(amount, fromCurrency, toCurrency, rates = {}) {
  const val = Number(amount || 0);
  if (isNaN(val) || val === 0) return 0;

  const from = fromCurrency === 'WOW_GOLD' ? 'GOLD' : (fromCurrency || 'USD');
  const to = toCurrency === 'WOW_GOLD' ? 'GOLD' : (toCurrency || 'USD');

  // Same currency -> 1:1
  if (from === to) return val;

  const goldRateUSD = Number(rates.goldRateUSD) || 0.035;
  const goldRateTOMAN = Number(rates.goldRateTOMAN) || 3200;

  // 1. From GOLD to Fiat
  if (from === 'GOLD') {
    if (to === 'USD') {
      return (val / 1000) * goldRateUSD;
    }
    if (to === 'TOMAN') {
      return (val / 1000) * goldRateTOMAN;
    }
  }

  // 2. From Fiat to GOLD
  if (to === 'GOLD') {
    if (from === 'USD') {
      return goldRateUSD > 0 ? (val / goldRateUSD) * 1000 : 0;
    }
    if (from === 'TOMAN') {
      return goldRateTOMAN > 0 ? (val / goldRateTOMAN) * 1000 : 0;
    }
  }

  // 3. Between USD and TOMAN (via Gold reference or default cross-rate)
  if (from === 'USD' && to === 'TOMAN') {
    // If 1k gold = $X USD and 1k gold = Y Toman, then $1 USD = Y / X Toman
    if (goldRateUSD > 0 && goldRateTOMAN > 0) {
      return val * (goldRateTOMAN / goldRateUSD);
    }
    return val * 90000;
  }

  if (from === 'TOMAN' && to === 'USD') {
    if (goldRateUSD > 0 && goldRateTOMAN > 0) {
      return val * (goldRateUSD / goldRateTOMAN);
    }
    return val / 90000;
  }

  return val;
}

/**
 * Format converted secondary string (e.g. "≈ $17.50" or "≈ 500,000 GOLD")
 */
export function formatConvertedSecondary(amount, fromCurrency, targetCurrency, rates = {}) {
  const from = fromCurrency === 'WOW_GOLD' ? 'GOLD' : (fromCurrency || 'USD');
  const to = targetCurrency === 'WOW_GOLD' ? 'GOLD' : (targetCurrency || 'USD');

  if (from === to) return null;

  const converted = convertCurrency(amount, from, to, rates);
  return `≈ ${formatMoney(converted, to)}`;
}
