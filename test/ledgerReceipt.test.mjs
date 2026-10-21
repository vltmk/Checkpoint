import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { markOrderCollected, markSharePaid } from '../src/lib/ledger/actions.js';
import { buildReceipt, receiptLines, receiptPlainText, receiptDiscord, heroMinor, heroLabel, statusText, statusTone, receiptCode, RECEIPT_WORDS } from '../src/lib/ledger/receipt.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const fmt = {
  money: (minor, cur) => `${cur === 'USD' || cur === 'EUR' ? minor / 100 : minor} ${cur}`,
  date: (iso) => String(iso).slice(0, 10),
  time: (iso) => String(iso).slice(11, 16),
  num: (n) => String(n),
};

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const store = createLedgerStore(createSqliteBackend({ async execute(s, p = []) { db.prepare(s).run(...p); }, async select(s, p = []) { return db.prepare(s).all(...p); } }));
  await store.init();
  return store;
}
const order = (over) => ({ id: 'ord_abc12345', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 100000, payerId: 'g2g', title: 'Mythic+ x4', game: 'World of Warcraft', orderRef: 'G2G-1', dateTime: '2026-10-21T09:10:00.000Z', note: 'fast run', ...over });

async function fixture() {
  const store = await makeStore();
  await store.saveParty({ id: 'g2g', kind: 'platform', name: 'G2G' });
  const ali = await store.ensureParty('booster', 'Ali');
  const sara = await store.ensureParty('booster', 'Sara');
  await store.saveOrder({ order: order(), shares: [{ partyId: ali.id, amountMinor: 300000 }, { partyId: sara.id, amountMinor: 200000 }] });
  return { store, ali, sara };
}

test('a receipt reads its numbers from the ledger: price, fee, boosters, what you keep', async () => {
  const { store } = await fixture();
  const vm = buildReceipt(await store.loadAll(), 'ord_abc12345');
  assert.equal(vm.code, 'ABC12345');
  assert.equal(vm.title, 'Mythic+ x4');
  assert.equal(vm.payer, 'G2G');
  assert.equal(vm.grossMinor, 1000000);
  assert.equal(vm.feeMinor, 100000);
  assert.equal(vm.feePct, 10);
  assert.equal(vm.sharesTotalMinor, 500000);
  assert.equal(vm.marginMinor, 400000);
  assert.deepEqual(vm.shares.map((s) => [s.name, s.amountMinor, s.paid]), [['Ali', 300000, false], ['Sara', 200000, false]]);
  assert.equal(buildReceipt(await store.loadAll(), 'nope'), null);
});

test('each document leads with its own number: the client price, the payout to boosters, or what you earned', async () => {
  const { store } = await fixture();
  const vm = buildReceipt(await store.loadAll(), 'ord_abc12345');
  assert.equal(heroMinor(vm, 'client'), 1000000);
  assert.equal(heroMinor(vm, 'slip'), 500000);
  assert.equal(heroMinor(vm, 'work'), 400000);
  assert.equal(heroLabel(vm, 'work', 'en'), 'Your share'); // a job split with a team
  const solo = buildReceipt({ ...(await store.loadAll()), shares: [] }, 'ord_abc12345');
  assert.equal(heroLabel(solo, 'work', 'en'), 'You earned');
});

test('payment state is real: collected, and each booster paid on their own date', async () => {
  const { store, ali } = await fixture();
  let vm = buildReceipt(await store.loadAll(), 'ord_abc12345');
  assert.equal(statusTone(vm), 'unpaid');
  assert.equal(statusText(vm, 'en', fmt), 'Not paid yet');
  await markOrderCollected(store, 'ord_abc12345', { rates: RATES, dateTime: '2026-10-22T10:00:00.000Z' });
  const share = (await store.loadAll()).shares.find((s) => s.partyId === ali.id);
  await markSharePaid(store, share.id, { rates: RATES, dateTime: '2026-10-23T11:00:00.000Z' });
  vm = buildReceipt(await store.loadAll(), 'ord_abc12345');
  assert.equal(vm.collected, true);
  assert.equal(vm.collectedAt, '2026-10-22T10:00:00.000Z');
  assert.equal(statusText(vm, 'en', fmt), 'Paid 2026-10-22');
  const a = vm.shares.find((s) => s.name === 'Ali');
  assert.equal(a.paid, true);
  assert.equal(a.paidAt, '2026-10-23T11:00:00.000Z');
  assert.equal(statusText(vm, 'en', fmt, { share: a }), 'Paid 2026-10-23');
  assert.equal(statusTone(vm, { share: vm.shares.find((s) => s.name === 'Sara') }), 'unpaid');
});

