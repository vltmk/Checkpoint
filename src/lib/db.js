/**
 * db.js - Unified Hybrid Storage Engine for Nodra Vault
 * Automatically routes to SQLite in Tauri Desktop mode, or IndexedDB in Web Browser mode.
 * Features lazy-loaded proof attachments, WAL mode, and rolling snapshots.
 */

import { isTauri } from './desktop';

const DB_NAME_IDB = 'NodraVaultDB_v1';
const DB_VERSION_IDB = 1;
const STORE_ENTRIES = 'work_entries';
const STORE_SETTINGS = 'app_settings';
const STORE_SNAPSHOTS = 'db_snapshots';

export class StorageDB {
  constructor() {
    this.sqliteDb = null;
    this.idb = null;
    this.isDesktop = isTauri();
    this.initPromise = this.init();
  }

  async init() {
    if (this.isDesktop) {
      try {
        const Database = (await import('@tauri-apps/plugin-sql')).default;
        this.sqliteDb = await Database.load('sqlite:nodra_vault.db');
        await this.initSqliteSchema();
        return this.sqliteDb;
      } catch (err) {
        console.warn('Failed to initialize Tauri SQLite, falling back to IndexedDB:', err);
        this.isDesktop = false;
        return this.initIndexedDB();
      }
    } else {
      return this.initIndexedDB();
    }
  }

  /* =========================================================================
   * 1. SQLite Driver Implementation (Desktop)
   * ========================================================================= */

