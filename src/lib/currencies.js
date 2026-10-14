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
    supportsDecimals: false,
  },
  GOLD: {
    code: 'GOLD',
    symbol: '',
    name: 'GOLD (G)',
    suffix: ' G',
    isFiat: false,
    supportsDecimals: false,
    game: 'World of Warcraft',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'USD ($)',
    suffix: ' $',
    isFiat: true,
    supportsDecimals: true,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'EUR (€)',
    suffix: ' €',
    isFiat: true,
    supportsDecimals: true,
  },
};

export const DEFAULT_EXCHANGE_RATES = {
  goldRateTOMAN: 3200,
  usdRateTOMAN: 95000,
  eurRateUSD: 1.08,
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
  Pending: 'تکمیل شده',
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
    label: 'تکمیل شده',
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

import { toPersianDigits, formatShamsiDate, normalizeDigits } from './persianCalendar.js';

/**
 * Extract numeric and unit parts for customized typography styling
 */
export function formatMoneyParts(amount, currencyCode = 'TOMAN', compact = false, usePersianDigits = false) {
  const code = currencyCode === 'WOW_GOLD' ? 'GOLD' : (currencyCode || 'TOMAN');
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
      if (cur.supportsDecimals && (num % 1 !== 0 || String(amount).includes('.'))) {
        formattedNum = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        formattedNum = Math.round(num).toLocaleString('en-US');
      }
    }
  }

  // Only convert to Persian digits if requested and NOT Gold, USD, EUR
  if (usePersianDigits && code === 'TOMAN') {
    formattedNum = toPersianDigits(formattedNum);
  }

  const unit = cur.symbol ? cur.symbol : cur.suffix.trim();
  let full = '';
  if (code === 'GOLD') {
    full = `\u200E${formattedNum}${magnitude} G\u200E`;
  } else if (code === 'USD') {
    full = `\u200E$${formattedNum}${magnitude}\u200E`;
  } else if (code === 'EUR') {
    full = `\u200E€${formattedNum}${magnitude}\u200E`;
  } else {
    full = magnitude ? `\u200E${formattedNum}${magnitude}\u200E${cur.suffix}` : `${formattedNum}${cur.suffix}`;
  }

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
 * Robust Multi-Currency Converter
 * Supports conversions between TOMAN, GOLD, USD, and EUR.
 */
