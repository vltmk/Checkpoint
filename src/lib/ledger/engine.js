/**
 * engine.js - pure ledger math for the v2 model. No I/O, no React, no clock unless `now` is passed.
 *
 * Shapes (camelCase here, snake_case in SQL):
 *   order      { id, lifecycle, currency, grossMinor, platformFeeMinor, payerId, dateTime, expectedPayoutAt, kind }
 *   share      { id, orderId, partyId, amountMinor, state: 'open' | 'done' | 'cancelled' }
 *   payment    { id, direction: 'out' | 'in', partyId, amountMinor, currency, rates, kind, voidsPaymentId, dateTime }
 *   allocation { id, paymentId, targetType: 'share' | 'order', targetId, appliedMinor, consumedMinor }
 *     appliedMinor  - amount applied, in the target's currency
 *     consumedMinor - amount consumed from the payment, in the payment's currency
 *
 * Invariants:
 *   margin(order) = gross - platformFee - sum(active shares)   (derived, never stored)
 *   a voided payment, and the void marker itself, count for nothing
 *   unallocated outgoing money is advance credit
 */
import { convertMinor, normalizeCurrency, collapseBuckets, bucketKey } from './money.js';
import { UNKNOWN_PAYER_ID } from './legacyMapper.js';

export const DEAD_LIFECYCLES = new Set(['failed', 'refunded']);

/**
 * Who pays for an order, as one consistent key. An order with no payer, and one that came from the upgrade's
 * "Direct / unknown" placeholder, are the same thing: ''.
 */
export const payerKey = (order) => (order && order.payerId && order.payerId !== UNKNOWN_PAYER_ID ? order.payerId : '');
export const OVERDUE_GRACE_DAYS = 3;
const DAY_MS = 86400000;

// --- Effective records ---------------------------------------------------------------------

export function voidedPaymentIds(payments) {
  const ids = new Set();
  for (const p of payments) if (p.voidsPaymentId) ids.add(p.voidsPaymentId);
  return ids;
}

/** Payments that count: not voided and not a void marker. */
export function effectivePayments(payments) {
  const voided = voidedPaymentIds(payments);
  // an expense that belongs to another payment (a withdrawal fee) goes with it when that payment is voided
  return payments.filter((p) => !p.voidsPaymentId && !voided.has(p.id) && !(p.relatedPaymentId && voided.has(p.relatedPaymentId)));
}

export function isShareActive(share, order) {
  if (!share || share.state === 'cancelled') return false;
  if (order && DEAD_LIFECYCLES.has(order.lifecycle)) return false;
  return true;
}

export function isShareEarned(share, order) {
  return share.state === 'done' || order?.lifecycle === 'done';
}

const positive = (n) => (Number(n) > 0 ? Number(n) : null);

/** The USD / EUR rates a record locked, or undefined when it never saved any. */
function lockedFiat(rates) {
  const usd = positive(rates?.usdRateTOMAN);
  const eur = positive(rates?.eurRateUSD);
  return usd || eur ? { usdRateTOMAN: usd, eurRateUSD: eur } : undefined;
}

/**
 * The rates an order was priced at: the gold rate (classic gold is per 1, retail per 1k) and the USD / EUR rates of
 * the day it was logged. Every total and statistic values the order with these, so a later rate change never moves it.
 */
export function orderRateOpts(order) {
  const r = order?.rates;
  return {
    customRate: positive(order?.exchangeRate) ?? positive(r?.goldRateTOMAN),
    isPerOneGold: order?.rateUnit === '1',
    rates: lockedFiat(r),
  };
}

/** Gold lock only: what settling an order's debt uses (USD and EUR debts are settled at the rate of the payment). */
export function orderGoldLockOpts(order) {
  const { customRate, isPerOneGold } = orderRateOpts(order);
  return { customRate, isPerOneGold };
}

/** A payment keeps every rate it was made at. */
export function paymentRateOpts(payment) {
  const r = payment?.rates;
  return { customRate: positive(r?.goldRateTOMAN), isPerOneGold: Boolean(r?.isPerOneGold), rates: lockedFiat(r) };
}

function indexById(list) {
  const m = new Map();
  for (const x of list) m.set(x.id, x);
  return m;
}

