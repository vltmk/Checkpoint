/**
 * db.js - Unified Hybrid Storage Engine for CHECKPOINT
 * Automatically routes to SQLite in Tauri Desktop mode, or IndexedDB in Web Browser mode.
 * Features lazy-loaded proof attachments, WAL mode, and rolling snapshots.
 */

import { isTauri } from './desktop';
import { getAppVersion } from './updater';
import { buildStorageDiagnosticReport, toStorageError } from './storageDiagnostics';

const DB_NAME_IDB = 'CheckpointDB_v1';
const DB_VERSION_IDB = 1;
const STORE_ENTRIES = 'work_entries';
const STORE_SETTINGS = 'app_settings';
const STORE_SNAPSHOTS = 'db_snapshots';

const REQUIRED_WORK_ENTRY_COLUMNS = [
  'id', 'title', 'game', 'source', 'teamMode', 'teammates', 'income', 'currency',
  'exchangeRate', 'rateUnit', 'status', 'dateTime', 'hours', 'notes',
];

const WORK_ENTRY_COLUMN_MIGRATIONS = {
  source: "ALTER TABLE work_entries ADD COLUMN source TEXT DEFAULT 'Direct Client';",
  teamMode: 'ALTER TABLE work_entries ADD COLUMN teamMode INTEGER DEFAULT 0;',
  teammates: "ALTER TABLE work_entries ADD COLUMN teammates TEXT DEFAULT '[]';",
  exchangeRate: 'ALTER TABLE work_entries ADD COLUMN exchangeRate REAL DEFAULT 3200;',
  rateUnit: "ALTER TABLE work_entries ADD COLUMN rateUnit TEXT DEFAULT '1k';",
};

export class StorageDB {
  constructor() {
    this.sqliteDb = null;
    this.idb = null;
    this.isDesktop = isTauri();
    this.storageStatus = {
      driver: this.isDesktop ? 'sqlite' : 'indexeddb',
      state: 'initializing',
      schema: 'unknown',
      writable: 'unknown',
      integrity: 'unknown',
      lastOperation: null,
      lastError: null,
    };
    this.initPromise = this.init();
  }

  async init() {
    if (this.isDesktop) {
      return this.initDesktopStorage();
    }

    try {
      const db = await this.initIndexedDB();
      this.storageStatus = {
        ...this.storageStatus,
        driver: 'indexeddb',
        state: db ? 'ready' : 'unavailable',
        schema: db ? 'ready' : 'unknown',
        writable: db ? 'unknown' : 'unavailable',
      };
      return db;
    } catch (err) {
      this.recordStorageError(err, 'initialize_indexeddb');
      return null;
    }
  }

  async initDesktopStorage() {
    try {
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      this.sqliteDb = await Database.load('sqlite:checkpoint.db');
      await this.initSqliteSchema();
      await this.migrateLegacySqliteData(Database);
      await this.verifySqliteHealth();
      this.storageStatus = {
        ...this.storageStatus,
        driver: 'sqlite',
        state: 'ready',
        lastOperation: 'initialize',
        lastError: null,
      };
      return this.sqliteDb;
    } catch (err) {
      const storageError = this.recordStorageError(err, 'initialize');
      console.warn('Failed to initialize Tauri SQLite:', storageError.safeMessage);
      if (this.sqliteDb) {
        try {
          await this.sqliteDb.close();
        } catch (closeErr) {}
      }
      this.sqliteDb = null;
      return null;
    }
  }

  recordStorageError(error, operation) {
    const storageError = toStorageError(error, operation);
    this.storageStatus = {
      ...this.storageStatus,
      state: 'error',
      lastOperation: operation,
      lastError: {
        kind: storageError.kind,
        operation: storageError.operation,
        message: storageError.safeMessage,
      },
    };
    return storageError;
  }

  createUnavailableStorageError(operation) {
    return this.recordStorageError(
      new Error('Local database connection is unavailable.'),
      operation
    );
  }

  getStorageStatus() {
    return {
      ...this.storageStatus,
      lastError: this.storageStatus.lastError ? { ...this.storageStatus.lastError } : null,
    };
  }

