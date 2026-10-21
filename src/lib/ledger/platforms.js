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

/** A platform's saved withdrawal rule, with safe defaults. */
export function withdrawalRule(party) {
  const w = party?.settings?.withdraw || {};
  const pct = Number(w.pct);
  const flat = Number(w.flatMinor);
  return {
    pct: Number.isFinite(pct) && pct >= 0 && pct < 100 ? pct : 0,
    flatMinor: Number.isSafeInteger(flat) && flat >= 0 ? flat : 0,
    flatCurrency: typeof w.flatCurrency === 'string' ? w.flatCurrency : null,
    // most platforms send the net amount, and people type what reached their account
    takenOut: w.takenOut === undefined ? true : Boolean(w.takenOut),
  };
}
