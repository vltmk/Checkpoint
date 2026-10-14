/**
 * Smart Order Parser (5-Pass Extraction Pipeline)
 * Robust clipboard order text extractor for gamer freelancers & boosting agencies.
 */

import { sanitizePriceInput } from './currencies.js';

const PLATFORM_URL_MAP = [
  { pattern: /g2g\.com/i, name: 'G2G' },
  { pattern: /eldorado\.gg/i, name: 'Eldorado' },
  { pattern: /funpay\.(com|ru)/i, name: 'FunPay' },
  { pattern: /playerauctions\.com/i, name: 'PlayerAuctions' },
  { pattern: /chicksgold\.com/i, name: 'ChicksGold' },
  { pattern: /discord\.(gg|com)/i, name: 'Discord' },
];

const PLATFORM_KEYWORD_MAP = [
  { pattern: /\b(g2g)\b/i, name: 'G2G' },
  { pattern: /\b(eldorado)\b/i, name: 'Eldorado' },
  { pattern: /\b(funpay)\b/i, name: 'FunPay' },
  { pattern: /\b(playerauctions)\b/i, name: 'PlayerAuctions' },
  { pattern: /\b(chicksgold)\b/i, name: 'ChicksGold' },
];

/**
 * Parses raw order text from clipboard and extracts structured order fields.
 * @param {string} text Raw clipboard text
 * @returns {object} Extracted fields: { title, price, currency, orderId, source, link, confidence, raw }
 */
