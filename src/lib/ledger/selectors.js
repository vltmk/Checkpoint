/**
 * selectors.js - view models for the v2 screens, built from engine.js. Pure: pass in a context, rates and `now`.
 * Money leaves here as integer minor units in the display currency, with isApproximate when currencies mixed.
 */
import {
  partyBalance,
  partyBalanceDisplay,
  agingDays,
  payerReceivables,
  exposureByCurrency,
  marginSummary,
  expensesByCurrency,
  needsAttention,
  orderMarginMinor,
  orderMoneyState,
  orderReceivableMinor,
  activeSharesOf,
  shareAppliedMinor,
  isShareEarned,
  isShareOwed,
  isPaidByPayer,
  orderRateOpts,
  paymentRateOpts,
  payerKey,
  DEAD_LIFECYCLES,
  paymentCovers,
  lastPaidAtByTarget,
} from './engine.js';
import { UNASSIGNED_PARTY_ID } from './legacyMapper.js';
import { collapseBuckets, convertMinor, normalizeCurrency } from './money.js';

const sumBuckets = (list) => {
  const out = {};
  for (const b of list) for (const [c, n] of Object.entries(b || {})) out[c] = (out[c] || 0) + n;
  return out;
};

const subBuckets = (a, b) => {
  const out = { ...a };
  for (const [c, n] of Object.entries(b || {})) out[c] = (out[c] || 0) - n;
  return out;
};

/** People (boosters/teammates) with a balance, sorted by what I owe them. */
export function peopleList(ctx, parties, { rates, displayCurrency, now = Date.now(), kinds = ['booster'] } = {}) {
  const rows = [];
  for (const party of parties) {
    if (!kinds.includes(party.kind)) continue;
    const bal = partyBalance(ctx, party.id);
    const disp = partyBalanceDisplay(bal, displayCurrency, rates);
    // archiving hides a settled person, never money that is still owed or held
    if (party.archived && disp.netMinor === 0) continue;
    const mine = ctx.shares.filter((s) => s.partyId === party.id && isShareOwed(s, ctx.orderById.get(s.orderId)));
    const openOrders = new Set(mine.filter((s) => ctx.orderById.get(s.orderId)?.lifecycle !== 'done').map((s) => s.orderId)).size;
    const totalOrders = new Set(mine.map((s) => s.orderId)).size;
    rows.push({
      party,
      balance: bal,
      display: disp,
      agingDays: agingDays(ctx, party.id, now),
      openOrders,
      totalOrders,
    });
  }
  return rows.sort((a, b) => b.display.netMinor - a.display.netMinor || a.party.name.localeCompare(b.party.name));
}

/** Everything the cockpit needs, already collapsed to the display currency. */
export function cockpitSummary(ctx, parties, { rates, displayCurrency, now = Date.now(), flaggedOrderIds = [] } = {}) {
  const people = peopleList(ctx, parties, { rates, displayCurrency, now });
  const counted = people.filter((p) => p.party.id !== UNASSIGNED_PARTY_ID);
  const owedNow = counted.reduce((s, p) => s + p.display.owedNowMinor, 0);
  const committed = counted.reduce((s, p) => s + p.display.committedMinor, 0);
  const advances = counted.reduce((s, p) => s + p.display.advanceMinor, 0);
  const approximate = counted.some((p) => p.display.isApproximate);

  const payerIds = [...new Set(ctx.orders.filter((o) => o.kind !== 'expense').map(payerKey))];
  const payers = payerIds.map((id) => {
    const r = payerReceivables(ctx, id, now);
    const held = collapseBuckets(r.held, displayCurrency, rates);
    const releasable = collapseBuckets(r.releasable, displayCurrency, rates);
    const overdue = collapseBuckets(r.overdue, displayCurrency, rates);
    return { payerId: id, heldMinor: held.minor, releasableMinor: releasable.minor, overdueMinor: overdue.minor, isApproximate: held.isApproximate || releasable.isApproximate };
  }).filter((p) => p.heldMinor + p.releasableMinor > 0);
  const owedToMe = payers.reduce((s, p) => s + p.heldMinor + p.releasableMinor, 0);

  const margin = marginSummary(ctx);
  const expenses = expensesByCurrency(ctx);
  const realized = collapseBuckets(subBuckets(margin.realized, expenses), displayCurrency, rates);
  const pipeline = collapseBuckets(margin.pipeline, displayCurrency, rates);
  const exposure = collapseBuckets(exposureByCurrency(ctx), displayCurrency, rates);

  return {
    currency: displayCurrency,
    owedNowMinor: owedNow,
    committedMinor: committed,
    advancesMinor: advances,
    owedToMeMinor: owedToMe,
    payers,
    realizedMarginMinor: realized.minor,
    pipelineMarginMinor: pipeline.minor,
    exposureMinor: exposure.minor,
    isApproximate: approximate || realized.isApproximate || pipeline.isApproximate || exposure.isApproximate || payers.some((p) => p.isApproximate),
    people,
    attention: needsAttention(ctx, { now, flaggedOrderIds }),
  };
}