/** Context builder: indexes once so the per-party/per-order functions stay O(n). */
export function buildContext({ orders = [], shares = [], payments = [], allocations = [] }) {
  const eff = effectivePayments(payments);
  const effIds = new Set(eff.map((p) => p.id));
  const orderById = indexById(orders);
  const shareById = indexById(shares);
  // An allocation to a dead share (cancelled, or its order failed/refunded) no longer covers anything:
  // the money it applied goes back to being credit with the party.
  const liveAllocs = allocations.filter((a) => {
    if (!effIds.has(a.paymentId)) return false;
    if (a.targetType !== 'share') return true;
    const share = shareById.get(a.targetId);
    return Boolean(share) && isShareActive(share, orderById.get(share.orderId));
  });
  const appliedByTarget = new Map();
  for (const a of liveAllocs) {
    const k = `${a.targetType}:${a.targetId}`;
    appliedByTarget.set(k, (appliedByTarget.get(k) || 0) + a.appliedMinor);
  }
  const consumedByPayment = new Map();
  for (const a of liveAllocs) {
    consumedByPayment.set(a.paymentId, (consumedByPayment.get(a.paymentId) || 0) + a.consumedMinor);
  }
  return {
    orders,
    shares,
    payments,
    allocations,
    effectivePayments: eff,
    liveAllocations: liveAllocs,
    orderById,
    appliedByTarget,
    consumedByPayment,
  };
}

// --- Orders --------------------------------------------------------------------------------

export function orderReceivableMinor(order) {
  return Math.max(0, (order.grossMinor || 0) - (order.platformFeeMinor || 0));
}

export function activeSharesOf(ctx, orderId) {
  const order = ctx.orderById.get(orderId);
  return ctx.shares.filter((s) => s.orderId === orderId && isShareActive(s, order));
}

/** margin = receivable - sum(active shares). Dead orders (failed/refunded) have no margin. */
export function orderMarginMinor(ctx, order) {
  if (DEAD_LIFECYCLES.has(order.lifecycle)) return 0;
  const shareSum = activeSharesOf(ctx, order.id).reduce((s, x) => s + x.amountMinor, 0);
  return orderReceivableMinor(order) - shareSum;
}

export function shareAppliedMinor(ctx, shareId) {
  return ctx.appliedByTarget.get(`share:${shareId}`) || 0;
}

export function orderReceivedMinor(ctx, orderId) {
  return ctx.appliedByTarget.get(`order:${orderId}`) || 0;
}

/** Money state derived from allocations: how much of the order has been collected and paid out. */
export function orderMoneyState(ctx, order) {
  const receivable = orderReceivableMinor(order);
  const received = Math.min(receivable, orderReceivedMinor(ctx, order.id));
  const shares = activeSharesOf(ctx, order.id);
  const shareTotal = shares.reduce((s, x) => s + x.amountMinor, 0);
  const sharePaid = shares.reduce((s, x) => s + Math.min(x.amountMinor, shareAppliedMinor(ctx, x.id)), 0);
  return {
    receivableMinor: receivable,
    receivedMinor: received,
    collected: receivable > 0 && received >= receivable,
    partlyCollected: received > 0 && received < receivable,
    shareTotalMinor: shareTotal,
    sharePaidMinor: sharePaid,
    boostersPaid: shareTotal > 0 && sharePaid >= shareTotal,
    boostersPartlyPaid: sharePaid > 0 && sharePaid < shareTotal,
  };
}

// --- Party balances (what I owe a booster) -------------------------------------------------

/**
 * Per-currency balance for a party I pay (booster/teammate).
 * payable = outstanding on earned shares, committed = outstanding on open shares,
 * advance = outgoing money not yet applied to any share.
 */
export function partyBalance(ctx, partyId) {
  const payable = {};
  const committed = {};
  const advance = {};
  const paid = {};
  const add = (bucket, cur, n, opts) => {
    if (!n) return;
    const k = bucketKey(cur, opts);
    bucket[k] = (bucket[k] || 0) + n;
  };
  for (const share of ctx.shares) {
    if (share.partyId !== partyId) continue;
    const order = ctx.orderById.get(share.orderId);
    if (!order || !isShareActive(share, order)) continue;
    const opts = orderRateOpts(order);
    const raw = shareAppliedMinor(ctx, share.id);
    const applied = Math.min(share.amountMinor, raw);
    add(paid, order.currency, applied, opts);
    add(isShareEarned(share, order) ? payable : committed, order.currency, share.amountMinor - applied, opts);
    // a share edited down below what was already paid: the extra stays the booster's credit, never vanishes
    add(advance, order.currency, Math.max(0, raw - share.amountMinor), opts);
  }
  for (const p of ctx.effectivePayments) {
    if (p.direction !== 'out' || p.partyId !== partyId) continue;
    if (p.kind === 'expense') continue;
    const left = p.amountMinor - (ctx.consumedByPayment.get(p.id) || 0);
    add(advance, p.currency, Math.max(0, left), paymentRateOpts(p));
  }
  return { partyId, payable, committed, advance, paid };
}

