/**
 * actions.js - the money workflows the UI calls: settle up, receive a payout, mark paid, record an advance.
 * Each previewX is pure (for dialogs that show what will happen); each doX writes through the store.
 */
import {
  allocateToParty,
  allocateFifo,
  allocateToPayer,
  paymentsAppliedTo,
  orderTargetsFor,
  shareAppliedMinor,
  orderReceivedMinor,
  orderReceivableMinor,
  isShareActive,
  payerKey,
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
export function computeWithdrawal({ enteredMinor, pct = 0, flatMinor = 0, takenOut = true }) {
  const entered = Math.max(0, Math.round(enteredMinor || 0));
  const rate = Math.min(99.99, Math.max(0, Number(pct) || 0)) / 100;
  const flat = Math.max(0, Math.round(flatMinor || 0));
  if (rate === 0 && flat === 0) return { releasedMinor: entered, feeMinor: 0, netMinor: entered };
  if (takenOut) {
    const released = Math.round((entered + flat) / (1 - rate));
    return { releasedMinor: released, feeMinor: released - entered, netMinor: entered };
  }
  const fee = Math.min(entered, Math.round(entered * rate) + flat);
  return { releasedMinor: entered, feeMinor: fee, netMinor: entered - fee };
}

/** A lump from a platform or client, applied to their oldest unpaid orders. A withdrawal fee is booked as an expense linked to it. */
export async function receivePayout(store, { payerId, amountMinor, currency, rates, feeMinor = 0, dateTime, note = '', method = '', excludeIds = [] }) {
  const ctx = await store.loadContext();
  const { allocations } = previewReceivePayout(ctx, { payerId, amountMinor, currency, rates, excludeIds });
  const payment = await store.recordPayment({
    payment: { direction: 'in', partyId: payerId || null, amountMinor, currency: normalizeCurrency(currency), rates: ratesSnapshot(rates), kind: 'settlement', dateTime, note, method },
    allocations,
  });
  if (feeMinor > 0) {
    await store.recordPayment({
      // linked to the payout, so reports can spread the fee over the orders it paid
      payment: { direction: 'out', partyId: payerId || null, amountMinor: feeMinor, currency: normalizeCurrency(currency), rates: ratesSnapshot(rates), kind: 'expense', dateTime, note, relatedPaymentId: payment.id },
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
  const outstanding = share.amountMinor - shareAppliedMinor(ctx, share.id);
  if (outstanding <= 0) throw new LedgerValidationError('Already paid.');
  return store.recordPayment({
    payment: { direction: 'out', partyId: share.partyId, amountMinor: outstanding, currency: order.currency, rates: ratesSnapshot(rates), kind: 'settlement', dateTime, note },
    allocations: [{ targetType: 'share', targetId: share.id, appliedMinor: outstanding, consumedMinor: outstanding }],
  });
}

/** One tap: the payer has paid this order in full. */
export async function markOrderCollected(store, orderId, { rates, dateTime, note = '' } = {}) {
  const ctx = await store.loadContext();
  const order = ctx.orderById.get(orderId);
  if (!order) throw new LedgerValidationError('Order not found.');
  const outstanding = orderReceivableMinor(order) - orderReceivedMinor(ctx, orderId);
  if (outstanding <= 0) throw new LedgerValidationError('Already collected.');
  return store.recordPayment({
    payment: { direction: 'in', partyId: payerKey(order) || null, amountMinor: outstanding, currency: order.currency, rates: ratesSnapshot(rates), kind: 'settlement', dateTime, note },
    allocations: [{ targetType: 'order', targetId: orderId, appliedMinor: outstanding, consumedMinor: outstanding }],
  });
}