/** Order statuses that mean the work itself is still open. */
export const WORK_OPEN = new Set(['pending', 'working', 'on_hold', 'disputed']);

/**
 * A finished order whose money is not settled yet: the payer has not paid it all, or a booster on it is still owed.
 * Failed and refunded orders are never "unsettled": there is nothing left to move.
 * `row` is an orderRows() row.
 */
export function isUnsettled(row) {
  if (!row || row.dead || row.order.lifecycle !== 'done') return false;
  const m = row.money;
  const toCollect = m.receivableMinor > 0 && !m.collected;
  const toPay = m.shareTotalMinor > 0 && !m.boostersPaid;
  return toCollect || toPay;
}

/**
 * Which Orders tab a row belongs to. Active = the work is open, or it is finished but money still has to move.
 * Done = finished and settled both ways. Failed and refunded orders only show under All.
 */
export function orderTab(row) {
  if (WORK_OPEN.has(row.order.lifecycle) || isUnsettled(row)) return 'active';
  if (row.order.lifecycle === 'done') return 'done';
  return 'closed';
}

/** One row per order for the Orders table: waterfall numbers, per-person share status, and money state. */
export function orderRows(ctx, partyById) {
  return ctx.orders
    .filter((o) => o.kind !== 'expense')
    .map((order) => {
      const dead = DEAD_LIFECYCLES.has(order.lifecycle);
      const shares = ctx.shares
        .filter((s) => s.orderId === order.id && s.state !== 'cancelled')
        .map((share) => {
          // the payer pays this teammate directly: nothing is outstanding from me
          const byPayer = isPaidByPayer(share);
          const applied = byPayer ? share.amountMinor : Math.min(share.amountMinor, shareAppliedMinor(ctx, share.id));
          return {
            share,
            party: partyById.get(share.partyId) || { id: share.partyId, name: '?' },
            byPayer,
            appliedMinor: applied,
            outstandingMinor: Math.max(0, share.amountMinor - applied),
            paid: applied >= share.amountMinor,
            partlyPaid: applied > 0 && applied < share.amountMinor,
            earned: isShareEarned(share, order),
          };
        });
      return {
        order,
        dead,
        receivableMinor: orderReceivableMinor(order, ctx),
        marginMinor: dead ? 0 : orderMarginMinor(ctx, order),
        shares,
        money: orderMoneyState(ctx, order),
        payer: partyById.get(order.payerId) || null,
      };
    })
    .sort((a, b) => Date.parse(b.order.dateTime) - Date.parse(a.order.dateTime));
}

/**
 * Statement for one person: shares and payments in date order, with a running balance (positive = I owe them).
 * Mixed currencies are converted at the supplied rates, so the running column is approximate then.
 */
export function partyStatement(ctx, partyId, { rates, displayCurrency }) {
  const events = [];
  const shareById = new Map(ctx.shares.map((s) => [s.id, s]));
  const sharePaidAt = lastPaidAtByTarget(ctx, 'share');
  for (const share of ctx.shares) {
    if (share.partyId !== partyId || share.state === 'cancelled' || isPaidByPayer(share)) continue;
    const order = ctx.orderById.get(share.orderId);
    if (!order || DEAD_LIFECYCLES.has(order.lifecycle)) continue;
    events.push({
      type: 'share',
      at: Date.parse(order.dateTime),
      id: share.id,
      order,
      share,
      amountMinor: share.amountMinor,
      currency: normalizeCurrency(order.currency),
      earned: isShareEarned(share, order),
      appliedMinor: Math.min(share.amountMinor, shareAppliedMinor(ctx, share.id)),
      paidAt: sharePaidAt.get(share.id) ?? null,
    });
  }
  const voided = new Set(ctx.payments.filter((p) => p.voidsPaymentId).map((p) => p.voidsPaymentId));
  for (const p of ctx.payments) {
    if (p.partyId !== partyId || p.direction !== 'out' || p.kind === 'expense' || p.voidsPaymentId) continue;
    events.push({
      type: 'payment',
      at: Date.parse(p.dateTime),
      id: p.id,
      payment: p,
      amountMinor: p.amountMinor,
      currency: normalizeCurrency(p.currency),
      voided: voided.has(p.id),
      allocations: ctx.allocations.filter((a) => a.paymentId === p.id),
      covers: paymentCovers(ctx, p.id, shareById),
    });
  }
  events.sort((a, b) => a.at - b.at || (a.type === 'share' ? -1 : 1));
  let running = 0;
  let approximate = false;
  for (const e of events) {
    if (e.voided) {
      e.runningMinor = running;
      continue;
    }
    const inDisplay = convertMinor(e.amountMinor, e.currency, displayCurrency, rates, e.type === 'share' ? orderRateOpts(e.order) : paymentRateOpts(e.payment));
    if (normalizeCurrency(e.currency) !== normalizeCurrency(displayCurrency)) approximate = true;
    running += e.type === 'share' ? inDisplay : -inDisplay;
    e.runningMinor = running;
  }
  const balance = partyBalance(ctx, partyId);
  return {
    events,
    balance,
    display: partyBalanceDisplay(balance, displayCurrency, rates),
    isApproximate: approximate,
  };
}