  async initSqliteSchema() {
    if (!this.sqliteDb) return;

    // Enable WAL mode & foreign keys
    try {
      await this.sqliteDb.execute('PRAGMA journal_mode = WAL;');
      await this.sqliteDb.execute('PRAGMA synchronous = NORMAL;');
      await this.sqliteDb.execute('PRAGMA foreign_keys = ON;');
    } catch (e) {}

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

    // Run safe migrations for existing tables
    try {
      await this.sqliteDb.execute(`ALTER TABLE work_entries ADD COLUMN source TEXT DEFAULT 'Direct Client';`);
    } catch (e) {}
    try {
      await this.sqliteDb.execute(`ALTER TABLE work_entries ADD COLUMN teamMode INTEGER DEFAULT 0;`);
    } catch (e) {}
    try {
      await this.sqliteDb.execute(`ALTER TABLE work_entries ADD COLUMN teammates TEXT DEFAULT '[]';`);
    } catch (e) {}
    try {
      await this.sqliteDb.execute(`ALTER TABLE work_entries ADD COLUMN exchangeRate REAL DEFAULT 3200;`);
    } catch (e) {}
    try {
      await this.sqliteDb.execute(`ALTER TABLE work_entries ADD COLUMN rateUnit TEXT DEFAULT '1k';`);
    } catch (e) {}

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

    if (this.isDesktop && this.sqliteDb) {
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
        return cleanEntry;
      } catch (err) {
        console.error('SQLite saveEntry error:', err);
        throw err;
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

  async clearAll() {
    await this.initPromise;

    if (this.isDesktop && this.sqliteDb) {
      try {
        await this.sqliteDb.execute('DELETE FROM proof_attachments');
        await this.sqliteDb.execute('DELETE FROM work_entries');
        return true;
      } catch (err) {
        console.error('SQLite clearAll error:', err);
        return false;
      }
    }

    if (!this.idb) return false;
    return new Promise((resolve, reject) => {
      const transaction = this.idb.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /* =========================================================================
   * 4. Settings & Key-Value Persistence
   * ========================================================================= */

  async getSetting(key, fallback = null) {
    await this.initPromise;
    if (this.isDesktop && this.sqliteDb) {
      try {
        const rows = await this.sqliteDb.select('SELECT value FROM app_settings WHERE key = ? LIMIT 1', [key]);
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
      const val = localStorage.getItem(key);
      if (val !== null) {
        try {
          return JSON.parse(val);
        } catch (e) {
          return val;
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
      const lastSnapKey = 'vault_last_auto_snapshot_date';
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
      const snapshot = {
        app: 'Nodra Vault',
        version: '2.0.0',
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
    const list = await this.getAllEntries();
    const full = [];
    for (const item of list) {
      const fullEntry = await this.getEntry(item.id);
      full.push(fullEntry || item);
    }
    return full;
  }

  /* =========================================================================
   * 6. Sample Data Seeding
   * ========================================================================= */

  async resetWithFreshSeed() {
    await this.clearAll();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('nodrapay_v2_seeded');
    }
    return await this.seedInitialDataIfEmpty(true);
  }

  async seedInitialDataIfEmpty(force = false) {
    const isSeeded = await this.getSetting('nodrapay_v2_seeded', false);
    if (!force && isSeeded) {
      return [];
    }

    const existing = await this.getAllEntries();
    if (existing.length === 0 || force) {
      await this.setSetting('nodrapay_v2_seeded', true);

      const now = new Date();
      const offsetDate = (daysAgo, hour = 14) => {
        const d = new Date(now.getTime() - daysAgo * 86400000);
        d.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
        return d.toISOString().slice(0, 16);
      };

      const sampleEntries = [
        {
          id: 'job_' + Date.now() + '_1',
          title: 'Mythic+ +20 Keystone Carry (Armor Funnel)',
          game: 'World of Warcraft',
          source: 'Discord Direct',
          teamMode: true,
          teammates: ['ShadowPriest', 'TankGod'],
          income: 450000,
          currency: 'GOLD',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(0, 15),
          hours: 2.5,
          notes: 'Timed +20 dungeon run with specific cloth armor loot funnel.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_2',
          title: 'Ulduar 25 GDKP Guild Run Cut Split',
          game: 'World of Warcraft Classic',
          source: 'Guild Run',
          teamMode: true,
          teammates: ['Valkyrie', 'HealBot'],
          income: 850000,
          currency: 'GOLD',
          exchangeRate: 7000,
          rateUnit: '1',
          status: 'Paid',
          dateTime: offsetDate(0, 11),
          hours: 4.0,
          notes: 'Full clear GDKP raid with high cut payout.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_3',
          title: 'Powerleveling 1-80 Speed Service',
          game: 'World of Warcraft Classic',
          source: 'G2G',
          teamMode: false,
          teammates: [],
          income: 3500000,
          currency: 'TOMAN',
          exchangeRate: 7000,
          rateUnit: '1',
          status: 'Working',
          dateTime: offsetDate(1, 16),
          hours: 12.0,
          notes: 'Fast questing and dungeon leveling service.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_4',
          title: 'Custom Mythic Raid WeakAuras Suite',
          game: 'World of Warcraft',
          source: 'Personal Client',
          teamMode: false,
          teammates: [],
          income: 1800000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Pending',
          dateTime: offsetDate(1, 10),
          hours: 5.0,
          notes: 'Custom Mythic raid aura suite and action bar integration.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_5',
          title: 'Profession Crafting Max-Rank Batch',
          game: 'World of Warcraft',
          source: 'FunPay',
          teamMode: false,
          teammates: [],
          income: 600000,
          currency: 'GOLD',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'On Hold',
          dateTime: offsetDate(2, 18),
          hours: 6.0,
          notes: 'Max-rank craft orders fulfilled; awaiting client trade.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_6',
          title: 'Diablo IV Pit Tier 100+ Carry',
          game: 'Diablo IV',
          source: 'Discord Direct',
          teamMode: true,
          teammates: ['BarbKing', 'SorcererX'],
          income: 2200000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(3, 14),
          hours: 3.5,
          notes: 'Speed runs for glyph upgrades and Masterworking materials.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_7',
          title: 'Heroic Raid Full Clear (Personal Loot)',
          game: 'World of Warcraft',
          source: 'Eldorado',
          teamMode: true,
          teammates: ['RaidLead', 'DPSGod'],
          income: 550000,
          currency: 'GOLD',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(4, 20),
          hours: 2.0,
          notes: 'Fast 8/8 heroic clear with bonus loot traders.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_8',
          title: 'PoE T17 Abomination Map Boss Carry',
          game: 'Path of Exile',
          source: 'Discord Direct',
          teamMode: false,
          teammates: [],
          income: 1650000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(5, 17),
          hours: 1.5,
          notes: 'Deathless boss carry with fragment delivery.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_9',
          title: 'LoL Diamond Duo Queue Placement Boost',
          game: 'League of Legends',
          source: 'G2G',
          teamMode: true,
          teammates: ['DuoPartner'],
          income: 2800000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(6, 19),
          hours: 6.0,
          notes: '5-0 placement matches streak in Diamond MMR.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_10',
          title: 'Gladiator Arena 3v3 Coaching Session',
          game: 'World of Warcraft',
          source: 'Personal Client',
          teamMode: true,
          teammates: ['GladCoach', 'R1Rogue'],
          income: 4200000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(7, 21),
          hours: 4.0,
          notes: 'Cross-cc setups, positioning, and defensive cooldown coaching.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_11',
          title: 'Icecrown Citadel 25H Shadowmourne Shards',
          game: 'World of Warcraft Classic',
          source: 'Guild Run',
          teamMode: true,
          teammates: ['GuildMaster', 'MainTank'],
          income: 1200000,
          currency: 'GOLD',
          exchangeRate: 7000,
          rateUnit: '1',
          status: 'Paid',
          dateTime: offsetDate(8, 20),
          hours: 3.5,
          notes: 'Shadowfrost Shard reservation split payout.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_12',
          title: 'Diablo IV Torment 4 Boss Rotation Bundle',
          game: 'Diablo IV',
          source: 'FunPay',
          income: 1400000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Working',
          dateTime: offsetDate(9, 13),
          hours: 2.0,
          notes: '20x Duriel and Andariel summon rotations.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_13',
          title: 'Mage Tower Challenge Completion (All 7)',
          game: 'World of Warcraft',
          source: 'PlayerAuctions',
          income: 900000,
          currency: 'GOLD',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(10, 16),
          hours: 3.0,
          notes: 'Soaring Spelltome mount unlock achieved.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_14',
          title: 'PoE Uber Elder & Maven Carry',
          game: 'Path of Exile',
          source: 'Discord Direct',
          income: 1950000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Pending',
          dateTime: offsetDate(12, 15),
          hours: 2.0,
          notes: 'Feared invitation set carry.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_15',
          title: 'WoW Classic Hardcore 1-60 Duo Safe Escort',
          game: 'World of Warcraft Classic',
          source: 'Personal Client',
          income: 5500000,
          currency: 'TOMAN',
          exchangeRate: 7000,
          rateUnit: '1',
          status: 'Paid',
          dateTime: offsetDate(13, 11),
          hours: 25.0,
          notes: 'Safe leveling escort with zero deaths.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_16',
          title: 'Mythic Raid 8/8 Vault Bosses Package',
          game: 'World of Warcraft',
          source: 'Discord Direct',
          income: 2400000,
          currency: 'GOLD',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(15, 20),
          hours: 3.5,
          notes: 'Cutting Edge achievement and mount package.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_17',
          title: 'Diablo IV Masterworking 12/12 Gear Prep',
          game: 'Diablo IV',
          source: 'G2G',
          income: 2100000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(16, 14),
          hours: 5.0,
          notes: 'Triple crit masterworking on client weapons.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_18',
          title: 'LoL Master Tier Promo Series Boost',
          game: 'League of Legends',
          source: 'FunPay',
          income: 3900000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(18, 19),
          hours: 8.0,
          notes: 'Diamond 1 to Master promotion series won 3-1.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_19',
          title: 'Custom ElvUI / Plater Profile Commission',
          game: 'World of Warcraft',
          source: 'Personal Client',
          income: 1200000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(19, 12),
          hours: 3.0,
          notes: 'Pixel-perfect high contrast arena & M+ UI profile.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_20',
          title: 'GDKP Naxxramas 25 Immortal Title Run',
          game: 'World of Warcraft Classic',
          source: 'Guild Run',
          income: 1500000,
          currency: 'GOLD',
          exchangeRate: 7000,
          rateUnit: '1',
          status: 'Paid',
          dateTime: offsetDate(21, 21),
          hours: 4.0,
          notes: 'Flawless zero death clear with bonus pot split.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_21',
          title: 'PoE 40/40 League Challenges Service',
          game: 'Path of Exile',
          source: 'Discord Direct',
          income: 4800000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(22, 16),
          hours: 14.0,
          notes: 'Complete end-game league challenge fulfillment and totem reward.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_22',
          title: 'Mythic+ 0 to 2500 Rating Sprint',
          game: 'World of Warcraft',
          source: 'Eldorado',
          income: 1800000,
          currency: 'GOLD',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(24, 18),
          hours: 7.0,
          notes: 'All 8 dungeons timed on Fortified and Tyrannical.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_23',
          title: 'WoW Classic Gold Delivery 50,000g Batch',
          game: 'World of Warcraft Classic',
          source: 'FunPay',
          income: 750000,
          currency: 'GOLD',
          exchangeRate: 7000,
          rateUnit: '1',
          status: 'Paid',
          dateTime: offsetDate(25, 14),
          hours: 1.0,
          notes: 'Guild bank direct deposit delivery.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_24',
          title: 'Diablo IV Paragon 1-300 Leveling Service',
          game: 'Diablo IV',
          source: 'G2G',
          income: 2700000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(27, 13),
          hours: 9.0,
          notes: 'Infernal Hordes tier 8 fast leveling grind.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_25',
          title: 'LoL Clash Tournament Win Coaching',
          game: 'League of Legends',
          source: 'Personal Client',
          income: 1500000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          rateUnit: '1k',
          status: 'Paid',
          dateTime: offsetDate(29, 20),
          hours: 4.0,
          notes: 'Draft phase strategy, warding patterns, and trophy victory.',
          proofs: [],
        },
      ];

      await this.bulkImport(sampleEntries);
      return sampleEntries;
    }
    return existing;
  }
}

export const trackerDB = new StorageDB();

if (typeof window !== 'undefined') {
  window.trackerDB = trackerDB;
}
