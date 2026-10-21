// Backup files are untrusted. A crafted or corrupted file must never corrupt balances or wipe the ledger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { sanitizeRow } from '../src/lib/ledger/ledgerSchema.js';
import { settleUp } from '../src/lib/ledger/actions.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  return store;
}

test('rows with NaN, string money, bad enums or non-image proofs are rejected', () => {
  const good = { id: 'o1', lifecycle: 'done', currency: 'USD', grossMinor: 100, platformFeeMinor: 10 };
  assert.ok(sanitizeRow('orders', good));
  assert.equal(sanitizeRow('orders', { ...good, grossMinor: NaN }), null);
  assert.equal(sanitizeRow('orders', { ...good, grossMinor: '100' }), null);
  assert.equal(sanitizeRow('orders', { ...good, grossMinor: 1.5 }), null);
  assert.equal(sanitizeRow('orders', { ...good, platformFeeMinor: 999 }), null);
  assert.equal(sanitizeRow('orders', { ...good, lifecycle: 'hacked' }), null);
  assert.equal(sanitizeRow('orders', { ...good, currency: 'BTC' }), null);
  assert.equal(sanitizeRow('orders', { ...good, id: '' }), null);
  // long free text is trimmed (the order must survive a restore); a long reference id is rejected (it would point nowhere)
  assert.equal(sanitizeRow('orders', { ...good, title: 'x'.repeat(5000) }).title.length, 4000);
  assert.equal(sanitizeRow('orders', { ...good, payerId: 'y'.repeat(300) }), null);
  assert.equal(sanitizeRow('payments', { id: 'p', direction: 'out', kind: 'settlement', amountMinor: 0, currency: 'USD' }), null);
  assert.equal(sanitizeRow('payments', { id: 'p', direction: 'sideways', kind: 'settlement', amountMinor: 5, currency: 'USD' }), null);
  assert.equal(sanitizeRow('order_shares', { id: 's', orderId: 'o', partyId: 'p', amountMinor: -5, state: 'open' }), null);
  assert.equal(sanitizeRow('ledger_proofs', { id: 'x', ownerType: 'order', ownerId: 'o', data: 'javascript:alert(1)' }), null);
  assert.ok(sanitizeRow('ledger_proofs', { id: 'x', ownerType: 'order', ownerId: 'o', data: 'data:image/png;base64,AAAA' }));
});

test('unknown fields are dropped from imported rows', () => {
  const row = sanitizeRow('orders', { id: 'o1', lifecycle: 'done', currency: 'USD', grossMinor: 100, evil: '<script>' });
  assert.equal(row.evil, undefined);
});

test('merging a hostile backup keeps the valid rows and reports what it skipped', async () => {
  const store = await makeStore();
  const res = await store.mergeAll({
    parties: [{ id: 'p1', kind: 'booster', name: 'Ali' }, { id: 'p2', kind: 'booster', name: '' }],
    orders: [{ id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 500 }, { id: 'o2', lifecycle: 'done', currency: 'TOMAN', grossMinor: Infinity }],
    shares: [{ id: 's1', orderId: 'o1', partyId: 'p1', amountMinor: 100, state: 'done' }, { id: 's2', orderId: 'o1', partyId: 'p1', amountMinor: 'lots', state: 'done' }],
    payments: [], allocations: [],
    proofs: [{ id: 'pr', ownerType: 'order', ownerId: 'o1', data: 'data:text/html;base64,PHNjcmlwdD4=' }],
  });
  assert.equal(res.skipped, 4);
  const data = await store.loadAll();
  assert.equal(data.parties.length, 1);
  assert.equal(data.orders.length, 1);
  assert.equal(data.shares.length, 1);
  assert.deepEqual(await store.integrityReport(), []);
});

test('restoring from a garbage file does not touch the existing ledger when nothing in it is valid', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: { id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 500000, payerId: 'x', dateTime: '2026-09-01T00:00:00Z' }, shares: [{ partyId: ali.id, amountMinor: 100000 }] });
  await settleUp(store, { partyId: ali.id, amountMinor: 50000, currency: 'TOMAN', rates: RATES });
  const before = JSON.stringify(await store.exportAll());
  // mergeAll with junk adds nothing and removes nothing
  const res = await store.mergeAll({ orders: [{ id: 'z', lifecycle: 'nope' }], payments: 'not a list', meta: { schemaVersion: '99' } });
  assert.equal(res.skipped, 1);
  assert.equal(JSON.stringify(await store.exportAll()).length >= before.length, true);
  assert.equal((await store.loadAll()).orders.length, 1);
});

test('an exported ledger survives a round trip through validation unchanged', async () => {
  const a = await makeStore();
  const ali = await a.ensureParty('booster', 'Ali');
  await a.saveOrder({ order: { id: 'o1', lifecycle: 'done', currency: 'USD', grossMinor: 10000, platformFeeMinor: 1000, payerId: 'g', dateTime: '2026-09-01T00:00:00Z', title: 'Raid', exchangeRate: 3200, rateUnit: '1k' }, shares: [{ partyId: ali.id, amountMinor: 4000, note: 'n' }] });
  await settleUp(a, { partyId: ali.id, amountMinor: 1000000, currency: 'TOMAN', rates: RATES });
  await a.addProof({ ownerType: 'order', ownerId: 'o1', data: 'data:image/png;base64,AAAA' });
  await a.migrateLegacy([], { profile: 'advertiser' });
  const dump = JSON.parse(JSON.stringify(await a.exportAll()));
  const b = await makeStore();
  const res = await b.importAll(dump);
  assert.equal(res.skipped, 0, 'a real export must pass its own validation');
  assert.deepEqual(await b.exportAll(), await a.exportAll());
});
