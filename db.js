/**
 * db.js - IndexedDB storage for Freelance Gaming Tracker
 * Handles structured work entries and base64/blob image proof attachments.
 */

const DB_NAME = 'FreelanceGamingTrackerDB';
const DB_VERSION = 1;
const STORE_ENTRIES = 'work_entries';

class StorageDB {
    constructor() {
        this.db = null;
        this.initPromise = this.init();
    }

    async init() {
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
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_ENTRIES], 'readonly');
            const store = transaction.objectStore(STORE_ENTRIES);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result || [];
                results.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
                resolve(results);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getEntry(id) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_ENTRIES], 'readonly');
            const store = transaction.objectStore(STORE_ENTRIES);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async saveEntry(entry) {
        await this.initPromise;
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
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_ENTRIES], 'readwrite');
            const store = transaction.objectStore(STORE_ENTRIES);

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (e) => reject(e.target.error);

            for (const entry of entries) {
                store.put(entry);
            }
        });
    }

    async clearAll() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_ENTRIES], 'readwrite');
            const store = transaction.objectStore(STORE_ENTRIES);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

window.trackerDB = new StorageDB();
