/**
 * backup.js - change detection and spreadsheet export for the v2 ledger. Pure.
 */
import { buildContext, orderMarginMinor, orderMoneyState, DEAD_LIFECYCLES } from './engine.js';
import { fromMinor } from './money.js';

/**
 * Cheap fingerprint of everything that matters for a backup. The auto-backup compares it with the last one
 * and skips writing when nothing changed, so it has to move whenever any ledger record is added, edited or voided.
 */
export function ledgerFingerprint(exported) {
  if (!exported) return 'none';
  const sum = (list, f) => (list || []).reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const stamp = (list) => (list || []).reduce((m, x) => {
    const t = Date.parse(x.updatedAt || x.createdAt || '') || 0;
    return t > m ? t : m;
  }, 0);
  const o = exported.orders, s = exported.shares, p = exported.payments, a = exported.allocations;
  const parts = [
    (exported.parties || []).length, o?.length || 0, s?.length || 0, p?.length || 0, a?.length || 0, (exported.proofs || []).length,
    sum(o, (x) => x.grossMinor + (x.platformFeeMinor || 0) * 7), sum(s, (x) => x.amountMinor),
    // locked rates can change without any amount changing
    sum(o, (x) => (x.rates?.goldRateTOMAN || 0) + (x.rates?.usdRateTOMAN || 0) + (x.rates?.eurRateUSD || 0)),
    sum(p, (x) => x.amountMinor), sum(a, (x) => x.appliedMinor),
    // states change without amounts changing (done -> failed, cancelled share), so fold them in too
    (o || []).filter((x) => x.lifecycle === 'done').length, (o || []).filter((x) => DEAD_LIFECYCLES.has(x.lifecycle)).length,
    (s || []).filter((x) => x.state === 'cancelled').length,
    stamp(o), stamp(s), stamp(exported.parties), stamp(p),
  ];
  return parts.join('_');
}

const q = (v) => {
  if (typeof v === 'number') return `"${v}"`; // numbers can't be formulas, and a negative margin must stay -200
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet apps must not evaluate imported text as a formula
  return `"${s.replace(/"/g, '""')}"`;
};

/** One row per order, with the money columns a seller (or their accountant) asks for. No BOM; the caller adds it. */
export function buildOrdersCsv(data) {
  const ctx = buildContext(data);
  const party = new Map((data.parties || []).map((p) => [p.id, p]));
  const header = ['Date', 'Order', 'Order ID', 'Platform', 'Game', 'Status', 'Currency', 'Price', 'Platform fee', 'Boosters total', 'Your margin', 'Collected', 'Boosters paid', 'Boosters'];
  const rows = [header.map(q).join(',')];
  const orders = [...ctx.orders].filter((o) => o.kind !== 'expense').sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime));
  for (const o of orders) {
    const st = orderMoneyState(ctx, o);
    const shares = ctx.shares.filter((s) => s.orderId === o.id && s.state !== 'cancelled');
    rows.push([
      String(o.dateTime || '').slice(0, 10), o.title, o.orderRef, party.get(o.payerId)?.name || o.source || '', o.game, o.lifecycle, o.currency,
      fromMinor(o.grossMinor, o.currency), fromMinor(o.platformFeeMinor || 0, o.currency), fromMinor(st.shareTotalMinor, o.currency),
      fromMinor(DEAD_LIFECYCLES.has(o.lifecycle) ? 0 : orderMarginMinor(ctx, o), o.currency),
      st.collected ? 'yes' : st.partlyCollected ? 'partly' : 'no', st.boostersPaid ? 'yes' : st.boostersPartlyPaid ? 'partly' : st.shareTotalMinor ? 'no' : '',
      shares.map((s) => `${party.get(s.partyId)?.name || '?'} ${fromMinor(s.amountMinor, o.currency)}`).join('; '),
    ].map(q).join(','));
  }
  return rows.join('\n');
}

/** Every payment, in and out, for reconciling against a bank or wallet. */
export function buildPaymentsCsv(data) {
  const party = new Map((data.parties || []).map((p) => [p.id, p]));
  const voided = new Set((data.payments || []).filter((p) => p.voidsPaymentId).map((p) => p.voidsPaymentId));
  const rows = [['Date', 'Direction', 'Kind', 'Person', 'Currency', 'Amount', 'Note', 'Voided'].map(q).join(',')];
  const list = (data.payments || []).filter((p) => !p.voidsPaymentId).sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime));
  for (const p of list) {
    rows.push([String(p.dateTime || '').slice(0, 10), p.direction, p.kind, party.get(p.partyId)?.name || '', p.currency, fromMinor(p.amountMinor, p.currency), p.note || '', voided.has(p.id) ? 'yes' : ''].map(q).join(','));
  }
  return rows.join('\n');
}
