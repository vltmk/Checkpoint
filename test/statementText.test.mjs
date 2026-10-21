import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext } from '../src/lib/ledger/engine.js';
import { partyStatement } from '../src/lib/ledger/selectors.js';
import { buildStatementText, buildStatementCsv } from '../src/lib/ledger/statementText.js';
import { fromMinor } from '../src/lib/ledger/money.js';

const RATES = { goldRateTOMAN: 3200, usdRateTOMAN: 100000, eurRateUSD: 1.08 };
const fmtMinor = (m, c) => `${fromMinor(m, c)} ${c}`;
const fmtDate = (iso) => String(iso).slice(0, 10);

function statementFor(overrides = {}) {
  const ctx = buildContext({
    orders: [{ id: 'o1', lifecycle: 'done', currency: 'TOMAN', grossMinor: 1000000, platformFeeMinor: 0, payerId: 'g', dateTime: '2026-09-01T10:00:00Z', title: '=cmd|calc' }],
    shares: [{ id: 's1', orderId: 'o1', partyId: 'ali', amountMinor: 300000, state: 'done' }],
    payments: [{ id: 'p1', direction: 'out', partyId: 'ali', amountMinor: 100000, currency: 'TOMAN', kind: 'settlement', dateTime: '2026-09-05T10:00:00Z' }],
    allocations: [{ id: 'a1', paymentId: 'p1', targetType: 'share', targetId: 's1', appliedMinor: 100000, consumedMinor: 100000 }],
    ...overrides,
  });
  return partyStatement(ctx, 'ali', { rates: RATES, displayCurrency: 'TOMAN' });
}

test('statement text lists what is due, which work, and the latest payment', () => {
  const text = buildStatementText({ party: { name: 'Ali' }, statement: statementFor(), displayCurrency: 'TOMAN', language: 'en', formatMinor: fmtMinor, formatDate: fmtDate });
  assert.match(text, /Statement for Ali/);
  assert.match(text, /Due now: \*\*200000 TOMAN\*\*/);
  assert.match(text, /Unpaid work/);
  assert.match(text, /2026-09-05/);
});

test('a settled account says so instead of listing zeros', () => {
  const st = statementFor({
    allocations: [{ id: 'a1', paymentId: 'p1', targetType: 'share', targetId: 's1', appliedMinor: 300000, consumedMinor: 100000 }],
    payments: [{ id: 'p1', direction: 'out', partyId: 'ali', amountMinor: 300000, currency: 'TOMAN', kind: 'settlement', dateTime: '2026-09-05T10:00:00Z' }],
  });
  const text = buildStatementText({ party: { name: 'Ali' }, statement: st, displayCurrency: 'TOMAN', language: 'en', formatMinor: fmtMinor, formatDate: fmtDate });
  assert.match(text, /fully paid up/);
});

test('Farsi statement uses Farsi labels', () => {
  const text = buildStatementText({ party: { name: 'علی' }, statement: statementFor(), displayCurrency: 'TOMAN', language: 'fa', formatMinor: fmtMinor, formatDate: fmtDate });
  assert.match(text, /صورت‌حساب علی/);
  assert.match(text, /قابل پرداخت/);
});

test('statement CSV neutralises spreadsheet formulas in titles and notes', () => {
  const csv = buildStatementCsv({ statement: statementFor(), displayCurrency: 'TOMAN', formatMajor: (m, c) => fromMinor(m, c) });
  assert.ok(csv.includes(`"'=cmd|calc"`));
  assert.equal(csv.split('\n').length, 3);
});

import { buildClientStatementText, buildClientStatementCsv } from '../src/lib/ledger/statementText.js';
import { payerStatement } from '../src/lib/ledger/boosterSelectors.js';

function clientStatement() {
  const ctx = buildContext({
    orders: [
      { id: 'a', lifecycle: 'done', currency: 'TOMAN', grossMinor: 2000000, platformFeeMinor: 0, payerId: 'guild', dateTime: '2026-09-01T10:00:00Z', title: 'Raid' },
      { id: 'b', lifecycle: 'done', currency: 'TOMAN', grossMinor: 500000, platformFeeMinor: 0, payerId: 'guild', dateTime: '2026-09-10T10:00:00Z', title: '=evil' },
    ],
    shares: [],
    payments: [{ id: 'p1', direction: 'in', partyId: 'guild', amountMinor: 500000, currency: 'TOMAN', kind: 'settlement', dateTime: '2026-09-12T10:00:00Z' }],
    allocations: [{ id: 'x', paymentId: 'p1', targetType: 'order', targetId: 'b', appliedMinor: 500000, consumedMinor: 500000 }],
  });
  return payerStatement(ctx, 'guild', { rates: RATES, displayCurrency: 'TOMAN' });
}

test('client statement text lists only what is still unpaid, and the latest payment', () => {
  const text = buildClientStatementText({ party: { name: 'Guild' }, statement: clientStatement(), displayCurrency: 'TOMAN', language: 'en', formatMinor: fmtMinor, formatDate: fmtDate });
  assert.match(text, /Unpaid jobs for Guild/);
  assert.match(text, /Total due: \*\*2000000 TOMAN\*\*/);
  assert.match(text, /Raid/);
  assert.doesNotMatch(text, /=evil/); // that job is paid, so it is not listed as unpaid
  assert.match(text, /2026-09-12/);
});

test('client statement: settled account and Farsi labels', () => {
  const settled = { events: [], owedMinor: 0, progressMinor: 0, balanceMinor: 0, isApproximate: false };
  assert.match(buildClientStatementText({ party: { name: 'Guild' }, statement: settled, displayCurrency: 'TOMAN', language: 'en', formatMinor: fmtMinor, formatDate: fmtDate }), /paid up/);
  assert.match(buildClientStatementText({ party: { name: 'گیلد' }, statement: clientStatement(), displayCurrency: 'TOMAN', language: 'fa', formatMinor: fmtMinor, formatDate: fmtDate }), /جمع بدهی/);
});

test('client statement CSV keeps negative balances and neutralises formulas in titles', () => {
  const st = clientStatement();
  st.events[1].runningMinor = -5; // a client who paid ahead
  const csv = buildClientStatementCsv({ statement: st, displayCurrency: 'TOMAN', formatMajor: (m, c) => fromMinor(m, c) });
  assert.ok(csv.includes(`"'=evil"`));
  assert.ok(csv.includes('"-5"'));
});