export function parseOrderText(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      title: '',
      price: null,
      currency: null,
      orderId: null,
      source: null,
      link: null,
      confidence: 0,
      raw: text || '',
    };
  }

  const raw = text.trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let extractedLink = null;
  let extractedSource = null;
  let extractedOrderId = null;
  let extractedPrice = null;
  let extractedCurrency = null;
  let extractedTitle = null;

  // -------------------------------------------------------------
  // PASS 1: URL & Platform Detection
  // -------------------------------------------------------------
  const urlMatch = raw.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    extractedLink = urlMatch[0].replace(/[)\]>,;.]+$/, '');
    for (const { pattern, name } of PLATFORM_URL_MAP) {
      if (pattern.test(extractedLink)) {
        extractedSource = name;
        break;
      }
    }
  }

  if (!extractedSource) {
    for (const { pattern, name } of PLATFORM_KEYWORD_MAP) {
      if (pattern.test(raw)) {
        extractedSource = name;
        break;
      }
    }
  }

  // -------------------------------------------------------------
  // PASS 2: Explicit Key-Value Pair Extraction
  // -------------------------------------------------------------
  for (const line of lines) {
    // Order ID patterns: "Order ID: 12345", "Order #OD-123", "شناسه سفارش: 12345", "Order #: 12345"
    if (!extractedOrderId) {
      const idMatch = line.match(/(?:order\s*(?:id|#|number|code)?|شناسه(?:\s*سفارش)?|شماره\s*سفارش|کد\s*سفارش)\s*[:=\-–#]\s*([a-zA-Z0-9_\-#]+)/i);
      if (idMatch && idMatch[1]) {
        extractedOrderId = idMatch[1].replace(/^#/, '').trim();
      }
    }

    // Explicit Price line: "Price: $50", "مبلغ: 25 یورو", "Total: 15.00 USD"
    if (extractedPrice === null) {
      const priceKeyMatch = line.match(/(?:price|amount|cost|total|payout|مبلغ|قیمت|هزینه|سهم)\s*[:=\-–]\s*(.+)/i);
      if (priceKeyMatch && priceKeyMatch[1]) {
        const valStr = priceKeyMatch[1].trim();
        const parsedFin = extractFinancialToken(valStr);
        if (parsedFin.price !== null) {
          extractedPrice = parsedFin.price;
          if (parsedFin.currency) extractedCurrency = parsedFin.currency;
        }
      }
    }

    // Explicit Title line: "Service: Mythic Raid", "Title: Leveling 1-80", "عنوان: رید هیروئیک"
    if (!extractedTitle) {
      const titleMatch = line.match(/(?:service|title|job|order|item|خدمت|عنوان|سفارش|کار)\s*[:=\-–]\s*(.+)/i);
      if (titleMatch && titleMatch[1]) {
        const tVal = titleMatch[1].trim();
        // Ignore if it's just an order ID or URL
        if (!/^https?:\/\//i.test(tVal) && !/^\d+$/.test(tVal)) {
          extractedTitle = tVal;
        }
      }
    }

    // Explicit Source line: "Source: G2G", "منبع: Eldorado"
    if (!extractedSource) {
      const srcMatch = line.match(/(?:source|platform|site|website|منبع|سایت)\s*[:=\-–]\s*([a-zA-Z0-9_\-\s]+)/i);
      if (srcMatch && srcMatch[1]) {
        const sVal = srcMatch[1].trim();
        if (sVal) extractedSource = sVal;
      }
    }
  }

  // -------------------------------------------------------------
  // PASS 3: Fallback Financial Token Extraction (if not found via Pass 2)
  // -------------------------------------------------------------
  if (extractedPrice === null) {
    const fin = extractFinancialToken(raw, extractedOrderId);
    if (fin.price !== null) {
      extractedPrice = fin.price;
      if (fin.currency) extractedCurrency = fin.currency;
    }
  }

  // -------------------------------------------------------------
  // PASS 4: Fallback Order ID Extraction (e.g. #OD-19284, #948271)
  // -------------------------------------------------------------
  if (!extractedOrderId) {
    // Look for #123456 or #OD-12345
    const hashtagMatch = raw.match(/#([a-zA-Z0-9_\-]{4,20})/);
    if (hashtagMatch && hashtagMatch[1]) {
      // Guard against hex colors or discord tags
      if (!/^[0-9a-fA-F]{6}$/.test(hashtagMatch[1])) {
        extractedOrderId = hashtagMatch[1].trim();
      }
    }
  }

  // -------------------------------------------------------------
  // PASS 5: Residue Title Cleaning
  // -------------------------------------------------------------
  if (!extractedTitle) {
    // Find the first informative line that isn't purely a URL, order ID, or price
    for (const line of lines) {
      if (/^https?:\/\//i.test(line)) continue;
      if (/^(?:order\s*(?:id|#|number)?|شناسه(?:\s*سفارش)?|شماره\s*سفارش|price|مبلغ|قیمت|platform|source|منبع|سایت)/i.test(line)) continue;
      if (/^#?\d{4,12}$/.test(line)) continue;

      let clean = line;
      // Strip matched order ID
      if (extractedOrderId) {
        clean = clean.replace(new RegExp(`#?${extractedOrderId}`, 'gi'), '');
      }
      // Strip matched URL
      if (extractedLink) {
        clean = clean.replace(extractedLink, '');
      }
      // Strip price patterns
      clean = clean.replace(/[$€](\s*\d+(?:[.,]\d+)?)/g, '');
      clean = clean.replace(/(\d+(?:[.,]\d+)?)\s*(?:usd|eur|dollar|euro|تومان|toman|gold|g)/gi, '');
      clean = clean.replace(/[:=\-–#|]+$/, '').replace(/^[:=\-–#|]+/, '').trim();

      if (clean.length >= 3) {
        extractedTitle = clean;
        break;
      }
    }
  }

  // If still no title, use first line stripped
  if (!extractedTitle && lines.length > 0) {
    extractedTitle = lines[0].slice(0, 60).trim();
  }

  // Compute confidence score (0 to 1)
  let confidence = 0;
  if (extractedTitle) confidence += 0.3;
  if (extractedPrice !== null) confidence += 0.3;
  if (extractedCurrency) confidence += 0.15;
  if (extractedOrderId) confidence += 0.15;
  if (extractedSource || extractedLink) confidence += 0.1;

  return {
    title: extractedTitle || '',
    price: extractedPrice,
    currency: extractedCurrency || 'USD',
    orderId: extractedOrderId || null,
    source: extractedSource || null,
    link: extractedLink || null,
    confidence: Math.min(1, confidence),
    raw,
  };
}

/**
 * Extracts a financial amount and currency from text, protecting keystones like +15.
 */
function extractFinancialToken(str, excludeId = null) {
  let cleaned = str;
  if (excludeId) {
    cleaned = cleaned.replace(new RegExp(`#?${excludeId}`, 'gi'), '');
  }

  // Protect Mythic+ keystones like +15, +20, +2
  cleaned = cleaned.replace(/\+\s*\d{1,2}\b/g, ' ');

  // 1. Explicit Currency Symbols ($50, €75)
  const symbolMatch = cleaned.match(/([$€])\s*(\d+(?:[.,]\d+)?)/);
  if (symbolMatch) {
    const symbol = symbolMatch[1];
    const val = parseFloat(sanitizePriceInput(symbolMatch[2]));
    if (!isNaN(val) && val > 0) {
      return {
        price: val,
        currency: symbol === '$' ? 'USD' : 'EUR',
      };
    }
  }

  // 2. Trailing Currency Codes (50 USD, 75 EUR, 350000 Toman, 250k Gold)
  const trailingMatch = cleaned.match(/(\d+(?:[.,]\d+)?\s*[kKmM]?)\s*(usd|eur|dollar|euro|تومان|toman|gold|گلد)/i);
  if (trailingMatch) {
    const curToken = trailingMatch[2].toLowerCase();
    const val = parseFloat(sanitizePriceInput(trailingMatch[1]));
    if (!isNaN(val) && val > 0) {
      let cur = 'USD';
      if (curToken.includes('eur') || curToken.includes('euro')) cur = 'EUR';
      else if (curToken.includes('تومان') || curToken.includes('toman')) cur = 'TOMAN';
      else if (curToken.includes('gold') || curToken.includes('گلد')) cur = 'GOLD';

      return {
        price: val,
        currency: cur,
      };
    }
  }

  // 3. Fallback: Standalone number with k/m suffix (e.g., 50k, 2.5m)
  const kmMatch = cleaned.match(/\b(\d+(?:[.,]\d+)?\s*[kKmM])\b/);
  if (kmMatch) {
    const val = parseFloat(sanitizePriceInput(kmMatch[1]));
    if (!isNaN(val) && val > 0) {
      return {
        price: val,
        currency: null,
      };
    }
  }

  return { price: null, currency: null };
}
