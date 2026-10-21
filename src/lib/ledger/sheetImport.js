/**
 * sheetImport.js - turn a pasted Google Sheets / Excel / CSV table into v2 ledger records. Pure.
 *
 * Shape expected: one row per order (or per order-and-booster; rows sharing an Order ID are merged into one order
 * with several shares). Columns are matched by header name in English or Farsi and can be remapped by the user.
 * Ids are derived from the row's content, so importing the same sheet twice adds nothing the second time.
 */
import { parseAmountShorthand, toMinor, normalizeCurrency } from './money.js';
import { partyIdFor, slug } from './legacyMapper.js';
import { jalaliToDate, getJalaliMonthDays } from '../persianCalendar.js';

export const IMPORT_FIELDS = ['date', 'title', 'orderRef', 'platform', 'price', 'currency', 'fee', 'booster', 'boosterAmount', 'status', 'collected', 'boosterPaid', 'game'];

const SYNONYMS = {
  date: ['date', 'day', 'when', 'تاریخ', 'روز'],
  title: ['title', 'order', 'service', 'description', 'item', 'job', 'task', 'عنوان', 'سفارش', 'سرویس', 'شرح', 'توضیحات'],
  orderRef: ['order id', 'order no', 'order number', 'order #', 'ref', 'reference', 'id', 'شماره سفارش', 'کد سفارش', 'شناسه'],
  platform: ['platform', 'source', 'site', 'marketplace', 'client', 'customer', 'from', 'پلتفرم', 'منبع', 'سایت', 'مشتری'],
  price: ['price', 'total', 'amount', 'gross', 'order price', 'sale', 'revenue', 'قیمت', 'مبلغ', 'مبلغ کل', 'فروش'],
  currency: ['currency', 'cur', 'unit', 'ارز', 'واحد'],
  fee: ['fee', 'platform fee', 'commission', 'کارمزد', 'کمیسیون'],
  booster: ['booster', 'worker', 'player', 'assigned', 'who', 'بوستر', 'کارگر', 'بازیکن'],
  boosterAmount: ['booster pay', 'booster payout', 'payout', 'cut', 'share', 'pay', 'booster amount', 'سهم', 'سهم بوستر', 'دستمزد', 'پرداختی به بوستر'],
  status: ['status', 'state', 'وضعیت'],
  collected: ['paid by client', 'client paid', 'received', 'collected', 'payment received', 'دریافت شد', 'پرداخت مشتری', 'دریافتی'],
  boosterPaid: ['booster paid', 'paid out', 'paid to booster', 'settled', 'پرداخت به بوستر', 'تسویه'],
  game: ['game', 'بازی'],
};

const YES = new Set(['yes', 'y', 'true', '1', 'paid', 'done', '✓', '✔', 'x', 'بله', 'آره', 'پرداخت شد', 'پرداخت‌شده', 'دریافت شد']);
const LIFE = [
  [/(done|complete|completed|finished|paid|delivered|انجام|تمام|تکمیل)/i, 'done'],
  [/(progress|working|active|doing|started|در حال)/i, 'working'],
  [/(hold|paused|متوقف)/i, 'on_hold'],
  [/(fail|cancel|refund|لغو|ناموفق)/i, 'failed'],
  [/(pending|new|queue|waiting|در انتظار)/i, 'pending'],
];

// --- parsing -----------------------------------------------------------------------------------------------

/** Parse delimited text (tab from Sheets, or comma/semicolon from CSV), honouring quotes and embedded newlines. */
export function parseDelimited(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const count = (ch) => firstLine.split(ch).length - 1;
  const delimiter = count('\t') > 0 ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') inQuotes = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return { rows: rows.map((r) => r.map((c) => c.trim())), delimiter };
}

const norm = (h) => String(h || '').toLowerCase().replace(/[_\-./]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Guess which column holds which field from the header row. Returns { field: columnIndex | null }. */
export function suggestMapping(headers) {
  const used = new Set();
  const out = {};
  const normalized = headers.map(norm);
  // exact synonym first, so "Order ID" is not swallowed by the looser "order" -> title match
  for (const pass of ['exact', 'contains']) {
    for (const field of IMPORT_FIELDS) {
      if (out[field] !== undefined && out[field] !== null) continue;
      const idx = normalized.findIndex((h, i) => !used.has(i) && SYNONYMS[field].some((s) => (pass === 'exact' ? h === s : h.length > 1 && h.includes(s))));
      if (idx >= 0) { out[field] = idx; used.add(idx); } else out[field] = null;
    }
  }
  return out;
}

// --- cell parsers ------------------------------------------------------------------------------------------

const DIGITS = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const latin = (s) => String(s).replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d]);

