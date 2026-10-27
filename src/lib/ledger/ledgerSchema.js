/**
 * ledgerSchema.js - v2 ledger tables, described once and used for SQLite DDL, row (de)serialising and the
 * IndexedDB store list. Column names equal the JS field names, so rows need no mapping.
 *
 * Column kinds: 'text' | 'int' | 'real' | 'json' (stored as TEXT). Every table has a text `id` primary key.
 */
export const LEDGER_SCHEMA_VERSION = 2;

export const LEDGER_TABLES = {
  parties: {
    columns: {
      kind: 'text', name: 'text', handle: 'text', defaultCurrency: 'text', note: 'text',
      // per-platform memory: default fee %, withdrawal fee rule (percent / flat / taken out of the payout)
      settings: 'json',
      archived: 'int', createdAt: 'text', updatedAt: 'text',
    },
    indexes: ['kind'],
  },
  orders: {
    columns: {
      legacyId: 'text', kind: 'text', title: 'text', game: 'text', source: 'text', orderRef: 'text',
      payerId: 'text', dateTime: 'text', lifecycle: 'text', currency: 'text',
      grossMinor: 'int', platformFeeMinor: 'int', feeType: 'text', feeRate: 'real',
      exchangeRate: 'real', rateUnit: 'text', note: 'text', link: 'text', expectedPayoutAt: 'text',
      createdAt: 'text', updatedAt: 'text',
      // the gold, USD and EUR rates of the day the order was logged; every total values the order with these
      rates: 'json',
    },
    indexes: ['payerId', 'dateTime', 'lifecycle', 'legacyId'],
  },
  order_shares: {
    columns: {
      orderId: 'text', partyId: 'text', amountMinor: 'int', state: 'text', note: 'text',
      // 'payer' = the client pays this teammate directly (no debt of mine); missing or 'me' = I pay them
      paidBy: 'text',
      createdAt: 'text', updatedAt: 'text',
    },
    indexes: ['orderId', 'partyId'],
  },
  payments: {
    columns: {
      direction: 'text', partyId: 'text', dateTime: 'text', amountMinor: 'int', currency: 'text',
      rates: 'json', kind: 'text', method: 'text', note: 'text', voidsPaymentId: 'text',
      // an expense that belongs to another payment (a withdrawal fee points at the payout it was taken from)
      relatedPaymentId: 'text',
      origin: 'text', legacyId: 'text', createdAt: 'text',
    },
    indexes: ['partyId', 'dateTime', 'voidsPaymentId'],
  },
  payment_allocations: {
    columns: {
      paymentId: 'text', targetType: 'text', targetId: 'text', appliedMinor: 'int', consumedMinor: 'int',
    },
    indexes: ['paymentId', 'targetId'],
  },
  // Screenshots for orders and payments. No foreign key: legacy proofs stay in proof_attachments and are
  // read through the order's legacyId, so nothing is duplicated during migration.
  ledger_proofs: {
    columns: { ownerType: 'text', ownerId: 'text', name: 'text', data: 'text', size: 'int', createdAt: 'text' },
    indexes: ['ownerId'],
  },
  ledger_flags: {
    columns: { orderId: 'text', code: 'text', detail: 'json', resolved: 'int', createdAt: 'text' },
    indexes: ['orderId'],
  },
  ledger_meta: {
    columns: { value: 'text' },
    indexes: [],
  },
};

export const LEDGER_TABLE_NAMES = Object.keys(LEDGER_TABLES);

const SQL_TYPE = { text: 'TEXT', int: 'INTEGER', real: 'REAL', json: 'TEXT' };

export function createTableSql(table) {
  const spec = LEDGER_TABLES[table];
  const cols = Object.entries(spec.columns).map(([c, k]) => `${c} ${SQL_TYPE[k]}`);
  return `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, ${cols.join(', ')});`;
}

export function createIndexSql(table) {
  return LEDGER_TABLES[table].indexes.map(
    (c) => `CREATE INDEX IF NOT EXISTS idx_${table}_${c} ON ${table}(${c});`,
  );
}

export const tableDdl = () => LEDGER_TABLE_NAMES.map(createTableSql);
export const indexDdl = () => LEDGER_TABLE_NAMES.flatMap(createIndexSql);

/** SQL to add one column that an older database does not have yet. Additive only: nothing is dropped or rewritten. */
export function addColumnSql(table, column) {
  return `ALTER TABLE ${table} ADD COLUMN ${column} ${SQL_TYPE[LEDGER_TABLES[table].columns[column]]};`;
}

/** Row object -> positional SQL params. json columns are serialised, undefined becomes null. */
export function rowToParams(table, row) {
  const spec = LEDGER_TABLES[table];
  const params = [row.id];
  for (const [c, kind] of Object.entries(spec.columns)) {
    const v = row[c];
    if (v === undefined || v === null) params.push(null);
    else if (kind === 'json') params.push(JSON.stringify(v));
    else if (kind === 'int') params.push(typeof v === 'boolean' ? Number(v) : Math.round(Number(v)));
    else params.push(v);
  }
  return params;
}

export function upsertSql(table, { ignore = false } = {}) {
  const cols = ['id', ...Object.keys(LEDGER_TABLES[table].columns)];
  return `INSERT OR ${ignore ? 'IGNORE' : 'REPLACE'} INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')});`;
}

