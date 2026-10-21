// Ledger v2: money helpers, balances, FIFO allocation, receivables and exposure. Pure functions, no storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMinor, fromMinor, convertMinor, parseAmountShorthand, collapseBuckets, bucketsByCurrency } from '../src/lib/ledger/money.js';
import {
  buildContext,
  orderMarginMinor,
  orderMoneyState,
  partyBalance,
  partyBalanceDisplay,
  allocateFifo,
  allocateToParty,
  orderTargetsFor,
  payerReceivables,
  exposureByCurrency,
  marginSummary,
  needsAttention,
  agingDays,
} from '../src/lib/ledger/engine.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const DAY = 86400000;
const T0 = Date.parse('2026-10-01T10:00:00Z');
const iso = (days) => new Date(T0 + days * DAY).toISOString();

test('minor units round-trip per currency decimals', () => {
  assert.equal(toMinor(12.5, 'USD'), 1250);
  assert.equal(toMinor(3000000, 'TOMAN'), 3000000);
  assert.equal(fromMinor(1250, 'USD'), 12.5);
  assert.equal(toMinor('abc', 'USD'), 0);
  assert.equal(toMinor(0.1 + 0.2, 'USD'), 30);
});

test('convertMinor goes through convertCurrency and returns integers', () => {
  assert.equal(convertMinor(1000, 'USD', 'TOMAN', RATES), 1000000); // 10 USD -> 1,000,000 T
  assert.equal(convertMinor(1000000, 'TOMAN', 'USD', RATES), 1000); // back to 10.00 USD
  assert.equal(convertMinor(500, 'TOMAN', 'TOMAN', RATES), 500);
  assert.ok(Number.isInteger(convertMinor(12345, 'EUR', 'TOMAN', RATES)));
});

test('shorthand amounts: k/m, separators, Persian digits and words', () => {
  assert.equal(parseAmountShorthand('3m'), 3e6);
  assert.equal(parseAmountShorthand('250k'), 250000);
  assert.equal(parseAmountShorthand('1.5m'), 1.5e6);
  assert.equal(parseAmountShorthand('3,000,000'), 3e6);
  assert.equal(parseAmountShorthand('۳ میلیون'), 3e6);
  assert.equal(parseAmountShorthand('۲۵۰ هزار'), 250000);
  assert.equal(parseAmountShorthand('12.5'), 12.5);
  assert.equal(parseAmountShorthand('abc'), null);
  assert.equal(parseAmountShorthand(''), null);
  assert.equal(parseAmountShorthand('-5'), null);
  assert.equal(parseAmountShorthand('5 zz'), null);
});

// A G2G order: client paid 1,000,000 T, G2G keeps 10%, two boosters get 300k + 200k, seller keeps 400k.
function g2gFixture() {
  const orders = [
    { id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: 'g2g', dateTime: iso(0), expectedPayoutAt: iso(3) },
    { id: 'o2', lifecycle: 'working', currency: 'TOMAN', grossMinor: 500000, platformFeeMinor: 50000, payerId: 'g2g', dateTime: iso(1), expectedPayoutAt: null },
  ];
  const shares = [
    { id: 's1', orderId: 'o1', partyId: 'ali', amountMinor: 300000, state: 'open' },
    { id: 's2', orderId: 'o1', partyId: 'sara', amountMinor: 200000, state: 'open' },
    { id: 's3', orderId: 'o2', partyId: 'ali', amountMinor: 250000, state: 'open' },
  ];
  return { orders, shares, payments: [], allocations: [] };
}

test('margin is derived: receivable minus active shares', () => {
  const ctx = buildContext(g2gFixture());
  assert.equal(orderMarginMinor(ctx, ctx.orderById.get('o1')), 400000);
  assert.equal(orderMarginMinor(ctx, ctx.orderById.get('o2')), 200000);
});

test('failed orders and cancelled shares carry no margin or balance', () => {
  const f = g2gFixture();
  f.orders[1].lifecycle = 'failed';
  const ctx = buildContext(f);
  assert.equal(orderMarginMinor(ctx, ctx.orderById.get('o2')), 0);
  assert.equal(partyBalance(ctx, 'ali').committed.TOMAN, undefined);
});

test('balances split payable (earned) from committed (open work)', () => {
  const ctx = buildContext(g2gFixture());
  const ali = partyBalance(ctx, 'ali');
  assert.equal(ali.payable.TOMAN, 300000); // o1 is done
  assert.equal(ali.committed.TOMAN, 250000); // o2 still working
  assert.equal(partyBalance(ctx, 'sara').payable.TOMAN, 200000);
});

