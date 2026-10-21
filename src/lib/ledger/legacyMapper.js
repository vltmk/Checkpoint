/**
 * legacyMapper.js - pure mapping of legacy `work_entries` rows into v2 ledger records.
 *
 * Never mutates input and never touches storage. IDs are deterministic from the legacy id, so running the
 * mapping twice produces the same records and an INSERT OR IGNORE writer stays idempotent.
 *
 * Anything that can't be mapped faithfully is flagged for review, not guessed:
 *   cuts_exceed_pool      booster cuts add up to more than pot - income (margin will read lower than before)
 *   unassigned_pool       part of pot - income has no booster; kept under the "Unassigned" party so margin is unchanged
 *   even_split_assumed    teammates exist but no cut was stored; the pool was split evenly (what the old form defaulted to)
 *   missing_pot           advertiser order with boosters but no pot
 *   approximate_rate      USD/EUR amounts, which the old model re-valued at the current rate
 */
import { toMinor, normalizeCurrency } from './money.js';

export const UNASSIGNED_PARTY_ID = 'party_unassigned';
export const UNKNOWN_PAYER_ID = 'party_unknown_payer';

const PLATFORMS = ['g2g', 'funpay', 'eldorado', 'playerauctions', 'chicksgold', 'blazingboost'];

// In the old app "Pending" is labelled "Complete": the work is finished and payment is awaited (it is also the
// default for new entries). It must migrate to done, or finished work would look like it had not been earned yet.
const LIFECYCLE = {
  Paid: 'done',
  Pending: 'done',
  Working: 'working',
  'On Hold': 'on_hold',
  Failed: 'failed',
};

/**
 * One person, however the name was typed: case, spacing, Arabic vs Persian yeh/kaf, zero-width joiners and
 * diacritics all fold to the same key (so the Arabic and Persian spellings of one name are one person).
 */
export function slug(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‍‎‏ـً-ٟ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Stable party id from a display name; case-insensitive so "Ali" and "ali" are one person. */
export function partyIdFor(kind, name) {
  const key = slug(name);
  // two independent 32-bit hashes (64 bits) so different names do not collide in practice
  let a = 5381;
  let b = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    a = ((a << 5) + a + c) | 0;
    b = Math.imul(b ^ c, 16777619);
  }
  return `party_${kind}_${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}_${key.replace(/[^a-z0-9]+/g, '').slice(0, 12)}`;
}

function parseCut(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(String(raw).replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function uniqueNames(list) {
  const seen = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim();
    if (!name) continue;
    const k = slug(name);
    if (!seen.has(k)) seen.set(k, name);
  }
  return [...seen.values()];
}

function cutFor(cuts, name) {
  if (!cuts || typeof cuts !== 'object') return null;
  // "Ali" and "ali" are one person, so a cut typed under each spelling adds up
  const k = slug(name);
  let total = null;
  for (const key of Object.keys(cuts)) {
    if (slug(key) !== k) continue;
    const v = parseCut(cuts[key]);
    if (v !== null) total = (total || 0) + v;
  }
  return total;
}

function splitEvenly(total, count) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const out = Array(count).fill(base);
  out[0] += total - base * count;
  return out;
}

function payerPartyFor(source) {
  const name = String(source || '').trim();
  if (!name) return { id: UNKNOWN_PAYER_ID, kind: 'client', name: 'Direct / Unknown' };
  const kind = PLATFORMS.some((p) => slug(name).replace(/[^a-z0-9]/g, '').includes(p)) ? 'platform' : 'client';
  return { id: partyIdFor(kind, name), kind, name };
}

/**
 * @param {object[]} entries legacy entries as returned by mapSqliteEntryRow
 * @param {{ profile?: 'advertiser' | 'booster' }} opts
 */