/** Which sections of a statement go into an exported message: shares not yet fully paid, plus recent payments. */
export function statementSummaryLines(statement, { maxPayments = 5 } = {}) {
  const unpaid = statement.events.filter((e) => e.type === 'share' && e.earned && e.appliedMinor < e.amountMinor);
  const payments = statement.events.filter((e) => e.type === 'payment' && !e.voided).slice(-maxPayments);
  return { unpaid, payments };
}

/** How long money has been waiting, in four bands (days since the order). */
export const AGE_BUCKETS = ['0-7', '8-30', '31-90', '90+'];
const ageBand = (days) => (days <= 7 ? '0-7' : days <= 30 ? '8-30' : days <= 90 ? '31-90' : '90+');
const emptyBands = () => Object.fromEntries(AGE_BUCKETS.map((b) => [b, 0]));

/**
 * How long each earned, unpaid share of a booster has waited, in the display currency (each job at its own rates).
 */
export function partyAging(ctx, partyId, { rates, displayCurrency, now = Date.now() }) {
  const buckets = emptyBands();
  let isApproximate = false;
  for (const share of ctx.shares) {
    if (share.partyId !== partyId) continue;
    const order = ctx.orderById.get(share.orderId);
    if (!order || !isShareOwed(share, order) || !isShareEarned(share, order)) continue;
    const outstanding = share.amountMinor - shareAppliedMinor(ctx, share.id);
    if (outstanding <= 0) continue;
    const days = Math.max(0, Math.floor((now - Date.parse(order.dateTime)) / 86400000));
    if (normalizeCurrency(order.currency) !== normalizeCurrency(displayCurrency)) isApproximate = true;
    buckets[ageBand(days)] += convertMinor(outstanding, order.currency, displayCurrency, rates, orderRateOpts(order));
  }
  return { buckets, isApproximate };
}

export { sumBuckets };

/**
 * Margin report for live (non-failed, non-refunded) income orders, grouped by month, platform or game.
 * Amounts are converted to the display currency per order at the supplied rates.
 */