/** "$1,234.50", "۳٬۰۰۰٬۰۰۰ تومان", "250k" -> number, or null. */
export function parseMoneyCell(cell) {
  if (cell === null || cell === undefined) return null;
  const cleaned = latin(String(cell)).replace(/[$€£]|usd|eur|toman|تومان|gold|گلد|\s*[gG]$/gi, ' ').trim();
  if (!cleaned) return null;
  const v = parseAmountShorthand(cleaned.replace(/^\((.*)\)$/, '$1'));
  return v === null ? null : v;
}

export function detectCurrency(cell, fallback) {
  const s = latin(String(cell || '')).toLowerCase();
  if (/\$|usd|dollar|دلار/.test(s)) return 'USD';
  if (/€|eur|euro|یورو/.test(s)) return 'EUR';
  if (/gold|گلد|^g$/.test(s)) return 'GOLD';
  if (/toman|تومان|irt|rial/.test(s)) return 'TOMAN';
  return fallback ? normalizeCurrency(fallback) : null;
}

/** ISO, M/D/Y, D/M/Y or Shamsi (13xx/14xx). `order` resolves ambiguity: 'mdy' | 'dmy'. Returns an ISO string or null. */
export function parseDateCell(cell, order = 'mdy') {
  const s = latin(String(cell || '')).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y >= 1300 && y < 1500) {
      // Shamsi: month 1-12 and a day that exists in that month (Date would silently roll 13/45 into a later year)
      if (mo < 1 || mo > 12 || d < 1 || d > getJalaliMonthDays(y, mo)) return null;
      return jalaliToDate(y, mo, d, 12, 0).toISOString();
    }
    return gregorian(y, mo, d);
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 100) y += 2000;
    const [mo, d] = order === 'dmy' ? [b, a] : [a, b];
    return gregorian(y, mo, d);
  }
  // Free text like "Oct 5, 2026" is only trusted when it names a month; bare numbers are not dates
  if (!/[a-z]/i.test(s)) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** A real calendar date or null: Date.UTC would roll 2026-13-45 over into 2027, so the parts must survive a round trip. */
function gregorian(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0));
  const ok = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  return ok ? dt.toISOString() : null;
}

/** Guess D/M/Y vs M/D/Y: any first part above 12 means day first. */
export function detectDateOrder(cells) {
  for (const c of cells) {
    const m = latin(String(c || '')).match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (m && Number(m[1]) > 12) return 'dmy';
  }
  return 'mdy';
}

export const parseLifecycle = (cell, fallback = 'working') => {
  const s = String(cell || '').trim();
  if (!s) return fallback;
  for (const [re, life] of LIFE) if (re.test(s)) return life;
  return fallback;
};

export const parseYes = (cell) => YES.has(String(cell || '').trim().toLowerCase());

// --- building records --------------------------------------------------------------------------------------

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const PLATFORM_NAMES = ['g2g', 'funpay', 'eldorado', 'playerauctions', 'chicksgold'];

/**
 * @param rows data rows (header already removed)
 * @param mapping { field: columnIndex | null }
 * @param opts { defaultCurrency, dateOrder, now }
 * @returns { records, warnings: [{ row, code }], stats: { rows, orders, skipped } }
 */
