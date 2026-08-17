/**
 * db.js - StorageDB IndexedDB wrapper for Nodra Pay
 * Persistent client-side database supporting screenshot attachments and zero quota limit.
 */

const DB_NAME = 'FreelanceGamingTrackerDB';
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
        results.sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0));
        resolve(results);
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

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async saveEntry(entry) {
    await this.initPromise;
    if (!this.db) return entry;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);
      const request = store.put(entry);

      request.onsuccess = () => resolve(entry);
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

  async bulkImport(entries) {
    await this.initPromise;
    if (!this.db || !Array.isArray(entries)) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ENTRIES], 'readwrite');
      const store = transaction.objectStore(STORE_ENTRIES);

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);

      for (const entry of entries) {
        if (entry && entry.id) {
          store.put(entry);
        }
      }
    });
  }

  async clearAll() {
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

  /**
   * Seed realistic sample data if DB is currently empty
   */
  async seedInitialDataIfEmpty() {
    const existing = await this.getAllEntries();
    if (existing.length === 0) {
      const now = new Date();
      const d1 = new Date(now.getTime() - 1 * 86400000).toISOString().slice(0, 16);
      const d2 = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 16);
      const d3 = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 16);
      const d4 = new Date(now.getTime() - 10 * 86400000).toISOString().slice(0, 16);
      const d5 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 16);

      const sampleEntries = [
        {
          id: 'job_' + Date.now() + '_1',
          title: 'Mythic+ +20 Boost (Key Run)',
          game: 'World of Warcraft',
          income: 450000,
          currency: 'WOW_GOLD',
          status: 'Paid',
          dateTime: d1,
          hours: 2.5,
          notes: 'Timed +20 dungeon run with specific loot funnel.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_2',
          title: 'Ulduar 25-man GDKP Raid Run',
          game: 'World of Warcraft Classic',
          income: 850000,
          currency: 'WOW_GOLD',
          status: 'Paid',
          dateTime: d2,
          hours: 4.0,
          notes: 'Full clear GDKP raid with gold pot split.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_3',
          title: 'Leveling 1-80 Service',
          game: 'World of Warcraft Classic',
          income: 3500000,
          currency: 'TOMAN',
          status: 'Working',
          dateTime: d3,
          hours: 12.0,
          notes: 'Fast 1-80 questing and dungeon leveling service.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_4',
          title: 'Custom WeakAuras UI Setup',
          game: 'World of Warcraft',
          income: 180,
          currency: 'USD',
          status: 'Pending',
          dateTime: d4,
          hours: 5.0,
          notes: 'Custom Mythic raid aura suite and action bar integration.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_5',
          title: 'Gold Farming / Crafting Order',
          game: 'World of Warcraft',
          income: 600000,
          currency: 'WOW_GOLD',
          status: 'On Hold',
          dateTime: d5,
          hours: 6.0,
          notes: 'Profession craft orders fulfilled; awaiting client trade.',
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
