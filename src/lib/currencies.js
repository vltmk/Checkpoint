/**
 * currencies.js - Currency definitions, formatters, and gaming presets for Nodra Pay
 */

export const CURRENCIES = {
  // Fiat & Crypto
  USD: { code: 'USD', symbol: '$', name: 'USD ($)', suffix: '', isFiat: true, flag: '🇺🇸' },
  TOMAN: { code: 'TOMAN', symbol: '', name: 'Iranian Toman (تومان)', suffix: ' تومان', isFiat: true, flag: '🇮🇷' },
  EUR: { code: 'EUR', symbol: '€', name: 'EUR (€)', suffix: '', isFiat: true, flag: '🇪🇺' },
  GBP: { code: 'GBP', symbol: '£', name: 'GBP (£)', suffix: '', isFiat: true, flag: '🇬🇧' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'CAD ($)', suffix: '', isFiat: true, flag: '🇨🇦' },
  USDT: { code: 'USDT', symbol: '₮', name: 'USDT (₮)', suffix: '', isFiat: true, flag: '🌐' },

  // In-Game Currencies
  ROBUX: { code: 'ROBUX', symbol: 'R$', name: 'Robux (R$)', suffix: ' R$', isFiat: false, game: 'Roblox' },
  VP: { code: 'VP', symbol: '', name: 'Valorant Points (VP)', suffix: ' VP', isFiat: false, game: 'Valorant' },
  VBUCKS: { code: 'VBUCKS', symbol: '', name: 'V-Bucks', suffix: ' V-Bucks', isFiat: false, game: 'Fortnite' },
  WOW_GOLD: { code: 'WOW_GOLD', symbol: '', name: 'WoW Gold (g)', suffix: 'g', isFiat: false, game: 'World of Warcraft' },
  OSRS_GP: { code: 'OSRS_GP', symbol: '', name: 'OSRS GP (M GP)', suffix: 'M GP', isFiat: false, game: 'Old School RuneScape' },
  TF2_KEYS: { code: 'TF2_KEYS', symbol: '', name: 'TF2 Keys', suffix: ' Keys', isFiat: false, game: 'Team Fortress 2' },
  MINECOINS: { code: 'MINECOINS', symbol: '', name: 'Minecoins (MC)', suffix: ' MC', isFiat: false, game: 'Minecraft' },
  CUSTOM_IGC: { code: 'CUSTOM_IGC', symbol: '', name: 'Custom Game Currency', suffix: ' pts', isFiat: false, game: 'Custom' },
};

export const CATEGORIES = [
  'Game Dev / Code',
  '3D Art / Assets',
  '2D Art / UI',
  'Level Design',
  'QA / Playtesting',
  'Modding / Rigging',
  'Coaching / Boosting',
  'Audio / SFX',
  'Sponsorship / Stream',
  'Other',
];

export const STATUSES = ['Paid', 'Escrow', 'Invoiced', 'In Progress', 'Pending'];

export const STATUS_CONFIG = {
  Paid: {
    label: 'Paid',
    color: 'emerald',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30',
    dotClass: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    next: 'Escrow',
  },
  Escrow: {
    label: 'Escrow',
    color: 'blue',
    badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30',
    dotClass: 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    next: 'Invoiced',
  },
  Invoiced: {
    label: 'Invoiced',
    color: 'amber',
    badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30',
    dotClass: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    next: 'In Progress',
  },
  'In Progress': {
    label: 'In Progress',
    color: 'purple',
    badgeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/30',
    dotClass: 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]',
    next: 'Pending',
  },
  Pending: {
    label: 'Pending',
    color: 'rose',
    badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/30',
    dotClass: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
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
 * Gaming Quick Presets for 1-click modal fill
 */
export const GAMING_PRESETS = [
  {
    name: 'Roblox 3D Pets',
    icon: '🐾',
    data: {
      title: 'Roblox Simulator Map & Pet 3D Assets',
      game: 'Pet Royale [Roblox]',
      category: '3D Art / Assets',
      platform: 'Roblox Studio / Blender',
      currency: 'ROBUX',
      income: 45000,
      hours: 14.0,
      tags: ['roblox', '3d-assets', 'pets', 'low-poly'],
      notes: 'Modeled 6 mythical eggs, hatching animations, and spawn island environment.',
    },
  },
  {
    name: 'Valorant Coaching',
    icon: '🎯',
    data: {
      title: 'Radiant 1-on-1 Coaching & Duo VOD Review',
      game: 'Valorant',
      category: 'Coaching / Boosting',
      platform: 'Discord / Riot',
      currency: 'TOMAN',
      income: 8500000,
      hours: 8.0,
      tags: ['coaching', 'vod-review', 'radiant', 'toman'],
      notes: 'In-depth utility guide for Sova and Fade lineups on Lotus and Sunset.',
    },
  },
  {
    name: 'UE5 Combat AI',
    icon: '⚡',
    data: {
      title: 'Unreal Engine 5 Boss Behavior Trees & Combat AI',
      game: 'Aethelgard RPG',
      category: 'Game Dev / Code',
      platform: 'Unreal 5.4 / C++',
      currency: 'USD',
      income: 750,
      hours: 12.5,
      tags: ['ai', 'boss-fight', 'c++', 'blueprints'],
      notes: 'Implemented Phase 2 rage mechanic, custom navmesh queries, and spell telegraphs.',
    },
  },
  {
    name: 'WoW WeakAuras',
    icon: '🛡️',
    data: {
      title: 'Custom Mythic+ WeakAuras & UI Suite',
      game: 'World of Warcraft',
      category: 'Game Dev / Code',
      platform: 'Lua / Addon',
      currency: 'WOW_GOLD',
      income: 1250000,
      hours: 6.0,
      tags: ['weakauras', 'mythic-plus', 'lua'],
      notes: 'Custom cooldown trackers and raid warning sound triggers for Mythic progression.',
    },
  },
  {
    name: 'Unity Shader VFX',
    icon: '✨',
    data: {
      title: 'Stylized Water & Post-Processing Shader',
      game: 'Indie Roguelike',
      category: 'Game Dev / Code',
      platform: 'Unity / HLSL',
      currency: 'USD',
      income: 480,
      hours: 7.5,
      tags: ['unity', 'shader-graph', 'hlsl', 'vfx'],
      notes: 'Interactive stylized water shader with depth foam, caustics, and reflection probes.',
    },
  },
  {
    name: 'UEFN Fortnite Map',
    icon: '🏝️',
    data: {
      title: 'UEFN Custom Map Level Design & Verse Scripting',
      game: 'Fortnite Creative',
      category: 'Level Design',
      platform: 'UEFN / Verse',
      currency: 'USD',
      income: 620,
      hours: 9.0,
      tags: ['uefn', 'verse', 'level-design', 'fortnite'],
      notes: 'Created 1v1 Arena map geometry, custom round mechanics, and elimination leaderboard in Verse.',
    },
  },
];