/** Collapse a party balance into one display currency. net > 0 means I owe them; net < 0 means they owe me. */
export function partyBalanceDisplay(balance, displayCurrency, rates) {
  const p = collapseBuckets(balance.payable, displayCurrency, rates);
  const c = collapseBuckets(balance.committed, displayCurrency, rates);
  const a = collapseBuckets(balance.advance, displayCurrency, rates);
  const paidNow = collapseBuckets(balance.paid || {}, displayCurrency, rates);
  return {
    currency: p.currency,
    paidMinor: paidNow.minor,
    payableMinor: p.minor,
    committedMinor: c.minor,
    advanceMinor: a.minor,
    netMinor: p.minor + c.minor - a.minor,
    owedNowMinor: Math.max(0, p.minor - a.minor),
    isApproximate: p.isApproximate || c.isApproximate || a.isApproximate,
  };
}

/** Oldest unpaid earned share date for a party (aging). */
export function oldestUnpaidShareDate(ctx, partyId) {
  let oldest = null;
  for (const share of ctx.shares) {
    if (share.partyId !== partyId) continue;
    const order = ctx.orderById.get(share.orderId);
    if (!order || !isShareActive(share, order) || !isShareEarned(share, order)) continue;
    if (share.amountMinor - shareAppliedMinor(ctx, share.id) <= 0) continue;
    const t = Date.parse(order.dateTime);
    if (Number.isFinite(t) && (oldest === null || t < oldest)) oldest = t;
  }
  return oldest;
}

export function agingDays(ctx, partyId, now = Date.now()) {
  const oldest = oldestUnpaidShareDate(ctx, partyId);
  return oldest === null ? 0 : Math.max(0, Math.floor((now - oldest) / DAY_MS));
}

// --- Allocation (FIFO) ---------------------------------------------------------------------

/**
 * Apply a payment to targets, oldest first.
 * targets: [{ type: 'share' | 'order', id, currency, outstandingMinor, dateTime, opts? }]
 *   opts carries a locked gold rate ({ customRate, isPerOneGold }) when the target needs one.
 * Returns { allocations: [{ targetType, targetId, appliedMinor, consumedMinor }], remainderMinor }.
 * Never consumes more than the payment holds; rounding can only leave dust as remainder.
 */
export function allocateFifo({ amountMinor, currency, rates = {}, targets }) {
  const cur = normalizeCurrency(currency);
  let remaining = Math.max(0, Math.round(amountMinor || 0));
  const sorted = [...targets].sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime) || String(a.id).localeCompare(String(b.id)));
  const allocations = [];
  for (const t of sorted) {
    if (remaining <= 0) break;
    const outstanding = Math.max(0, Math.round(t.outstandingMinor || 0));
    if (outstanding <= 0) continue;
    const tcur = normalizeCurrency(t.currency);
    const available = convertMinor(remaining, cur, tcur, rates, t.opts);
    if (available <= 0) continue;
    if (available >= outstanding) {
      // a target worth less than one unit of the payment's currency costs nothing (never the whole payment)
      const consumed = Math.min(remaining, convertMinor(outstanding, tcur, cur, rates, t.opts));
      allocations.push({ targetType: t.type, targetId: t.id, appliedMinor: outstanding, consumedMinor: consumed });
      remaining -= consumed;
    } else {
      allocations.push({ targetType: t.type, targetId: t.id, appliedMinor: available, consumedMinor: remaining });
      remaining = 0;
    }
  }
  return { allocations, remainderMinor: remaining };
}

