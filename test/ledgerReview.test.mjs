// Regression tests for defects found by independent review. Each test names the failure it guards against.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore, LedgerValidationError } from '../src/lib/ledger/ledgerStore.js';
import { allocateFifo, buildContext, partyBalance, payerReceivables } from '../src/lib/ledger/engine.js';
import { cockpitSummary, marginReport, partyStatement } from '../src/lib/ledger/selectors.js';
import { settleUp, markSharePaid, markOrderCollected } from '../src/lib/ledger/actions.js';
import { mapLegacyEntries, partyIdFor, slug, UNASSIGNED_PARTY_ID } from '../src/lib/ledger/legacyMapper.js';
import { buildOrdersCsv } from '../src/lib/ledger/backup.js';
import { buildSampleLedger } from '../src/lib/ledger/sampleData.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const NOW = Date.parse('2026-10-21T00:00:00Z');

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  return store;
}
const order = (over = {}) => ({ id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 0, payerId: 'g', dateTime: '2026-09-01T00:00:00Z', title: 'T', ...over });

test('a dust-sized target no longer swallows the whole payment', () => {
  const r = allocateFifo({
    amountMinor: 1000, currency: 'USD', rates: RATES, // $10.00
    targets: [
      { type: 'share', id: 'dust', currency: 'TOMAN', outstandingMinor: 40, dateTime: '2026-09-01T00:00:00Z' },
      { type: 'share', id: 'real', currency: 'USD', outstandingMinor: 500, dateTime: '2026-09-02T00:00:00Z' },
    ],
  });
  assert.equal(r.allocations.find((a) => a.targetId === 'dust').appliedMinor, 40);
  assert.equal(r.allocations.find((a) => a.targetId === 'real').appliedMinor, 500);
  assert.equal(r.remainderMinor, 500); // nothing vanished: $5.00 is left over, and it stays visible as credit
  const consumed = r.allocations.reduce((s, a) => s + a.consumedMinor, 0);
  assert.equal(consumed + r.remainderMinor, 1000);
});

test('double-clicking Mark paid pays once; the second call is refused', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 100000 }] });
  const share = (await store.loadAll()).shares[0];
  const results = await Promise.allSettled([markSharePaid(store, share.id, { rates: RATES }), markSharePaid(store, share.id, { rates: RATES })]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await store.loadAll()).payments.length, 1);
  assert.deepEqual(await store.integrityReport(), []);
});

test('double-clicking Mark collected collects once', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: order(), shares: [] });
  const results = await Promise.allSettled([markOrderCollected(store, 'o1', { rates: RATES }), markOrderCollected(store, 'o1', { rates: RATES })]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await store.loadAll()).payments.length, 1);
});

test('editing a share below what was paid turns the difference into credit instead of losing it', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 100000 }] });
  await markSharePaid(store, (await store.loadAll()).shares[0].id, { rates: RATES });
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 60000 }] });
  const bal = partyBalance(await store.loadContext(), ali.id);
  assert.deepEqual(bal.payable, {});
  assert.equal(bal.advance.TOMAN, 40000);
});

test('changing the currency of an order that already has payments is refused', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 100000 }] });
  await markSharePaid(store, (await store.loadAll()).shares[0].id, { rates: RATES });
  await assert.rejects(store.saveOrder({ order: order({ currency: 'USD' }), shares: [{ partyId: ali.id, amountMinor: 100000 }] }), LedgerValidationError);
  // before any money moves, a currency change is fine
  await store.saveOrder({ order: order({ id: 'o2' }), shares: [] });
  await store.saveOrder({ order: order({ id: 'o2', currency: 'USD' }), shares: [] });
});

