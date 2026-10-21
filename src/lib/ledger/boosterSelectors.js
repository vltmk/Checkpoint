/**
 * boosterSelectors.js - view models for the Booster profile, built on the same engine as the Advertiser's.
 *
 * A booster's world is the mirror image of a seller's: clients, guilds and advertisers owe THEM. So the key
 * questions are "who owes me", "what did I earn this month", and "what did I spend". Teammates (when a job is
 * split) are the optional counterpart of the seller's boosters.
 *
 * "Owed to me" counts finished jobs that are not paid yet. Jobs still in progress are shown separately,
 * because they are not owed yet.
 */
import {
  orderMarginMinor,
  orderReceivableMinor,
  orderReceivedMinor,
  orderRateOpts,
  paymentRateOpts,
  payerKey,
  voidedPaymentIds,
  DEAD_LIFECYCLES,
} from './engine.js';
import { convertMinor, normalizeCurrency } from './money.js';
import { UNKNOWN_PAYER_ID } from './legacyMapper.js';
import { peopleList } from './selectors.js';

const DAY = 86400000;

/** The payer used when a job has none: shown as "Direct / unknown". */
export const NO_PAYER = Object.freeze({ id: '', kind: 'client', name: '' });

export const payerParty = (partyById, key) => (key ? partyById.get(key) || { id: key, kind: 'client', name: '?' } : NO_PAYER);

const liveJobs = (ctx) => ctx.orders.filter((o) => o.kind !== 'expense' && !DEAD_LIFECYCLES.has(o.lifecycle));

/** Everyone who pays me, with what they owe now, what is still in progress, and how long the oldest unpaid job has waited. */
export function payerList(ctx, parties, { rates, displayCurrency, now = Date.now() }) {
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const groups = new Map();
  for (const o of liveJobs(ctx)) {
    const key = payerKey(o);
    const g = groups.get(key) || { key, party: payerParty(partyById, key), jobs: 0, owedMinor: 0, progressMinor: 0, collectedMinor: 0, oldestMs: null, isApproximate: false };
    const receivable = orderReceivableMinor(o);
    const received = Math.min(receivable, orderReceivedMinor(ctx, o.id));
    const outstanding = receivable - received;
    const lock = orderRateOpts(o);
    if (normalizeCurrency(o.currency) !== normalizeCurrency(displayCurrency)) g.isApproximate = true;
    const conv = (m) => convertMinor(m, o.currency, displayCurrency, rates, lock);
    g.jobs += 1;
    g.collectedMinor += conv(received);
    if (o.lifecycle === 'done') {
      g.owedMinor += conv(outstanding);
      const t = Date.parse(o.dateTime);
      if (outstanding > 0 && Number.isFinite(t) && (g.oldestMs === null || t < g.oldestMs)) g.oldestMs = t;
    } else {
      g.progressMinor += conv(outstanding);
    }
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, agingDays: g.oldestMs === null ? 0 : Math.max(0, Math.floor((now - g.oldestMs) / DAY)) }))
    .sort((a, b) => b.owedMinor - a.owedMinor || b.progressMinor - a.progressMinor || String(a.party.name).localeCompare(String(b.party.name)));
}

/**
 * One client's jobs and payments in date order, with a running balance of what they owe me
 * (finished jobs add to it, payments take from it; jobs still in progress do not count yet).
 */
