/**
 * orderCalculator.js - Core quotation and order calculation engine for Checkpoint's Advertiser profile
 */

import { convertCurrency, CURRENCIES } from './currencies.js';

export const PLATFORM_FEE_PRESETS = [
  { id: 'direct', label: 'Direct', labelFa: 'مستقیم', pct: 0 },
  { id: 'g2g', label: 'G2G', labelFa: 'G2G', pct: 9.99 },
  { id: 'funpay', label: 'FunPay', labelFa: 'فان‌پی', pct: 7 },
  { id: 'eldorado', label: 'Eldorado', labelFa: 'الدورادو', pct: 10 },
];

export const ADVERTISER_FEE_PRESETS = ['15', '20', '25', '30', '35'];

/**
 * Round monetary value based on currency type (2 decimals for fiat, whole for Toman/Gold)
 */
function roundForCurrency(amount, currencyCode) {
  const cur = CURRENCIES[currencyCode] || CURRENCIES.TOMAN;
  if (cur.supportsDecimals) {
    return Math.round(Number(amount || 0) * 100) / 100;
  }
  return Math.round(Number(amount || 0));
}

/**
 * Calculates a live 4-currency matrix for a given booster payout pool and booster count
 */
export function getBoosterMultiCurrencyMatrix(boosterPool, boosterCount, fromCurrency = 'USD', rates = {}) {
  const pool = Number(boosterPool || 0);
  const count = Math.max(1, parseInt(boosterCount, 10) || 1);
  const currencies = ['USD', 'EUR', 'TOMAN', 'GOLD'];

  const matrix = {};
  for (const c of currencies) {
    const total = convertCurrency(pool, fromCurrency, c, rates);
    const perBooster = count > 1 ? (total / count) : total;
    matrix[c] = {
      total: roundForCurrency(total, c),
      perBooster: roundForCurrency(perBooster, c),
    };
  }

  return matrix;
}

/**
 * Forward Quote: Computes fees, net profit, and booster payouts from a given gross client price
 */
export function calculateForwardQuote({
  clientPrice = 0,
  platformFeePct = 0,
  feeType = 'percent',
  feeValue = 30,
  boosterCount = 1,
  currency = 'USD',
  rates = {},
}) {
  const gross = Number(clientPrice) || 0;
  const platformPct = Math.max(0, Math.min(99.9, Number(platformFeePct) || 0));
  const platformFeeAmount = roundForCurrency(gross * (platformPct / 100), currency);
  const netAfterPlatform = Math.max(0, roundForCurrency(gross - platformFeeAmount, currency));

  const count = Math.max(1, parseInt(boosterCount, 10) || 1);
  const feeVal = Math.max(0, Number(feeValue) || 0);

  let advertiserProfit = 0;
  if (feeType === 'percent') {
    const pct = Math.min(100, feeVal);
    advertiserProfit = roundForCurrency(netAfterPlatform * (pct / 100), currency);
  } else {
    // Flat static fee
    advertiserProfit = Math.min(netAfterPlatform, roundForCurrency(feeVal, currency));
  }

  const effectiveFeePercent = netAfterPlatform > 0
    ? Math.round(((advertiserProfit / netAfterPlatform) * 100) * 10) / 10
    : 0;

  const boosterPool = Math.max(0, roundForCurrency(netAfterPlatform - advertiserProfit, currency));
  const perBoosterCut = roundForCurrency(boosterPool / count, currency);

  const currencyMatrix = getBoosterMultiCurrencyMatrix(boosterPool, count, currency, rates);

  return {
    mode: 'forward',
    clientPrice: gross,
    platformFeePct: platformPct,
    platformFeeAmount,
    netAfterPlatform,
    feeType,
    feeValue: feeVal,
    effectiveFeePercent,
    advertiserProfit,
    boosterPool,
    boosterCount: count,
    perBoosterCut,
    currency,
    currencyMatrix,
  };
}

/**
 * Reverse Quote: Computes the required gross client price to ensure a target booster payout
 */
export function calculateReverseQuote({
  desiredBoosterPayout = 0,
  isPerBooster = false,
  platformFeePct = 0,
  feeType = 'percent',
  feeValue = 30,
  boosterCount = 1,
  currency = 'USD',
  payoutCurrency = null,
  rates = {},
}) {
  const targetCur = payoutCurrency || currency;
  let targetVal = Number(desiredBoosterPayout) || 0;

  const count = Math.max(1, parseInt(boosterCount, 10) || 1);
  if (isPerBooster) {
    targetVal = targetVal * count;
  }

  // Convert target pool to order currency if needed
  const targetPoolInOrderCurrency = targetCur === currency
    ? targetVal
    : convertCurrency(targetVal, targetCur, currency, rates);

  const platformPct = Math.max(0, Math.min(99, Number(platformFeePct) || 0));
  const feeVal = Math.max(0, Number(feeValue) || 0);

  let netNeeded = 0;
  if (feeType === 'percent') {
    const pct = Math.min(99, feeVal);
    const boosterShareRatio = Math.max(0.01, 1 - (pct / 100));
    netNeeded = targetPoolInOrderCurrency / boosterShareRatio;
  } else {
    // Flat static fee
    netNeeded = targetPoolInOrderCurrency + feeVal;
  }

  const platformShareRatio = Math.max(0.01, 1 - (platformPct / 100));
  const requiredGrossClientPrice = roundForCurrency(netNeeded / platformShareRatio, currency);

  // Re-run forward calculation with the derived gross client price for exact figures
  const forwardResult = calculateForwardQuote({
    clientPrice: requiredGrossClientPrice,
    platformFeePct: platformPct,
    feeType,
    feeValue: feeVal,
    boosterCount: count,
    currency,
    rates,
  });

  return {
    ...forwardResult,
    mode: 'reverse',
    desiredBoosterPayout: targetVal,
    isPerBooster,
    payoutCurrency: targetCur,
  };
}