/** Outstanding earned/open shares for a party, as FIFO targets (earned first, then by order date). */
export function shareTargetsFor(ctx, partyId, { includeOpen = true } = {}) {
  const out = [];
  for (const share of ctx.shares) {
    if (share.partyId !== partyId) continue;
    const order = ctx.orderById.get(share.orderId);
    if (!order || !isShareActive(share, order)) continue;
    const earned = isShareEarned(share, order);
    if (!earned && !includeOpen) continue;
    const outstanding = share.amountMinor - shareAppliedMinor(ctx, share.id);
    if (outstanding <= 0) continue;
    out.push({
      type: 'share',
      id: share.id,
      currency: order.currency,
      outstandingMinor: outstanding,
      dateTime: order.dateTime,
      earned,
      opts: orderGoldLockOpts(order),
    });
  }
  // earned shares settle before still-open ones; FIFO inside each group
  return out.sort((a, b) => Number(b.earned) - Number(a.earned) || Date.parse(a.dateTime) - Date.parse(b.dateTime));
}

/** Orders awaiting money from a payer (platform or client), as FIFO targets. */
export function orderTargetsFor(ctx, payerId) {
  const out = [];
  for (const order of ctx.orders) {
    if (payerKey(order) !== (payerId || '') || order.kind === 'expense') continue;
    if (DEAD_LIFECYCLES.has(order.lifecycle)) continue;
    const outstanding = orderReceivableMinor(order) - orderReceivedMinor(ctx, order.id);
    if (outstanding <= 0) continue;
    out.push({
      type: 'order',
      id: order.id,
      currency: order.currency,
      outstandingMinor: outstanding,
      dateTime: order.dateTime,
      earned: order.lifecycle === 'done',
      opts: orderGoldLockOpts(order),
    });
  }
  return out;
}

/**
 * Apply a payment from a payer to their orders: finished jobs first (oldest first), then jobs still in progress.
 * The same two-pass rule Settle up uses for a booster's shares.
 */
export function allocateToPayer(ctx, { payerId, amountMinor, currency, rates, excludeIds = [] }) {
  const skip = new Set(excludeIds);
  const targets = orderTargetsFor(ctx, payerId).filter((t) => !skip.has(t.id));
  const first = allocateFifo({ amountMinor, currency, rates, targets: targets.filter((t) => t.earned) });
  const rest = targets.filter((t) => !t.earned);
  if (first.remainderMinor <= 0 || !rest.length) return first;
  const second = allocateFifo({ amountMinor: first.remainderMinor, currency, rates, targets: rest });
  return { allocations: [...first.allocations, ...second.allocations], remainderMinor: second.remainderMinor };
}

/**
 * The effective payments that cover a share or an order. `exclusive` means the payment covers nothing else,
 * so it can be undone on its own without un-paying anything else.
 */
export function paymentsAppliedTo(ctx, targetType, targetId) {
  const out = [];
  const order = new Map(ctx.payments.map((p, i) => [p.id, i]));
  for (const p of ctx.effectivePayments) {
    if (p.kind === 'expense') continue;
    const mine = ctx.liveAllocations.filter((a) => a.paymentId === p.id);
    const here = mine.filter((a) => a.targetType === targetType && a.targetId === targetId);
    if (!here.length) continue;
    out.push({ payment: p, exclusive: mine.length === here.length, appliedMinor: here.reduce((s, a) => s + a.appliedMinor, 0) });
  }
  // newest first; payments made in the same instant fall back to the order they were recorded in
  return out.sort((a, b) => Date.parse(b.payment.dateTime) - Date.parse(a.payment.dateTime) || order.get(b.payment.id) - order.get(a.payment.id));
}

/**
 * What one payment covered, as lines a person can read: the order behind each share (or the order itself),
 * and the amount it took, in the order's own currency. Works for both directions: an advertiser's payment
 * to a booster covers shares, a booster's payout from a client covers orders.
 * `shareById` is passed in so a statement can build it once instead of once per payment.
 */
export function paymentCovers(ctx, paymentId, shareById = new Map(ctx.shares.map((s) => [s.id, s]))) {
  const out = [];
  for (const a of ctx.allocations) {
    if (a.paymentId !== paymentId || !(a.appliedMinor > 0)) continue;
    const share = a.targetType === 'share' ? shareById.get(a.targetId) || null : null;
    const order = share ? ctx.orderById.get(share.orderId) : ctx.orderById.get(a.targetId);
    if (!order) continue;
    out.push({ targetType: a.targetType, targetId: a.targetId, order, share, appliedMinor: a.appliedMinor, currency: normalizeCurrency(order.currency) });
  }
  return out;
}

/**
 * When each share (targetType 'share') or order (targetType 'order') was last paid, as epoch ms.
 * Only live allocations from effective payments count, so a voided payment does not date anything.
 */
