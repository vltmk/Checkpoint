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
          store.createIndex('category', 'category', { unique: false });
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
      const d2 = new Date(now.getTime() - 4 * 86400000).toISOString().slice(0, 16);
      const d3 = new Date(now.getTime() - 8 * 86400000).toISOString().slice(0, 16);
      const d4 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 16);

      const sampleEntries = [
        {
          id: 'job_' + Date.now() + '_1',
          title: 'Roblox Simulator Map & Pet 3D Assets',
          game: 'Pet Royale [Roblox]',
          category: '3D Art / Assets',
          platform: 'Roblox Studio / Blender',
          income: 45000,
          currency: 'ROBUX',
          status: 'Paid',
          dateTime: d1,
          hours: 14.0,
          deliverableUrl: 'https://www.roblox.com',
          tags: ['roblox', '3d-assets', 'pets', 'low-poly'],
          notes: 'Modeled 6 custom mythical eggs, hatching animations, and spawn island environment.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_2',
          title: 'Unreal Engine 5 Boss Encounter AI & Behavior Trees',
          game: 'Aethelgard RPG',
          category: 'Game Dev / Code',
          platform: 'Unreal 5.4 / C++',
          income: 650.0,
          currency: 'USD',
          status: 'Paid',
          dateTime: d2,
          hours: 12.5,
          deliverableUrl: 'https://github.com/example/boss-ai-module',
          tags: ['ai', 'boss-fight', 'c++', 'blueprints'],
          notes: 'Implemented Phase 2 rage mechanic, custom navmesh query filter, and spell telegraphing system.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_3',
          title: 'Valorant Radiant Coaching & Duo VOD Review (4 Sessions)',
          game: 'Valorant',
          category: 'Coaching / Boosting',
          platform: 'Discord / Riot',
          income: 8500000,
          currency: 'TOMAN',
          status: 'Paid',
          dateTime: d3,
          hours: 8.0,
          deliverableUrl: '',
          tags: ['coaching', 'vod-review', 'radiant', 'toman'],
          notes: 'Full utility guide for Sova and Fade lineups on Lotus and Sunset.',
          proofs: [],
        },
        {
          id: 'job_' + Date.now() + '_4',
          title: 'Custom World of Warcraft UI / WeakAuras Suite',
          game: 'World of Warcraft',
          category: 'Game Dev / Code',
          platform: 'Lua / Addon',
          income: 1250000,
          currency: 'WOW_GOLD',
          status: 'Escrow',
          dateTime: d4,
          hours: 6.0,
          deliverableUrl: 'https://wago.io',
          tags: ['weakauras', 'mythic-plus', 'lua'],
          notes: 'Custom cooldown trackers and raid warning sound triggers for Mythic progression.',
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
