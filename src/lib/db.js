/**
 * db.js - StorageDB IndexedDB wrapper for Nodra Vault
 * Persistent client-side database supporting screenshot attachments and zero quota limit.
 */

const DB_NAME = 'NodraVaultDB_v1';
const DB_VERSION = 1;
const STORE_ENTRIES = 'work_entries';

export class StorageDB {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
          store.createIndex('dateTime', 'dateTime', { unique: false });
          store.createIndex('game', 'game', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async getAllEntries() {
    await this.initPromise;
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ENTRIES], 'readonly');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Normalize any legacy currency codes on retrieval
        const normalized = results.map((entry) => {
          let cur = entry.currency;
          if (cur === 'WOW_GOLD') cur = 'GOLD';
          if (!['TOMAN', 'GOLD'].includes(cur)) cur = 'TOMAN';
          return { ...entry, currency: cur };
        });
        normalized.sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0));
        resolve(normalized);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getEntry(id) {
    await this.initPromise;
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ENTRIES], 'readonly');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.get(id);

      request.onsuccess = () => {
        const entry = request.result || null;
        if (entry) {
          if (entry.currency === 'WOW_GOLD') entry.currency = 'GOLD';
          if (!['TOMAN', 'GOLD'].includes(entry.currency)) entry.currency = 'TOMAN';
        }
        resolve(entry);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async saveEntry(entry) {
    await this.initPromise;
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);

      const record = {
        ...entry,
        currency: entry.currency === 'WOW_GOLD' ? 'GOLD' : (entry.currency || 'TOMAN'),
        exchangeRate: Number(entry.exchangeRate) > 0 ? Number(entry.exchangeRate) : 3200,
        updatedAt: new Date().toISOString(),
      };

      const request = store.put(record);
      request.onsuccess = () => resolve(record);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteEntry(id) {
    await this.initPromise;
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async clearAllEntries() {
    await this.initPromise;
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async bulkImport(entriesList) {
    await this.initPromise;
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);

      entriesList.forEach((entry) => {
        const rec = {
          ...entry,
          id: entry.id || 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          currency: entry.currency === 'WOW_GOLD' ? 'GOLD' : (entry.currency || 'TOMAN'),
          exchangeRate: Number(entry.exchangeRate) > 0 ? Number(entry.exchangeRate) : 3200,
          updatedAt: new Date().toISOString(),
        };
        store.put(rec);
      });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Reset database with fresh default sample data
   */
  async resetWithFreshSeed() {
    await this.clearAllEntries();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nodrapay_v3_seeded');
    }
    return this.seedInitialDataIfEmpty(true);
  }

  /**
   * Seed realistic sample data ONLY on very first app initialization
   */
  async seedInitialDataIfEmpty(force = false) {
    if (!force && typeof window !== 'undefined' && localStorage.getItem('nodrapay_v3_seeded')) {
      return [];
    }

    const existing = await this.getAllEntries();
    if (existing.length === 0 || force) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('nodrapay_v3_seeded', 'true');
      }

      const now = new Date();
      const d1 = new Date(now.getTime() - 1 * 86400000).toISOString().slice(0, 16);
      const d2 = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 16);
      const d3 = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 16);
      const d4 = new Date(now.getTime() - 10 * 86400000).toISOString().slice(0, 16);
      const d5 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 16);

      const sampleEntries = [
        {
          id: 'job_' + Date.now() + '_1',
          title: 'Mythic+ +20 Keystone Carry',
          game: 'World of Warcraft',
          source: 'G2G',
          income: 450000,
          currency: 'GOLD',
          exchangeRate: 3200,
          status: 'Paid',
          dateTime: d1,
          notes: 'Timed +20 dungeon run with specific armor loot funnel.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_2',
          title: 'Ulduar 25-man GDKP Raid Split',
          game: 'World of Warcraft Classic',
          source: 'Guild Run',
          income: 850000,
          currency: 'GOLD',
          exchangeRate: 2500,
          status: 'Paid',
          dateTime: d2,
          notes: 'Full clear GDKP raid with high cut payout.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_3',
          title: 'Powerleveling 1-80 Service',
          game: 'World of Warcraft Classic',
          source: 'FunPay',
          income: 3500000,
          currency: 'TOMAN',
          exchangeRate: 7800,
          status: 'Pending',
          dateTime: d3,
          notes: 'Fast questing and dungeon leveling service.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_4',
          title: 'Custom Raid UI & WeakAuras Suite',
          game: 'World of Warcraft',
          source: 'Discord Direct',
          income: 2500000,
          currency: 'TOMAN',
          exchangeRate: 3200,
          status: 'Pending',
          dateTime: d4,
          notes: 'Custom Mythic raid aura suite and action bar integration.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_5',
          title: 'Profession Crafting Order Batch',
          game: 'World of Warcraft',
          source: 'Personal Client',
          income: 600000,
          currency: 'GOLD',
          exchangeRate: 3200,
          status: 'Pending',
          dateTime: d5,
          notes: 'Max-rank craft orders fulfilled; awaiting client trade.',
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
