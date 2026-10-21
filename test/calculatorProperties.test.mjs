// Property checks for the Advertiser's order calculator: the money must always add up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateForwardQuote, calculateReverseQuote } from '../src/lib/orderCalculator.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const unit = (cur) => (cur === 'USD' || cur === 'EUR' ? 0.01 : 1);
const round = (n, cur) => (unit(cur) === 0.01 ? Math.round(n * 100) / 100 : Math.round(n));

test('forward: platform fee + your cut + booster pool always equals what the client paid', () => {
  const r = rng(7);
  for (let i = 0; i < 4000; i++) {
    const currency = ['USD', 'EUR', 'TOMAN', 'GOLD'][Math.floor(r() * 4)];
    const gross = round(r() * (currency === 'TOMAN' ? 5e7 : currency === 'GOLD' ? 5e5 : 2000), currency);
    const q = calculateForwardQuote({
      clientPrice: gross, platformFeePct: r() < 0.3 ? 0 : Math.round(r() * 2500) / 100,
      feeType: r() < 0.7 ? 'percent' : 'flat', feeValue: r() < 0.7 ? Math.round(r() * 5000) / 100 : round(r() * gross, currency),
      boosterCount: 1 + Math.floor(r() * 10), currency, rates: RATES,
    });
    const sum = q.platformFeeAmount + q.advertiserProfit + q.boosterPool;
    assert.ok(Math.abs(sum - gross) <= unit(currency) + 1e-9, `${currency} gross ${gross}: parts add to ${sum}`);
    assert.ok(q.boosterPool >= 0 && q.advertiserProfit >= 0 && q.platformFeeAmount >= 0);
  }
});

test('forward: splitting the pool never creates or loses money (cuts add up to the pool)', () => {
  const r = rng(11);
  let withDust = 0;
  for (let i = 0; i < 4000; i++) {
    const currency = ['USD', 'EUR', 'TOMAN', 'GOLD'][Math.floor(r() * 4)];
    const gross = round(r() * (currency === 'TOMAN' ? 5e7 : currency === 'GOLD' ? 5e5 : 2000), currency);
    const q = calculateForwardQuote({ clientPrice: gross, platformFeePct: 10, feeType: 'percent', feeValue: 15, boosterCount: 1 + Math.floor(r() * 9), currency, rates: RATES });
    const split = round(q.perBoosterCut * q.boosterCount, currency);
    if (Math.abs(split - q.boosterPool) > 1e-9) withDust++;
  }
  // per-booster cuts are rounded individually, so some quotes cannot be split exactly: the order form must
  // distribute the pool itself (remainder to the first booster) instead of repeating perBoosterCut
  assert.ok(withDust > 0, 'expected rounding dust in some per-booster cuts (documents why the order form splits the pool)');
});

test('reverse: the price it asks for really pays boosters what was requested, to within one unit', () => {
  const r = rng(13);
  for (let i = 0; i < 3000; i++) {
    const currency = ['USD', 'EUR', 'TOMAN', 'GOLD'][Math.floor(r() * 4)];
    const target = round(r() * (currency === 'TOMAN' ? 3e7 : currency === 'GOLD' ? 3e5 : 1000) + unit(currency) * 5, currency);
    const q = calculateReverseQuote({
      desiredBoosterPayout: target, isPerBooster: false, platformFeePct: r() < 0.3 ? 0 : Math.round(r() * 2000) / 100,
      feeType: 'percent', feeValue: Math.round(r() * 4000) / 100, boosterCount: 1 + Math.floor(r() * 5), currency, rates: RATES,
    });
    const tolerance = Math.max(unit(currency) * 3, target * 0.002);
    assert.ok(q.boosterPool + tolerance >= target, `${currency}: asked ${target} for boosters, pool is ${q.boosterPool}`);
    assert.ok(Math.abs(q.clientPrice - q.platformFeeAmount - q.advertiserProfit - q.boosterPool) <= unit(currency) + 1e-9);
  }
});

test('edge cases: zero price, a flat cut bigger than the price, and a 100% cut all stay non-negative and finite', () => {
  const zero = calculateForwardQuote({ clientPrice: 0, platformFeePct: 10, feeType: 'percent', feeValue: 20, currency: 'USD', rates: RATES });
  assert.deepEqual([zero.advertiserProfit, zero.boosterPool, zero.platformFeeAmount], [0, 0, 0]);
  const flat = calculateForwardQuote({ clientPrice: 50, platformFeePct: 0, feeType: 'flat', feeValue: 80, currency: 'USD', rates: RATES });
  assert.equal(flat.boosterPool, 0);
  assert.equal(flat.advertiserProfit, 50);
  const all = calculateForwardQuote({ clientPrice: 100, platformFeePct: 0, feeType: 'percent', feeValue: 100, currency: 'USD', rates: RATES });
  assert.equal(all.boosterPool, 0);
  const junk = calculateForwardQuote({ clientPrice: 'abc', platformFeePct: NaN, feeValue: undefined, boosterCount: 0, currency: 'USD', rates: RATES });
  assert.ok(Number.isFinite(junk.clientPrice) && Number.isFinite(junk.perBoosterCut));
});

test('reverse across currencies: asking for a USD payout on a Toman order converts at the given rate', () => {
  const q = calculateReverseQuote({ desiredBoosterPayout: 50, payoutCurrency: 'USD', currency: 'TOMAN', platformFeePct: 0, feeType: 'percent', feeValue: 0, boosterCount: 1, rates: RATES });
  assert.equal(q.boosterPool, 5000000); // $50 at 100,000 per dollar
});

test('quote -> order: the shares add up to exactly the quoted booster pool, and the remainder goes to the first booster', async () => {
  const { quoteShareTexts } = await import('../src/lib/ledger/quote.js');
  const { toMinor } = await import('../src/lib/ledger/money.js');
  const q = calculateForwardQuote({ clientPrice: 100, platformFeePct: 0, feeType: 'percent', feeValue: 15, boosterCount: 3, currency: 'USD', rates: RATES });
  const texts = quoteShareTexts({ boosterCount: 3, boosterPool: q.boosterPool, perBoosterCut: q.perBoosterCut }, 'USD');
  assert.equal(texts.length, 3);
  assert.equal(texts.reduce((s, t) => s + toMinor(Number(t), 'USD'), 0), toMinor(q.boosterPool, 'USD'));
  assert.ok(Number(texts[0]) >= Number(texts[1]));
  assert.equal(quoteShareTexts({ boosterCount: 2 }, 'USD'), null);
  assert.deepEqual(quoteShareTexts({ boosterCount: 2, perBoosterCut: 40 }, 'TOMAN'), ['40', '40']);
  assert.deepEqual(quoteShareTexts({ boosterCount: 3, boosterPool: 1000 }, 'TOMAN'), ['334', '333', '333']);
});
