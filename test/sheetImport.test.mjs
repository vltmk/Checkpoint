import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteBackend } from '../src/lib/ledger/ledgerBackends.js';
import { createLedgerStore } from '../src/lib/ledger/ledgerStore.js';
import { buildContext, orderMarginMinor, partyBalance } from '../src/lib/ledger/engine.js';
import {
  parseDelimited, suggestMapping, buildImport, parseMoneyCell, parseDateCell, detectDateOrder, detectCurrency, parseLifecycle,
} from '../src/lib/ledger/sheetImport.js';

const SHEET = [
  ['Date', 'Order', 'Order ID', 'Platform', 'Price', 'Booster', 'Booster pay', 'Status', 'Paid by client', 'Booster paid'].join('\t'),
  ['2026-10-01', 'M+ 15 run', 'A1', 'G2G', '$100.00', 'Ali', '$40', 'Done', 'yes', 'no'].join('\t'),
  ['2026-10-01', 'M+ 15 run', 'A1', 'G2G', '$100.00', 'Sara', '$30', 'Done', 'yes', 'yes'].join('\t'),
  ['10/05/2026', 'Leveling "70-80"', '', 'FunPay', '60', 'Reza', '35', 'in progress', '', ''].join('\t'),
  ['', '', '', '', '', '', '', '', '', ''].join('\t'),
].join('\n');

async function makeStore() {
  const db = new DatabaseSync(':memory:');
  const wrap = { async execute(sql, p = []) { db.prepare(sql).run(...p); }, async select(sql, p = []) { return db.prepare(sql).all(...p); } };
  const store = createLedgerStore(createSqliteBackend(wrap));
  await store.init();
  return store;
}

test('parses tab-separated text from Sheets, with quotes and blank rows', () => {
  const { rows, delimiter } = parseDelimited(SHEET);
  assert.equal(delimiter, '\t');
  assert.equal(rows.length, 4); // header + 3 data rows, blank row dropped
  assert.equal(rows[3][1], 'Leveling "70-80"');
  const csv = parseDelimited('a,b\n"x, y","he said ""hi"""\n');
  assert.deepEqual(csv.rows[1], ['x, y', 'he said "hi"']);
});

test('parses semicolon CSV and quoted multi-line cells', () => {
  const { rows } = parseDelimited('a;b\n"line1\nline2";2\n');
  assert.deepEqual(rows[1], ['line1\nline2', '2']);
});

test('suggests a column mapping from English and Farsi headers', () => {
  const en = suggestMapping(['Date', 'Order', 'Order ID', 'Platform', 'Price', 'Booster', 'Booster pay', 'Status']);
  assert.deepEqual([en.date, en.title, en.orderRef, en.platform, en.price, en.booster, en.boosterAmount, en.status], [0, 1, 2, 3, 4, 5, 6, 7]);
  const fa = suggestMapping(['تاریخ', 'سفارش', 'پلتفرم', 'مبلغ', 'بوستر', 'سهم بوستر', 'وضعیت']);
  assert.equal(fa.date, 0);
  assert.equal(fa.platform, 2);
  assert.equal(fa.price, 3);
  assert.equal(fa.booster, 4);
  assert.equal(fa.boosterAmount, 5);
});

test('money, currency, date and status cells', () => {
  assert.equal(parseMoneyCell('$1,234.50'), 1234.5);
  assert.equal(parseMoneyCell('۳٬۰۰۰٬۰۰۰ تومان'), 3000000);
  assert.equal(parseMoneyCell('250k'), 250000);
  assert.equal(parseMoneyCell('abc'), null);
  assert.equal(parseMoneyCell(''), null);
  assert.equal(detectCurrency('$100', 'TOMAN'), 'USD');
  assert.equal(detectCurrency('3000000 تومان', 'USD'), 'TOMAN');
  assert.equal(detectCurrency('100', 'EUR'), 'EUR');
  assert.equal(parseDateCell('2026-10-05').slice(0, 10), '2026-10-05');
  assert.equal(parseDateCell('10/05/2026', 'mdy').slice(0, 10), '2026-10-05');
  assert.equal(parseDateCell('10/05/2026', 'dmy').slice(0, 10), '2026-05-10');
  assert.equal(parseDateCell('1405/07/29').slice(0, 10), '2026-10-21'); // Shamsi
  assert.equal(parseDateCell('not a date'), null);
  // impossible dates are rejected, never rolled into another month or year
  assert.equal(parseDateCell('2026-13-45'), null);
  assert.equal(parseDateCell('2026-02-30'), null);
  assert.equal(parseDateCell('31/04/2026', 'dmy'), null);
  assert.equal(parseDateCell('1405/13/01'), null);
  assert.equal(parseDateCell('1405/07/32'), null);
  assert.equal(parseDateCell('2024-02-29').slice(0, 10), '2024-02-29'); // a real leap day
  assert.equal(parseDateCell('2026'), null);
  assert.equal(detectDateOrder(['13/05/2026', '01/02/2026']), 'dmy');
  assert.equal(detectDateOrder(['10/05/2026']), 'mdy');
  assert.equal(parseLifecycle('Completed'), 'done');
  assert.equal(parseLifecycle('in progress'), 'working');
  assert.equal(parseLifecycle('انجام شد'), 'done');
  assert.equal(parseLifecycle(''), 'working');
});