/** SQL row -> JS object: json columns parsed, NULL turned back into undefined-free defaults. */
export function rowFromSql(table, row) {
  const spec = LEDGER_TABLES[table];
  const out = { id: row.id };
  for (const [c, kind] of Object.entries(spec.columns)) {
    let v = row[c];
    if (kind === 'json') {
      try { v = v === null || v === undefined ? null : JSON.parse(v); } catch { v = null; }
    }
    out[c] = v === undefined ? null : v;
  }
  return out;
}

// --- Validation of rows that come from outside (backup files) ----------------------------------------------

const LIFECYCLE_SET = new Set(['pending', 'working', 'on_hold', 'done', 'failed', 'disputed', 'refunded']);
const PAYMENT_KIND_SET = new Set(['settlement', 'advance', 'expense', 'refund', 'adjustment', 'writeoff']);
const CURRENCY_SET = new Set(['TOMAN', 'GOLD', 'USD', 'EUR']);
const PARTY_KIND_SET = new Set(['booster', 'client', 'platform', 'advertiser']);
const MAX_TEXT = 4000;
const MAX_PROOF = 8 * 1024 * 1024;
const REF_COLUMNS = new Set(['orderId', 'partyId', 'payerId', 'paymentId', 'targetId', 'voidsPaymentId', 'relatedPaymentId', 'ownerId', 'legacyId']);
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
const isInt = (v) => typeof v === 'number' && Number.isSafeInteger(v);

const rateOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e12 ? v : null);

/** An untrusted locked-rates object -> only the known rates, each a positive finite number; null when none survive. */
export function cleanRates(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const out = { goldRateTOMAN: rateOrNull(r.goldRateTOMAN), usdRateTOMAN: rateOrNull(r.usdRateTOMAN), eurRateUSD: rateOrNull(r.eurRateUSD) };
  if (r.isPerOneGold === true) out.isPerOneGold = true;
  return out.goldRateTOMAN || out.usdRateTOMAN || out.eurRateUSD ? out : null;
}

/**
 * Returns a cleaned copy of an untrusted row, or null when it cannot be trusted. Money fields must be safe
 * integers (a NaN or a string would silently corrupt every balance), enums must be known values, text is
 * capped, and proofs must be images. Unknown fields are dropped.
 */
export function sanitizeRow(table, row) {
  const spec = LEDGER_TABLES[table];
  if (!spec || !row || typeof row !== 'object' || !isId(row.id)) return null;
  const out = { id: row.id };
  for (const [col, kind] of Object.entries(spec.columns)) {
    const v = row[col];
    if (v === undefined || v === null) {
      out[col] = null;
      continue;
    }
    if (kind === 'text') {
      if (typeof v !== 'string') return null;
      if (table === 'ledger_proofs' && col === 'data') {
        if (v.length > MAX_PROOF) return null;
        out[col] = v;
      } else if (REF_COLUMNS.has(col)) {
        if (v.length > 200) return null; // a trimmed reference would point at the wrong record
        out[col] = v;
      } else {
        out[col] = v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) : v; // long notes are trimmed, the order is kept
      }
    } else if (kind === 'int') {
      const n = typeof v === 'boolean' ? Number(v) : v;
      if (!isInt(n)) return null;
      out[col] = n;
    } else if (kind === 'real') {
      if (typeof v !== 'number' || !Number.isFinite(v)) return null;
      out[col] = v;
    } else {
      // json: must serialise to something small
      try {
        if (JSON.stringify(v).length > MAX_TEXT * 4) return null;
      } catch {
        return null;
      }
      out[col] = v;
    }
  }
  // locked rates drive every converted total, so they are cleaned as strictly as amounts
  if ((table === 'orders' || table === 'payments') && out.rates !== null) out.rates = cleanRates(out.rates);
  const nonNeg = (k) => isInt(out[k]) && out[k] >= 0;
  switch (table) {
    case 'orders':
      if (!LIFECYCLE_SET.has(out.lifecycle) || !nonNeg('grossMinor') || !CURRENCY_SET.has(out.currency)) return null;
      if (out.platformFeeMinor !== null && (!nonNeg('platformFeeMinor') || out.platformFeeMinor > out.grossMinor)) return null;
      break;
    case 'order_shares':
      if (!isId(out.orderId) || !isId(out.partyId) || !nonNeg('amountMinor') || !['open', 'done', 'cancelled'].includes(out.state)) return null;
      if (out.paidBy !== 'payer') out.paidBy = null;
      break;
    case 'payments':
      if (!['in', 'out'].includes(out.direction) || !PAYMENT_KIND_SET.has(out.kind) || !isInt(out.amountMinor) || out.amountMinor <= 0 || !CURRENCY_SET.has(out.currency)) return null;
      break;
    case 'payment_allocations':
      if (!isId(out.paymentId) || !isId(out.targetId) || !['share', 'order'].includes(out.targetType) || !nonNeg('appliedMinor') || !nonNeg('consumedMinor')) return null;
      break;
    case 'parties':
      if (typeof out.name !== 'string' || !out.name.trim() || !PARTY_KIND_SET.has(out.kind)) return null;
      break;
    case 'ledger_proofs':
      if (!['order', 'payment'].includes(out.ownerType) || !isId(out.ownerId) || typeof out.data !== 'string' || !out.data.startsWith('data:image/')) return null;
      break;
    default:
  }
  return out;
}