test('classic gold keeps its locked rate on every screen (cockpit, statement, reports)', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  // 500 gold, classic: 7000 Toman per 1 gold; Ali is owed 300 gold
  await store.saveOrder({ order: order({ currency: 'GOLD', grossMinor: 500, exchangeRate: 7000, rateUnit: '1', payerId: null }), shares: [{ partyId: ali.id, amountMinor: 300 }] });
  const data = await store.loadAll();
  const ctx = buildContext(data);
  const c = cockpitSummary(ctx, data.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.equal(c.owedNowMinor, 2100000); // 300 gold x 7000, not the 3200-per-1k retail rate
  const st = partyStatement(ctx, ali.id, { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(st.display.netMinor, 2100000);
  assert.equal(st.events[0].runningMinor, 2100000);
  const rep = marginReport(ctx, new Map(data.parties.map((p) => [p.id, p])), { rates: RATES, displayCurrency: 'TOMAN' });
  assert.equal(rep.totals.marginMinor, 1400000); // 200 gold x 7000
});

test('legacy "Pending" (labelled Complete) migrates to done, so finished unpaid work is owed now', () => {
  const m = mapLegacyEntries([{ id: 'j', title: 'x', currency: 'TOMAN', pot: 1000000, income: 400000, teammates: ['Ali', 'Sara'], teammateCuts: { Ali: '300000', Sara: '300000' }, status: 'Pending', source: 'G2G', dateTime: '2026-09-01T00:00', sourcePaid: false, boosterPaid: false }]);
  assert.equal(m.orders[0].lifecycle, 'done');
  assert.ok(m.shares.every((s) => s.state === 'done'));
  const ctx = buildContext(m);
  assert.equal(partyBalance(ctx, partyIdFor('booster', 'Ali')).payable.TOMAN, 300000);
});

test('booster profile: Complete (Pending) income is earned but not yet received', () => {
  const m = mapLegacyEntries([{ id: 'b', title: 'x', currency: 'TOMAN', income: 500000, status: 'Pending', source: 'Guild', dateTime: '2026-09-01T00:00' }], { profile: 'booster' });
  assert.equal(m.payments.length, 0);
  const paid = mapLegacyEntries([{ id: 'b', title: 'x', currency: 'TOMAN', income: 500000, status: 'Paid', source: 'Guild', dateTime: '2026-09-01T00:00' }], { profile: 'booster' });
  assert.equal(paid.payments.filter((p) => p.direction === 'in').length, 1);
});

test('cuts rounded to the cent do not invent a 1-cent "Unassigned" debt or a flag', () => {
  // $100 at 15% with 3 boosters: the old form stored 28.33 each (84.99 of an 85.00 pool)
  const m = mapLegacyEntries([{ id: 'r', title: 'x', currency: 'USD', pot: 100, income: 15, teammates: ['A', 'B', 'C'], teammateCuts: { A: '28.33', B: '28.33', C: '28.33' }, status: 'Working', source: 'FunPay', dateTime: '2026-09-01T00:00' }]);
  assert.equal(m.shares.some((s) => s.partyId === UNASSIGNED_PARTY_ID), false);
  assert.deepEqual(m.flags.filter((f) => f.code !== 'approximate_rate'), []);
});

test('one person, however the name was typed: Arabic/Persian letters, joiners and case', () => {
  assert.equal(slug('على'), slug('علی'));
  assert.equal(slug('كیان'), slug('کیان'));
  assert.equal(slug('محمد‌رضا'), slug('محمدرضا'));
  assert.equal(partyIdFor('booster', '  ALI '), partyIdFor('booster', 'ali'));
  assert.notEqual(partyIdFor('booster', 'علی'), partyIdFor('booster', 'علا'));
});

test('no hash collisions across thousands of short Persian names', () => {
  const letters = [...'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'];
  const seen = new Map();
  for (const a of letters) for (const b of letters) for (const c of letters) {
    const name = a + b + c;
    const id = partyIdFor('booster', name);
    assert.ok(!seen.has(id) || slug(seen.get(id)) === slug(name), `collision: ${seen.get(id)} / ${name}`);
    seen.set(id, name);
  }
});

test('case-variants of one name add their cuts together instead of leaving half as Unassigned', () => {
  const m = mapLegacyEntries([{ id: 'c', title: 'x', currency: 'TOMAN', pot: 1000, income: 100, teammates: ['Ali', 'ali'], teammateCuts: { Ali: '450', ali: '450' }, status: 'Working', source: 'G2G', dateTime: '2026-09-01T00:00' }]);
  assert.equal(m.shares.length, 1);
  assert.equal(m.shares[0].amountMinor, 900);
});

test('income above the pot is flagged, not silently absorbed', () => {
  const m = mapLegacyEntries([{ id: 'x', title: 't', currency: 'USD', pot: 50, income: 70, teammates: [], status: 'Paid', source: 'G2G', dateTime: '2026-09-01T00:00' }]);
  assert.ok(m.flags.some((f) => f.code === 'income_exceeds_pot'));
});

test('an archived booster who is still owed money stays in the totals; the migration catch-all is not a debt', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 100000 }] });
  await store.saveParty({ ...(await store.loadAll()).parties.find((p) => p.id === ali.id), archived: 1 });
  let data = await store.loadAll();
  let c = cockpitSummary(buildContext(data), data.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.equal(c.owedNowMinor, 100000);
  const un = await store.saveParty({ id: UNASSIGNED_PARTY_ID, kind: 'booster', name: 'Unassigned' });
  await store.saveOrder({ order: order({ id: 'o2' }), shares: [{ partyId: un.id, amountMinor: 50000 }] });
  data = await store.loadAll();
  c = cockpitSummary(buildContext(data), data.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.equal(c.owedNowMinor, 100000);
});

