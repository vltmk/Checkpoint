/**
 * currencies.js - Currency definitions, formatters, and gaming presets for Nodra Pay
 */

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'USD ($)', suffix: '', isFiat: true, flag: '🇺🇸' },
  TOMAN: { code: 'TOMAN', symbol: '', name: 'Toman (تومان)', suffix: ' تومان', isFiat: true, flag: '🇮🇷' },
  EUR: { code: 'EUR', symbol: '€', name: 'EUR (€)', suffix: '', isFiat: true, flag: '🇪🇺' },
  GBP: { code: 'GBP', symbol: '£', name: 'GBP (£)', suffix: '', isFiat: true, flag: '🇬🇧' },
  USDT: { code: 'USDT', symbol: '₮', name: 'USDT (₮)', suffix: '', isFiat: true, flag: '🌐' },
  WOW_GOLD: { code: 'WOW_GOLD', symbol: '🟡 ', name: 'WoW Gold (g)', suffix: 'g', isFiat: false, game: 'World of Warcraft' },
};

export const GAMES = [
  'World of Warcraft',
  'World of Warcraft Classic',
];

export const CATEGORIES = [];

export const STATUSES = ['Paid', 'Pending', 'Working', 'On Hold'];

export const STATUS_CONFIG = {
  Paid: {
    label: 'Paid',
    color: 'emerald',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    dotClass: 'bg-emerald-400',
    next: 'Pending',
  },
  Pending: {
    label: 'Pending',
    color: 'amber',
    badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dotClass: 'bg-amber-400',
    next: 'Working',
  },
  Working: {
    label: 'Working',
    color: 'purple',
    badgeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    dotClass: 'bg-purple-400',
    next: 'On Hold',
  },
  'On Hold': {
    label: 'On Hold',
    color: 'blue',
    badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    dotClass: 'bg-blue-400',
    next: 'Paid',
  },
};

/**
 * Format numeric currency amount for display
 */
export function formatMoney(amount, currencyCode = null, fallbackCurrency = 'USD') {
  const code = currencyCode && currencyCode !== 'DEFAULT' ? currencyCode : fallbackCurrency;
  const cur = CURRENCIES[code] || { symbol: '$', suffix: '', isFiat: true };
  const num = Number(amount || 0);

  let formattedNum;
  if (code === 'TOMAN' || !cur.isFiat) {
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
 * Convert WoW Gold amount to target fiat currency based on rate per 1,000 Gold
 */
export function convertToFiat(goldAmount, goldRate, targetCurrency = 'USD') {
  const rate = Number(goldRate || 0);
  const gold = Number(goldAmount || 0);
  if (!rate || rate <= 0 || !gold) return 0;
  return (gold / 1000) * rate;
}

/**
 * Format converted value if currency is WoW Gold and conversion rate is set
 */
export function formatConvertedValue(amount, currencyCode, goldRate, targetCurrency = 'USD') {
  if (currencyCode === 'WOW_GOLD' && goldRate && Number(goldRate) > 0) {
    const converted = convertToFiat(amount, goldRate, targetCurrency);
    return formatMoney(converted, targetCurrency);
  }
  return formatMoney(amount, currencyCode);
}

/**
 * Gaming Quick Presets for 1-click modal fill
 */
export const GAMING_PRESETS = [
  {
    name: 'Mythic+ +20 Boost',
    icon: '⚔️',
    data: {
      title: 'Mythic+ +20 Boost',
      game: 'World of Warcraft',
      currency: 'WOW_GOLD',
      income: 450000,
      hours: 2.5,
      notes: 'Timed +20 dungeon run boost with specific loot funnel.',
    },
  },
  {
    name: 'Raid GDKP Run',
    icon: '👑',
    data: {
      title: 'Raid GDKP Run',
      game: 'World of Warcraft Classic',
      currency: 'WOW_GOLD',
      income: 850000,
      hours: 4.0,
      notes: 'Full clear GDKP raid with gold pot split.',
    },
  },
  {
    name: 'Leveling 1-80 Service',
    icon: '⚡',
    data: {
      title: 'Leveling 1-80 Service',
      game: 'World of Warcraft Classic',
      currency: 'TOMAN',
      income: 3500000,
      hours: 12.0,
      notes: 'Fast 1-80 questing and dungeon grinding service.',
    },
  },
  {
    name: 'Custom WeakAuras UI',
    icon: '🛡️',
    data: {
      title: 'Custom WeakAuras UI',
      game: 'World of Warcraft',
      currency: 'USD',
      income: 180,
      hours: 5.0,
      notes: 'Tailored Mythic raid aura suite and action bar integration.',
    },
  },
  {
    name: 'Gold Farming / Crafting',
    icon: '⛏️',
    data: {
      title: 'Gold Farming / Crafting',
      game: 'World of Warcraft',
      currency: 'WOW_GOLD',
      income: 600000,
      hours: 6.0,
      notes: 'Ore farming and profession craft orders fulfillment.',
    },
  },
];

/**
 * WoW Gold Rate Presets (per 1,000 gold)
 */
export const WOW_PRESETS = [
  { label: 'Retail (USD)', rate: 0.035, currency: 'USD' },
  { label: 'High (USD)', rate: 0.045, currency: 'USD' },
  { label: 'Toman (2.5k)', rate: 2500, currency: 'TOMAN' },
  { label: 'Toman (3.2k)', rate: 3200, currency: 'TOMAN' },
  { label: 'EU (EUR)', rate: 0.032, currency: 'EUR' },
];
