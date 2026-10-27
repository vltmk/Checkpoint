// Workspaces from older versions may still hold the sample ledger: removing it must never touch the user's own data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { isDemoId } from '../src/lib/ledger/sampleData.js';
import { buildSampleLedger } from './fixtures/demoLedger.mjs';

const NOW = Date.parse('2026-10-21T00:00:00Z');

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  return store;
}

test('removing the sample leaves the user\'s own orders and payments untouched', async () => {
  const store = await makeStore();
  await store.mergeAll(buildSampleLedger(NOW));
  const me = await store.ensureParty('booster', 'Mine');
  await store.saveOrder({ order: { id: 'ord_mine', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000, payerId: null, dateTime: '2026-10-01T00:00:00Z' }, shares: [{ partyId: me.id, amountMinor: 400 }] });
  await store.addProof({ ownerType: 'order', ownerId: 'ord_mine', data: 'data:image/png;base64,AAAA' });
  await store.removeDemo();
  const data = await store.loadAll();
  assert.deepEqual(data.orders.map((o) => o.id), ['ord_mine']);
  assert.deepEqual(data.parties.map((p) => p.id), [me.id]);
  assert.equal(data.shares.length, 1);
  assert.equal(data.payments.length, 0);
  assert.equal(data.allocations.length, 0);
  assert.equal((await store.listProofs('order', 'ord_mine')).length, 1);
  assert.deepEqual(await store.integrityReport(), []);
});

test('sample ids are recognisable, so they can be removed without touching real data', () => {
  assert.ok(isDemoId('demo_o1'));
  assert.ok(!isDemoId('ord_abc'));
  assert.ok(!isDemoId(null));
});
