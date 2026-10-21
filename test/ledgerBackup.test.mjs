import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { settleUp, receivePayout } from '../src/lib/ledger/actions.js';
import { ledgerFingerprint, buildOrdersCsv, buildPaymentsCsv } from '../src/lib/ledger/backup.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
let tick = 0;

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap), { now: () => new Date(Date.UTC(2026, 9, 1, 0, 0, ++tick)).toISOString() });
  await store.init();
  return store;
}

async function seeded() {
  const store = await makeStore();
  const g2g = await store.ensureParty('platform', 'G2G');
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: { id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: g2g.id, dateTime: '2026-09-01T10:00:00Z', title: '=HYPERLINK("x")', orderRef: 'A1' }, shares: [{ partyId: ali.id, amountMinor: 400000 }] });
  return { store, g2g, ali };
}

test('fingerprint changes for every kind of edit, so the auto-backup never skips real changes', async () => {
  const { store, g2g, ali } = await seeded();
  const seen = new Set([ledgerFingerprint(await store.exportAll())]);
  const step = async (label, fn) => {
    await fn();
    const fp = ledgerFingerprint(await store.exportAll());
    assert.ok(!seen.has(fp), `fingerprint did not change after: ${label}`);
    seen.add(fp);
  };
  await step('record a payment', () => settleUp(store, { partyId: ali.id, amountMinor: 100000, currency: 'TOMAN', rates: RATES }));
  await step('receive a payout', () => receivePayout(store, { payerId: g2g.id, amountMinor: 900000, currency: 'TOMAN', rates: RATES }));
  await step('add a proof', async () => store.addProof({ ownerType: 'order', ownerId: 'o1', data: 'data:image/png;base64,AAAA' }));
  await step('change lifecycle', () => store.setLifecycle('o1', 'failed'));
  await step('rename a person', async () => store.saveParty({ ...(await store.loadAll()).parties.find((p) => p.id === ali.id), name: 'Ali R' }));
  const payment = (await store.loadAll()).payments[0];
  await step('void a payment', () => store.voidPayment(payment.id));
});

test('fingerprint is stable when nothing changed', async () => {
  const { store } = await seeded();
  assert.equal(ledgerFingerprint(await store.exportAll()), ledgerFingerprint(await store.exportAll()));
});

test('orders CSV has the money columns, and neutralises spreadsheet formulas', async () => {
  const { store, ali } = await seeded();
  await settleUp(store, { partyId: ali.id, amountMinor: 400000, currency: 'TOMAN', rates: RATES });
  const csv = buildOrdersCsv(await store.loadAll());
  const [header, row] = csv.split('\n');
  assert.match(header, /"Your margin"/);
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(row.includes('"500000"')); // margin 1,000,000 - 100,000 fee - 400,000 boosters
  assert.ok(row.includes('"Ali 400000"'));
  assert.match(row, /"no","yes"/); // not collected, boosters paid
});

test('payments CSV lists voided payments as such', async () => {
  const { store, ali } = await seeded();
  const pay = await settleUp(store, { partyId: ali.id, amountMinor: 100000, currency: 'TOMAN', rates: RATES, note: 'bank' });
  await store.voidPayment(pay.id);
  const rows = buildPaymentsCsv(await store.loadAll()).split('\n');
  assert.equal(rows.length, 2);
  assert.match(rows[1], /"yes"$/);
});

test('merging a backup keeps local edits and adds what is missing', async () => {
  const a = await seeded();
  const dump = await a.store.exportAll();
  const b = await makeStore();
  await b.mergeAll(dump);
  const local = (await b.loadAll()).orders[0];
  await b.saveOrder({ order: { ...local, title: 'edited here' }, shares: (await b.loadAll()).shares });
  await b.mergeAll(dump);
  const data = await b.loadAll();
  assert.equal(data.orders.length, 1);
  assert.equal(data.orders[0].title, 'edited here');
  assert.equal(await b.getMeta('schemaVersion'), '2');
});
