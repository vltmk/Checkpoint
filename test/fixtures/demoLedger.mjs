// Test-only fixture: the sample ledger the app used to offer, kept so the cleanup of old sample rows stays tested.
import { DEMO_PREFIX } from '../../src/lib/ledger/sampleData.js';

const DAY = 86400000;

export function buildSampleLedger(now = Date.now()) {
  const iso = (daysAgo) => new Date(now - daysAgo * DAY).toISOString();
  const stamp = iso(0);
  const party = (id, kind, name) => ({ id: DEMO_PREFIX + id, kind, name, archived: 0, createdAt: stamp, updatedAt: stamp });
  const order = (id, over) => ({
    id: DEMO_PREFIX + id, kind: 'income', game: 'World of Warcraft', platformFeeMinor: 0, createdAt: stamp, updatedAt: stamp, ...over,
  });
  const share = (id, orderId, partyId, amountMinor, state) => ({
    id: DEMO_PREFIX + id, orderId: DEMO_PREFIX + orderId, partyId: DEMO_PREFIX + partyId, amountMinor, state, createdAt: stamp, updatedAt: stamp,
  });
  const payment = (id, direction, partyId, amountMinor, daysAgo, over = {}) => ({
    id: DEMO_PREFIX + id, direction, partyId: DEMO_PREFIX + partyId, dateTime: iso(daysAgo), amountMinor, currency: 'USD',
    kind: 'settlement', origin: 'user', createdAt: stamp, ...over,
  });
  const alloc = (id, paymentId, targetType, targetId, applied, consumed = applied) => ({
    id: DEMO_PREFIX + id, paymentId: DEMO_PREFIX + paymentId, targetType, targetId: DEMO_PREFIX + targetId, appliedMinor: applied, consumedMinor: consumed,
  });

  // amounts in cents (USD)
  return {
    parties: [
      party('g2g', 'platform', 'G2G'), party('funpay', 'platform', 'FunPay'),
      party('ali', 'booster', 'Ali'), party('sara', 'booster', 'Sara'), party('reza', 'booster', 'Reza'),
    ],
    orders: [
      order('o1', { title: 'Mythic+ 15 timed, 4 runs', orderRef: 'G2G-4821', payerId: DEMO_PREFIX + 'g2g', dateTime: iso(14), lifecycle: 'done', currency: 'USD', grossMinor: 12000, platformFeeMinor: 1199, expectedPayoutAt: iso(9) }),
      order('o2', { title: 'Raid carry: Heroic Nerub-ar Palace', orderRef: 'G2G-4866', payerId: DEMO_PREFIX + 'g2g', dateTime: iso(8), lifecycle: 'done', currency: 'USD', grossMinor: 8000, platformFeeMinor: 799, expectedPayoutAt: iso(-1) }),
      order('o3', { title: 'Leveling 70-80', orderRef: 'FP-1203', payerId: DEMO_PREFIX + 'funpay', dateTime: iso(5), lifecycle: 'working', currency: 'USD', grossMinor: 6000, platformFeeMinor: 420 }),
      order('o4', { title: 'Delve farming, 2 hours', payerId: DEMO_PREFIX + 'funpay', dateTime: iso(3), lifecycle: 'done', currency: 'USD', grossMinor: 3000, platformFeeMinor: 210, expectedPayoutAt: iso(-2) }),
      order('o5', { title: 'Mythic+ 10, 3 runs', orderRef: 'G2G-4902', payerId: DEMO_PREFIX + 'g2g', dateTime: iso(1), lifecycle: 'pending', currency: 'USD', grossMinor: 7000, platformFeeMinor: 699 }),
    ],
    shares: [
      share('s1a', 'o1', 'ali', 4000, 'done'), share('s1b', 'o1', 'sara', 4000, 'done'),
      share('s2a', 'o2', 'ali', 3000, 'done'), share('s2b', 'o2', 'reza', 2500, 'done'),
      share('s3a', 'o3', 'reza', 3500, 'open'),
      share('s4a', 'o4', 'sara', 1800, 'done'),
      share('s5a', 'o5', 'ali', 4000, 'open'),
    ],
    payments: [
      // G2G paid out the first order in full, after a withdrawal fee
      payment('p1', 'in', 'g2g', 10801, 8),
      // Ali was paid part of what he is owed; Sara was paid for the first order
      payment('p2', 'out', 'ali', 5000, 6),
      payment('p3', 'out', 'sara', 4000, 7),
      // Reza got an advance before starting the leveling job
      payment('p4', 'out', 'reza', 1000, 4, { kind: 'advance' }),
    ],
    allocations: [
      alloc('a1', 'p1', 'order', 'o1', 10801),
      alloc('a2', 'p2', 'share', 's1a', 4000), alloc('a3', 'p2', 'share', 's2a', 1000),
      alloc('a4', 'p3', 'share', 's1b', 4000),
    ],
    proofs: [],
    flags: [],
    meta: {},
  };
}