export function convertCurrency(amount, fromCurrency, toCurrency, rates = {}, customRate = null, isPerOneGold = false) {
  const val = Number(amount || 0);
  if (isNaN(val) || val === 0) return 0;

  const normalize = (c) => {
    if (c === 'WOW_GOLD') return 'GOLD';
    return c || 'TOMAN';
  };

  const from = normalize(fromCurrency);
  const to = normalize(toCurrency);

  // Same currency -> 1:1
  if (from === to) return val;

  const goldRate = Number(customRate) > 0
    ? Number(customRate)
    : (Number(rates?.goldRateTOMAN) > 0 ? Number(rates.goldRateTOMAN) : 3200);

  const usdRate = Number(rates?.usdRateTOMAN) > 0 ? Number(rates.usdRateTOMAN) : 95000;
  const eurRateUSD = Number(rates?.eurRateUSD) > 0 ? Number(rates.eurRateUSD) : 1.08;
  const eurRateTOMAN = Number(rates?.eurRateTOMAN) > 0 ? Number(rates.eurRateTOMAN) : (eurRateUSD * usdRate);

  // Fast path: USD <-> EUR
  if (from === 'USD' && to === 'EUR') return eurRateUSD > 0 ? val / eurRateUSD : 0;
  if (from === 'EUR' && to === 'USD') return val * eurRateUSD;

  // Convert from -> base TOMAN
  let tomanVal = val;
  if (from === 'GOLD') {
    tomanVal = isPerOneGold ? val * goldRate : (val / 1000) * goldRate;
  } else if (from === 'USD') {
    tomanVal = val * usdRate;
  } else if (from === 'EUR') {
    tomanVal = val * eurRateTOMAN;
  }

  // Convert base TOMAN -> target currency
  if (to === 'TOMAN') return Math.round(tomanVal);
  if (to === 'GOLD') {
    if (goldRate <= 0) return 0;
    return isPerOneGold ? Math.round(tomanVal / goldRate) : Math.round((tomanVal / goldRate) * 1000);
  }
  if (to === 'USD') {
    return usdRate > 0 ? Math.round((tomanVal / usdRate) * 100) / 100 : 0;
  }
  if (to === 'EUR') {
    return eurRateTOMAN > 0 ? Math.round((tomanVal / eurRateTOMAN) * 100) / 100 : 0;
  }

  return tomanVal;
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
export function generateDiscordReceiptText(
  entry,
  { language = 'en', globalCurrency = 'TOMAN', activeProfileId = 'booster', receiptMode = null } = {}
) {
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
  const isAdvertiser = activeProfileId === 'advertiser' || Boolean(entry.orderId);
  const statusLabel = STATUS_CONFIG[entry.status]?.label || entry.status || (isFa ? 'پرداخت شده' : 'Paid');

  // Advertiser Profile Formatting
  if (isAdvertiser) {
    const isClientMode = receiptMode === 'client' || (!receiptMode && !entry.teammates?.length);
    if (isClientMode) {
      const orderPrice = entry.pot || entry.income || 0;
      const formattedClientPrice = formatMoney(orderPrice, entryCurrency, false, isFa);

      if (isFa) {
        return `\`\`\`ini
[ رسید سفارش مشتری CHECKPOINT ]
شناسه      = ${receiptId}${entry.orderId ? `\nشماره سفارش = #${entry.orderId}` : ''}
تاریخ      = ${dateStr}
بازی       = ${entry.game || 'World of Warcraft'}
عنوان      = ${entry.title || 'سفارش ثبت‌شده'}
سورس       = ${entry.source || 'مشتری مستقیم'}
مبلغ سفارش = ${formattedClientPrice}
وضعیت      = ${statusLabel}
توضیحات    = ${entry.notes || 'ندارد'}
\`\`\``;
      }

      return `\`\`\`ini
[ CHECKPOINT - CLIENT ORDER RECEIPT ]
ID         = ${receiptId}${entry.orderId ? `\nOrder ID   = #${entry.orderId}` : ''}
Date       = ${dateStr}
Game       = ${entry.game || 'World of Warcraft'}
Title      = ${entry.title || 'Work Record'}
Source     = ${entry.source || '-'}
Order Price= ${formattedClientPrice}
Status     = ${entry.status || 'Paid'}
Description= ${entry.notes || 'None'}
\`\`\``;
    } else {
      // Booster Payout Slip Mode
      const boosterPayoutVal = Math.max(0, (entry.pot || entry.income || 0) - (entry.income || 0));
      const finalPayout = boosterPayoutVal > 0 ? boosterPayoutVal : (entry.income || 0);
      const formattedBoosterPayout = formatMoney(finalPayout, entryCurrency, false, isFa);
      const hasTeammates = Array.isArray(entry.teammates) && entry.teammates.length > 0;
      const boosterNames = hasTeammates ? entry.teammates.join(', ') : '-';
      const teamCutsBreakdown = hasTeammates
        ? entry.teammates
            .map((tm) => {
              const cut = entry.teammateCuts?.[tm] || (finalPayout / entry.teammates.length);
              return `${tm}: ${formatMoney(cut, entryCurrency, false, isFa)}`;
            })
            .join(', ')
        : '';

      if (isFa) {
        return `\`\`\`ini
[ فیش تسویه بوستر CHECKPOINT ]
شناسه      = ${receiptId}${entry.orderId ? `\nشماره سفارش = #${entry.orderId}` : ''}
تاریخ      = ${dateStr}
بازی       = ${entry.game || 'World of Warcraft'}
عنوان      = ${entry.title || 'سفارش ثبت‌شده'}
سورس       = ${entry.source || 'مشتری مستقیم'}
بوسترها    = ${boosterNames}
تسویه بوستر= ${formattedBoosterPayout}${teamCutsBreakdown ? `\nجزئیات سهم = ${teamCutsBreakdown}` : ''}
وضعیت      = ${statusLabel}
توضیحات    = ${entry.notes || 'ندارد'}
\`\`\``;
      }

      return `\`\`\`ini
[ CHECKPOINT - BOOSTER PAYOUT SLIP ]
ID         = ${receiptId}${entry.orderId ? `\nOrder ID   = #${entry.orderId}` : ''}
Date       = ${dateStr}
Game       = ${entry.game || 'World of Warcraft'}
Title      = ${entry.title || 'Work Record'}
Source     = ${entry.source || '-'}
Booster(s) = ${boosterNames}
Payout     = ${formattedBoosterPayout}${teamCutsBreakdown ? `\nBreakdown  = ${teamCutsBreakdown}` : ''}
Status     = ${entry.status || 'Paid'}
Description= ${entry.notes || 'None'}
\`\`\``;
    }
  }

  // Booster Profile Default Formatting
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
شناسه      = ${receiptId}${entry.orderId ? `\nشماره سفارش = #${entry.orderId}` : ''}
تاریخ      = ${dateStr}
بازی       = ${entry.game || 'World of Warcraft'}
عنوان      = ${entry.title || 'کار ثبت‌شده'}
سورس       = ${entry.source || 'مشتری مستقیم'}${
      isTeamWork
        ? `\nپات تیمی   = ${formattedPot} (${totalShares} سهم)\nسهم شما    = ${formattedIncome}\nسهم تیم    = ${teamCutsBreakdown}`
        : `\nمبلغ       = ${formattedIncome}`
    }
نرخ تبدیل  = ${formatMoney(effectiveRate, 'TOMAN', false, true)} / ${rateDiscordText}
وضعیت      = ${statusLabel}
توضیحات   = ${entry.notes || 'ندارد'}
\`\`\``;
  }

  return `\`\`\`ini
[ CHECKPOINT - PROOF OF WORK RECEIPT ]
ID         = ${receiptId}${entry.orderId ? `\nOrder ID   = #${entry.orderId}` : ''}
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
Work Description = ${entry.notes || 'None'}
\`\`\``;
}

