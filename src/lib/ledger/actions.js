/**
 * actions.js - the money workflows the UI calls: settle up, receive a payout, mark paid, record an advance.
 * Each previewX is pure (for dialogs that show what will happen); each doX writes through the store.
 */
import {
  allocateToParty,
  allocateToPayer,
  paymentsAppliedTo,
  shareAppliedMinor,
  orderReceivedMinor,
  orderReceivableMinor,
  isShareActive,
  isPaidByPayer,
  payerKey,
  DEAD_LIFECYCLES,
} from './engine.js';
import { LedgerValidationError } from './ledgerStore.js';
import { normalizeCurrency } from './money.js';

const ratesSnapshot = (rates = {}) => ({
  goldRateTOMAN: Number(rates.goldRateTOMAN) || null,
  usdRateTOMAN: Number(rates.usdRateTOMAN) || null,
  eurRateUSD: Number(rates.eurRateUSD) || null,
});

/** What "pay Ali X" would do: which works it covers, and what is left over as advance credit. */
export function previewSettleUp(ctx, { partyId, amountMinor, currency, rates, includeOpen = true, excludeIds = [] }) {
  const { allocations, remainderMinor } = allocateToParty(ctx, { partyId, amountMinor, currency, rates, includeOpen, excludeIds });
  return { allocations, remainderMinor };
}

export async function settleUp(store, { partyId, amountMinor, currency, rates, dateTime, note = '', method = '', includeOpen = true, excludeIds = [] }) {
  const ctx = await store.loadContext();
  const { allocations } = previewSettleUp(ctx, { partyId, amountMinor, currency, rates, includeOpen, excludeIds });
  return store.recordPayment({
    payment: {
      direction: 'out', partyId, amountMinor, currency: normalizeCurrency(currency), rates: ratesSnapshot(rates),
      kind: allocations.length ? 'settlement' : 'advance', dateTime, note, method,
    },
    allocations,
  });
}

/** Money sent before there is work to apply it to. It sits as credit and nets against what is owed later. */
export async function addAdvance(store, { partyId, amountMinor, currency, rates, dateTime, note = '', method = '' }) {
  return store.recordPayment({
    payment: { direction: 'out', partyId, amountMinor, currency: normalizeCurrency(currency), rates: ratesSnapshot(rates), kind: 'advance', dateTime, note, method },
  });
}

export function previewReceivePayout(ctx, { payerId, amountMinor, currency, rates, excludeIds = [] }) {
  return allocateToPayer(ctx, { payerId, amountMinor, currency, rates, excludeIds });
}

/**
 * Undo "mark paid" (or a recorded payment) for one share or order. The payment is voided, not deleted, so the
 * history stays visible in the Money log. Only a payment that covers nothing else can be undone this way; one
 * that was part of a bigger payout has to be voided as a whole from Money.
 */
export async function undoPaid(store, targetType, targetId) {
  const ctx = await store.loadContext();
  const applied = paymentsAppliedTo(ctx, targetType, targetId);
  if (!applied.length) throw new LedgerValidationError('Nothing was paid on this.');
  const alone = applied.find((x) => x.exclusive);
  if (!alone) throw new LedgerValidationError('This was paid as part of a bigger payment. Void that payment in Money to undo it.');
  return store.voidPayment(alone.payment.id, 'undo');
}

/**
 * Work out a platform payout with a withdrawal fee. The seller enters one amount; `takenOut` says which one:
 *   takenOut = true  : "what reached my account". The platform released more (amount + fee), the fee is already gone.
 *   takenOut = false : "what the platform released". The fee comes out of my pocket on top.
 * Either way the orders are credited with the released amount, the fee is an expense, and net cash = released - fee.
 */
const layerRate = (pct) => Math.min(99.99, Math.max(0, Number(pct) || 0)) / 100;
const layerFlat = (flat) => Math.max(0, Math.round(Number(flat) || 0));

