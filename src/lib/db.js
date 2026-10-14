/**
 * db.js - Unified Hybrid Storage Engine for CHECKPOINT
 * Automatically routes to SQLite in Tauri Desktop mode, or IndexedDB in Web Browser mode.
 * Features lazy-loaded proof attachments, WAL mode, and rolling snapshots.
 */

import { isTauri } from './desktop';
import { getAppVersion } from './updater';
import {
  buildStorageDiagnosticReport,
  STORAGE_ERROR_KINDS,
  STORAGE_INITIALIZATION_STAGES,
  toStorageError,
} from './storageDiagnostics';
import {
  closeSqlitePool,
  migrateLegacySqliteData as runLegacySqliteMigration,
  SQLITE_MAIN_PATH,
} from './sqliteMigration';
import { getActiveProfileId, PROFILES, SHARED_SYNC_SETTING_KEYS } from './profiles';

const DB_NAME_IDB = 'CheckpointDB_v1';
const DB_VERSION_IDB = 1;
const STORE_ENTRIES = 'work_entries';
const STORE_SETTINGS = 'app_settings';
const STORE_SNAPSHOTS = 'db_snapshots';

const REQUIRED_WORK_ENTRY_COLUMNS = [
  'id', 'title', 'game', 'source', 'teamMode', 'teammates', 'income', 'currency',
  'exchangeRate', 'rateUnit', 'status', 'dateTime', 'hours', 'notes', 'link',
  'pot', 'teamInputMode', 'teammateCuts', 'teammateNotes', 'orderId', 'feeRate', 'sourcePaid',
  'feeType', 'boosterPaid', 'platformFee',
];

const WORK_ENTRY_COLUMN_MIGRATIONS = {
  source: "ALTER TABLE work_entries ADD COLUMN source TEXT DEFAULT '';",
  teamMode: 'ALTER TABLE work_entries ADD COLUMN teamMode INTEGER DEFAULT 0;',
  teammates: "ALTER TABLE work_entries ADD COLUMN teammates TEXT DEFAULT '[]';",
  exchangeRate: 'ALTER TABLE work_entries ADD COLUMN exchangeRate REAL DEFAULT 3200;',
  rateUnit: "ALTER TABLE work_entries ADD COLUMN rateUnit TEXT DEFAULT '1k';",
  link: "ALTER TABLE work_entries ADD COLUMN link TEXT DEFAULT '';",
  pot: 'ALTER TABLE work_entries ADD COLUMN pot REAL DEFAULT NULL;',
  teamInputMode: "ALTER TABLE work_entries ADD COLUMN teamInputMode TEXT DEFAULT 'pot';",
  teammateCuts: "ALTER TABLE work_entries ADD COLUMN teammateCuts TEXT DEFAULT '{}';",
  teammateNotes: "ALTER TABLE work_entries ADD COLUMN teammateNotes TEXT DEFAULT '{}';",
  orderId: "ALTER TABLE work_entries ADD COLUMN orderId TEXT DEFAULT '';",
  feeRate: 'ALTER TABLE work_entries ADD COLUMN feeRate REAL DEFAULT NULL;',
  sourcePaid: 'ALTER TABLE work_entries ADD COLUMN sourcePaid INTEGER DEFAULT 0;',
  feeType: "ALTER TABLE work_entries ADD COLUMN feeType TEXT DEFAULT 'percent';",
  boosterPaid: 'ALTER TABLE work_entries ADD COLUMN boosterPaid INTEGER DEFAULT 0;',
  platformFee: 'ALTER TABLE work_entries ADD COLUMN platformFee REAL DEFAULT 0;',
};

export class StorageDB {
  constructor() {
    this.sqliteDb = null;
    this.sqliteDbs = {};
    this.idb = null;
    this.idbDbs = {};
    this.isDesktop = isTauri();
    this.activeProfile = getActiveProfileId();
    this.storageStatus = {
      driver: this.isDesktop ? 'sqlite' : 'indexeddb',
      state: 'initializing',
      initializationState: 'initializing',
      initializationStage: STORAGE_INITIALIZATION_STAGES.LOAD,
      initializationError: null,
      schema: 'unknown',
      writable: 'unknown',
      integrity: 'unknown',
      lastOperation: null,
      lastError: null,
    };
    this.initPromise = this.init();
    this.retryPromise = null;
    this._switchPromise = null;
  }

  getActiveProfile() {
    return this.activeProfile || 'booster';
  }

  getSqliteDbPath() {
    const profile = PROFILES[this.activeProfile] || PROFILES.booster;
    return profile.dbPath || SQLITE_MAIN_PATH;
  }

  getSqliteDbPathForProfile(profileId) {
    const pid = profileId || this.activeProfile || 'booster';
    const profile = PROFILES[pid] || PROFILES.booster;
    return profile.dbPath || SQLITE_MAIN_PATH;
  }

  getIdbDatabaseName() {
    return this.activeProfile === 'advertiser' ? 'CheckpointDB_advertiser_v1' : DB_NAME_IDB;
  }

  getIdbDatabaseNameForProfile(profileId) {
    const pid = profileId || this.activeProfile || 'booster';
    return pid === 'advertiser' ? 'CheckpointDB_advertiser_v1' : DB_NAME_IDB;
  }