test('FIFO settle-up across several works, with a remainder becoming advance credit', () => {
  const f = g2gFixture();
  f.orders[1].lifecycle = 'done';
  let ctx = buildContext(f);
  const { allocations, remainderMinor } = allocateToParty(ctx, { partyId: 'ali', amountMinor: 600000, currency: 'TOMAN', rates: RATES });
  assert.equal(remainderMinor, 50000);
  assert.deepEqual(allocations.map((a) => [a.targetId, a.appliedMinor]), [['s1', 300000], ['s3', 250000]]);

  const pay = { id: 'p1', direction: 'out', partyId: 'ali', amountMinor: 600000, currency: 'TOMAN', rates: RATES, kind: 'settlement', dateTime: iso(5) };
  ctx = buildContext({ ...f, payments: [pay], allocations: allocations.map((a, i) => ({ ...a, id: `a${i}`, paymentId: 'p1' })) });
  const bal = partyBalance(ctx, 'ali');
  assert.deepEqual(bal.payable, {});
  assert.equal(bucketsByCurrency(bal.advance).TOMAN, 50000);
});

test('partial payment leaves the share partly outstanding', () => {
  const f = g2gFixture();
  const { allocations } = allocateFifo({ amountMinor: 100000, currency: 'TOMAN', rates: RATES, targets: [{ type: 'share', id: 's1', currency: 'TOMAN', outstandingMinor: 300000, dateTime: iso(0) }] });
  const pay = { id: 'p1', direction: 'out', partyId: 'ali', amountMinor: 100000, currency: 'TOMAN', kind: 'settlement', dateTime: iso(2) };
  const ctx = buildContext({ ...f, payments: [pay], allocations: allocations.map((a) => ({ ...a, id: 'a1', paymentId: 'p1' })) });
  assert.equal(partyBalance(ctx, 'ali').payable.TOMAN, 200000);
});

test('paying a USD work in Toman applies at the payment rate and never overpays', () => {
  const targets = [{ type: 'share', id: 's', currency: 'USD', outstandingMinor: 5000, dateTime: iso(0) }]; // 50.00 USD
  const full = allocateFifo({ amountMinor: 5000000, currency: 'TOMAN', rates: RATES, targets }); // 5M T = 50 USD
  assert.equal(full.allocations[0].appliedMinor, 5000);
  assert.equal(full.allocations[0].consumedMinor, 5000000);
  assert.equal(full.remainderMinor, 0);
  const part = allocateFifo({ amountMinor: 2000000, currency: 'TOMAN', rates: RATES, targets });
  assert.equal(part.allocations[0].appliedMinor, 2000); // 20.00 USD
  assert.equal(part.remainderMinor, 0);
});

test('allocation never consumes more than the payment holds', () => {
  for (let amount = 1; amount < 400; amount += 7) {
    const r = allocateFifo({
      amountMinor: amount,
      currency: 'TOMAN',
      rates: RATES,
      targets: [
        { type: 'share', id: 'a', currency: 'USD', outstandingMinor: 333, dateTime: iso(0) },
        { type: 'share', id: 'b', currency: 'EUR', outstandingMinor: 777, dateTime: iso(1) },
      ],
    });
    const consumed = r.allocations.reduce((s, a) => s + a.consumedMinor, 0);
    assert.ok(consumed <= amount, `consumed ${consumed} > ${amount}`);
    assert.equal(consumed + r.remainderMinor, amount);
  }
});

test('voiding a payment removes its effect and its allocations', () => {
  const f = g2gFixture();
  const pay = { id: 'p1', direction: 'out', partyId: 'ali', amountMinor: 300000, currency: 'TOMAN', kind: 'settlement', dateTime: iso(4) };
  const alloc = { id: 'a1', paymentId: 'p1', targetType: 'share', targetId: 's1', appliedMinor: 300000, consumedMinor: 300000 };
  const voidMarker = { id: 'p2', direction: 'out', partyId: 'ali', amountMinor: 300000, currency: 'TOMAN', kind: 'adjustment', voidsPaymentId: 'p1', dateTime: iso(5) };
  const before = buildContext({ ...f, payments: [pay], allocations: [alloc] });
  assert.equal(partyBalance(before, 'ali').payable.TOMAN, undefined);
  const after = buildContext({ ...f, payments: [pay, voidMarker], allocations: [alloc] });
  assert.equal(partyBalance(after, 'ali').payable.TOMAN, 300000);
  assert.deepEqual(partyBalance(after, 'ali').advance, {});
});

test('intermediary: platform payer receivables split held / releasable / overdue', () => {
  const f = g2gFixture();
  f.orders.push({ id: 'o3', lifecycle: 'done', currency: 'TOMAN', grossMinor: 200000, platformFeeMinor: 0, payerId: 'g2g', dateTime: iso(-20), expectedPayoutAt: iso(-10) });
  const ctx = buildContext(f);
  const now = T0 + 2 * DAY;
  const r = payerReceivables(ctx, 'g2g', now);
  assert.equal(r.held.TOMAN, 900000 + 450000); // o1 inside hold (due +3d) and o2 not done
  assert.equal(r.releasable.TOMAN, 200000); // o3 done and past due
  assert.equal(r.overdue.TOMAN, 200000); // o3 is 12 days late
});