export function mapLegacyEntries(entries, { profile = 'advertiser' } = {}) {
  const parties = new Map();
  const orders = [];
  const shares = [];
  const payments = [];
  const allocations = [];
  const flags = [];

  const ensureParty = (p) => {
    if (!parties.has(p.id)) parties.set(p.id, { id: p.id, kind: p.kind, name: p.name });
    return p.id;
  };
  const flag = (orderId, code, detail = {}) => flags.push({ orderId, code, ...detail });

  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || !e.id) continue;
    const currency = normalizeCurrency(e.currency);
    const orderId = `ord_${e.id}`;
    const income = Number(e.income) || 0;
    const when = e.dateTime || e.updatedAt || new Date(0).toISOString();
    const settledAt = e.updatedAt || when;

    // Negative income is an expense (booster profile), not an order. Keep it as an out-payment with no party.
    if (income < 0) {
      payments.push({
        id: `pay_mig_exp_${e.id}`,
        direction: 'out',
        partyId: null,
        dateTime: when,
        amountMinor: toMinor(Math.abs(income), currency),
        currency,
        rates: lockedRates(e),
        kind: 'expense',
        note: e.title || '',
        origin: 'migrated',
        legacyId: e.id,
      });
      continue;
    }

    const payer = payerPartyFor(e.source);
    ensureParty(payer);

    const names = uniqueNames(e.teammates);
    const isAdvertiser = profile === 'advertiser';
    const hasPot = e.pot !== null && e.pot !== undefined && Number(e.pot) > 0;
    const hasTeam = names.length > 0 && (isAdvertiser || e.teamMode);

    let grossMinor = toMinor(hasPot ? e.pot : income, currency);
    const incomeMinor = toMinor(income, currency);
    if (isAdvertiser && hasTeam && !hasPot) {
      flag(orderId, 'missing_pot');
      grossMinor = incomeMinor;
    }
    if (grossMinor < incomeMinor) {
      if (hasPot) flag(orderId, 'income_exceeds_pot');
      grossMinor = incomeMinor;
    }
    const poolMinor = Math.max(0, grossMinor - incomeMinor);

    const lifecycle = LIFECYCLE[e.status] || 'pending';
    const shareState = lifecycle === 'failed' ? 'cancelled' : lifecycle === 'done' ? 'done' : 'open';

    const orderRec = {
      id: orderId,
      legacyId: e.id,
      kind: 'income',
      title: e.title || '',
      game: e.game || '',
      source: e.source || '',
      orderRef: e.orderId || '',
      payerId: payer.id,
      dateTime: when,
      lifecycle,
      currency,
      grossMinor,
      platformFeeMinor: 0,
      feeType: e.feeType || 'percent',
      feeRate: e.feeRate ?? null,
      exchangeRate: Number(e.exchangeRate) > 0 ? Number(e.exchangeRate) : null,
      rateUnit: e.rateUnit || '1k',
      note: e.notes || '',
      link: e.link || '',
      expectedPayoutAt: null,
    };
    orders.push(orderRec);
    if (currency === 'USD' || currency === 'EUR') flag(orderId, 'approximate_rate');

    // The old calculator stored the platform fee % but never used it, so pot - income still contains the
    // platform's cut. Recognise it as the fee (never more than the pool), so it isn't read as booster pay.
    const feeGuess = Number(e.platformFee) > 0 ? Math.min(poolMinor, Math.round((grossMinor * Number(e.platformFee)) / 100)) : 0;

    // --- shares: booster cuts ---
    const entryShares = [];
    const hasAnyCut = names.some((n) => cutFor(e.teammateCuts, n) !== null);
    if (poolMinor > 0 && hasTeam) {
      const cuts = names.map((n) => cutFor(e.teammateCuts, n));
      const given = cuts.filter((c) => c !== null);
      let amounts;
      if (given.length === 0) {
        amounts = splitEvenly(poolMinor - feeGuess, names.length);
        flag(orderId, 'even_split_assumed');
      } else {
        const givenMinor = cuts.map((c) => (c === null ? null : toMinor(c, currency)));
        const givenSum = givenMinor.reduce((s, x) => s + (x || 0), 0);
        const missing = givenMinor.filter((x) => x === null).length;
        const rest = Math.max(0, poolMinor - givenSum);
        const restSplit = splitEvenly(rest, missing);
        let ri = 0;
        amounts = givenMinor.map((x) => (x === null ? restSplit[ri++] : x));
        if (missing > 0) flag(orderId, 'even_split_assumed');
      }
      names.forEach((name, i) => {
        const id = partyIdFor('booster', name);
        ensureParty({ id, kind: 'booster', name });
        entryShares.push({ partyId: id, amountMinor: amounts[i] });
      });
    }

    const sharedSum = entryShares.reduce((s, x) => s + x.amountMinor, 0);
    // cuts typed to the cent rarely add up to the pool exactly: up to one unit per booster is rounding, not a gap
    const tolerance = hasTeam ? Math.max(1, names.length) : 0;
    if (poolMinor > 0) {
      if (sharedSum < poolMinor - tolerance) {
        const remainder = poolMinor - sharedSum;
        // with no stored cuts the fee was already carved out of the even split
        const feeMinor = hasAnyCut ? Math.min(remainder, feeGuess) : feeGuess;
        orderRec.platformFeeMinor = feeMinor;
        const unassigned = remainder - feeMinor;
        if (unassigned > 0) {
          ensureParty({ id: UNASSIGNED_PARTY_ID, kind: 'booster', name: 'Unassigned' });
          entryShares.push({ partyId: UNASSIGNED_PARTY_ID, amountMinor: unassigned });
          flag(orderId, 'unassigned_pool', { amountMinor: unassigned });
        }
      } else if (sharedSum > poolMinor + tolerance) {
        flag(orderId, 'cuts_exceed_pool', { poolMinor, sharedSum });
      }
    }

    for (const s of entryShares) {
      if (s.amountMinor <= 0) continue;
      shares.push({
        id: `shr_${e.id}_${s.partyId}`,
        orderId,
        partyId: s.partyId,
        amountMinor: s.amountMinor,
        state: shareState,
        note: noteFor(e.teammateNotes, s.partyId, names),
      });
    }

    // --- synthetic payments from the old boolean flags ---
    const receivable = grossMinor - orderRec.platformFeeMinor;
    // Booster profile: money is received when the entry is marked Paid; "Complete" (Pending) is earned, not yet received
    const received = isAdvertiser ? Boolean(e.sourcePaid) : e.status === 'Paid' || Boolean(e.sourcePaid);
    if (received && lifecycle !== 'failed' && receivable > 0) {
      const payId = `pay_mig_in_${e.id}`;
      payments.push({
        id: payId,
        direction: 'in',
        partyId: payer.id,
        dateTime: settledAt,
        amountMinor: receivable,
        currency,
        rates: lockedRates(e),
        kind: 'settlement',
        note: '',
        origin: 'migrated',
        legacyId: e.id,
      });
      allocations.push({
        id: `alc_mig_in_${e.id}`,
        paymentId: payId,
        targetType: 'order',
        targetId: orderId,
        appliedMinor: receivable,
        consumedMinor: receivable,
      });
    }
    if (isAdvertiser && e.boosterPaid && lifecycle !== 'failed') {
      for (const s of shares.filter((x) => x.orderId === orderId)) {
        const payId = `pay_mig_out_${e.id}_${s.partyId}`;
        payments.push({
          id: payId,
          direction: 'out',
          partyId: s.partyId,
          dateTime: settledAt,
          amountMinor: s.amountMinor,
          currency,
          rates: lockedRates(e),
          kind: 'settlement',
          note: '',
          origin: 'migrated',
          legacyId: e.id,
        });
        allocations.push({
          id: `alc_mig_out_${e.id}_${s.partyId}`,
          paymentId: payId,
          targetType: 'share',
          targetId: s.id,
          appliedMinor: s.amountMinor,
          consumedMinor: s.amountMinor,
        });
      }
    }
  }

  return { parties: [...parties.values()], orders, shares, payments, allocations, flags };
}

function lockedRates(e) {
  return {
    goldRateTOMAN: Number(e.exchangeRate) > 0 ? Number(e.exchangeRate) : null,
    isPerOneGold: e.rateUnit === '1',
  };
}

function noteFor(notes, partyId, names) {
  if (!notes || typeof notes !== 'object') return '';
  const name = names.find((n) => partyIdFor('booster', n) === partyId);
  if (!name) return '';
  const k = slug(name);
  for (const key of Object.keys(notes)) if (slug(key) === k) return String(notes[key] || '');
  return '';
}
