/**
 * platforms.js - marketplaces the sellers and boosters usually deal with, and what Checkpoint remembers per platform.
 *
 * `feePct` is only a starting suggestion for the order's platform fee. Once a seller enters a different number for a
 * platform it is remembered on that platform's record (party.settings.feePct) and wins over this table.
 */
import { slug } from './legacyMapper.js';

export const KNOWN_PLATFORMS = [
  { id: 'g2g', label: 'G2G', feePct: 9.99 },
  { id: 'funpay', label: 'FunPay', feePct: 7 },
  { id: 'eldorado', label: 'Eldorado', feePct: 10 },
  { id: 'blazingboost', label: 'BlazingBoost', feePct: null },
  { id: 'playerauctions', label: 'PlayerAuctions', feePct: null },
  { id: 'chicksgold', label: 'ChicksGold', feePct: null },
];

const squash = (name) => slug(name).replace(/[^a-z0-9]/g, '');

export function findKnownPlatform(name) {
  const key = squash(name);
  return key ? KNOWN_PLATFORMS.find((p) => key.includes(p.id)) || null : null;
}

export const isPlatformName = (name) => findKnownPlatform(name) !== null;

/**
 * The fee % to suggest when an order comes from this platform: what the seller used last time for it,
 * else the table's value, else 0.
 */
export function suggestedFeePct(partyOrName, party) {
  const saved = Number(party?.settings?.feePct ?? partyOrName?.settings?.feePct);
  if (Number.isFinite(saved) && saved >= 0) return saved;
  const known = findKnownPlatform(typeof partyOrName === 'string' ? partyOrName : partyOrName?.name);
  return known?.feePct ?? 0;
}

export const MAX_FEE_LAYERS = 5;

const cleanPct = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : 0;
};
const cleanFlat = (v) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
};

/**
 * A platform's saved withdrawal rule, with safe defaults. `layers` are the fees taken on the way to you (platform,
 * bank, exchange...). A rule saved before layers existed (one pct and one flat amount) reads as a single layer.
 */
export function withdrawalRule(party) {
  const w = party?.settings?.withdraw || {};
  const pct = cleanPct(w.pct);
  const flatMinor = cleanFlat(w.flatMinor);
  const saved = Array.isArray(w.layers)
    ? w.layers.slice(0, MAX_FEE_LAYERS).map((l) => ({ label: typeof l?.label === 'string' ? l.label.slice(0, 40) : '', pct: cleanPct(l?.pct), flatMinor: cleanFlat(l?.flatMinor) })).filter((l) => l.pct > 0 || l.flatMinor > 0)
    : [];
  const layers = saved.length ? saved : (pct > 0 || flatMinor > 0 ? [{ label: '', pct, flatMinor }] : []);
  return {
    pct,
    flatMinor,
    flatCurrency: typeof w.flatCurrency === 'string' ? w.flatCurrency : null,
    // most platforms send the net amount, and people type what reached their account
    takenOut: w.takenOut === undefined ? true : Boolean(w.takenOut),
    layers,
  };
}