export function lastPaidAtByTarget(ctx, targetType) {
  const paidAtOf = new Map(ctx.effectivePayments.map((p) => [p.id, Date.parse(p.dateTime)]));
  const out = new Map();
  for (const a of ctx.liveAllocations) {
    if (a.targetType !== targetType || !(a.appliedMinor > 0)) continue;
    const at = paidAtOf.get(a.paymentId);
    if (at === undefined || Number.isNaN(at)) continue;
    if (!(out.get(a.targetId) >= at)) out.set(a.targetId, at);
  }
  return out;
}

/**
 * Money a payer has sent that no order has taken yet, as buckets: each incoming payment less what its allocations
 * consumed. This is credit with them. It stays until an order is paid from it, and voided payments carry none.
 */
export function payerCreditBuckets(ctx, payerId) {
  const used = new Map();
  for (const a of ctx.liveAllocations) used.set(a.paymentId, (used.get(a.paymentId) || 0) + (Number(a.consumedMinor) || 0));
  const out = {};
  for (const p of ctx.effectivePayments) {
    if (p.direction !== 'in' || p.kind === 'expense' || p.kind === 'writeoff' || (p.partyId || '') !== (payerId || '')) continue;
    const left = Math.max(0, Math.round(Number(p.amountMinor) || 0) - (used.get(p.id) || 0));
    if (left <= 0) continue;
    const k = bucketKey(p.currency, paymentRateOpts(p));
    out[k] = (out[k] || 0) + left;
  }
  return out;
}

/**
 * What was closed short on each order (kind 'writeoff' payments), as a Map orderId -> minor. This is not cash: it
 * clears what is owed, and cash totals (collected, Money's in) must leave it out.
 */
export function writtenOffByOrder(ctx) {
  const kindOf = new Map(ctx.effectivePayments.map((p) => [p.id, p.kind]));
  const out = new Map();
  for (const a of ctx.liveAllocations) {
    if (a.targetType !== 'order' || kindOf.get(a.paymentId) !== 'writeoff') continue;
    out.set(a.targetId, (out.get(a.targetId) || 0) + (Number(a.appliedMinor) || 0));
  }
  return out;
}

/** FIFO needs oldest-first within the given order, so shareTargetsFor's group order must be kept. */
export function allocateToParty(ctx, { partyId, amountMinor, currency, rates, includeOpen = true, excludeIds = [] }) {
  const skip = new Set(excludeIds);
  const targets = shareTargetsFor(ctx, partyId, { includeOpen }).filter((t) => !skip.has(t.id));
  // allocateFifo sorts by date; keep earned-first by running two passes
  const earned = targets.filter((t) => t.earned);
  const open = targets.filter((t) => !t.earned);
  const first = allocateFifo({ amountMinor, currency, rates, targets: earned });
  if (first.remainderMinor <= 0 || !open.length) return first;
  const second = allocateFifo({ amountMinor: first.remainderMinor, currency, rates, targets: open });
  return {
    allocations: [...first.allocations, ...second.allocations],
    remainderMinor: second.remainderMinor,
  };
}

// --- Receivables (what payers owe me) ------------------------------------------------------

/**
 * Per-payer receivable split into held / releasable / overdue, per currency.
 * held: order not done, or still inside the platform hold window.
 * releasable: done and past expectedPayoutAt (or no hold date).
 * overdue: releasable and more than OVERDUE_GRACE_DAYS past expectedPayoutAt.
 */
export function payerReceivables(ctx, payerId, now = Date.now()) {
  const held = {};
  const releasable = {};
  const overdue = {};
  const add = (bucket, cur, n, opts) => {
    if (n <= 0) return;
    const k = bucketKey(cur, opts);
    bucket[k] = (bucket[k] || 0) + n;
  };
  for (const order of ctx.orders) {
    if (payerKey(order) !== (payerId || '') || order.kind === 'expense') continue;
    if (DEAD_LIFECYCLES.has(order.lifecycle)) continue;
    const outstanding = orderReceivableMinor(order) - orderReceivedMinor(ctx, order.id);
    if (outstanding <= 0) continue;
    const due = order.expectedPayoutAt ? Date.parse(order.expectedPayoutAt) : null;
    if (order.lifecycle !== 'done') {
      add(held, order.currency, outstanding, orderRateOpts(order));
    } else if (due !== null && Number.isFinite(due) && now < due) {
      add(held, order.currency, outstanding, orderRateOpts(order));
    } else {
      add(releasable, order.currency, outstanding, orderRateOpts(order));
      if (due !== null && Number.isFinite(due) && now > due + OVERDUE_GRACE_DAYS * DAY_MS) {
        add(overdue, order.currency, outstanding, orderRateOpts(order));
      }
    }
  }
  return { payerId, held, releasable, overdue };
}