/**
 * Sanitizes and normalizes raw, pasted, or formatted price input strings into
 * raw clean numeric strings (e.g. '60.699' or '60,699' -> '60699').
 * 
 * Supports:
 * - Dot as thousands separator: '60.699' -> '60699', '1.250.000' -> '1250000'
 * - Comma as thousands separator: '60,699' -> '60699', '1,250,000' -> '1250000'
 * - Persian/Arabic digits: '۶۰.۶۹۹', '۶۰,۶۹۹', '۶۰٬۶۹۹', '۶۰٫۶۹۹' -> '60699'
 * - Leading signs for income/expense: '+60.699' -> '+60699', '-60.699' -> '-60699'
 * - Multipliers: '60k' / '60K' -> '60000', '60.5k' -> '60500', '1.5m' / '1.5M' -> '1500000'
 * - Mixed notation with zero cents: '60,699.00' or '60.699,00' -> '60699'
 * - Strips currency words and whitespace: '60.699 تومان' -> '60699', '60.699 G' -> '60699'
 */
export function sanitizePriceInput(input, options = {}) {
  if (input === null || input === undefined) return '';
  let str = String(input).trim();
  if (!str) return '';

  const allowDecimals = Boolean(options?.allowDecimals);

  // 1. Normalize Persian/Arabic digits
  str = normalizeDigits(str);

  // 2. Normalize Persian/Arabic separators
  // \u066C (Arabic thousands separator ٬) -> ','
  // \u060C (Arabic comma ،) -> ','
  // \u066B (Arabic decimal separator ٫) -> '.'
  str = str.replace(/[\u066C\u060C]/g, ',').replace(/\u066B/g, '.');

  // 3. Detect and extract leading sign (+ / -)
  const hasMinus = str.includes('-');
  const hasPlus = str.includes('+');
  const sign = hasMinus ? '-' : (hasPlus ? '+' : '');

  // 4. Remove signs and whitespace
  str = str.replace(/[-+\s]/g, '');

  // 5. Check for k / m suffix multipliers (e.g. 60k, 60.5k, 1.5m)
  const matchK = str.match(/^([\d.,]+)[kK]$/);
  const matchM = str.match(/^([\d.,]+)[mM]$/);
  if (matchK) {
    const rawVal = matchK[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num)) {
      return sign + (allowDecimals ? String(Math.round(num * 1000 * 100) / 100) : String(Math.round(num * 1000)));
    }
  }
  if (matchM) {
    const rawVal = matchM[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num)) {
      return sign + (allowDecimals ? String(Math.round(num * 1000000 * 100) / 100) : String(Math.round(num * 1000000)));
    }
  }

  // Remove any non-digit non-separator characters (e.g. currency names like Toman, G, USD, etc.)
  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return sign;

  // 6. Handle commas and dots:
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  // Case A: Both ',' and '.' present (e.g. 60,699.00 or 60.699,00)
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastDot > lastComma) {
      // Comma is thousands, dot is decimal (e.g. 60,699.00 or 1,250,000.50)
      const wholePart = str.slice(0, lastDot).replace(/,/g, '');
      const decPart = str.slice(lastDot + 1);
      if (allowDecimals) {
        return sign + (decPart ? `${wholePart}.${decPart.slice(0, 2)}` : wholePart);
      }
      const num = parseFloat(`${wholePart}.${decPart}`);
      return sign + String(Math.round(num));
    } else {
      // Dot is thousands, comma is decimal (e.g. 60.699,00 or 1.250.000,50)
      const wholePart = str.slice(0, lastComma).replace(/\./g, '');
      const decPart = str.slice(lastComma + 1);
      if (allowDecimals) {
        return sign + (decPart ? `${wholePart}.${decPart.slice(0, 2)}` : wholePart);
      }
      const num = parseFloat(`${wholePart}.${decPart}`);
      return sign + String(Math.round(num));
    }
  }

  // Case B: Only commas present (e.g. 60,699 or 1,250,000 or 60,00)
  if (lastComma !== -1) {
    const parts = str.split(',');
    // If single comma followed by 1 or 2 digits at end (e.g. 60,00 or 60,5), it's European decimal cents
    if (parts.length === 2 && parts[1].length < 3) {
      if (allowDecimals) {
        return sign + `${parts[0]}.${parts[1].slice(0, 2)}`;
      }
      const num = parseFloat(`${parts[0]}.${parts[1]}`);
      return sign + String(Math.round(num));
    }
    // Otherwise all commas are thousands separators
    return sign + str.replace(/,/g, '');
  }

  // Case C: Only dots present (e.g. 60.699 or 1.250.000 or 60.000 or 60.00)
  if (lastDot !== -1) {
    const parts = str.split('.');
    // If multiple dots (e.g. 1.250.000 or 60.699.000), all are thousands separators
    if (parts.length > 2) {
      return sign + str.replace(/\./g, '');
    }
    // If single dot followed by exactly 3 digits (e.g. 60.699 or 60.000)
    // This is a thousands separator!
    if (parts.length === 2 && parts[1].length === 3) {
      return sign + parts[0] + parts[1];
    }
    // If single dot followed by 1 or 2 digits (e.g. 60.00 or 60.0), decimal cents
    if (parts.length === 2 && parts[1].length <= 2) {
      if (allowDecimals) {
        return sign + `${parts[0]}.${parts[1].slice(0, 2)}`;
      }
      const num = parseFloat(str);
      return sign + String(Math.round(num));
    }
    // If followed by 4 or more digits or anything else, treat as thousands separator or digits
    return sign + str.replace(/\./g, '');
  }

  // Case D: Pure digits
  return sign + str;
}
