/**
 * ledgerQuery.js - pure helpers for querying the ledger.
 *
 * The storage layer uses these to build SQL for filtering, ordering and paging. Money is never
 * computed in SQL: every amount still goes through convertEntryCurrency / convertCurrency from
 * currencies.js, so rounding and rate rules stay in one place. The same module also holds a JS
 * reference filter (used by the IndexedDB fallback and by tests) so both paths share semantics.
 */

import { convertCurrency, convertEntryCurrency, STATUS_LABELS } from './currencies.js';
import { formatShamsiDate, normalizeDigits } from './persianCalendar.js';

export const DEFAULT_GAME = 'World of Warcraft';
export const SEARCH_DATE_OPTIONS = { month: 'long', day: 'numeric', year: 'numeric' };

// Normalizes a stored currency code the same way getAllEntries does (WOW_GOLD -> GOLD, unknown -> TOMAN)
const CURRENCY_SQL = "(CASE WHEN currency IN ('GOLD', 'WOW_GOLD') THEN 'GOLD' WHEN currency IN ('USD', 'EUR', 'TOMAN') THEN currency ELSE 'TOMAN' END)";
const GAME_SQL = `(CASE WHEN game IS NULL OR game = '' THEN '${DEFAULT_GAME}' ELSE game END)`;
const TEAMMATES_SQL = "(CASE WHEN json_valid(teammates) THEN teammates ELSE '[]' END)";
const STATUS_LABEL_SQL = "(CASE status WHEN 'Paid' THEN ? WHEN 'Pending' THEN ? WHEN 'Working' THEN ? WHEN 'On Hold' THEN ? WHEN 'Failed' THEN ? ELSE '' END)";

const STATUS_LABEL_PARAMS = [
  STATUS_LABELS.Paid,
  STATUS_LABELS.Pending,
  STATUS_LABELS.Working,
  STATUS_LABELS['On Hold'],
  STATUS_LABELS.Failed,
];

export const CURRENCY_SQL_EXPR = CURRENCY_SQL;
export const GAME_SQL_EXPR = GAME_SQL;

/** Index columns stored next to each entry: epoch ms for date filters/sorting, and the Persian date label for search. */
export function computeIndexColumns(dateTime) {
  const parsed = new Date(dateTime || 0).getTime();
  return {
    ts: Number.isNaN(parsed) ? 0 : parsed,
    date_label: dateTime ? formatShamsiDate(dateTime, SEARCH_DATE_OPTIONS) : '',
  };
}

/** Local-time [from, to) bounds for a date preset. `to` null means open-ended. */
export function dateRangeBounds(range, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (range) {
    case 'today':
      return { from: new Date(y, m, d).getTime(), to: null };
    case 'yesterday':
      return { from: new Date(y, m, d - 1).getTime(), to: new Date(y, m, d).getTime() };
    case 'week':
      return { from: new Date(y, m, d - 6).getTime(), to: null };
    case 'month':
      return { from: new Date(y, m, 1).getTime(), to: null };
    case 'last_month':
      return { from: new Date(y, m - 1, 1).getTime(), to: new Date(y, m, 1).getTime() };
    default:
      return null;
  }
}

/**
 * Normalizes the UI filter state. Mirrors the checks the ledger used to run in JS:
 * - search is trimmed and lowercased (blank means no search)
 * - status 'ALL' or empty means no status filter
 */
export function normalizeLedgerFilters(raw = {}) {
  return {
    search: typeof raw.search === 'string' ? raw.search.trim().toLowerCase() : '',
    currency: raw.currency || '',
    game: raw.game || '',
    hasProof: Boolean(raw.hasProof),
    teammate: raw.teammate ? String(raw.teammate).toLowerCase() : '',
    source: raw.source ? String(raw.source).toLowerCase() : '',
    settlement: raw.settlement || '',
    dateRange: raw.dateRange || '',
    status: raw.status && raw.status !== 'ALL' ? raw.status : '',
  };
}

/**
 * Builds the WHERE clause for normalized filters (see normalizeLedgerFilters).
 * Returns { where, params }; where is '' when no filter applies.
 * The status filter is intentionally NOT part of this clause: the ledger keeps the base
 * (non-status) set for metrics and status counts, and applies status in memory.
 */