test('Receive payout: one lump from the platform is allocated to its oldest orders', () => {
  const f = g2gFixture();
  const ctx = buildContext(f);
  const targets = orderTargetsFor(ctx, 'g2g');
  const { allocations, remainderMinor } = allocateFifo({ amountMinor: 1000000, currency: 'TOMAN', rates: RATES, targets });
  assert.deepEqual(allocations.map((a) => [a.targetId, a.appliedMinor]), [['o1', 900000], ['o2', 100000]]);
  assert.equal(remainderMinor, 0);
  const pay = { id: 'in1', direction: 'in', partyId: 'g2g', amountMinor: 1000000, currency: 'TOMAN', kind: 'settlement', dateTime: iso(4) };
  const after = buildContext({ ...f, payments: [pay], allocations: allocations.map((a, i) => ({ ...a, id: `x${i}`, paymentId: 'in1' })) });
  assert.equal(orderMoneyState(after, after.orderById.get('o1')).collected, true);
  assert.equal(orderMoneyState(after, after.orderById.get('o2')).partlyCollected, true);
});

test('exposure: paid out to boosters before the platform paid me', () => {
  const f = g2gFixture();
  const pay = { id: 'p1', direction: 'out', partyId: 'ali', amountMinor: 300000, currency: 'TOMAN', kind: 'settlement', dateTime: iso(2) };
  const alloc = { id: 'a1', paymentId: 'p1', targetType: 'share', targetId: 's1', appliedMinor: 300000, consumedMinor: 300000 };
  let ctx = buildContext({ ...f, payments: [pay], allocations: [alloc] });
  assert.equal(exposureByCurrency(ctx).TOMAN, 300000);
  const rec = { id: 'in1', direction: 'in', partyId: 'g2g', amountMinor: 900000, currency: 'TOMAN', kind: 'settlement', dateTime: iso(3) };
  const recAlloc = { id: 'a2', paymentId: 'in1', targetType: 'order', targetId: 'o1', appliedMinor: 900000, consumedMinor: 900000 };
  ctx = buildContext({ ...f, payments: [pay, rec], allocations: [alloc, recAlloc] });
  assert.equal(exposureByCurrency(ctx).TOMAN, undefined);
});

test('refund after paying a booster leaves a negative net balance (they owe me)', () => {
  const f = g2gFixture();
  const pay = { id: 'p1', direction: 'out', partyId: 'sara', amountMinor: 200000, currency: 'TOMAN', kind: 'settlement', dateTime: iso(2) };
  const alloc = { id: 'a1', paymentId: 'p1', targetType: 'share', targetId: 's2', appliedMinor: 200000, consumedMinor: 200000 };
  f.orders[0].lifecycle = 'refunded';
  const ctx = buildContext({ ...f, payments: [pay], allocations: [alloc] });
  // the share is dead, so the money Sara was paid is no longer applied to anything: it reads as credit
  const disp = partyBalanceDisplay(partyBalance(ctx, 'sara'), 'TOMAN', RATES);
  assert.equal(disp.netMinor, -200000);
});

test('margin summary splits realized (done) from pipeline (live)', () => {
  const ctx = buildContext(g2gFixture());
  const m = marginSummary(ctx);
  assert.equal(m.realized.TOMAN, 400000);
  assert.equal(m.pipeline.TOMAN, 200000);
});

test('needs attention: stale unpaid booster, and collected-but-not-paid-out', () => {
  const f = g2gFixture();
  const rec = { id: 'in1', direction: 'in', partyId: 'g2g', amountMinor: 900000, currency: 'TOMAN', kind: 'settlement', dateTime: iso(3) };
  const recAlloc = { id: 'a2', paymentId: 'in1', targetType: 'order', targetId: 'o1', appliedMinor: 900000, consumedMinor: 900000 };
  const ctx = buildContext({ ...f, payments: [rec], allocations: [recAlloc] });
  const items = needsAttention(ctx, { now: T0 + 10 * DAY });
  assert.ok(items.some((i) => i.type === 'booster_overdue' && i.partyId === 'ali'));
  assert.ok(items.some((i) => i.type === 'collected_not_paid_out' && i.orderId === 'o1'));
  assert.equal(agingDays(ctx, 'ali', T0 + 10 * DAY), 10);
});

test('collapseBuckets flags mixed currencies as approximate', () => {
  const r = collapseBuckets({ TOMAN: 1000000, USD: 1000 }, 'TOMAN', RATES);
  assert.equal(r.minor, 2000000);
  assert.equal(r.isApproximate, true);
  assert.equal(collapseBuckets({ TOMAN: 5 }, 'TOMAN', RATES).isApproximate, false);
});
