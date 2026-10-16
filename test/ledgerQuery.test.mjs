// Parity tests: the SQL ledger query must return the same rows, in the same order, with the same
// money summary as the JS reference path that the ledger used before. Runs against node:sqlite,
// which is SQLite as well, so the SQL dialect is exercised for real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  computeIndexColumns,
  normalizeLedgerFilters,
  buildLedgerWhere,
  LEDGER_INDEX_SELECT,
  indexOrderSql,
  normalizeLedgerIndexRow,
  sortLedgerRows,
  computeLedgerMetrics,
  filterLedgerRows,
  compareByDate,
} from '../src/lib/ledgerQuery.js';
import { convertEntryCurrency } from '../src/lib/currencies.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 95000, eurRateUSD: 1.08 };

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ['Boost', 'Raid', 'داش', 'Mythic', 'گلد', 'order', 'طلا', 'Quest', 'پرداخت', 'client', 'Daily', 'Failed'];
const STATUSES = ['Paid', 'Pending', 'Working', 'On Hold', 'Failed'];
const CURRENCIES = ['TOMAN', 'GOLD', 'USD', 'EUR', 'WOW_GOLD', 'BOGUS', null];
const GAMES = ['World of Warcraft', 'World of Warcraft Classic', '', null, 'Diablo IV', 'Elden Ring'];
const TEAM_NAMES = ['Ali', 'ali', 'Reza', 'بهنام', 'Zed'];

function localIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function makeFixtures(count, seed) {
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const rows = [];
  for (let i = 0; i < count; i++) {
    const when = new Date(2024, 0, 1 + Math.floor(r() * 720), Math.floor(r() * 24), Math.floor(r() * 60));
    const dateTime = r() < 0.7 ? localIso(when) : when.toISOString();
    const teamCount = Math.floor(r() * 3);
    const teammates = Array.from({ length: teamCount }, () => pick(TEAM_NAMES));
    const incomeRaw = r() < 0.08 ? 0 : Math.round(r() * 1e6) / (r() < 0.5 ? 1 : 100);
    const pot = r() < 0.5 ? null : (r() < 0.2 ? 0 : Math.round(r() * 2e6) / 100);
    rows.push({
      id: `job_${String(i).padStart(5, '0')}_${Math.floor(r() * 1e6)}`,
      title: r() < 0.1 ? '' : Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(WORDS)).join(' '),
      game: pick(GAMES),
      source: r() < 0.5 ? pick(['Alpha', 'beta', 'گیم سرور', 'ALPHA', '']) : '',
      teammates: JSON.stringify(teammates),
      notes: r() < 0.3 ? pick(WORDS) : '',
      orderId: r() < 0.3 ? `#${i}` : '',
      status: pick(STATUSES),
      currency: pick(CURRENCIES),
      income: incomeRaw,
      exchangeRate: pick([null, 0, 3200, 7000, 2750.5, 95000]),
      rateUnit: pick(['1k', '1', null, '']),
      pot,
      sourcePaid: r() < 0.5 ? 1 : 0,
      boosterPaid: r() < 0.5 ? 1 : 0,
      dateTime,
      proofCount: pick([0, 0, 1, 2]),
    });
  }
  return rows;
}

function normalizeCurrency(c) {
  if (c === 'WOW_GOLD') return 'GOLD';
  return ['USD', 'EUR', 'TOMAN', 'GOLD'].includes(c) ? c : 'TOMAN';
}

