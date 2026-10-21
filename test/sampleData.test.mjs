import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { sanitizeRow } from '../src/lib/ledger/ledgerSchema.js';
import { buildSampleLedger, isDemoId } from '../src/lib/ledger/sampleData.js';
import { cockpitSummary } from '../src/lib/ledger/selectors.js';
import { buildContext, partyBalance } from '../src/lib/ledger/engine.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const NOW = Date.parse('2026-10-21T00:00:00Z');

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  return store;
}

test('every sample row passes the same validation as an imported file', () => {
  const s = buildSampleLedger(NOW);
  const tables = { parties: s.parties, orders: s.orders, order_shares: s.shares, payments: s.payments, payment_allocations: s.allocations };
  for (const [table, rows] of Object.entries(tables)) for (const r of rows) assert.ok(sanitizeRow(table, r), `${table} ${r.id}`);
});

test('the sample is internally consistent and shows owed, held and exposure', async () => {
  const store = await makeStore();
  const res = await store.mergeAll(buildSampleLedger(NOW));
  assert.equal(res.skipped, 0);
  assert.deepEqual(await store.integrityReport(), []);
  const data = await store.loadAll();
  const ctx = buildContext(data);
  const c = cockpitSummary(ctx, data.parties, { rates: RATES, displayCurrency: 'USD', now: NOW });
  assert.ok(c.owedNowMinor > 0, 'someone is owed money');
  assert.ok(c.committedMinor > 0, 'some work is in progress');
  assert.ok(c.owedToMeMinor > 0, 'platforms owe the seller');
  assert.ok(c.advancesMinor > 0, 'one booster holds an advance');
  assert.equal(partyBalance(ctx, 'demo_ali').payable.USD, 2000); // 30 + 40 earned - 50 paid
});

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
