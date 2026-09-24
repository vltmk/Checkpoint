import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateForwardQuote,
  calculateReverseQuote,
  getBoosterMultiCurrencyMatrix,
} from '../src/lib/orderCalculator.js';
import { convertCurrency, formatMoney, sanitizePriceInput } from '../src/lib/currencies.js';

test('orderCalculator: forward quote with G2G platform fee, 30% advertiser cut, and 4 boosters', () => {
  const rates = {
    goldRateTOMAN: 3200,
    usdRateTOMAN: 95000,
    eurRateUSD: 1.08,
  };

  const res = calculateForwardQuote({
    clientPrice: 100,
    platformFeePct: 9.99,
    feeType: 'percent',
    feeValue: 30,
    boosterCount: 4,
    currency: 'USD',
    rates,
  });

  // Client pays $100
  assert.equal(res.clientPrice, 100);
  // G2G takes 9.99% -> $9.99
  assert.equal(res.platformFeeAmount, 9.99);
  // Net after platform = $90.01
  assert.equal(res.netAfterPlatform, 90.01);
  // Advertiser takes 30% of $90.01 -> $27.00
  assert.equal(res.advertiserProfit, 27);
  // Booster pool = $90.01 - $27 = $63.01
  assert.equal(res.boosterPool, 63.01);
  // 4 boosters -> $63.01 / 4 = $15.75
  assert.equal(res.perBoosterCut, 15.75);

  // Check currency matrix
  assert.ok(res.currencyMatrix.USD);
  assert.ok(res.currencyMatrix.EUR);
  assert.ok(res.currencyMatrix.TOMAN);
  assert.ok(res.currencyMatrix.GOLD);
  assert.equal(res.currencyMatrix.USD.total, 63.01);
  assert.ok(res.currencyMatrix.GOLD.total > 0);
  assert.ok(res.currencyMatrix.TOMAN.total > 0);
});

test('orderCalculator: forward quote with Flat fee mode', () => {
  const res = calculateForwardQuote({
    clientPrice: 50,
    platformFeePct: 0,
    feeType: 'flat',
    feeValue: 10,
    boosterCount: 2,
    currency: 'USD',
  });

  assert.equal(res.clientPrice, 50);
  assert.equal(res.platformFeeAmount, 0);
  assert.equal(res.advertiserProfit, 10);
  assert.equal(res.boosterPool, 40);
  assert.equal(res.perBoosterCut, 20);
});

test('orderCalculator: reverse quote ensures target booster payout', () => {
  const rates = {
    goldRateTOMAN: 3200,
    usdRateTOMAN: 95000,
    eurRateUSD: 1.08,
  };

  const res = calculateReverseQuote({
    desiredBoosterPayout: 70,
    platformFeePct: 0,
    feeType: 'percent',
    feeValue: 30, // 30% cut
    boosterCount: 1,
    currency: 'USD',
    rates,
  });

  // If desired booster payout is $70 and advertiser takes 30%, client must pay $100
  assert.equal(res.clientPrice, 100);
  assert.equal(res.advertiserProfit, 30);
  assert.equal(res.boosterPool, 70);
});

test('currencies: USD and EUR formatting and conversions', () => {
  const rates = {
    goldRateTOMAN: 3200,
    usdRateTOMAN: 95000,
    eurRateUSD: 1.08,
  };

  // Formatting
  assert.equal(formatMoney(24.5, 'USD'), '\u200E$24.50\u200E');
  assert.equal(formatMoney(100, 'USD'), '\u200E$100\u200E');
  assert.equal(formatMoney(19.99, 'EUR'), '\u200E€19.99\u200E');

  // Conversions
  // 100 USD -> Toman
  const usdToToman = convertCurrency(100, 'USD', 'TOMAN', rates);
  assert.equal(usdToToman, 9500000);

  // 100 EUR -> USD
  const eurToUsd = convertCurrency(100, 'EUR', 'USD', rates);
  assert.equal(eurToUsd, 108);

  // Decimal price sanitization
  assert.equal(sanitizePriceInput('24.50', { allowDecimals: true }), '24.50');
  assert.equal(sanitizePriceInput('$1,250.75', { allowDecimals: true }), '1250.75');
  assert.equal(sanitizePriceInput('60.699'), '60699'); // default still integers for Toman
});