  async retryStorage() {
    if (!this.isDesktop) {
      await this.initPromise;
      return this.getStorageStatus();
    }

    if (this.sqliteDb) {
      try {
        await this.verifySqliteHealth();
        this.storageStatus = {
          ...this.storageStatus,
          state: 'ready',
          lastOperation: 'retry_health_check',
          lastError: null,
        };
      } catch (err) {
        this.recordStorageError(err, 'retry_health_check');
      }
      return this.getStorageStatus();
    }

    this.storageStatus = {
      ...this.storageStatus,
      state: 'initializing',
      lastOperation: 'retry_initialize',
    };
    this.initPromise = this.initDesktopStorage();
    await this.initPromise;
    return this.getStorageStatus();
  }

  async getStorageDiagnostics() {
    await this.initPromise;
    let checks = {};

    if (this.isDesktop && this.sqliteDb) {
      checks = await this.collectSqliteDiagnosticChecks();
    }

    let appVersion = 'unknown';
    try {
      appVersion = await getAppVersion();
    } catch (err) {}

    return buildStorageDiagnosticReport({
      appVersion,
      status: this.getStorageStatus(),
      checks,
    });
  }

  /* =========================================================================
   * 1. SQLite Driver Implementation (Desktop)
   * ========================================================================= */

  async initSqliteSchema() {
    if (!this.sqliteDb) {
      throw new Error('Local database connection is unavailable.');
    }

    await this.sqliteDb.execute('PRAGMA journal_mode = WAL;');
    await this.sqliteDb.execute('PRAGMA synchronous = NORMAL;');
    await this.sqliteDb.execute('PRAGMA foreign_keys = ON;');

    // 1. Main work entries table (lightweight, rapid indexing)
    await this.sqliteDb.execute(`
      CREATE TABLE IF NOT EXISTS work_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        game TEXT NOT NULL,
        source TEXT DEFAULT 'Direct Client',
        teamMode INTEGER DEFAULT 0,
        teammates TEXT DEFAULT '[]',
        income REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'TOMAN',
        exchangeRate REAL DEFAULT 3200,
        rateUnit TEXT DEFAULT '1k',
        status TEXT NOT NULL DEFAULT 'Working',
        dateTime TEXT NOT NULL,
        hours REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    await this.ensureWorkEntryColumns();

    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_entries_datetime ON work_entries(dateTime DESC);`);
    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_entries_status ON work_entries(status);`);
    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_entries_game ON work_entries(game);`);