  async switchProfile(profileId) {
    if (!PROFILES[profileId]) {
      return this.getStorageStatus();
    }

    // Serialize profile switching to eliminate concurrent switch race conditions
    const currentSwitch = (async () => {
      if (this._switchPromise) {
        try {
          await this._switchPromise;
        } catch (e) {}
      }

      if (this.activeProfile === profileId && (this.isDesktop ? this.sqliteDb : this.idb)) {
        return this.getStorageStatus();
      }

      this.activeProfile = profileId;

      if (this.isDesktop) {
        if (this.sqliteDbs[profileId]) {
          this.sqliteDb = this.sqliteDbs[profileId];
          this.storageStatus = {
            ...this.storageStatus,
            driver: 'sqlite',
            state: 'ready',
            initializationState: 'ready',
            initializationStage: STORAGE_INITIALIZATION_STAGES.READY,
            initializationError: null,
            lastOperation: 'switch_profile',
            lastError: null,
          };
        } else {
          this.initPromise = this.initDesktopStorage(profileId);
          await this.initPromise;
        }
      } else {
        if (this.idbDbs[profileId]) {
          this.idb = this.idbDbs[profileId];
          this.storageStatus = {
            ...this.storageStatus,
            driver: 'indexeddb',
            state: 'ready',
            initializationState: 'ready',
            initializationStage: STORAGE_INITIALIZATION_STAGES.READY,
            initializationError: null,
            lastOperation: 'switch_profile',
            lastError: null,
          };
        } else {
          this.initPromise = this.initIndexedDB(profileId);
          await this.initPromise;
        }
      }

      await this.syncSharedSettings().catch(() => {});
      return this.getStorageStatus();
    })();

    this._switchPromise = currentSwitch;
    try {
      return await currentSwitch;
    } finally {
      if (this._switchPromise === currentSwitch) {
        this._switchPromise = null;
      }
    }
  }