export function payerStatement(ctx, key, { rates, displayCurrency }) {
  const events = [];
  const voided = voidedPaymentIds(ctx.payments);
  for (const o of liveJobs(ctx)) {
    if (payerKey(o) !== (key || '')) continue;
    const receivable = orderReceivableMinor(o);
    events.push({
      type: 'job', id: o.id, at: Date.parse(o.dateTime), order: o, amountMinor: receivable, currency: normalizeCurrency(o.currency),
      appliedMinor: Math.min(receivable, orderReceivedMinor(ctx, o.id)), done: o.lifecycle === 'done',
    });
  }
  for (const p of ctx.payments) {
    if (p.voidsPaymentId || p.direction !== 'in' || p.kind === 'expense') continue;
    if ((p.partyId || '') !== (key || '') && !(key === '' && p.partyId === UNKNOWN_PAYER_ID)) continue;
    events.push({ type: 'payment', id: p.id, at: Date.parse(p.dateTime), payment: p, amountMinor: p.amountMinor, currency: normalizeCurrency(p.currency), voided: voided.has(p.id) });
  }
  events.sort((a, b) => a.at - b.at || (a.type === 'job' ? -1 : 1));
  let running = 0;
  let approximate = false;
  let owed = 0;
  let progress = 0;
  for (const e of events) {
    const opts = e.type === 'job' ? orderRateOpts(e.order) : paymentRateOpts(e.payment);
    const inDisplay = convertMinor(e.amountMinor, e.currency, displayCurrency, rates, opts);
    if (e.currency !== normalizeCurrency(displayCurrency)) approximate = true;
    if (e.type === 'job') {
      const left = convertMinor(e.amountMinor - e.appliedMinor, e.currency, displayCurrency, rates, opts);
      if (e.done) {
        running += inDisplay;
        owed += left;
      } else progress += left;
    } else if (!e.voided) running -= inDisplay;
    e.runningMinor = running;
  }
  // money received beyond what they owed shows as a negative balance (they are ahead of you)
  return { events, owedMinor: owed, progressMinor: progress, balanceMinor: running, isApproximate: approximate };
}

/** The Booster's home screen numbers. `monthKey` maps an ISO date to the user's calendar month (Shamsi or Gregorian). */
export function boosterOverview(ctx, parties, { rates, displayCurrency, now = Date.now(), monthKey, staleDays = 7 }) {
  const payers = payerList(ctx, parties, { rates, displayCurrency, now });
  const thisMonth = monthKey(new Date(now).toISOString());
  const conv = (m, cur, opts) => convertMinor(m, cur, displayCurrency, rates, opts);
  let approximate = payers.some((p) => p.isApproximate);

  let earned = 0;
  let jobs = 0;
  let allTimeEarned = 0;
  for (const o of liveJobs(ctx)) {
    const m = conv(orderMarginMinor(ctx, o), o.currency, orderRateOpts(o));
    if (normalizeCurrency(o.currency) !== normalizeCurrency(displayCurrency)) approximate = true;
    allTimeEarned += m;
    if (monthKey(o.dateTime) === thisMonth) {
      earned += m;
      jobs += 1;
    }
  }
  let spent = 0;
  let allTimeSpent = 0;
  const recent = [];
  for (const p of ctx.effectivePayments) {
    const isExpense = p.kind === 'expense';
    const v = conv(p.amountMinor, p.currency, paymentRateOpts(p));
    if (normalizeCurrency(p.currency) !== normalizeCurrency(displayCurrency)) approximate = true;
    if (isExpense) {
      allTimeSpent += v;
      if (monthKey(p.dateTime) === thisMonth) spent += v;
    }
    if (p.direction === 'in' || isExpense) recent.push(p);
  }
  recent.sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime));

  const owedMinor = payers.reduce((s, p) => s + p.owedMinor, 0);
  const progressMinor = payers.reduce((s, p) => s + p.progressMinor, 0);
  const team = peopleList(ctx, parties, { rates, displayCurrency, now }).filter((p) => p.party.id !== 'party_unassigned');
  const teamOwedMinor = team.reduce((s, p) => s + p.display.owedNowMinor, 0);

  const attention = [];
  for (const p of payers) if (p.owedMinor > 0 && p.agingDays >= staleDays) attention.push({ type: 'client_overdue', key: p.key, days: p.agingDays });
  return {
    currency: displayCurrency, owedMinor, progressMinor, owingClients: payers.filter((p) => p.owedMinor > 0).length,
    oldestDays: payers.reduce((m, p) => Math.max(m, p.owedMinor > 0 ? p.agingDays : 0), 0),
    earnedMinor: earned, spentMinor: spent, keptMinor: earned - spent, jobsThisMonth: jobs,
    allTimeEarnedMinor: allTimeEarned, allTimeSpentMinor: allTimeSpent,
    teamOwedMinor, team, payers, attention, recentPayments: recent.slice(0, 6), isApproximate: approximate,
  };
}