    // 2. Dedicated proof attachments table (lazy-loaded on demand)
    await this.sqliteDb.execute(`
      CREATE TABLE IF NOT EXISTS proof_attachments (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        name TEXT NOT NULL,
        data_blob TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES work_entries(id) ON DELETE CASCADE
      );
    `);

    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_proofs_entry_id ON proof_attachments(entry_id);`);

    // 3. Application settings & preferences table
    await this.sqliteDb.execute(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    // This single internal marker lets us prove that SQLite can still accept
    // writes without touching a user's ledger, settings, proofs, or snapshots.
    await this.sqliteDb.execute(`
      CREATE TABLE IF NOT EXISTS checkpoint_storage_health (
        id INTEGER PRIMARY KEY CHECK (id = 1)
      );
    `);

    // 4. Rolling snapshots archive table
    await this.sqliteDb.execute(`
      CREATE TABLE IF NOT EXISTS db_snapshots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        entries_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    await this.ensureWorkEntryColumns();
    this.storageStatus = {
      ...this.storageStatus,
      schema: 'ready',
    };
  }

  async ensureWorkEntryColumns() {
    const rows = await this.sqliteDb.select('PRAGMA table_info(work_entries);');
    const existingColumns = new Set((rows || []).map((column) => column.name));

    for (const [column, sql] of Object.entries(WORK_ENTRY_COLUMN_MIGRATIONS)) {
      if (!existingColumns.has(column)) {
        await this.sqliteDb.execute(sql);
        existingColumns.add(column);
      }
    }

    const missingColumns = REQUIRED_WORK_ENTRY_COLUMNS.filter((column) => !existingColumns.has(column));
    if (missingColumns.length > 0) {
      throw new Error(`work_entries schema is missing required columns: ${missingColumns.join(', ')}`);
    }
  }

  async verifySqliteHealth() {
    if (!this.sqliteDb) {
      throw new Error('Local database connection is unavailable.');
    }

    const integrityRows = await this.sqliteDb.select('PRAGMA integrity_check;');
    const integrityValue = String(Object.values(integrityRows?.[0] || {})[0] || '').toLowerCase();
    if (integrityValue !== 'ok') {
      throw new Error(`SQLite integrity check failed: ${integrityValue || 'no result'}`);
    }

    // tauri-plugin-sql exposes a connection pool, so a BEGIN / ROLLBACK pair
    // can land on different SQLite connections. A fixed internal marker is a
    // reliable write probe and never changes user-owned data.
    await this.sqliteDb.execute('INSERT OR REPLACE INTO checkpoint_storage_health (id) VALUES (1);');

    this.storageStatus = {
      ...this.storageStatus,
      schema: 'ready',
      integrity: 'ok',
      writable: 'yes',
    };
  }

  async collectSqliteDiagnosticChecks() {
    const checks = { integrity: 'unknown', writable: 'unknown' };
    if (!this.sqliteDb) return checks;

    try {
      const integrityRows = await this.sqliteDb.select('PRAGMA integrity_check;');
      const integrityValue = String(Object.values(integrityRows?.[0] || {})[0] || '').toLowerCase();
      checks.integrity = integrityValue === 'ok' ? 'ok' : 'failed';
    } catch (err) {
      checks.integrity = 'failed';
    }

    try {
      await this.sqliteDb.execute('INSERT OR REPLACE INTO checkpoint_storage_health (id) VALUES (1);');
      checks.writable = 'yes';
    } catch (err) {
      checks.writable = 'no';
    }

    return checks;
  }

  async migrateLegacySqliteData(Database) {
    if (!this.sqliteDb) return;

    const countRows = await this.sqliteDb.select('SELECT COUNT(*) as cnt FROM work_entries');
    const hasEntries = countRows && countRows[0] && countRows[0].cnt > 0;
    if (hasEntries) return;

    let legacyDb = null;
    try {
      legacyDb = await Database.load('sqlite:nodra_vault.db');
      if (!(await this.tableExists(legacyDb, 'work_entries'))) return;

      const legacyCount = await legacyDb.select('SELECT COUNT(*) as cnt FROM work_entries');
      if (!legacyCount?.[0]?.cnt) return;

      const oldEntries = await legacyDb.select('SELECT * FROM work_entries');
      for (const row of oldEntries) {
        await this.sqliteDb.execute(
          `INSERT OR IGNORE INTO work_entries (id, title, game, source, teamMode, teammates, income, currency, exchangeRate, rateUnit, status, dateTime, hours, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id, row.title, row.game, row.source || 'Direct Client',
            row.teamMode || 0, row.teammates || '[]', row.income || 0,
            row.currency || 'TOMAN', row.exchangeRate || 3200, row.rateUnit || '1k',
            row.status || 'Working', row.dateTime, row.hours || 0,
            row.notes || '', row.created_at || Math.floor(Date.now() / 1000), row.updated_at || Math.floor(Date.now() / 1000),
          ]
        );
      }

      if (await this.tableExists(legacyDb, 'proof_attachments')) {
        const oldProofs = await legacyDb.select('SELECT * FROM proof_attachments');
        for (const p of oldProofs) {
          await this.sqliteDb.execute(
            `INSERT OR IGNORE INTO proof_attachments (id, entry_id, name, data_blob, size, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [p.id, p.entry_id, p.name, p.data_blob, p.size || 0, p.created_at]
          );
        }
      }

      if (await this.tableExists(legacyDb, 'app_settings')) {
        const oldSettings = await legacyDb.select('SELECT * FROM app_settings');
        for (const setting of oldSettings) {
          await this.sqliteDb.execute(
            `INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`,
            [setting.key, setting.value, setting.updated_at || Math.floor(Date.now() / 1000)]
          );
        }
      }

      if (await this.tableExists(legacyDb, 'db_snapshots')) {
        const oldSnapshots = await legacyDb.select('SELECT * FROM db_snapshots');
        for (const snapshot of oldSnapshots) {
          await this.sqliteDb.execute(
            `INSERT OR IGNORE INTO db_snapshots (id, name, snapshot_json, entries_count, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [snapshot.id, snapshot.name, snapshot.snapshot_json, snapshot.entries_count || 0, snapshot.created_at]
          );
        }
      }
    } finally {
      if (legacyDb) {
        try {
          await legacyDb.close();
        } catch (err) {}
      }
    }
  }

  async tableExists(db, tableName) {
    const rows = await db.select(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
      [tableName]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  /* =========================================================================
   * 2. IndexedDB Driver Implementation (Browser Fallback)
   * ========================================================================= */

  async initIndexedDB() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME_IDB, DB_VERSION_IDB);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
          store.createIndex('dateTime', 'dateTime', { unique: false });
          store.createIndex('game', 'game', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.idb = event.target.result;
        resolve(this.idb);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /* =========================================================================
   * 3. Unified Work Entries API
   * ========================================================================= */

  async getAllEntries() {
    await this.initPromise;

    if (this.isDesktop && this.sqliteDb) {
      try {
        // Fast lightweight query with proof metadata
        const rows = await this.sqliteDb.select(`
          SELECT 
            w.id, w.title, w.game, w.source, w.teamMode, w.teammates, w.income, w.currency, w.exchangeRate, w.rateUnit, w.status, w.dateTime, w.hours, w.notes,
            COUNT(p.id) as proof_count
          FROM work_entries w
          LEFT JOIN proof_attachments p ON w.id = p.entry_id
          GROUP BY w.id
          ORDER BY w.dateTime DESC
        `);

        return rows.map((r) => {
          let cur = r.currency;
          if (cur === 'WOW_GOLD') cur = 'GOLD';
          if (!['USD', 'TOMAN', 'GOLD'].includes(cur)) cur = 'TOMAN';
          const isClassic = r.rateUnit === '1' || r.game === 'World of Warcraft Classic';
          const defaultRate = isClassic ? 7000 : 3200;

          let parsedTeammates = [];
          try {
            if (typeof r.teammates === 'string') parsedTeammates = JSON.parse(r.teammates);
            else if (Array.isArray(r.teammates)) parsedTeammates = r.teammates;
          } catch (e) {}

          return {
            ...r,
            source: r.source || 'Direct Client',
            teamMode: Boolean(r.teamMode),
            teammates: parsedTeammates,
            currency: cur,
            exchangeRate: Number(r.exchangeRate) > 0 ? Number(r.exchangeRate) : defaultRate,
            rateUnit: r.rateUnit || (isClassic ? '1' : '1k'),
            proofs: Array(r.proof_count || 0).fill({}), // Proof count placeholder for quick list
          };
        });
      } catch (err) {
        console.error('SQLite getAllEntries error:', err);
        return [];
      }
    }

    // Browser IndexedDB Fallback
    if (!this.idb) return [];
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readonly');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const normalized = results.map((entry) => {
          let cur = entry.currency;
          if (cur === 'WOW_GOLD') cur = 'GOLD';
          if (!['USD', 'TOMAN', 'GOLD'].includes(cur)) cur = 'TOMAN';
          const isClassic = entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic';
          const defaultRate = isClassic ? 7000 : 3200;
          return {
            ...entry,
            source: entry.source || 'Direct Client',
            teamMode: Boolean(entry.teamMode),
            teammates: Array.isArray(entry.teammates) ? entry.teammates : [],
            currency: cur,
            exchangeRate: Number(entry.exchangeRate) > 0 ? Number(entry.exchangeRate) : defaultRate,
            rateUnit: entry.rateUnit || (isClassic ? '1' : '1k'),
          };
        });
        normalized.sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0));
        resolve(normalized);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getEntry(id) {
    await this.initPromise;
    if (!id) return null;

    if (this.isDesktop && this.sqliteDb) {
      try {
        const rows = await this.sqliteDb.select('SELECT * FROM work_entries WHERE id = ? LIMIT 1', [id]);
        if (!rows || rows.length === 0) return null;

        const entry = { ...rows[0] };
        if (entry.currency === 'WOW_GOLD') entry.currency = 'GOLD';
        if (!['USD', 'TOMAN', 'GOLD'].includes(entry.currency)) entry.currency = 'TOMAN';

        const isClassic = entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic';
        const defaultRate = isClassic ? 7000 : 3200;
        entry.source = entry.source || 'Direct Client';
        entry.exchangeRate = Number(entry.exchangeRate) > 0 ? Number(entry.exchangeRate) : defaultRate;
        entry.rateUnit = entry.rateUnit || (isClassic ? '1' : '1k');

        try {
          if (typeof entry.teammates === 'string') entry.teammates = JSON.parse(entry.teammates);
          else if (!Array.isArray(entry.teammates)) entry.teammates = [];
        } catch (e) {
          entry.teammates = [];
        }
        entry.teamMode = Boolean(entry.teamMode);

        // Fetch full proofs attachments
        const proofRows = await this.sqliteDb.select(
          'SELECT id, name, data_blob as data, size, created_at as createdAt FROM proof_attachments WHERE entry_id = ? ORDER BY created_at ASC',
          [id]
        );
        entry.proofs = proofRows || [];
        return entry;
      } catch (err) {
        console.error('SQLite getEntry error:', err);
        return null;
      }
    }

    // Browser IndexedDB Fallback
    if (!this.idb) return null;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readonly');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.get(id);

      request.onsuccess = () => {
        const entry = request.result || null;
        if (entry) {
          if (entry.currency === 'WOW_GOLD') entry.currency = 'GOLD';
          if (!['USD', 'TOMAN', 'GOLD'].includes(entry.currency)) entry.currency = 'TOMAN';
          const isClassic = entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic';
          const defaultRate = isClassic ? 7000 : 3200;
          entry.source = entry.source || 'Direct Client';
          entry.teamMode = Boolean(entry.teamMode);
          entry.teammates = Array.isArray(entry.teammates) ? entry.teammates : [];
          entry.exchangeRate = Number(entry.exchangeRate) > 0 ? Number(entry.exchangeRate) : defaultRate;
          entry.rateUnit = entry.rateUnit || (isClassic ? '1' : '1k');
        }
        resolve(entry);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async saveEntry(entry) {
    await this.initPromise;
    if (!entry || !entry.id) return entry;

    let cleanEntry = { ...entry };
    if (cleanEntry.currency === 'WOW_GOLD') cleanEntry.currency = 'GOLD';
    if (!['USD', 'TOMAN', 'GOLD'].includes(cleanEntry.currency)) cleanEntry.currency = 'TOMAN';

    const isClassic = cleanEntry.rateUnit === '1' || cleanEntry.game === 'World of Warcraft Classic';
    const defaultRate = isClassic ? 7000 : 3200;
    const finalRate = Number(cleanEntry.exchangeRate) > 0 ? Number(cleanEntry.exchangeRate) : defaultRate;
    const finalUnit = cleanEntry.rateUnit || (isClassic ? '1' : '1k');
    const finalSource = cleanEntry.source || 'Direct Client';
    const teammatesJson = JSON.stringify(cleanEntry.teammates || []);
    const teamModeInt = cleanEntry.teamMode ? 1 : 0;

    cleanEntry.exchangeRate = finalRate;
    cleanEntry.rateUnit = finalUnit;
    cleanEntry.source = finalSource;

    if (this.isDesktop) {
      if (!this.sqliteDb) {
        throw this.createUnavailableStorageError('save_entry');
      }

      try {
        await this.sqliteDb.execute(
          `INSERT OR REPLACE INTO work_entries (id, title, game, source, teamMode, teammates, income, currency, exchangeRate, rateUnit, status, dateTime, hours, notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
          [
            cleanEntry.id,
            cleanEntry.title || 'Untitled Work',
            cleanEntry.game || 'World of Warcraft',
            finalSource,
            teamModeInt,
            teammatesJson,
            Number(cleanEntry.income) || 0,
            cleanEntry.currency,
            finalRate,
            finalUnit,
            cleanEntry.status || 'Working',
            cleanEntry.dateTime || new Date().toISOString(),
            Number(cleanEntry.hours) || 0,
            cleanEntry.notes || '',
          ]
        );

        // Sync proof attachments
        if (Array.isArray(cleanEntry.proofs)) {
          await this.sqliteDb.execute('DELETE FROM proof_attachments WHERE entry_id = ?', [cleanEntry.id]);
          for (const p of cleanEntry.proofs) {
            if (p && (p.data || p.data_blob)) {
              await this.sqliteDb.execute(
                `INSERT INTO proof_attachments (id, entry_id, name, data_blob, size, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  p.id || 'proof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                  cleanEntry.id,
                  p.name || 'Screenshot Proof',
                  p.data || p.data_blob,
                  Number(p.size) || 0,
                  p.createdAt || new Date().toISOString(),
                ]
              );
            }
          }
        }
        this.storageStatus = {
          ...this.storageStatus,
          state: 'ready',
          writable: 'yes',
          lastOperation: 'save_entry',
          lastError: null,
        };
        return cleanEntry;
      } catch (err) {
        const storageError = this.recordStorageError(err, 'save_entry');
        console.error('SQLite saveEntry error:', storageError.safeMessage);
        throw storageError;
      }
    }

    // Browser IndexedDB Fallback
    if (!this.idb) return cleanEntry;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.put(cleanEntry);

      request.onsuccess = () => resolve(cleanEntry);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteEntry(id) {
    await this.initPromise;
    if (!id) return false;

    if (this.isDesktop && this.sqliteDb) {
      try {
        await this.sqliteDb.execute('DELETE FROM proof_attachments WHERE entry_id = ?', [id]);
        await this.sqliteDb.execute('DELETE FROM work_entries WHERE id = ?', [id]);
        return true;
      } catch (err) {
        console.error('SQLite deleteEntry error:', err);
        return false;
      }
    }

    // Browser IndexedDB Fallback
    if (!this.idb) return false;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async bulkDeleteEntries(ids) {
    await this.initPromise;
    if (!Array.isArray(ids) || ids.length === 0) return false;

    if (this.isDesktop && this.sqliteDb) {
      try {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const chunk = ids.slice(i, i + CHUNK_SIZE);
          const placeholders = chunk.map(() => '?').join(',');
          await this.sqliteDb.execute(`DELETE FROM proof_attachments WHERE entry_id IN (${placeholders})`, chunk);
          await this.sqliteDb.execute(`DELETE FROM work_entries WHERE id IN (${placeholders})`, chunk);
        }
        return true;
      } catch (err) {
        console.error('SQLite bulkDeleteEntries error:', err);
        return false;
      }
    }

    // Browser IndexedDB Fallback
    if (!this.idb) return false;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      ids.forEach((id) => store.delete(id));

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);
    });
  }

  async bulkUpdateStatus(ids, nextStatus) {
    await this.initPromise;
    if (!Array.isArray(ids) || ids.length === 0 || !nextStatus) return false;

    if (this.isDesktop && this.sqliteDb) {
      try {
        const CHUNK_SIZE = 400;
        const nowSec = Math.floor(Date.now() / 1000);
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const chunk = ids.slice(i, i + CHUNK_SIZE);
          const placeholders = chunk.map(() => '?').join(',');
          await this.sqliteDb.execute(
            `UPDATE work_entries SET status = ?, updated_at = ? WHERE id IN (${placeholders})`,
            [nextStatus, nowSec, ...chunk]
          );
        }
        return true;
      } catch (err) {
        console.error('SQLite bulkUpdateStatus error:', err);
        return false;
      }
    }

    // Browser IndexedDB Fallback
    if (!this.idb) return false;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      ids.forEach((id) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const entry = getReq.result;
          if (entry) {
            entry.status = nextStatus;
            entry.updatedAt = new Date().toISOString();
            store.put(entry);
          }
        };
      });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);
    });
  }

  async bulkImport(entries) {
    await this.initPromise;
    if (!Array.isArray(entries)) return false;

    for (const entry of entries) {
      if (entry && entry.id) {
        await this.saveEntry(entry);
      }
    }
    return true;
  }

  async clearAll(purgeSnapshots = false) {
    await this.initPromise;

    if (this.isDesktop && this.sqliteDb) {
      try {
        await this.sqliteDb.execute('DELETE FROM proof_attachments');
        await this.sqliteDb.execute('DELETE FROM work_entries');
        if (purgeSnapshots) {
          try {
            await this.sqliteDb.execute('DELETE FROM db_snapshots');
          } catch (e) {}
        }
        return true;
      } catch (err) {
        console.error('SQLite clearAll error:', err);
        return false;
      }
    }

    if (!this.idb) return false;
    return new Promise((resolve, reject) => {
      const stores = purgeSnapshots && this.idb.objectStoreNames.contains(STORE_SNAPSHOTS)
        ? [STORE_ENTRIES, STORE_SNAPSHOTS]
        : [STORE_ENTRIES];
      const transaction = this.idb.transaction(stores, 'readwrite');
      stores.forEach((s) => transaction.objectStore(s).clear());

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);
    });
  }

  /* =========================================================================
   * 4. Settings & Key-Value Persistence
   * ========================================================================= */

  async getSetting(key, fallback = null) {
    await this.initPromise;

    const legacyKeyMap = {
      checkpoint_currency: 'nodrapay_currency',
      checkpoint_gold_rate_toman: 'nodrapay_gold_rate_toman',
      checkpoint_tab: 'nodrapay_tab',
      checkpoint_last_auto_snapshot_date: 'vault_last_auto_snapshot_date',
      checkpoint_quick_last_game: 'vault_quick_last_game',
      checkpoint_quick_last_custom_game: 'vault_quick_last_custom_game',
      checkpoint_quick_last_source: 'vault_quick_last_source',
      checkpoint_quick_last_currency: 'vault_quick_last_currency',
      checkpoint_work_draft: 'vault_work_draft',
      checkpoint_user_saved_sources_v2: 'vault_user_saved_sources_v2',
      checkpoint_user_saved_sources: 'vault_user_saved_sources_v2',
      checkpoint_saved_teammates_v1: 'vault_saved_teammates_v1',
      checkpoint_analytics_timeframe: 'vault_analytics_timeframe',
      checkpoint_close_to_tray: 'nodrapay_close_to_tray',
      checkpoint_minimize_to_tray: 'nodrapay_minimize_to_tray',
      checkpoint_language: 'nodrapay_language',
      checkpoint_v2_seeded: 'nodrapay_v2_seeded',
    };

    const keysToTry = [key];
    if (legacyKeyMap[key]) {
      keysToTry.push(legacyKeyMap[key]);
    }

    for (const k of keysToTry) {
      if (this.isDesktop && this.sqliteDb) {
        try {
          const rows = await this.sqliteDb.select('SELECT value FROM app_settings WHERE key = ? LIMIT 1', [k]);
          if (rows && rows.length > 0) {
            try {
              return JSON.parse(rows[0].value);
            } catch (e) {
              return rows[0].value;
            }
          }
        } catch (err) {
          console.error('SQLite getSetting error:', err);
        }
      }

      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(k);
        if (val !== null) {
          try {
            return JSON.parse(val);
          } catch (e) {
            return val;
          }
        }
      }
    }

    return fallback;
  }

  async setSetting(key, value) {
    await this.initPromise;
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);

    if (this.isDesktop && this.sqliteDb) {
      try {
        await this.sqliteDb.execute(
          `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, strftime('%s', 'now'))`,
          [key, strVal]
        );
      } catch (err) {
        console.error('SQLite setSetting error:', err);
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, strVal);
    }
  }

  /* =========================================================================
   * 5. Rolling Snapshots & Auto-Backup
   * ========================================================================= */

  async autoCreateDailySnapshot() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lastSnapKey = 'checkpoint_last_auto_snapshot_date';
      const lastDate = await this.getSetting(lastSnapKey, '');

      if (lastDate !== today) {
        await this.createSnapshot(`Daily Snapshot (${today})`);
        await this.setSetting(lastSnapKey, today);
      }
    } catch (e) {
      console.warn('Auto snapshot skipped:', e);
    }
  }

  async createSnapshot(name) {
    await this.initPromise;
    try {
      // Get all entries with full proofs
      const entries = await this.getAllEntriesFull();
      const version = await getAppVersion();
      const snapshot = {
        app: 'CHECKPOINT',
        version: version || '0.0.0',
        timestamp: new Date().toISOString(),
        entries,
      };

      const id = 'snap_' + Date.now();
      const snapName = name || `Backup ${new Date().toLocaleString()}`;

      if (this.isDesktop && this.sqliteDb) {
        await this.sqliteDb.execute(
          `INSERT INTO db_snapshots (id, name, snapshot_json, entries_count, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [id, snapName, JSON.stringify(snapshot), entries.length, new Date().toISOString()]
        );

        // Keep maximum 5 latest snapshots
        await this.sqliteDb.execute(`
          DELETE FROM db_snapshots WHERE id NOT IN (
            SELECT id FROM db_snapshots ORDER BY created_at DESC LIMIT 5
          )
        `);
      }
      return true;
    } catch (err) {
      console.error('Failed to create snapshot:', err);
      return false;
    }
  }

  async listSnapshots() {
    await this.initPromise;
    if (this.isDesktop && this.sqliteDb) {
      try {
        return await this.sqliteDb.select(`
          SELECT id, name, entries_count, created_at 
          FROM db_snapshots 
          ORDER BY created_at DESC
        `);
      } catch (err) {
        return [];
      }
    }
    return [];
  }

  async restoreSnapshot(id) {
    await this.initPromise;
    if (!id) return false;

    if (this.isDesktop && this.sqliteDb) {
      try {
        const rows = await this.sqliteDb.select('SELECT snapshot_json FROM db_snapshots WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          const snapshot = JSON.parse(rows[0].snapshot_json);
          if (snapshot && Array.isArray(snapshot.entries)) {
            await this.clearAll();
            await this.bulkImport(snapshot.entries);
            return true;
          }
        }
      } catch (err) {
        console.error('Failed to restore snapshot:', err);
      }
    }
    return false;
  }

  async getAllEntriesFull() {
    await this.initPromise;
    if (this.isDesktop && this.sqliteDb) {
      try {
        const entries = await this.getAllEntries();
        if (!entries || entries.length === 0) return [];

        const proofRows = await this.sqliteDb.select(
          'SELECT id, entry_id, name, data_blob as data, size, created_at as createdAt FROM proof_attachments ORDER BY created_at ASC'
        );

        const proofMap = new Map();
        if (Array.isArray(proofRows)) {
          for (const p of proofRows) {
            if (!proofMap.has(p.entry_id)) {
              proofMap.set(p.entry_id, []);
            }
            proofMap.get(p.entry_id).push(p);
          }
        }

        return entries.map((entry) => ({
          ...entry,
          proofs: proofMap.get(entry.id) || [],
        }));
      } catch (err) {
        console.error('SQLite getAllEntriesFull batch error:', err);
        return this.getAllEntries();
      }
    }

    // IndexedDB fallback (already preserves complete object in STORE_ENTRIES)
    return this.getAllEntries();
  }
}

export const trackerDB = new StorageDB();

if (typeof window !== 'undefined' && import.meta.env && import.meta.env.DEV) {
  window.trackerDB = trackerDB;
}