/** Every layer's percent added up (capped below 100%), and every layer's flat amount added up. */
function layerTotals(layers) {
  const rules = layers.map((l) => ({ label: l.label || '', rate: layerRate(l.pct), flat: layerFlat(l.flatMinor) }));
  return { rules, rate: Math.min(0.9999, rules.reduce((s, r) => s + r.rate, 0)), flat: rules.reduce((s, r) => s + r.flat, 0) };
}

/**
 * Fees taken on the way to you, one per layer (platform, bank, exchange...). Each layer's percent is of the amount the
 * platform released, not of what is left after the layer before it, and its flat amount is added on top. The layers
 * therefore add up to one percent and one flat amount, and `takenOut` says whether the typed amount is what reached you.
 * Each layer's share of the fee is returned so every layer can be booked on its own.
 */
export function computeWithdrawalLayers({ enteredMinor, layers = [], takenOut = true }) {
  const entered = Math.max(0, Math.round(enteredMinor || 0));
  const { rules, rate, flat } = layerTotals(layers);
  if (rate === 0 && flat === 0) return { releasedMinor: entered, feeMinor: 0, netMinor: entered, feeLines: [] };

  let released;
  let total;
  let raw;
  if (takenOut) {
    released = Math.round((entered + flat) / (1 - rate));
    total = released - entered;
    raw = rules.map((r) => Math.round(released * r.rate) + r.flat);
  } else {
    released = entered;
    raw = rules.map((r) => Math.round(entered * r.rate) + r.flat);
    total = Math.min(entered, raw.reduce((s, x) => s + x, 0));
  }
  // rounding can leave the per-layer figures a unit off the total: the last layer takes the difference
  const shares = raw.map((x) => x);
  const sumRaw = shares.reduce((s, x) => s + x, 0);
  if (shares.length) shares[shares.length - 1] += total - sumRaw;
  const feeLines = rules.map((r, i) => ({ label: r.label, feeMinor: Math.max(0, shares[i]) })).filter((l) => l.feeMinor > 0);
  const net = takenOut ? entered : entered - total;
  return { releasedMinor: released, feeMinor: total, netMinor: net, feeLines };
}

/** One platform fee rule (a single pct and flat amount), kept for callers that do not use layers. */
export function computeWithdrawal({ enteredMinor, pct = 0, flatMinor = 0, takenOut = true }) {
  const { releasedMinor, feeMinor, netMinor } = computeWithdrawalLayers({ enteredMinor, layers: [{ pct, flatMinor }], takenOut });
  return { releasedMinor, feeMinor, netMinor };
}

/**
 * The amount to type so the platform's released amount comes to `releasedMinor`: the inverse of computeWithdrawal.
 * Used by "Fill exact", so the typed figure covers the selected orders to the unit, fee included.
 */
export function enteredForReleased({ releasedMinor, layers = null, pct = 0, flatMinor = 0, takenOut = true }) {
  const target = Math.max(0, Math.round(releasedMinor || 0));
  const list = layers || [{ pct, flatMinor }];
  const { rate, flat } = layerTotals(list);
  if (!takenOut || (rate === 0 && flat === 0)) return target;
  const released = (e) => computeWithdrawalLayers({ enteredMinor: e, layers: list, takenOut }).releasedMinor;
  let entered = Math.max(0, Math.round(target * (1 - rate)) - flat);
  // rounding can land a unit either side of the target: step up until it covers, then down while one less still does
  while (released(entered) < target) entered += 1;
  while (entered > 0 && released(entered - 1) >= target) entered -= 1;
  return entered;
}