export function buildImport(rows, mapping, { defaultCurrency = 'USD', dateOrder = 'mdy', now = new Date().toISOString() } = {}) {
  const cell = (r, f) => (mapping[f] === null || mapping[f] === undefined ? '' : r[mapping[f]] ?? '');
  const parties = new Map();
  const orders = new Map();
  const shares = new Map();
  const payments = [];
  const allocations = [];
  const warnings = [];
  const seenKeys = new Map();
  let skipped = 0;

  const ensureParty = (kind, name) => {
    const id = partyIdFor(kind, name);
    if (!parties.has(id)) parties.set(id, { id, kind, name: name.trim(), archived: 0, createdAt: now, updatedAt: now });
    return id;
  };

  rows.forEach((r, i) => {
    const rowNo = i + 2; // 1-based, header is row 1
    const title = String(cell(r, 'title')).trim();
    const orderRef = String(cell(r, 'orderRef')).trim();
    const priceMajor = parseMoneyCell(cell(r, 'price'));
    const boosterName = String(cell(r, 'booster')).trim();
    const boosterMajor = parseMoneyCell(cell(r, 'boosterAmount'));

    if (!title && !orderRef && priceMajor === null) { skipped++; return; } // blank-ish row
    const currency = detectCurrency(`${cell(r, 'currency')} ${cell(r, 'price')}`, defaultCurrency);
    const dateIso = parseDateCell(cell(r, 'date'), dateOrder);
    if (cell(r, 'date') && !dateIso) warnings.push({ row: rowNo, code: 'bad_date' });

    // rows with the same order id are one order with several boosters
    const baseKey = orderRef ? `ref:${slug(orderRef)}` : `row:${slug(title)}|${dateIso || ''}|${priceMajor ?? ''}|${slug(String(cell(r, 'platform')))}`;
    const occurrence = orderRef ? 0 : (seenKeys.get(baseKey) || 0);
    if (!orderRef) seenKeys.set(baseKey, occurrence + 1);
    const orderId = `imp_${hash(baseKey + '#' + occurrence)}`;

    let order = orders.get(orderId);
    if (!order) {
      if (priceMajor === null) { warnings.push({ row: rowNo, code: 'no_price' }); skipped++; return; }
      const platformName = String(cell(r, 'platform')).trim();
      const kind = PLATFORM_NAMES.some((p) => slug(platformName).replace(/[^a-z0-9]/g, '').includes(p)) ? 'platform' : 'client';
      const payerId = platformName ? ensureParty(kind, platformName) : null;
      const grossMinor = toMinor(priceMajor, currency);
      const feeCell = String(cell(r, 'fee')).trim();
      let feeMinor = 0;
      if (feeCell) {
        const isPct = feeCell.includes('%');
        const fv = parseMoneyCell(feeCell.replace('%', ''));
        feeMinor = fv === null ? 0 : isPct ? Math.round((grossMinor * fv) / 100) : toMinor(fv, currency);
        if (fv === null) warnings.push({ row: rowNo, code: 'bad_fee' });
        if (feeMinor > grossMinor) { feeMinor = 0; warnings.push({ row: rowNo, code: 'fee_over_price' }); }
      }
      order = {
        id: orderId, kind: 'income', title, game: String(cell(r, 'game')).trim(), source: platformName, orderRef,
        payerId, dateTime: dateIso || now, lifecycle: parseLifecycle(cell(r, 'status')), currency,
        grossMinor, platformFeeMinor: feeMinor, note: '', link: '', createdAt: now, updatedAt: now,
        _collected: parseYes(cell(r, 'collected')),
      };
      orders.set(orderId, order);
    }

    if (boosterName) {
      const partyId = ensureParty('booster', boosterName);
      const shareId = `imp_s_${hash(orderId + partyId)}`;
      const amountMinor = boosterMajor === null ? 0 : toMinor(boosterMajor, order.currency);
      if (boosterMajor === null) warnings.push({ row: rowNo, code: 'no_booster_amount' });
      if (!shares.has(shareId)) {
        shares.set(shareId, { id: shareId, orderId, partyId, amountMinor, state: order.lifecycle === 'done' ? 'done' : order.lifecycle === 'failed' ? 'cancelled' : 'open', note: '', createdAt: now, updatedAt: now, _paid: parseYes(cell(r, 'boosterPaid')) });
      } else {
        warnings.push({ row: rowNo, code: 'duplicate_booster' });
      }
    }
  });

  // flags and synthetic payments from the yes/no columns
  const outShares = [...shares.values()];
  for (const o of orders.values()) {
    const live = outShares.filter((s) => s.orderId === o.id);
    const total = live.reduce((s, x) => s + x.amountMinor, 0);
    if (total > o.grossMinor - o.platformFeeMinor) warnings.push({ row: 0, code: 'shares_exceed_price', orderId: o.id });
    if (o._collected && o.lifecycle !== 'failed' && o.payerId) {
      const amount = o.grossMinor - o.platformFeeMinor;
      if (amount > 0) {
        const pid = `imp_p_in_${hash(o.id)}`;
        payments.push({ id: pid, direction: 'in', partyId: o.payerId, dateTime: o.dateTime, amountMinor: amount, currency: o.currency, rates: null, kind: 'settlement', note: '', origin: 'imported', createdAt: now });
        allocations.push({ id: `imp_a_in_${hash(o.id)}`, paymentId: pid, targetType: 'order', targetId: o.id, appliedMinor: amount, consumedMinor: amount });
      }
    }
  }
  for (const s of outShares) {
    const o = orders.get(s.orderId);
    if (s._paid && s.amountMinor > 0 && o.lifecycle !== 'failed') {
      const pid = `imp_p_out_${hash(s.id)}`;
      payments.push({ id: pid, direction: 'out', partyId: s.partyId, dateTime: o.dateTime, amountMinor: s.amountMinor, currency: o.currency, rates: null, kind: 'settlement', note: '', origin: 'imported', createdAt: now });
      allocations.push({ id: `imp_a_out_${hash(s.id)}`, paymentId: pid, targetType: 'share', targetId: s.id, appliedMinor: s.amountMinor, consumedMinor: s.amountMinor });
    }
  }

  const strip = ({ _collected, _paid, ...rest }) => rest;
  return {
    records: {
      parties: [...parties.values()],
      orders: [...orders.values()].map(strip),
      shares: outShares.map(strip),
      payments,
      allocations,
      proofs: [],
      flags: [],
    },
    warnings,
    stats: { rows: rows.length, orders: orders.size, skipped },
  };
}
