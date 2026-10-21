/**
 * ledgerBackends.js - two tiny adapters with one async interface, so the store and tests don't care
 * whether rows live in SQLite (desktop) or IndexedDB (web fallback).
 *
 *   ensureSchema()                      create tables / stores if missing
 *   selectAll(table)                    every row, as JS objects
 *   upsert(table, row, { ignore })      insert or replace (ignore: keep the existing row)
 *   remove(table, id)
 *   removeWhere(table, field, value)
 *   count(table)
 */
import {
  LEDGER_TABLE_NAMES,
  LEDGER_TABLES,
  addColumnSql,
  indexDdl,
  tableDdl,
  rowToParams,
  rowFromSql,
  upsertSql,
} from './ledgerSchema.js';

/** `db` follows tauri-plugin-sql: execute(sql, params) and select(sql, params). */
export function createSqliteBackend(db) {
  return {
    kind: 'sqlite',
    async ensureSchema() {
      for (const sql of tableDdl()) await db.execute(sql);
      // A database made by an earlier version lacks columns added since. Add them in place (additive only),
      // before the indexes that may refer to them.
      for (const table of LEDGER_TABLE_NAMES) {
        const have = new Set(((await db.select(`PRAGMA table_info(${table})`)) || []).map((c) => c.name));
        for (const column of Object.keys(LEDGER_TABLES[table].columns)) {
          if (!have.has(column)) await db.execute(addColumnSql(table, column));
        }
      }
      for (const sql of indexDdl()) await db.execute(sql);
    },
    async selectAll(table) {
      const rows = await db.select(`SELECT * FROM ${table}`);
      return (rows || []).map((r) => rowFromSql(table, r));
    },
    async selectWhere(table, field, value) {
      if (!(field in LEDGER_TABLES[table].columns)) throw new Error(`Unknown column ${table}.${field}`);
      const rows = await db.select(`SELECT * FROM ${table} WHERE ${field} = ?`, [value]);
      return (rows || []).map((r) => rowFromSql(table, r));
    },
    async upsert(table, row, { ignore = false } = {}) {
      await db.execute(upsertSql(table, { ignore }), rowToParams(table, row));
    },
    async remove(table, id) {
      await db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    },
    async removeWhere(table, field, value) {
      if (!(field in LEDGER_TABLES[table].columns)) throw new Error(`Unknown column ${table}.${field}`);
      await db.execute(`DELETE FROM ${table} WHERE ${field} = ?`, [value]);
    },
    async count(table) {
      const rows = await db.select(`SELECT COUNT(*) AS n FROM ${table}`);
      return Number(rows?.[0]?.n) || 0;
    },
    async clear(table) {
      await db.execute(`DELETE FROM ${table}`);
    },
  };
}

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Object stores are created by db.js in onupgradeneeded (see createLedgerIdbStores). */
export function createLedgerIdbStores(idb) {
  for (const t of LEDGER_TABLE_NAMES) {
    if (!idb.objectStoreNames.contains(t)) idb.createObjectStore(t, { keyPath: 'id' });
  }
}

export function createIdbBackend(idb) {
  const store = (table, mode) => idb.transaction([table], mode).objectStore(table);
  return {
    kind: 'indexeddb',
    async ensureSchema() {
      const missing = LEDGER_TABLE_NAMES.filter((t) => !idb.objectStoreNames.contains(t));
      if (missing.length) throw new Error(`IndexedDB is missing ledger stores: ${missing.join(', ')}`);
    },
    async selectAll(table) {
      return (await idbRequest(store(table, 'readonly').getAll())) || [];
    },
    async selectWhere(table, field, value) {
      const rows = (await idbRequest(store(table, 'readonly').getAll())) || [];
      return rows.filter((r) => r[field] === value);
    },
    async upsert(table, row, { ignore = false } = {}) {
      const s = store(table, 'readwrite');
      if (ignore && (await idbRequest(s.get(row.id))) !== undefined) return;
      await idbRequest(s.put(row));
    },
    async remove(table, id) {
      await idbRequest(store(table, 'readwrite').delete(id));
    },
    async removeWhere(table, field, value) {
      const rows = await idbRequest(store(table, 'readonly').getAll());
      for (const r of rows || []) {
        if (r[field] === value) await idbRequest(store(table, 'readwrite').delete(r.id));
      }
    },
    async count(table) {
      return idbRequest(store(table, 'readonly').count());
    },
    async clear(table) {
      await idbRequest(store(table, 'readwrite').clear());
    },
  };
}