export function marginReport(ctx, partyById, { rates, displayCurrency, groupBy = 'month', sinceMs = null, monthKey = (iso) => String(iso || '').slice(0, 7) }) {
  const groups = new Map();
  // `sinceMs` limits the report to orders (and expenses) dated on or after it; null means everything.
  const inRange = (iso) => sinceMs == null || Date.parse(iso) >= sinceMs;
  let approximate = false;
  const conv = (minor, cur, opts) => {
    if (normalizeCurrency(cur) !== normalizeCurrency(displayCurrency)) approximate = true;
    return convertMinor(minor, cur, displayCurrency, rates, opts);
  };
  const keyOfOrder = (order) => {
    if (groupBy === 'platform') return payerKey(order) ? partyById.get(order.payerId)?.name || order.source || '' : '';
    if (groupBy === 'game') return order.game || '';
    return monthKey(order.dateTime);
  };
  const group = (key) => {
    if (!groups.has(key)) groups.set(key, { key, orders: 0, volumeMinor: 0, feeMinor: 0, boostersMinor: 0, marginMinor: 0, expensesMinor: 0, keepMinor: 0 });
    return groups.get(key);
  };
  for (const order of ctx.orders) {
    if (order.kind === 'expense' || DEAD_LIFECYCLES.has(order.lifecycle) || !inRange(order.dateTime)) continue;
    const g = group(keyOfOrder(order));
    const shareSum = activeSharesOf(ctx, order.id).reduce((s, x) => s + x.amountMinor, 0);
    g.orders += 1;
    const lock = orderRateOpts(order);
    g.volumeMinor += conv(order.grossMinor, order.currency, lock);
    g.feeMinor += conv(order.platformFeeMinor || 0, order.currency, lock);
    g.boostersMinor += conv(shareSum, order.currency, lock);
    g.marginMinor += conv(orderMarginMinor(ctx, order), order.currency, lock);
  }

  // Expenses (withdrawal fees, repairs, ...). A fee that belongs to a payout is spread over the orders that payout
  // paid, in proportion to what it paid on each, so it lands on the right game, platform and month. Anything else
  // is booked where it happened: its own month, its own platform, or "not set" for game.
  for (const e of ctx.effectivePayments) {
    if (e.kind !== 'expense') continue;
    const total = conv(e.amountMinor, e.currency, paymentRateOpts(e));
    const covered = e.relatedPaymentId
      ? ctx.liveAllocations.filter((a) => a.paymentId === e.relatedPaymentId && a.targetType === 'order' && ctx.orderById.has(a.targetId))
      : [];
    if (covered.length) {
      const weights = covered.map((a) => {
        const o = ctx.orderById.get(a.targetId);
        return { order: o, w: Math.max(1, conv(a.appliedMinor, o.currency, orderRateOpts(o))) };
      });
      const sum = weights.reduce((x, y) => x + y.w, 0);
      let given = 0;
      weights.forEach((x, i) => {
        const part = i === weights.length - 1 ? total - given : Math.round((total * x.w) / sum);
        given += part;
        if (inRange(x.order.dateTime)) group(keyOfOrder(x.order)).expensesMinor += part;
      });
    } else if (inRange(e.dateTime)) {
      const key = groupBy === 'month' ? monthKey(e.dateTime) : groupBy === 'platform' ? partyById.get(e.partyId)?.name || '' : '';
      group(key).expensesMinor += total;
    }
  }

  for (const g of groups.values()) g.keepMinor = g.marginMinor - g.expensesMinor;
  const rows = [...groups.values()].sort((a, b) => (groupBy === 'month' ? b.key.localeCompare(a.key) : b.keepMinor - a.keepMinor));
  const totals = rows.reduce(
    (t, r) => ({
      orders: t.orders + r.orders, volumeMinor: t.volumeMinor + r.volumeMinor, feeMinor: t.feeMinor + r.feeMinor,
      boostersMinor: t.boostersMinor + r.boostersMinor, marginMinor: t.marginMinor + r.marginMinor,
      expensesMinor: t.expensesMinor + r.expensesMinor, keepMinor: t.keepMinor + r.keepMinor,
    }),
    { orders: 0, volumeMinor: 0, feeMinor: 0, boostersMinor: 0, marginMinor: 0, expensesMinor: 0, keepMinor: 0 }
  );
  return { rows, totals, isApproximate: approximate };
}

/** Headline numbers for a margin report: what was kept, the average per order and the group that kept the most. */
export function reportSummary(report) {
  const { totals, rows } = report;
  const top = rows.length > 1 ? rows.reduce((a, b) => (b.keepMinor > a.keepMinor ? b : a)) : null;
  return {
    keepMinor: totals.keepMinor,
    avgPerOrderMinor: totals.orders ? Math.round(totals.keepMinor / totals.orders) : 0,
    top: top && top.keepMinor > 0 ? { key: top.key, keepMinor: top.keepMinor } : null,
  };
}

/** Rows of cells -> CSV text. Text cells that a spreadsheet could read as a formula are defused with a leading quote. */
export function toCsv(rows) {
  const cell = (v) => {
    if (typeof v === 'number') return String(v);
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}

/** What each booster has earned, been paid and is still owed, in the display currency. */
export function boosterReport(ctx, parties, { rates, displayCurrency }) {
  return parties
    .filter((p) => p.kind === 'booster')
    .map((party) => {
      const bal = partyBalance(ctx, party.id);
      const d = partyBalanceDisplay(bal, displayCurrency, rates);
      const orders = new Set(ctx.shares.filter((s) => s.partyId === party.id && s.state !== 'cancelled').map((s) => s.orderId)).size;
      return { party, orders, earnedMinor: d.paidMinor + d.payableMinor + d.committedMinor, paidMinor: d.paidMinor, owedMinor: d.payableMinor + d.committedMinor, isApproximate: d.isApproximate };
    })
    .filter((r) => r.orders > 0)
    .sort((a, b) => b.earnedMinor - a.earnedMinor);
}