function openDb(fixtures) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE work_entries (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, game TEXT NOT NULL, source TEXT DEFAULT '',
      teamMode INTEGER DEFAULT 0, teammates TEXT DEFAULT '[]', income REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TOMAN', exchangeRate REAL DEFAULT 3200, rateUnit TEXT DEFAULT '1k',
      status TEXT NOT NULL DEFAULT 'Working', dateTime TEXT NOT NULL, notes TEXT DEFAULT '',
      orderId TEXT DEFAULT '', pot REAL DEFAULT NULL, sourcePaid INTEGER DEFAULT 0,
      boosterPaid INTEGER DEFAULT 0, ts INTEGER, date_label TEXT
    );
    CREATE TABLE proof_attachments (id TEXT PRIMARY KEY, entry_id TEXT, name TEXT, data_blob TEXT, size INTEGER, created_at TEXT);
  `);
  const insert = db.prepare(`INSERT INTO work_entries (id, title, game, source, teammates, income, currency, exchangeRate, rateUnit, status, dateTime, notes, orderId, pot, sourcePaid, boosterPaid, ts, date_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertProof = db.prepare('INSERT INTO proof_attachments (id, entry_id, name, data_blob, size, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  for (const f of fixtures) {
    const idx = computeIndexColumns(f.dateTime);
    // NOT NULL columns in the app schema: a missing currency is stored as '' and normalizes to TOMAN
    insert.run(f.id, f.title, f.game ?? 'World of Warcraft', f.source, f.teammates, f.income, f.currency ?? '', f.exchangeRate, f.rateUnit, f.status, f.dateTime, f.notes, f.orderId, f.pot, f.sourcePaid, f.boosterPaid, idx.ts, idx.date_label);
    for (let p = 0; p < f.proofCount; p++) insertProof.run(`${f.id}_p${p}`, f.id, 'shot', 'x', 1, '2025-01-01');
  }
  return db;
}

// Full rows as the reference path sees them (fields the JS filter and metrics read)
function referenceRows(fixtures) {
  return fixtures.map((f) => {
    const idx = computeIndexColumns(f.dateTime);
    const base = {
      id: f.id,
      title: f.title,
      game: f.game ?? 'World of Warcraft',
      source: f.source,
      notes: f.notes,
      orderId: f.orderId,
      status: f.status,
      dateTime: f.dateTime,
      teammates: JSON.parse(f.teammates),
      proofs: Array(f.proofCount).fill({}),
      ts: idx.ts,
      date_label: idx.date_label,
    };
    return {
      ...base,
      ...normalizeLedgerIndexRow({
        id: f.id,
        status: f.status,
        dateTime: f.dateTime,
        ts: idx.ts,
        income: f.income,
        currency: normalizeCurrency(f.currency),
        exchangeRate: f.exchangeRate,
        rateUnit: f.rateUnit,
        game: base.game,
        pot: f.pot,
        sourcePaid: f.sourcePaid,
        boosterPaid: f.boosterPaid,
      }),
    };
  });
}

function randomFilters(r, pick) {
  return normalizeLedgerFilters({
    search: r() < 0.5 ? '' : pick(['boost', 'RAID', 'گلد', '۲۰۲۴', '2025', 'ali', '#12', 'paid', 'پرداخت', 'Failed', 'Ali', '  ', 'daily', 'طلا', 'xyz', 'comp']),
    currency: r() < 0.3 ? pick(['TOMAN', 'GOLD', 'USD', 'EUR']) : '',
    game: r() < 0.3 ? pick(['World of Warcraft', 'Diablo IV', 'Elden Ring', 'World of Warcraft Classic']) : '',
    hasProof: r() < 0.2,
    teammate: r() < 0.2 ? pick(['ali', 'Reza', 'بهنام', 'zed']) : '',
    source: r() < 0.2 ? pick(['alpha', 'BETA', 'گیم سرور']) : '',
    settlement: r() < 0.2 ? pick(['received', 'pending', 'booster_due', 'booster_paid']) : '',
    dateRange: r() < 0.3 ? pick(['today', 'yesterday', 'week', 'month', 'last_month']) : '',
    status: r() < 0.3 ? pick(['Paid', 'Pending', 'ALL', 'Failed', 'Working']) : '',
  });
}

function runSql(db, filters, { includeStatus, now, sortOption }) {
  const { where, params } = buildLedgerWhere(filters, { includeStatus, now });
  const sql = `SELECT ${LEDGER_INDEX_SELECT} FROM work_entries ${where ? `WHERE ${where}` : ''} ORDER BY ${indexOrderSql(sortOption)}`;
  return db.prepare(sql).all(...params).map(normalizeLedgerIndexRow);
}

const fixtures = makeFixtures(1200, 20240601);
const db = openDb(fixtures);
const refAll = referenceRows(fixtures);

test('SQL normalization of every row matches the JS normalization', () => {
  const sqlAll = db.prepare(`SELECT ${LEDGER_INDEX_SELECT} FROM work_entries ORDER BY id`).all().map(normalizeLedgerIndexRow);
  const refIndexed = refAll.map((r) => normalizeLedgerIndexRow({ ...r, cur: r.currency })).sort((a, b) => (a.id < b.id ? -1 : 1));
  assert.deepEqual(sqlAll, refIndexed);
});