test('a sheet becomes orders, shares and the payments its yes/no columns imply', () => {
  const { rows } = parseDelimited(SHEET);
  const [header, ...data] = rows;
  const mapping = suggestMapping(header);
  const { records, warnings, stats } = buildImport(data, mapping, { defaultCurrency: 'TOMAN', now: '2026-10-21T00:00:00.000Z' });
  assert.equal(stats.orders, 2);
  assert.equal(records.shares.length, 3);
  assert.equal(records.payments.length, 2); // client paid A1, Sara paid
  assert.deepEqual(warnings, []);
  const a1 = records.orders.find((o) => o.orderRef === 'A1');
  assert.equal(a1.currency, 'USD'); // the $ sign wins over the default
  assert.equal(a1.grossMinor, 10000);
  const ctx = buildContext(records);
  assert.equal(orderMarginMinor(ctx, a1), 3000); // 100 - 40 - 30
  const ali = records.parties.find((p) => p.name === 'Ali');
  assert.equal(partyBalance(ctx, ali.id).payable.USD, 4000); // done, unpaid
  const sara = records.parties.find((p) => p.name === 'Sara');
  assert.deepEqual(partyBalance(ctx, sara.id).payable, {});
});

test('importing the same sheet twice adds nothing the second time', async () => {
  const { rows } = parseDelimited(SHEET);
  const [header, ...data] = rows;
  const built = buildImport(data, suggestMapping(header), { defaultCurrency: 'USD', now: '2026-10-21T00:00:00.000Z' });
  const store = await makeStore();
  const first = await store.mergeAll(built.records);
  assert.equal(first.skipped, 0, 'imported rows must pass the same validation as a backup file');
  const snapshot = JSON.stringify((await store.loadAll()).orders.map((o) => o.id).sort());
  await store.mergeAll(buildImport(data, suggestMapping(header), { defaultCurrency: 'USD', now: '2026-10-22T00:00:00.000Z' }).records);
  const data2 = await store.loadAll();
  assert.equal(JSON.stringify(data2.orders.map((o) => o.id).sort()), snapshot);
  assert.equal(data2.shares.length, 3);
  assert.equal(data2.payments.length, 2);
  assert.deepEqual(await store.integrityReport(), []);
});

test('identical rows without an order id stay separate orders; the same row twice in one sheet is not merged away', () => {
  const rows = [['2026-10-01', 'Gold run', '', 'G2G', '50', 'Ali', '20', 'done'], ['2026-10-01', 'Gold run', '', 'G2G', '50', 'Ali', '20', 'done']];
  const { records } = buildImport(rows, { date: 0, title: 1, orderRef: 2, platform: 3, price: 4, booster: 5, boosterAmount: 6, status: 7 }, { defaultCurrency: 'USD' });
  assert.equal(records.orders.length, 2);
  assert.equal(records.shares.length, 2);
});

test('problems are reported per row instead of failing the import', () => {
  const rows = [
    ['2026-13-45x', 'Bad date', '', 'G2G', '10', 'Ali', '4', ''],
    ['2026-10-01', 'No price', '', 'G2G', '', 'Ali', '4', ''],
    ['2026-10-01', 'Too generous', 'T1', 'G2G', '10', 'Ali', '20', ''],
    ['2026-10-01', 'No booster amount', 'T2', 'G2G', '10', 'Ali', '', ''],
  ];
  const { records, warnings, stats } = buildImport(rows, { date: 0, title: 1, orderRef: 2, platform: 3, price: 4, booster: 5, boosterAmount: 6, status: 7 }, { defaultCurrency: 'USD' });
  const codes = warnings.map((w) => w.code);
  assert.ok(codes.includes('bad_date'));
  assert.ok(codes.includes('no_price'));
  assert.ok(codes.includes('shares_exceed_price'));
  assert.ok(codes.includes('no_booster_amount'));
  assert.equal(stats.skipped, 1);
  assert.equal(records.orders.length, 3);
});

test('spreadsheet formulas in imported text stay plain text in the ledger', () => {
  const rows = [['2026-10-01', '=HYPERLINK("http://evil")', '', 'G2G', '10', '@SUM(1)', '4', 'done']];
  const { records } = buildImport(rows, { date: 0, title: 1, orderRef: 2, platform: 3, price: 4, booster: 5, boosterAmount: 6, status: 7 }, { defaultCurrency: 'USD' });
  assert.equal(records.orders[0].title, '=HYPERLINK("http://evil")'); // stored as data; exports neutralise it
});