export function buildLedgerWhere(filters, { includeStatus = false, now = new Date() } = {}) {
  const clauses = [];
  const params = [];

  if (filters.search) {
    const q = filters.search;
    const nq = normalizeDigits(q);
    clauses.push(`(
      instr(lower(COALESCE(title, '')), ?) > 0
      OR instr(lower(COALESCE(game, '')), ?) > 0
      OR instr(lower(COALESCE(source, '')), ?) > 0
      OR instr(lower(COALESCE(notes, '')), ?) > 0
      OR instr(lower(COALESCE(orderId, '')), ?) > 0
      OR instr(lower(COALESCE(status, '')), ?) > 0
      OR instr(${STATUS_LABEL_SQL}, ?) > 0
      OR EXISTS (SELECT 1 FROM json_each(${TEAMMATES_SQL}) j WHERE typeof(j.value) = 'text' AND instr(lower(j.value), ?) > 0)
      OR instr(COALESCE(dateTime, ''), ?) > 0
      OR instr(COALESCE(dateTime, ''), ?) > 0
      OR instr(COALESCE(date_label, ''), ?) > 0
      OR instr(COALESCE(date_label, ''), ?) > 0
    )`);
    // Placeholder order must match the SQL above: 6 text needles, 5 status-label params, then the
    // label needle, teammate needle, dateTime (raw, normalized digits), date_label (raw, normalized digits)
    params.push(q, q, q, q, q, q, ...STATUS_LABEL_PARAMS, q, q, q, nq, q, nq);
  }

  if (filters.currency) {
    clauses.push(`${CURRENCY_SQL} = ?`);
    params.push(filters.currency);
  }

  if (filters.game) {
    clauses.push(`${GAME_SQL} = ?`);
    params.push(filters.game);
  }

  if (filters.hasProof) {
    clauses.push('EXISTS (SELECT 1 FROM proof_attachments p WHERE p.entry_id = work_entries.id)');
  }

  if (filters.teammate) {
    clauses.push(`EXISTS (SELECT 1 FROM json_each(${TEAMMATES_SQL}) j WHERE typeof(j.value) = 'text' AND lower(j.value) = ?)`);
    params.push(filters.teammate);
  }

  if (filters.source) {
    clauses.push("lower(COALESCE(source, '')) = ?");
    params.push(filters.source);
  }

  switch (filters.settlement) {
    case 'received':
      clauses.push('COALESCE(sourcePaid, 0) <> 0');
      break;
    case 'pending':
      clauses.push('COALESCE(sourcePaid, 0) = 0');
      break;
    case 'booster_due':
      clauses.push('COALESCE(boosterPaid, 0) = 0');
      break;
    case 'booster_paid':
      clauses.push('COALESCE(boosterPaid, 0) <> 0');
      break;
    default:
      break;
  }

  const bounds = dateRangeBounds(filters.dateRange, now);
  if (bounds) {
    clauses.push('COALESCE(ts, 0) >= ?');
    params.push(bounds.from);
    if (bounds.to !== null) {
      clauses.push('COALESCE(ts, 0) < ?');
      params.push(bounds.to);
    }
  }

  if (includeStatus && filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }

  return { where: clauses.join(' AND '), params };
}

/** Columns read for the lightweight ledger index (everything the metrics and sorting need, nothing bulky). */
export const LEDGER_INDEX_SELECT = `
  id, status, dateTime, COALESCE(ts, 0) AS ts, income,
  ${CURRENCY_SQL} AS cur, exchangeRate, rateUnit, game, pot, sourcePaid, boosterPaid`;

/** Order for date sorts. Ties break on id so the order is deterministic everywhere. */
export function indexOrderSql(sortOption) {
  return sortOption === 'date_asc' ? 'COALESCE(ts, 0) ASC, id ASC' : 'COALESCE(ts, 0) DESC, id ASC';
}

/**
 * Normalizes one lightweight index row. Same rules getAllEntries applies to the fields used by
 * conversion and metrics (currency, rateUnit, exchangeRate default, pot), so results match full rows.
 */
export function normalizeLedgerIndexRow(r) {
  const cur = r.cur !== undefined ? r.cur : r.currency;
  const isClassic = r.rateUnit === '1' || r.game === 'World of Warcraft Classic';
  const defaultRate = isClassic ? 7000 : 3200;
  return {
    id: r.id,
    status: r.status,
    dateTime: r.dateTime,
    ts: Number(r.ts) || 0,
    income: Number(r.income) || 0,
    currency: cur,
    exchangeRate: Number(r.exchangeRate) > 0 ? Number(r.exchangeRate) : defaultRate,
    rateUnit: r.rateUnit || (isClassic ? '1' : '1k'),
    game: r.game,
    pot: r.pot !== null && r.pot !== undefined ? Number(r.pot) : null,
    sourcePaid: Boolean(r.sourcePaid),
    boosterPaid: Boolean(r.boosterPaid),
  };
}