/** A lump from a platform or client, applied to their oldest unpaid orders. A withdrawal fee is booked as an expense linked to it. */
export async function receivePayout(store, { payerId, amountMinor, currency, rates, feeLines = null, feeMinor = 0, dateTime, note = '', method = '', excludeIds = [] }) {
  const ctx = await store.loadContext();
  const { allocations } = previewReceivePayout(ctx, { payerId, amountMinor, currency, rates, excludeIds });
  const payment = await store.recordPayment({
    payment: { direction: 'in', partyId: payerId || null, amountMinor, currency: normalizeCurrency(currency), rates: ratesSnapshot(rates), kind: 'settlement', dateTime, note, method },
    allocations,
  });
  // one expense per fee layer, each linked to the payout so reports can spread it over the orders it paid
  const lines = feeLines || (feeMinor > 0 ? [{ label: note, feeMinor }] : []);
  for (const line of lines) {
    if (!(line.feeMinor > 0)) continue;
    await store.recordPayment({
      payment: { direction: 'out', partyId: payerId || null, amountMinor: line.feeMinor, currency: normalizeCurrency(currency), rates: ratesSnapshot(rates), kind: 'expense', dateTime, note: line.label || note, relatedPaymentId: payment.id },
    });
  }
  return payment;
}

/** One tap: pay exactly what is still owed on a single share. */
export async function markSharePaid(store, shareId, { rates, dateTime, note = '' } = {}) {
  const ctx = await store.loadContext();
  const share = ctx.shares.find((s) => s.id === shareId);
  if (!share) throw new LedgerValidationError('Share not found.');
  const order = ctx.orderById.get(share.orderId);
  if (!order || !isShareActive(share, order)) throw new LedgerValidationError('That share is cancelled.');
  if (isPaidByPayer(share)) throw new LedgerValidationError('The client pays this teammate directly.');
  const outstanding = share.amountMinor - shareAppliedMinor(ctx, share.id);
  if (outstanding <= 0) throw new LedgerValidationError('Already paid.');
  return store.recordPayment({
    payment: { direction: 'out', partyId: share.partyId, amountMinor: outstanding, currency: order.currency, rates: ratesSnapshot(rates), kind: 'settlement', dateTime, note },
    allocations: [{ targetType: 'share', targetId: share.id, appliedMinor: outstanding, consumedMinor: outstanding }],
  });
}

/**
 * Close what is still owed on an order because the payer paid less than it was written for. The shortfall is booked as
 * a write-off: a payment of its own that clears the order without any cash moving. Voiding it, in Money, reopens the balance.
 */
export async function writeOffOrder(store, orderId, { rates, dateTime, note = '' } = {}) {
  const ctx = await store.loadContext();
  const order = ctx.orderById.get(orderId);
  if (!order || DEAD_LIFECYCLES.has(order.lifecycle)) throw new LedgerValidationError('That order is not open.');
  const shortfall = orderReceivableMinor(order, ctx) - orderReceivedMinor(ctx, order.id);
  if (shortfall <= 0) throw new LedgerValidationError('Nothing is left to close.');
  return store.recordPayment({
    payment: { direction: 'in', partyId: payerKey(order) || null, amountMinor: shortfall, currency: order.currency, rates: ratesSnapshot(rates), kind: 'writeoff', dateTime, note },
    allocations: [{ targetType: 'order', targetId: order.id, appliedMinor: shortfall, consumedMinor: 0 }],
  });
}

/** One tap: the payer has paid this order in full. */
export async function markOrderCollected(store, orderId, { rates, dateTime, note = '' } = {}) {
  const ctx = await store.loadContext();
  const order = ctx.orderById.get(orderId);
  if (!order) throw new LedgerValidationError('Order not found.');
  const outstanding = orderReceivableMinor(order, ctx) - orderReceivedMinor(ctx, orderId);
  if (outstanding <= 0) throw new LedgerValidationError('Already collected.');
  return store.recordPayment({
    payment: { direction: 'in', partyId: payerKey(order) || null, amountMinor: outstanding, currency: order.currency, rates: ratesSnapshot(rates), kind: 'settlement', dateTime, note },
    allocations: [{ targetType: 'order', targetId: orderId, appliedMinor: outstanding, consumedMinor: outstanding }],
  });
}
