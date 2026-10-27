/**
 * sampleData.js - recognises rows from the sample ledger older versions could load. Every one of its ids starts with
 * `demo_`, so a workspace that still has them can drop them in one step (store.removeDemo) without touching
 * anything the user created. The app no longer offers to load a sample.
 */
export const DEMO_PREFIX = 'demo_';

export const isDemoId = (id) => typeof id === 'string' && id.startsWith(DEMO_PREFIX);