test('an order with no payer still counts in what you are owed', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: order({ payerId: null }), shares: [] });
  const data = await store.loadAll();
  const c = cockpitSummary(buildContext(data), data.parties, { rates: RATES, displayCurrency: 'TOMAN', now: NOW });
  assert.equal(c.owedToMeMinor, 1000000);
  assert.equal(payerReceivables(buildContext(data), null, NOW).releasable.TOMAN, 1000000);
});

test('moving a done order back to working returns its shares to in-progress', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 100000 }] });
  assert.equal(partyBalance(await store.loadContext(), ali.id).payable.TOMAN, 100000);
  await store.setLifecycle('o1', 'working');
  const bal = partyBalance(await store.loadContext(), ali.id);
  assert.deepEqual(bal.payable, {});
  assert.equal(bal.committed.TOMAN, 100000);
  await store.setLifecycle('o1', 'done');
  assert.equal(partyBalance(await store.loadContext(), ali.id).payable.TOMAN, 100000);
});

test('removing the sample also removes payments the user recorded against sample people', async () => {
  const store = await makeStore();
  await store.mergeAll(buildSampleLedger(NOW));
  await settleUp(store, { partyId: 'demo_sara', amountMinor: 100, currency: 'USD', rates: RATES });
  await store.removeDemo();
  const data = await store.loadAll();
  assert.equal(data.payments.length, 0);
  assert.equal(data.allocations.length, 0);
});

test('a real person named like a sample person is not mistaken for them', async () => {
  const store = await makeStore();
  await store.mergeAll(buildSampleLedger(NOW));
  const real = await store.ensureParty('booster', 'Ali');
  assert.ok(!real.id.startsWith('demo_'));
  await store.removeDemo();
  assert.ok((await store.loadAll()).parties.some((p) => p.id === real.id));
});

test('renaming cannot create or merge duplicates; a renamed person is still found by the new name', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  const sara = await store.ensureParty('booster', 'Sara');
  await assert.rejects(store.saveParty({ ...sara, name: 'ali' }), LedgerValidationError);
  await store.saveParty({ ...sara, name: 'Sarah' });
  const again = await store.ensureParty('booster', 'sarah');
  assert.equal(again.id, sara.id);
  assert.equal((await store.loadAll()).parties.length, 2);
  void ali;
});

test('unsafe integers are refused on write, not only on restore', async () => {
  const store = await makeStore();
  await assert.rejects(store.saveOrder({ order: order({ grossMinor: 9.99e21 }), shares: [] }), LedgerValidationError);
  await assert.rejects(store.recordPayment({ payment: { direction: 'out', partyId: 'x', amountMinor: 9.99e21, currency: 'USD', kind: 'settlement' } }), LedgerValidationError);
});

test('exports keep negative numbers negative while still neutralising text formulas', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order({ title: '=SUM(1)', grossMinor: 100000 }), shares: [{ partyId: ali.id, amountMinor: 300000 }] });
  const csv = buildOrdersCsv(await store.loadAll());
  assert.ok(csv.includes('"-200000"'), csv);
  assert.ok(csv.includes(`"'=SUM(1)"`));
});

test('an interrupted write leaves a marker that is reported at the next start, and local markers never travel in backups', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  const orig = store.backend.upsert;
  let n = 0;
  store.backend.upsert = async (...a) => { if (a[0] === 'orders' && ++n === 1) throw new Error('crash'); return orig(...a); };
  await assert.rejects(store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 100 }] }));
  store.backend.upsert = orig;
  const dump = await store.exportAll();
  assert.equal(dump.meta.inflight, undefined);
  const rec = await store.takeInterrupted();
  assert.equal(rec.op, 'saveOrder');
  assert.equal(rec.id, 'o1');
  await store.dismissInterrupted();
  assert.equal(await store.takeInterrupted(), null);
});

test('a normal save leaves no marker', async () => {
  const store = await makeStore();
  const ali = await store.ensureParty('booster', 'Ali');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 100 }] });
  await settleUp(store, { partyId: ali.id, amountMinor: 50, currency: 'TOMAN', rates: RATES });
  assert.equal(await store.takeInterrupted(), null);
});

test('saving a flagged migrated order resolves its review note', async () => {
  const store = await makeStore();
  await store.migrateLegacy([{ id: 'f', title: 'x', currency: 'TOMAN', pot: 1000, income: 100, teammates: [], status: 'Working', source: 'G2G', dateTime: '2026-09-01T00:00' }], { profile: 'advertiser' });
  const data = await store.loadAll();
  assert.ok(data.flags.some((f) => f.code === 'unassigned_pool' && !f.resolved));
  const o = data.orders[0];
  await store.saveOrder({ order: o, shares: data.shares.map((s) => ({ partyId: s.partyId, amountMinor: s.amountMinor })) });
  assert.ok((await store.loadAll()).flags.every((f) => f.resolved));
});