test('filtered SQL rows and order match the JS reference for random filter combinations', () => {
  const r = rng(77);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const sorts = ['date_desc', 'date_asc', 'income_desc', 'income_asc'];
  const nows = [new Date(2025, 5, 15, 13, 37), new Date(2024, 2, 3, 9, 0), new Date(2025, 11, 31, 23, 59)];

  let nonEmpty = 0;
  for (let n = 0; n < 300; n++) {
    const filters = randomFilters(r, pick);
    const now = pick(nows);
    const sortOption = pick(sorts);
    const includeStatus = r() < 0.5;

    const sqlRows = runSql(db, filters, { includeStatus, now, sortOption: 'date_desc' });
    const refRows = filterLedgerRows(refAll, includeStatus ? filters : { ...filters, status: '' }, { now });
    const refMatched = refRows.map((row) => normalizeLedgerIndexRow({ ...row, cur: row.currency }));

    const sqlIds = sortLedgerRows(sqlRows, sortOption, 'TOMAN', RATES).map((row) => row.id);
    const refIds = sortLedgerRows(refMatched, sortOption, 'TOMAN', RATES).map((row) => row.id);
    assert.deepEqual(sqlIds, refIds, `case ${n} ${JSON.stringify({ filters, sortOption, includeStatus })}`);
    if (sqlIds.length > 0) nonEmpty++;
  }
  // Guard against a vacuous pass: most random filter combinations must return rows
  assert.ok(nonEmpty > 150, `only ${nonEmpty} non-empty cases`);
});

test('metric cards are identical whether computed from SQL rows or from full JS rows', () => {
  const r = rng(991);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  for (let n = 0; n < 120; n++) {
    const filters = randomFilters(r, pick);
    const now = new Date(2025, 5, 15, 13, 37);
    const target = pick(['TOMAN', 'GOLD', 'USD', 'EUR']);
    const sqlRows = runSql(db, filters, { includeStatus: false, now, sortOption: 'date_desc' });
    const refRows = filterLedgerRows(refAll, { ...filters, status: '' }, { now }).map((row) => normalizeLedgerIndexRow({ ...row, cur: row.currency }));
    const canonical = (rows) => [...rows].sort((a, b) => compareByDate(a, b, 'desc'));
    const fromSql = computeLedgerMetrics(canonical(sqlRows), target, RATES);
    const fromRef = computeLedgerMetrics(canonical(refRows), target, RATES);
    assert.deepEqual(fromSql, fromRef, `case ${n} target ${target}`);
  }
});

test('per-row conversions are exactly the existing convertEntryCurrency results', () => {
  const sqlRows = db.prepare(`SELECT ${LEDGER_INDEX_SELECT} FROM work_entries`).all().map(normalizeLedgerIndexRow);
  const refById = new Map(refAll.map((row) => [row.id, row]));
  for (const row of sqlRows) {
    const ref = refById.get(row.id);
    for (const target of ['TOMAN', 'GOLD', 'USD', 'EUR']) {
      assert.equal(
        convertEntryCurrency(row, target, RATES),
        convertEntryCurrency(ref, target, RATES),
        `row ${row.id} -> ${target}`
      );
    }
  }
});

test('search matches Persian dates and digits the same way the ledger did', () => {
  const persianDate = computeIndexColumns('2025-06-15T13:37').date_label;
  assert.ok(persianDate.length > 0, 'date label is produced');
  const now = new Date(2025, 5, 15);
  for (const term of [persianDate.split(' ')[0], '۲۰۲۵', '2025-06', 'پرداخت', 'تکمیل شده']) {
    const filters = normalizeLedgerFilters({ search: term });
    const sqlRows = runSql(db, filters, { includeStatus: false, now, sortOption: 'date_desc' });
    const refRows = filterLedgerRows(refAll, filters, { now }).map((row) => normalizeLedgerIndexRow({ ...row, cur: row.currency }));
    const sqlIds = sortLedgerRows(sqlRows, 'date_desc', 'TOMAN', RATES).map((x) => x.id);
    const refIds = sortLedgerRows(refRows, 'date_desc', 'TOMAN', RATES).map((x) => x.id);
    assert.deepEqual(sqlIds, refIds, `search term ${term}`);
  }
});