// --- Exposure ------------------------------------------------------------------------------

/** Money paid to boosters on orders whose payer hasn't paid in full yet, per currency. */
export function exposureByCurrency(ctx) {
  const out = {};
  for (const order of ctx.orders) {
    if (order.kind === 'expense' || DEAD_LIFECYCLES.has(order.lifecycle)) continue;
    const paidOut = ctx.shares
      .filter((s) => s.orderId === order.id && isShareActive(s, order))
      .reduce((sum, s) => sum + Math.min(s.amountMinor, shareAppliedMinor(ctx, s.id)), 0);
    const received = orderReceivedMinor(ctx, order.id);
    const exposed = Math.max(0, paidOut - received);
    if (exposed > 0) {
      const k = bucketKey(order.currency, orderRateOpts(order));
      out[k] = (out[k] || 0) + exposed;
    }
  }
  return out;
}

// --- Margin roll-up ------------------------------------------------------------------------

/** realized = margin on done orders (collected or not); pipeline = margin on live orders not yet done. Per currency. */
export function marginSummary(ctx) {
  const realized = {};
  const pipeline = {};
  for (const order of ctx.orders) {
    if (order.kind === 'expense' || DEAD_LIFECYCLES.has(order.lifecycle)) continue;
    const margin = orderMarginMinor(ctx, order);
    const k = bucketKey(order.currency, orderRateOpts(order));
    const bucket = order.lifecycle === 'done' ? realized : pipeline;
    bucket[k] = (bucket[k] || 0) + margin;
  }
  return { realized, pipeline };
}

/** Out-of-order expenses (withdrawal fees etc.) per currency; these reduce profit but touch no balance. */
export function expensesByCurrency(ctx) {
  const out = {};
  for (const p of ctx.effectivePayments) {
    if (p.kind !== 'expense') continue;
    const k = bucketKey(p.currency, paymentRateOpts(p));
    out[k] = (out[k] || 0) + p.amountMinor;
  }
  return out;
}

// --- Needs attention -----------------------------------------------------------------------

/**
 * Actionable items for the cockpit inbox. Each item: { type, severity, partyId?, orderId?, ... }.
 * `flaggedOrderIds` are orders the migration marked for review.
 */
export function needsAttention(ctx, { now = Date.now(), staleDays = 7, flaggedOrderIds = [] } = {}) {
  const items = [];
  const partyIds = new Set(ctx.shares.map((s) => s.partyId));
  for (const partyId of partyIds) {
    const days = agingDays(ctx, partyId, now);
    const bal = partyBalance(ctx, partyId);
    const hasPayable = Object.values(bal.payable).some((n) => n > 0);
    if (hasPayable && days >= staleDays) {
      items.push({ type: 'booster_overdue', severity: 'warn', partyId, days });
    }
  }
  const paidParties = new Set(
    ctx.effectivePayments.filter((p) => p.direction === 'out' && p.kind !== 'expense' && p.partyId).map((p) => p.partyId),
  );
  for (const partyId of paidParties) {
    const bal = partyBalance(ctx, partyId);
    const hasAdvance = Object.values(bal.advance).some((n) => n > 0);
    const hasOpenWork = Object.values(bal.payable).some((n) => n > 0) || Object.values(bal.committed).some((n) => n > 0);
    if (hasAdvance && !hasOpenWork) items.push({ type: 'advance_idle', severity: 'info', partyId });
  }
  for (const order of ctx.orders) {
    if (order.kind === 'expense' || DEAD_LIFECYCLES.has(order.lifecycle)) continue;
    const st = orderMoneyState(ctx, order);
    if (st.collected && st.shareTotalMinor > 0 && !st.boostersPaid) {
      items.push({ type: 'collected_not_paid_out', severity: 'warn', orderId: order.id });
    }
    if (!st.collected && st.sharePaidMinor > st.receivedMinor) {
      items.push({ type: 'paid_out_before_collected', severity: 'info', orderId: order.id });
    }
  }
  for (const id of flaggedOrderIds) items.push({ type: 'needs_review', severity: 'info', orderId: id });
  return items;
}