test('a failed order says so and carries no earnings', async () => {
  const { store } = await fixture();
  await store.setLifecycle('ord_abc12345', 'failed');
  const vm = buildReceipt(await store.loadAll(), 'ord_abc12345');
  assert.equal(vm.dead, true);
  assert.equal(vm.marginMinor, 0);
  assert.equal(statusTone(vm), 'dead');
  assert.equal(statusText(vm, 'en', fmt), 'Failed');
});

test('the rates row appears only for jobs that are not in Toman, with the rates saved on the job', async () => {
  const store = await makeStore();
  await store.saveOrder({ order: order({ id: 'ord_usd00001', currency: 'USD', grossMinor: 10000, platformFeeMinor: 0, payerId: null, rates: { goldRateTOMAN: 3200, usdRateTOMAN: 95000, eurRateUSD: 1.1 } }), shares: [] });
  await store.saveOrder({ order: order({ id: 'ord_tmn00001', payerId: null }), shares: [] });
  const data = await store.loadAll();
  const usd = buildReceipt(data, 'ord_usd00001');
  assert.equal(usd.rates.usdRateTOMAN, 95000);
  assert.equal(usd.tomanMinor(10000), 9500000, 'a hundred dollars at the rate saved on the job, not at today rates');
  assert.ok(receiptLines(usd, 'work', 'en', fmt).some(([k, v]) => k === RECEIPT_WORDS.en.rates && v.includes('95000')));
  const toman = buildReceipt(data, 'ord_tmn00001');
  assert.equal(toman.rates, null);
  assert.equal(toman.tomanMinor(1), null);
  assert.ok(!receiptLines(toman, 'work', 'en', fmt).some(([k]) => k === RECEIPT_WORDS.en.rates), 'no stray conversion row on a Toman receipt');
});

test('the client receipt never shows internal numbers; the slip lists each booster; copies match the card', async () => {
  const { store } = await fixture();
  const vm = buildReceipt(await store.loadAll(), 'ord_abc12345');
  const client = receiptPlainText(vm, 'client', 'en', fmt);
  assert.match(client, /Order total: 1000000 TOMAN/);
  assert.ok(!/Ali|Sara|Platform fee/.test(client), 'no boosters or fees on the client copy');
  const slip = receiptPlainText(vm, 'slip', 'en', fmt);
  assert.match(slip, /Ali: 300000 TOMAN \(Not paid yet\)/);
  assert.match(slip, /Sara: 200000 TOMAN/);
  assert.match(slip, /Total payout: 500000 TOMAN/);
  const one = receiptPlainText(vm, 'slip', 'en', fmt, { onlyShare: vm.shares[0] });
  assert.match(one, /Booster: Ali: 300000 TOMAN/);
  assert.ok(!/Sara/.test(one), 'a single slip names only that booster');
  const work = receiptDiscord(vm, 'work', 'en', fmt);
  assert.ok(work.startsWith('```ini\n[ CHECKPOINT - Proof of work receipt ]') && work.endsWith('```'));
  assert.match(work, /Your share\s+= 400000 TOMAN/);
  assert.match(work, /Platform fee\s+= 10% \(100000 TOMAN\)/);
});

test('receipts speak Farsi when asked, with the same facts', async () => {
  const { store } = await fixture();
  const vm = buildReceipt(await store.loadAll(), 'ord_abc12345');
  const fa = receiptPlainText(vm, 'client', 'fa', fmt);
  assert.match(fa, /مبلغ سفارش: 1000000 TOMAN/);
  assert.match(fa, /وضعیت: هنوز پرداخت نشده/);
  assert.deepEqual(Object.keys(RECEIPT_WORDS.en).sort(), Object.keys(RECEIPT_WORDS.fa).sort());
});

test('receipt codes are short, upper case and stable', () => {
  assert.equal(receiptCode('ord_k3j2h1g0f9'), 'J2H1G0F9');
  assert.equal(receiptCode('x'), 'X');
  assert.equal(receiptCode(''), 'JOB');
});