  async syncSharedSettings() {
    if (typeof localStorage === 'undefined') return;
    for (const key of SHARED_SYNC_SETTING_KEYS) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try {
          const parsed = JSON.parse(val);
          await this.setSetting(key, parsed);
        } catch (e) {
          await this.setSetting(key, val);
        }
      }
    }
  }

  async getProfileCounts() {
    await this.initPromise;
    const counts = { booster: 0, advertiser: 0 };
    if (this.isDesktop) {
      try {
        for (const pid of ['booster', 'advertiser']) {
          if (this.sqliteDbs[pid]) {
            try {
              const res = await this.sqliteDbs[pid].select('SELECT COUNT(*) as cnt FROM work_entries');
              counts[pid] = res?.[0]?.cnt || 0;
            } catch (e) {
              counts[pid] = 0;
            }
          } else {
            try {
              // Pre-warm into cache without closing the pool
              const db = await this.initDesktopStorage(pid);
              if (db) {
                const res = await db.select('SELECT COUNT(*) as cnt FROM work_entries');
                counts[pid] = res?.[0]?.cnt || 0;
              }
            } catch (e) {
              counts[pid] = 0;
            }
          }
        }
      } catch (err) {}
    } else if (typeof indexedDB !== 'undefined') {
      try {
        for (const pid of ['booster', 'advertiser']) {
          const db = this.idbDbs[pid] || (await this.initIndexedDB(pid).catch(() => null));
          if (db && db.objectStoreNames.contains(STORE_ENTRIES)) {
            counts[pid] = await new Promise((resolve) => {
              try {
                const tx = db.transaction(STORE_ENTRIES, 'readonly');
                const countReq = tx.objectStore(STORE_ENTRIES).count();
                countReq.onsuccess = () => resolve(countReq.result || 0);
                countReq.onerror = () => resolve(0);
              } catch (e) {
                resolve(0);
              }
            });
          }
        }
      } catch (e) {}
    }
    return counts;
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
        initializationState: db ? 'ready' : 'error',
        initializationStage: db ? STORAGE_INITIALIZATION_STAGES.READY : STORAGE_INITIALIZATION_STAGES.LOAD,
        initializationError: null,
        schema: db ? 'ready' : 'unknown',
        writable: db ? 'unknown' : 'unavailable',
      };
      return db;
    } catch (err) {
      this.recordStorageError(err, 'initialize_indexeddb');
      return null;
    }
  }

  async initDesktopStorage(profileId = null) {
    const targetProfile = profileId || this.activeProfile || 'booster';

    // If already cached and open, switch/return directly
    if (this.sqliteDbs[targetProfile]) {
      if (targetProfile === this.activeProfile) {
        this.sqliteDb = this.sqliteDbs[targetProfile];
      }
      return this.sqliteDbs[targetProfile];
    }

    let stage = STORAGE_INITIALIZATION_STAGES.LOAD;
    if (targetProfile === this.activeProfile) {
      this.setInitializationStage(stage);
    }

    const dbPath = this.getSqliteDbPathForProfile(targetProfile);

    try {
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      const db = await Database.load(dbPath);

      // Temporarily bind this.sqliteDb to db so schema and verification methods operate on it
      const prevActiveDb = this.sqliteDb;
      this.sqliteDb = db;

      stage = STORAGE_INITIALIZATION_STAGES.SCHEMA;
      if (targetProfile === this.activeProfile) {
        this.setInitializationStage(stage);
      }
      await this.initSqliteSchema();

      // Legacy SQLite migration only on the canonical booster DB
      if (targetProfile === 'booster') {
        stage = STORAGE_INITIALIZATION_STAGES.LEGACY_MIGRATION;
        if (targetProfile === this.activeProfile) {
          this.setInitializationStage(stage);
        }
        await this.migrateLegacySqliteData(Database);
      }
      await this.verifySqliteConnection();

      stage = STORAGE_INITIALIZATION_STAGES.INTEGRITY_CHECK;
      if (targetProfile === this.activeProfile) {
        this.setInitializationStage(stage);
      }
      await this.verifySqliteIntegrity();

      stage = STORAGE_INITIALIZATION_STAGES.WRITABILITY_CHECK;
      if (targetProfile === this.activeProfile) {
        this.setInitializationStage(stage);
      }
      await this.verifySqliteWritability();

      this.sqliteDbs[targetProfile] = db;
      if (targetProfile === this.activeProfile) {
        this.sqliteDb = db;
        this.storageStatus = {
          ...this.storageStatus,
          driver: 'sqlite',
          state: 'ready',
          initializationState: 'ready',
          initializationStage: STORAGE_INITIALIZATION_STAGES.READY,
          initializationError: null,
          lastOperation: 'initialize',
          lastError: null,
        };
      } else {
        this.sqliteDb = prevActiveDb;
      }

      // Sync shared metadata in background
      this.syncSharedSettings().catch(() => {});

      return db;
    } catch (err) {
      const storageError = this.recordStorageError(err, 'initialize', stage);
      console.warn('Failed to initialize Tauri SQLite for profile', targetProfile, storageError.safeMessage);
      if (this.sqliteDb) {
        try {
          await closeSqlitePool(this.sqliteDb, dbPath);
        } catch (closeErr) {}
      }
      delete this.sqliteDbs[targetProfile];
      if (targetProfile === this.activeProfile) {
        this.sqliteDb = null;
      }
      return null;
    }
  }

  setInitializationStage(stage) {
    this.storageStatus = {
      ...this.storageStatus,
      initializationState: 'initializing',
      initializationStage: stage,
    };
  }

  recordStorageError(error, operation, stage = null) {
    const storageError = toStorageError(error, operation, stage);
    const errorSnapshot = {
      kind: storageError.kind,
      operation: storageError.operation,
      stage: storageError.stage || stage || null,
      message: storageError.safeMessage,
    };
    const isInitialization = operation === 'initialize' || operation === 'initialize_indexeddb';

    this.storageStatus = {
      ...this.storageStatus,
      state: 'error',
      lastOperation: operation,
      lastError: errorSnapshot,
      ...(isInitialization
        ? {
            initializationState: 'error',
            initializationStage: stage || storageError.stage || STORAGE_INITIALIZATION_STAGES.LOAD,
            initializationError: errorSnapshot,
          }
        : {}),
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
      initializationError: this.storageStatus.initializationError
        ? { ...this.storageStatus.initializationError }
        : null,
    };
  }

  async retryStorage() {
    if (this.retryPromise) return this.retryPromise;

    this.retryPromise = this.retryStorageInternal();
    try {
      return await this.retryPromise;
    } finally {
      this.retryPromise = null;
    }
  }

  async retryStorageInternal() {
    if (!this.isDesktop) {
      await this.initPromise;
      return this.getStorageStatus();
    }

    await this.initPromise;

    if (this.sqliteDb) {
      let stage = STORAGE_INITIALIZATION_STAGES.INTEGRITY_CHECK;
      try {
        await this.verifySqliteConnection();
        await this.verifySqliteIntegrity();
        stage = STORAGE_INITIALIZATION_STAGES.WRITABILITY_CHECK;
        await this.verifySqliteWritability();
        this.storageStatus = {
          ...this.storageStatus,
          state: 'ready',
          initializationState: 'ready',
          initializationStage: STORAGE_INITIALIZATION_STAGES.READY,
          initializationError: null,
          lastOperation: 'retry_health_check',
          lastError: null,
        };
      } catch (err) {
        const storageError = this.recordStorageError(err, 'retry_health_check', stage);
        if (storageError.kind === STORAGE_ERROR_KINDS.UNAVAILABLE) {
          try {
            await closeSqlitePool(this.sqliteDb, SQLITE_MAIN_PATH);
          } catch (closeErr) {}
          this.sqliteDb = null;
          this.storageStatus = {
            ...this.storageStatus,
            state: 'initializing',
            initializationState: 'initializing',
            initializationStage: STORAGE_INITIALIZATION_STAGES.LOAD,
          };
          this.initPromise = this.initDesktopStorage();
          await this.initPromise;
        }
      }
      return this.getStorageStatus();
    }

    this.storageStatus = {
      ...this.storageStatus,
      state: 'initializing',
      initializationState: 'initializing',
      initializationStage: STORAGE_INITIALIZATION_STAGES.LOAD,
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
        source TEXT DEFAULT '',
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
        link TEXT DEFAULT '',
        pot REAL DEFAULT NULL,
        teamInputMode TEXT DEFAULT 'pot',
        teammateCuts TEXT DEFAULT '{}',
        teammateNotes TEXT DEFAULT '{}',
        orderId TEXT DEFAULT '',
        feeRate REAL DEFAULT NULL,
        sourcePaid INTEGER DEFAULT 0,
        feeType TEXT DEFAULT 'percent',
        boosterPaid INTEGER DEFAULT 0,
        platformFee REAL DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    await this.ensureWorkEntryColumns();

    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_entries_datetime ON work_entries(dateTime DESC);`);
    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_entries_status ON work_entries(status);`);
    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_entries_game ON work_entries(game);`);
    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_entries_order_id ON work_entries(orderId);`);
    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_entries_source_paid ON work_entries(sourcePaid);`);
    await this.sqliteDb.execute(`CREATE INDEX IF NOT EXISTS idx_entries_booster_paid ON work_entries(boosterPaid);`);

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

  async verifySqliteIntegrity() {
    if (!this.sqliteDb) {
      throw new Error('Local database connection is unavailable.');
    }

    try {
      const integrityRows = await this.sqliteDb.select('PRAGMA integrity_check;');
      const integrityValue = String(Object.values(integrityRows?.[0] || {})[0] || '').toLowerCase();
      if (integrityValue !== 'ok') {
        throw new Error(`SQLite integrity check failed: ${integrityValue || 'no result'}`);
      }

      this.storageStatus = {
        ...this.storageStatus,
        integrity: 'ok',
      };
    } catch (err) {
      this.storageStatus = {
        ...this.storageStatus,
        integrity: 'failed',
      };
      throw err;
    }
  }

  async verifySqliteConnection() {
    if (!this.sqliteDb) {
      throw new Error('Local database connection is unavailable.');
    }

    await this.sqliteDb.select('SELECT 1 AS connection_alive;');
  }

  async verifySqliteWritability() {
    if (!this.sqliteDb) {
      throw new Error('Local database connection is unavailable.');
    }

    // tauri-plugin-sql exposes a connection pool, so a BEGIN / ROLLBACK pair
    // can land on different SQLite connections. A fixed internal marker is a
    // reliable write probe and never changes user-owned data.
    try {
      await this.sqliteDb.execute('INSERT OR REPLACE INTO checkpoint_storage_health (id) VALUES (1);');
      this.storageStatus = {
        ...this.storageStatus,
        writable: 'yes',
      };
    } catch (err) {
      this.storageStatus = {
        ...this.storageStatus,
        writable: 'no',
      };
      throw err;
    }
  }

  async verifySqliteHealth() {
    await this.verifySqliteIntegrity();
    await this.verifySqliteWritability();
    this.storageStatus = {
      ...this.storageStatus,
      schema: 'ready',
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
    return runLegacySqliteMigration({
      mainDb: this.sqliteDb,
      loadDatabase: (path) => Database.load(path),
    });
  }

  /* =========================================================================
   * 2. IndexedDB Driver Implementation (Browser Fallback)
   * ========================================================================= */

  async initIndexedDB(profileId = null) {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }

    const targetProfile = profileId || this.activeProfile || 'booster';
    if (this.idbDbs[targetProfile]) {
      if (targetProfile === this.activeProfile) {
        this.idb = this.idbDbs[targetProfile];
      }
      return this.idbDbs[targetProfile];
    }

    return new Promise((resolve, reject) => {
      const dbName = this.getIdbDatabaseNameForProfile(targetProfile);
      const request = indexedDB.open(dbName, DB_VERSION_IDB);

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
        const db = event.target.result;
        this.idbDbs[targetProfile] = db;
        if (targetProfile === this.activeProfile) {
          this.idb = db;
        }
        resolve(db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error for profile', targetProfile, event.target.error);
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
            w.id, w.title, w.game, w.source, w.teamMode, w.teammates, w.income, w.currency, w.exchangeRate, w.rateUnit, w.status, w.dateTime, w.hours, w.notes, w.link,
            w.pot, w.teamInputMode, w.teammateCuts, w.teammateNotes, w.orderId, w.feeRate, w.sourcePaid, w.feeType, w.boosterPaid, w.platformFee,
            COUNT(p.id) as proof_count
          FROM work_entries w
          LEFT JOIN proof_attachments p ON w.id = p.entry_id
          GROUP BY w.id
          ORDER BY w.dateTime DESC
        `);

        return rows.map((r) => {
          let cur = r.currency;
          if (cur === 'WOW_GOLD') cur = 'GOLD';
          if (!['USD', 'EUR', 'TOMAN', 'GOLD'].includes(cur)) cur = 'TOMAN';
          const isClassic = r.rateUnit === '1' || r.game === 'World of Warcraft Classic';
          const defaultRate = isClassic ? 7000 : 3200;

          let parsedTeammates = [];
          try {
            if (typeof r.teammates === 'string') parsedTeammates = JSON.parse(r.teammates);
            else if (Array.isArray(r.teammates)) parsedTeammates = r.teammates;
          } catch (e) {}

          let parsedTeammateCuts = {};
          try {
            if (typeof r.teammateCuts === 'string') parsedTeammateCuts = JSON.parse(r.teammateCuts);
            else if (r.teammateCuts && typeof r.teammateCuts === 'object') parsedTeammateCuts = r.teammateCuts;
          } catch (e) {}

          let parsedTeammateNotes = {};
          try {
            if (typeof r.teammateNotes === 'string') parsedTeammateNotes = JSON.parse(r.teammateNotes);
            else if (r.teammateNotes && typeof r.teammateNotes === 'object') parsedTeammateNotes = r.teammateNotes;
          } catch (e) {}

          return {
            ...r,
            source: r.source || '',
            teamMode: Boolean(r.teamMode),
            teammates: parsedTeammates,
            currency: cur,
            exchangeRate: Number(r.exchangeRate) > 0 ? Number(r.exchangeRate) : defaultRate,
            rateUnit: r.rateUnit || (isClassic ? '1' : '1k'),
            link: r.link || '',
            pot: r.pot !== null && r.pot !== undefined ? Number(r.pot) : null,
            teamInputMode: r.teamInputMode === 'income' ? 'income' : 'pot',
            teammateCuts: parsedTeammateCuts,
            teammateNotes: parsedTeammateNotes,
            orderId: r.orderId || '',
            feeRate: r.feeRate !== null && r.feeRate !== undefined && !isNaN(Number(r.feeRate)) ? Number(r.feeRate) : null,
            sourcePaid: Boolean(r.sourcePaid),
            feeType: r.feeType || 'percent',
            boosterPaid: Boolean(r.boosterPaid),
            platformFee: r.platformFee !== null && r.platformFee !== undefined ? Number(r.platformFee) : 0,
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
          if (!['USD', 'EUR', 'TOMAN', 'GOLD'].includes(cur)) cur = 'TOMAN';
          const isClassic = entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic';
          const defaultRate = isClassic ? 7000 : 3200;
          return {
            ...entry,
            source: entry.source || '',
            teamMode: Boolean(entry.teamMode),
            teammates: Array.isArray(entry.teammates) ? entry.teammates : [],
            currency: cur,
            exchangeRate: Number(entry.exchangeRate) > 0 ? Number(entry.exchangeRate) : defaultRate,
            rateUnit: entry.rateUnit || (isClassic ? '1' : '1k'),
            link: entry.link || '',
            pot: entry.pot !== null && entry.pot !== undefined ? Number(entry.pot) : null,
            teamInputMode: entry.teamInputMode === 'income' ? 'income' : 'pot',
            teammateCuts: entry.teammateCuts && typeof entry.teammateCuts === 'object' ? entry.teammateCuts : {},
            teammateNotes: entry.teammateNotes && typeof entry.teammateNotes === 'object' ? entry.teammateNotes : {},
            orderId: entry.orderId || '',
            feeRate: entry.feeRate !== null && entry.feeRate !== undefined && !isNaN(Number(entry.feeRate)) ? Number(entry.feeRate) : null,
            sourcePaid: Boolean(entry.sourcePaid),
            feeType: entry.feeType || 'percent',
            boosterPaid: Boolean(entry.boosterPaid),
            platformFee: entry.platformFee !== null && entry.platformFee !== undefined ? Number(entry.platformFee) : 0,
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
        if (!['USD', 'EUR', 'TOMAN', 'GOLD'].includes(entry.currency)) entry.currency = 'TOMAN';

        const isClassic = entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic';
        const defaultRate = isClassic ? 7000 : 3200;
        entry.source = entry.source || '';
        entry.exchangeRate = Number(entry.exchangeRate) > 0 ? Number(entry.exchangeRate) : defaultRate;
        entry.rateUnit = entry.rateUnit || (isClassic ? '1' : '1k');
        entry.link = entry.link || '';
        entry.orderId = entry.orderId || '';
        entry.feeRate = entry.feeRate !== null && entry.feeRate !== undefined && !isNaN(Number(entry.feeRate)) ? Number(entry.feeRate) : null;
        entry.sourcePaid = Boolean(entry.sourcePaid);

        try {
          if (typeof entry.teammates === 'string') entry.teammates = JSON.parse(entry.teammates);
          else if (!Array.isArray(entry.teammates)) entry.teammates = [];
        } catch (e) {
          entry.teammates = [];
        }
        entry.teamMode = Boolean(entry.teamMode);

        entry.pot = entry.pot !== null && entry.pot !== undefined ? Number(entry.pot) : null;
        entry.teamInputMode = entry.teamInputMode === 'income' ? 'income' : 'pot';
        try {
          if (typeof entry.teammateCuts === 'string') entry.teammateCuts = JSON.parse(entry.teammateCuts);
          else if (!entry.teammateCuts || typeof entry.teammateCuts !== 'object') entry.teammateCuts = {};
        } catch (e) {
          entry.teammateCuts = {};
        }

        try {
          if (typeof entry.teammateNotes === 'string') entry.teammateNotes = JSON.parse(entry.teammateNotes);
          else if (!entry.teammateNotes || typeof entry.teammateNotes !== 'object') entry.teammateNotes = {};
        } catch (e) {
          entry.teammateNotes = {};
        }

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
          if (!['USD', 'EUR', 'TOMAN', 'GOLD'].includes(entry.currency)) entry.currency = 'TOMAN';
          const isClassic = entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic';
          const defaultRate = isClassic ? 7000 : 3200;
          entry.source = entry.source || '';
          entry.teamMode = Boolean(entry.teamMode);
          entry.teammates = Array.isArray(entry.teammates) ? entry.teammates : [];
          entry.exchangeRate = Number(entry.exchangeRate) > 0 ? Number(entry.exchangeRate) : defaultRate;
          entry.rateUnit = entry.rateUnit || (isClassic ? '1' : '1k');
          entry.link = entry.link || '';
          entry.pot = entry.pot !== null && entry.pot !== undefined ? Number(entry.pot) : null;
          entry.teamInputMode = entry.teamInputMode === 'income' ? 'income' : 'pot';
          entry.teammateCuts = entry.teammateCuts && typeof entry.teammateCuts === 'object' ? entry.teammateCuts : {};
          entry.teammateNotes = entry.teammateNotes && typeof entry.teammateNotes === 'object' ? entry.teammateNotes : {};
          entry.orderId = entry.orderId || '';
          entry.feeRate = entry.feeRate !== null && entry.feeRate !== undefined && !isNaN(Number(entry.feeRate)) ? Number(entry.feeRate) : null;
          entry.sourcePaid = Boolean(entry.sourcePaid);
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
    if (!['USD', 'EUR', 'TOMAN', 'GOLD'].includes(cleanEntry.currency)) cleanEntry.currency = 'TOMAN';

    const isClassic = cleanEntry.rateUnit === '1' || cleanEntry.game === 'World of Warcraft Classic';
    const defaultRate = isClassic ? 7000 : 3200;
    const finalRate = Number(cleanEntry.exchangeRate) > 0 ? Number(cleanEntry.exchangeRate) : defaultRate;
    const finalUnit = cleanEntry.rateUnit || (isClassic ? '1' : '1k');
    const finalSource = typeof cleanEntry.source === 'string' ? cleanEntry.source.trim() : '';
    const finalLink = typeof cleanEntry.link === 'string' ? cleanEntry.link.trim() : '';
    const teammatesJson = JSON.stringify(cleanEntry.teammates || []);
    const teamModeInt = cleanEntry.teamMode ? 1 : 0;
    const finalPot = cleanEntry.pot !== null && cleanEntry.pot !== undefined && !Number.isNaN(Number(cleanEntry.pot))
      ? Number(cleanEntry.pot)
      : null;
    const finalTeamInputMode = cleanEntry.teamInputMode === 'income' ? 'income' : 'pot';
    const teammateCutsJson = JSON.stringify(cleanEntry.teammateCuts && typeof cleanEntry.teammateCuts === 'object' ? cleanEntry.teammateCuts : {});
    const teammateNotesJson = JSON.stringify(cleanEntry.teammateNotes && typeof cleanEntry.teammateNotes === 'object' ? cleanEntry.teammateNotes : {});
    const finalOrderId = typeof cleanEntry.orderId === 'string' ? cleanEntry.orderId.trim() : '';
    const finalFeeRate = cleanEntry.feeRate !== null && cleanEntry.feeRate !== undefined && !Number.isNaN(Number(cleanEntry.feeRate))
      ? Number(cleanEntry.feeRate)
      : null;
    const finalSourcePaid = cleanEntry.sourcePaid ? 1 : 0;
    const finalFeeType = cleanEntry.feeType === 'flat' ? 'flat' : 'percent';
    const finalBoosterPaid = cleanEntry.boosterPaid ? 1 : 0;
    const finalPlatformFee = cleanEntry.platformFee !== null && cleanEntry.platformFee !== undefined && !Number.isNaN(Number(cleanEntry.platformFee))
      ? Number(cleanEntry.platformFee)
      : 0;

    cleanEntry.exchangeRate = finalRate;
    cleanEntry.rateUnit = finalUnit;
    cleanEntry.source = finalSource;
    cleanEntry.link = finalLink;
    cleanEntry.pot = finalPot;
    cleanEntry.teamInputMode = finalTeamInputMode;
    cleanEntry.teammateCuts = cleanEntry.teammateCuts && typeof cleanEntry.teammateCuts === 'object' ? cleanEntry.teammateCuts : {};
    cleanEntry.teammateNotes = cleanEntry.teammateNotes && typeof cleanEntry.teammateNotes === 'object' ? cleanEntry.teammateNotes : {};
    cleanEntry.orderId = finalOrderId;
    cleanEntry.feeRate = finalFeeRate;
    cleanEntry.sourcePaid = Boolean(finalSourcePaid);
    cleanEntry.feeType = finalFeeType;
    cleanEntry.boosterPaid = Boolean(finalBoosterPaid);
    cleanEntry.platformFee = finalPlatformFee;

    if (this.isDesktop) {
      if (!this.sqliteDb) {
        throw this.createUnavailableStorageError('save_entry');
      }

      try {
        await this.sqliteDb.execute(
          `INSERT OR REPLACE INTO work_entries (id, title, game, source, teamMode, teammates, income, currency, exchangeRate, rateUnit, status, dateTime, hours, notes, link, pot, teamInputMode, teammateCuts, teammateNotes, orderId, feeRate, sourcePaid, feeType, boosterPaid, platformFee, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
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
            finalLink,
            finalPot,
            finalTeamInputMode,
            teammateCutsJson,
            teammateNotesJson,
            finalOrderId,
            finalFeeRate,
            finalSourcePaid,
            finalFeeType,
            finalBoosterPaid,
            finalPlatformFee,
          ]
        );

        // Sync proof attachments
        if (Array.isArray(cleanEntry.proofs)) {
          await this.sqliteDb.execute('DELETE FROM proof_attachments WHERE entry_id = ?', [cleanEntry.id]);
          for (const p of cleanEntry.proofs) {
            if (p && (p.data || p.data_blob)) {
              const proofId = (!p.id || (p.entry_id && p.entry_id !== cleanEntry.id))
                ? 'proof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
                : p.id;
              await this.sqliteDb.execute(
                `INSERT OR REPLACE INTO proof_attachments (id, entry_id, name, data_blob, size, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  proofId,
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

  async updateSourcePaid(id, sourcePaid) {
    await this.initPromise;
    if (!id) return false;
    const isPaidInt = sourcePaid ? 1 : 0;
    const nowSec = Math.floor(Date.now() / 1000);

    if (this.isDesktop && this.sqliteDb) {
      try {
        await this.sqliteDb.execute(
          'UPDATE work_entries SET sourcePaid = ?, updated_at = ? WHERE id = ?',
          [isPaidInt, nowSec, id]
        );
        return true;
      } catch (err) {
        console.error('SQLite updateSourcePaid error:', err);
        return false;
      }
    }

    // Browser IndexedDB Fallback
    if (!this.idb) return false;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const entry = getReq.result;
        if (entry) {
          entry.sourcePaid = Boolean(sourcePaid);
          entry.updatedAt = new Date().toISOString();
          store.put(entry);
        }
      };

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);
    });
  }

  async updateBoosterPaid(id, boosterPaid) {
    await this.initPromise;
    if (!id) return false;
    const isPaidInt = boosterPaid ? 1 : 0;
    const nowSec = Math.floor(Date.now() / 1000);

    if (this.isDesktop && this.sqliteDb) {
      try {
        await this.sqliteDb.execute(
          'UPDATE work_entries SET boosterPaid = ?, updated_at = ? WHERE id = ?',
          [isPaidInt, nowSec, id]
        );
        return true;
      } catch (err) {
        console.error('SQLite updateBoosterPaid error:', err);
        return false;
      }
    }

    // Browser IndexedDB Fallback
    if (!this.idb) return false;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const entry = getReq.result;
        if (entry) {
          entry.boosterPaid = Boolean(boosterPaid);
          entry.updatedAt = new Date().toISOString();
          store.put(entry);
        }
      };

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

  async updateGameName(oldName, newName) {
    await this.initPromise;
    if (!oldName || !newName || oldName === newName) return false;

    if (this.isDesktop && this.sqliteDb) {
      try {
        await this.sqliteDb.execute(
          'UPDATE work_entries SET game = ?, updated_at = strftime("%s", "now") WHERE game = ?',
          [newName, oldName]
        );
        return true;
      } catch (err) {
        console.error('SQLite updateGameName error:', err);
        return false;
      }
    }

    if (!this.idb) return false;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const entry = cursor.value;
          if (entry.game === oldName) {
            entry.game = newName;
            cursor.update(entry);
          }
          cursor.continue();
        } else {
          resolve(true);
        }
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async countEntriesWithSource(source) {
    await this.initPromise;
    const clean = typeof source === 'string' ? source.trim() : '';
    if (!clean) return 0;

    if (this.isDesktop && this.sqliteDb) {
      try {
        const rows = await this.sqliteDb.select(
          'SELECT COUNT(*) as cnt FROM work_entries WHERE LOWER(source) = LOWER(?)',
          [clean]
        );
        return rows?.[0]?.cnt || 0;
      } catch (err) {
        return 0;
      }
    }

    if (!this.idb) return 0;
    return new Promise((resolve) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readonly');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.openCursor();
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.source && cursor.value.source.trim().toLowerCase() === clean.toLowerCase()) {
            count++;
          }
          cursor.continue();
        } else {
          resolve(count);
        }
      };
      request.onerror = () => resolve(0);
    });
  }

  async renameSourceInEntries(oldSource, newSource) {
    await this.initPromise;
    const oldClean = typeof oldSource === 'string' ? oldSource.trim() : '';
    const newClean = typeof newSource === 'string' ? newSource.trim() : '';
    if (!oldClean || !newClean || oldClean.toLowerCase() === newClean.toLowerCase()) return 0;

    if (this.isDesktop && this.sqliteDb) {
      try {
        const result = await this.sqliteDb.execute(
          'UPDATE work_entries SET source = ?, updated_at = strftime("%s", "now") WHERE LOWER(source) = LOWER(?)',
          [newClean, oldClean]
        );
        return result?.rowsAffected ?? 1;
      } catch (err) {
        console.error('SQLite renameSourceInEntries error:', err);
        return 0;
      }
    }

    if (!this.idb) return 0;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.openCursor();
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const entry = cursor.value;
          if (entry.source && entry.source.trim().toLowerCase() === oldClean.toLowerCase()) {
            entry.source = newClean;
            entry.updatedAt = new Date().toISOString();
            cursor.update(entry);
            count++;
          }
          cursor.continue();
        } else {
          resolve(count);
        }
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  async countEntriesWithTeammate(teammate) {
    await this.initPromise;
    const clean = typeof teammate === 'string' ? teammate.trim() : '';
    if (!clean) return 0;

    if (this.isDesktop && this.sqliteDb) {
      try {
        const rows = await this.sqliteDb.select(
          'SELECT teammates FROM work_entries WHERE teammates LIKE ?',
          [`%${clean}%`]
        );
        let count = 0;
        for (const row of rows) {
          try {
            const list = typeof row.teammates === 'string' ? JSON.parse(row.teammates) : (row.teammates || []);
            if (Array.isArray(list) && list.some((t) => typeof t === 'string' && t.trim().toLowerCase() === clean.toLowerCase())) {
              count++;
            }
          } catch (e) {}
        }
        return count;
      } catch (err) {
        return 0;
      }
    }

    if (!this.idb) return 0;
    return new Promise((resolve) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readonly');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.openCursor();
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const list = cursor.value.teammates;
          if (Array.isArray(list) && list.some((t) => typeof t === 'string' && t.trim().toLowerCase() === clean.toLowerCase())) {
            count++;
          }
          cursor.continue();
        } else {
          resolve(count);
        }
      };
      request.onerror = () => resolve(0);
    });
  }

  async renameTeammateInEntries(oldTeammate, newTeammate) {
    await this.initPromise;
    const oldClean = typeof oldTeammate === 'string' ? oldTeammate.trim() : '';
    const newClean = typeof newTeammate === 'string' ? newTeammate.trim() : '';
    if (!oldClean || !newClean || oldClean.toLowerCase() === newClean.toLowerCase()) return 0;

    if (this.isDesktop && this.sqliteDb) {
      try {
        const rows = await this.sqliteDb.select(
          'SELECT id, teammates, teammateCuts FROM work_entries WHERE teammates LIKE ?',
          [`%${oldClean}%`]
        );
        let updatedCount = 0;
        const nowSec = Math.floor(Date.now() / 1000);

        for (const row of rows) {
          let list = [];
          try {
            list = typeof row.teammates === 'string' ? JSON.parse(row.teammates) : (row.teammates || []);
          } catch (e) {
            list = [];
          }
          if (!Array.isArray(list)) list = [];

          let matched = false;
          const updatedList = list.map((tm) => {
            if (typeof tm === 'string' && tm.trim().toLowerCase() === oldClean.toLowerCase()) {
              matched = true;
              return newClean;
            }
            return tm;
          });

          let cuts = {};
          try {
            cuts = typeof row.teammateCuts === 'string' ? JSON.parse(row.teammateCuts) : (row.teammateCuts || {});
          } catch (e) {
            cuts = {};
          }
          if (cuts && typeof cuts === 'object') {
            for (const key of Object.keys(cuts)) {
              if (key.trim().toLowerCase() === oldClean.toLowerCase()) {
                cuts[newClean] = cuts[key];
                delete cuts[key];
                matched = true;
              }
            }
          }

          if (matched) {
            await this.sqliteDb.execute(
              'UPDATE work_entries SET teammates = ?, teammateCuts = ?, updated_at = ? WHERE id = ?',
              [JSON.stringify(updatedList), JSON.stringify(cuts), nowSec, row.id]
            );
            updatedCount++;
          }
        }
        return updatedCount;
      } catch (err) {
        console.error('SQLite renameTeammateInEntries error:', err);
        return 0;
      }
    }

    if (!this.idb) return 0;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.openCursor();
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const entry = cursor.value;
          let matched = false;
          if (Array.isArray(entry.teammates)) {
            entry.teammates = entry.teammates.map((tm) => {
              if (typeof tm === 'string' && tm.trim().toLowerCase() === oldClean.toLowerCase()) {
                matched = true;
                return newClean;
              }
              return tm;
            });
          }
          if (entry.teammateCuts && typeof entry.teammateCuts === 'object') {
            for (const key of Object.keys(entry.teammateCuts)) {
              if (key.trim().toLowerCase() === oldClean.toLowerCase()) {
                entry.teammateCuts[newClean] = entry.teammateCuts[key];
                delete entry.teammateCuts[key];
                matched = true;
              }
            }
          }
          if (matched) {
            entry.updatedAt = new Date().toISOString();
            cursor.update(entry);
            count++;
          }
          cursor.continue();
        } else {
          resolve(count);
        }
      };

      request.onerror = (e) => reject(e.target.error);
    });
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
      const profileId = this.activeProfile || 'booster';
      const today = new Date().toISOString().slice(0, 10);
      const lastSnapKey = `checkpoint_last_auto_snapshot_date_${profileId}`;
      const lastDate = await this.getSetting(lastSnapKey, '');

      if (lastDate !== today) {
        const roleLabel = profileId === 'advertiser' ? 'Advertiser' : 'Booster';
        await this.createSnapshot(`${roleLabel} Daily Snapshot (${today})`);
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
      const profileId = this.activeProfile || 'booster';
      const snapshot = {
        app: 'CHECKPOINT',
        profile: profileId,
        version: version || '0.0.0',
        timestamp: new Date().toISOString(),
        entries,
      };

      const id = 'snap_' + Date.now();
      const snapName = name || `${profileId === 'advertiser' ? 'Advertiser' : 'Booster'} Backup ${new Date().toLocaleString()}`;

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
