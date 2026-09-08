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

export const STATUSES = ['Paid', 'Pending', 'Working', 'On Hold', 'Failed'];

export const STATUS_LABELS = {
  Paid: 'پرداخت شده',
  Pending: 'درحال انتظار',
  Working: 'درحال انجام',
  'On Hold': 'توقف موقت',
  Failed: 'ناموفق',
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
    next: 'Failed',
  },
  Failed: {
    label: 'ناموفق',
    color: 'rose',
    badgeClass: 'bg-rose-950/40 text-rose-400 border border-rose-800/40 hover:bg-rose-900/40',
    dotClass: 'bg-rose-400',
    next: 'Paid',
  },
};

import { toPersianDigits, formatShamsiDate } from './i18n';

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

/**
 * Generate Discord Markdown Receipt for a work entry
 */
export function generateDiscordReceiptText(entry, { language = 'en', globalCurrency = 'TOMAN' } = {}) {
  if (!entry) return '';
  const isFa = language === 'fa';
  const receiptId = (entry.id || 'JOB').toUpperCase();
  const dt = entry.dateTime ? new Date(entry.dateTime) : new Date();
  const dateStr = dt && !isNaN(dt.getTime())
    ? isFa
      ? formatShamsiDate(dt, { month: 'long', day: 'numeric', year: 'numeric' })
      : dt.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : '--';

  const entryCurrency = entry.currency && entry.currency !== 'DEFAULT' ? entry.currency : globalCurrency;
  const formattedIncome = formatMoney(entry.income || 0, entryCurrency, false, isFa);

  const isClassic = entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic';
  const effectiveRate = Number(entry.exchangeRate) || (isClassic ? 7000 : 3200);
  const rateDiscordText = isClassic ? '1 Gold' : '1k Gold';
  const hasTeammates = Array.isArray(entry.teammates) && entry.teammates.length > 0;
  const totalShares = 1 + (hasTeammates ? entry.teammates.length : 0);
  const isTeamWork = Boolean(entry.teamMode || hasTeammates);
  const totalPot = entry.pot !== undefined && entry.pot !== null
    ? entry.pot
    : (entry.income ? entry.income * totalShares : 0);
  const formattedPot = formatMoney(totalPot, entryCurrency, false, isFa);

  const teamCutsBreakdown = hasTeammates
    ? entry.teammates
        .map((tm) => {
          const cut = entry.teammateCuts?.[tm] || entry.income;
          return `${tm}: ${formatMoney(cut, entryCurrency, false, isFa)}`;
        })
        .join(', ')
    : '';

  if (isFa) {
    return `\`\`\`ini
[ رسید اثبات کار چک‌پوینت ]
شناسه      = ${receiptId}
تاریخ      = ${dateStr}
بازی       = ${entry.game || 'World of Warcraft'}
عنوان      = ${entry.title || 'کار ثبت‌شده'}
سورس       = ${entry.source || 'مشتری مستقیم'}${
      isTeamWork
        ? `\nپات تیمی   = ${formattedPot} (${totalShares} سهم)\nسهم شما    = ${formattedIncome}\nسهم تیم    = ${teamCutsBreakdown}`
        : `\nمبلغ       = ${formattedIncome}`
    }
نرخ تبدیل  = ${formatMoney(effectiveRate, 'TOMAN', false, true)} / ${rateDiscordText}
وضعیت      = ${STATUS_CONFIG[entry.status]?.label || entry.status || 'پرداخت شده'}
یادداشت    = ${entry.notes || 'ندارد'}
\`\`\``;
  }

  return `\`\`\`ini
[ CHECKPOINT - PROOF OF WORK RECEIPT ]
ID         = ${receiptId}
Date       = ${dateStr}
Game       = ${entry.game || 'World of Warcraft'}
Title      = ${entry.title || 'Work Record'}
Source     = ${entry.source || '-'}${
    isTeamWork
      ? `\nPot        = ${formattedPot} (${totalShares} Shares)\nYour Share = ${formattedIncome}\nTeam Cuts  = ${teamCutsBreakdown}`
      : `\nAmount     = ${formattedIncome}`
  }
Rate       = ${effectiveRate.toLocaleString()} Toman / ${rateDiscordText}
Status     = ${entry.status || 'Paid'}
Notes      = ${entry.notes || 'None'}
\`\`\``;
}