/** Canonical date comparator: newest first (or oldest first), id as the tie-breaker. */
export function compareByDate(a, b, direction = 'desc') {
  if (a.ts !== b.ts) return direction === 'asc' ? a.ts - b.ts : b.ts - a.ts;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Sorts index rows for display. Date sorts use the canonical comparator; income sorts convert every
 * row with the same convertEntryCurrency the ledger always used, then break ties by date.
 */
export function sortLedgerRows(rows, sortOption, globalCurrency, rates) {
  if (sortOption === 'income_desc' || sortOption === 'income_asc') {
    const descending = sortOption === 'income_desc';
    const valued = rows.map((row) => ({ row, value: convertEntryCurrency(row, globalCurrency, rates) || 0 }));
    valued.sort((a, b) => {
      if (a.value !== b.value) return descending ? b.value - a.value : a.value - b.value;
      return compareByDate(a.row, b.row, 'desc');
    });
    return valued.map((v) => v.row);
  }
  const direction = sortOption === 'date_asc' ? 'asc' : 'desc';
  return [...rows].sort((a, b) => compareByDate(a, b, direction));
}

/**
 * Money summary for the metric cards. This is the exact formula the ledger used, moved here unchanged.
 * Rows should be passed in canonical date order so sums are deterministic.
 */
export function computeLedgerMetrics(rows, globalCurrency, rates) {
  let totalPaid = 0;
  let paidCount = 0;
  let totalPending = 0;
  let pendingCount = 0;
  let totalFailed = 0;
  let failedCount = 0;

  let grossVolume = 0;
  let pendingInflow = 0;
  let boosterPayouts = 0;

  rows.forEach((e) => {
    const convertedInc = convertEntryCurrency(e, globalCurrency, rates);
    const grossAmount = e.pot ? convertCurrency(e.pot, e.currency, globalCurrency, rates) : convertedInc;
    const payoutAmount = Math.max(0, grossAmount - convertedInc);

    if (e.status !== 'Failed') {
      grossVolume += grossAmount;
      boosterPayouts += payoutAmount;
      if (!e.sourcePaid) {
        pendingInflow += convertedInc;
      }
    }

    if (e.status === 'Paid') {
      totalPaid += convertedInc;
      paidCount++;
    } else if (e.status === 'Failed') {
      totalFailed += convertedInc;
      failedCount++;
    } else {
      totalPending += convertedInc;
      pendingCount++;
    }
  });

  const totalValue = totalPaid + totalPending + totalFailed;
  const completionRate =
    totalValue > 0
      ? Math.round((totalPaid / totalValue) * 100)
      : (rows.length > 0 ? Math.round((paidCount / rows.length) * 100) : 0);
  const payableJobsCount = rows.length - failedCount;
  const avgRate = payableJobsCount > 0 ? (totalPaid + totalPending) / payableJobsCount : 0;

  return {
    totalPaid,
    paidCount,
    totalPending,
    pendingCount,
    totalFailed,
    failedCount,
    totalValue,
    completionRate,
    avgRate,
    grossVolume,
    pendingInflow,
    boosterPayouts,
  };
}

/**
 * JS reference filter with the same semantics as buildLedgerWhere. Used by the IndexedDB fallback
 * and by tests that check the SQL matches it. `rows` need dateTime, title, game, source, notes,
 * orderId, status, teammates (array), proofs (array), currency, sourcePaid, boosterPaid, ts, date_label.
 */
export function filterLedgerRows(rows, filters, { now = new Date() } = {}) {
  const bounds = dateRangeBounds(filters.dateRange, now);
  const q = filters.search;
  const nq = q ? normalizeDigits(q) : '';
  const lowerIncludes = (value, needle) => typeof value === 'string' && value.toLowerCase().includes(needle);

  return rows.filter((e) => {
    if (filters.status && e.status !== filters.status) return false;
    if (q) {
      const statusLabel = STATUS_LABELS[e.status] || '';
      const matchTeammates = Array.isArray(e.teammates) && e.teammates.some((t) => lowerIncludes(t, q));
      const matchDate =
        (e.dateTime && (e.dateTime.includes(q) || e.dateTime.includes(nq))) ||
        (e.date_label && (e.date_label.includes(q) || e.date_label.includes(nq)));
      const hit =
        lowerIncludes(e.title, q) ||
        lowerIncludes(e.game, q) ||
        lowerIncludes(e.source, q) ||
        lowerIncludes(e.notes, q) ||
        lowerIncludes(e.orderId, q) ||
        lowerIncludes(e.status, q) ||
        lowerIncludes(statusLabel, q) ||
        matchTeammates ||
        Boolean(matchDate);
      if (!hit) return false;
    }
    if (filters.currency && e.currency !== filters.currency) return false;
    if (filters.game && (e.game || DEFAULT_GAME) !== filters.game) return false;
    if (filters.hasProof && !(e.proofs && e.proofs.length > 0)) return false;
    if (filters.teammate) {
      const hit = Array.isArray(e.teammates) && e.teammates.some((t) => typeof t === 'string' && t.toLowerCase() === filters.teammate);
      if (!hit) return false;
    }
    if (filters.source && !(typeof e.source === 'string' && e.source.toLowerCase() === filters.source)) return false;
    switch (filters.settlement) {
      case 'received':
        if (!e.sourcePaid) return false;
        break;
      case 'pending':
        if (e.sourcePaid) return false;
        break;
      case 'booster_due':
        if (e.boosterPaid) return false;
        break;
      case 'booster_paid':
        if (!e.boosterPaid) return false;
        break;
      default:
        break;
    }
    if (bounds) {
      const t = Number(e.ts) || 0;
      if (t < bounds.from) return false;
      if (bounds.to !== null && t >= bounds.to) return false;
    }
    return true;
  });
}
