import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDiscordReceiptText } from '../src/lib/currencies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const appCode = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf8');
const ledgerCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'views', 'LedgerView.jsx'), 'utf8');
const workModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'WorkModal.jsx'), 'utf8');
const shortcutsCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ShortcutsModal.jsx'), 'utf8');
const undoToastCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'UndoToast.jsx'), 'utf8');
const contextMenuCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'ContextMenu.jsx'), 'utf8');
const i18nCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'i18n.jsx'), 'utf8');

test('generateDiscordReceiptText formats advertiser orders with Order ID and Client/Booster modes', () => {
  const sampleAdvertiserOrder = {
    id: 'ADV-101',
    orderId: 'G2G-882194',
    dateTime: '2026-09-24T12:00:00Z',
    game: 'World of Warcraft',
    title: 'Mythic+ Keystone 15 Boost',
    source: 'G2G',
    currency: 'USD',
    pot: '120',
    income: '36', // 30% advertiser fee
    status: 'Paid',
    teammates: ['BoosterRex', 'CarryGod'],
    teammateCuts: {
      BoosterRex: '42',
      CarryGod: '42',
    },
    notes: 'Fast 30min run',
  };

  // 1. Client mode receipt includes Order ID and Client Order Price
  const clientReceipt = generateDiscordReceiptText(sampleAdvertiserOrder, {
    language: 'en',
    activeProfileId: 'advertiser',
    receiptMode: 'client',
  });

  assert.ok(clientReceipt.includes('CHECKPOINT - CLIENT ORDER RECEIPT'));
  assert.ok(clientReceipt.includes('Order ID   = #G2G-882194'));
  assert.ok(clientReceipt.includes('$120'));
  assert.ok(clientReceipt.includes('Source     = G2G'));
  assert.ok(clientReceipt.includes('Mythic+ Keystone 15 Boost'));

  // 2. Booster payout slip mode includes Order ID and Booster Breakdown
  const boosterSlip = generateDiscordReceiptText(sampleAdvertiserOrder, {
    language: 'en',
    activeProfileId: 'advertiser',
    receiptMode: 'booster',
  });

  assert.ok(boosterSlip.includes('CHECKPOINT - BOOSTER PAYOUT SLIP'));
  assert.ok(boosterSlip.includes('Order ID   = #G2G-882194'));
  assert.ok(boosterSlip.includes('Booster(s) = BoosterRex, CarryGod'));
  assert.ok(boosterSlip.includes('$84'));
  assert.ok(boosterSlip.includes('BoosterRex:'));
  assert.ok(boosterSlip.includes('CarryGod:'));

  // 3. Persian Client mode
  const faClientReceipt = generateDiscordReceiptText(sampleAdvertiserOrder, {
    language: 'fa',
    activeProfileId: 'advertiser',
    receiptMode: 'client',
  });
  assert.ok(faClientReceipt.includes('رسید سفارش مشتری CHECKPOINT'));
  assert.ok(faClientReceipt.includes('شماره سفارش = #G2G-882194'));
});

test('LedgerView supports Date Range preset filtering and batch Discord export', () => {
  assert.ok(ledgerCode.includes('dateRangeFilter'));
  assert.ok(ledgerCode.includes("dateRangeFilter === 'today'"));
  assert.ok(ledgerCode.includes("dateRangeFilter === 'yesterday'"));
  assert.ok(ledgerCode.includes("dateRangeFilter === 'week'"));
  assert.ok(ledgerCode.includes("dateRangeFilter === 'month'"));
  assert.ok(ledgerCode.includes("dateRangeFilter === 'last_month'"));
  assert.ok(ledgerCode.includes('handleCopyDiscordBatch'));
  assert.ok(ledgerCode.includes('isDiscordBatchCopied'));
  assert.ok(ledgerCode.includes('CHECKPOINT - BATCH SUMMARY'));
});

test('UndoToast and App.jsx deletion undo safety net wiring', () => {
  assert.ok(undoToastCode.includes('onUndo'));
  assert.ok(undoToastCode.includes('onDismiss'));
  assert.ok(undoToastCode.includes('setProgress'));

  assert.ok(appCode.includes('<UndoToast'));
  assert.ok(appCode.includes('handleUndoDelete'));
  assert.ok(appCode.includes('undoDeleteState'));
});

test('ShortcutsModal accurately documents Ctrl+Shift+P and Ctrl+F', () => {
  assert.ok(shortcutsCode.includes("'Ctrl', 'Shift', 'P'"));
  assert.ok(shortcutsCode.includes('Ctrl+F'));
});

test('WorkModal integrates OrderCalculatorPopover directly with active draft preservation', () => {
  assert.ok(workModalCode.includes('<OrderCalculatorPopover'));
  assert.ok(workModalCode.includes('handleApplyFromCalculator'));
  assert.ok(workModalCode.includes('setIsCalculatorOpen(true)'));
  assert.ok(workModalCode.includes('Calculate'));
});

test('ContextMenu supports advertiser profile and passes receiptMode to handleContextCopyDiscord', () => {
  assert.ok(contextMenuCode.includes("activeProfileId === 'advertiser'"));
  assert.ok(contextMenuCode.includes("onCopyDiscordReceipt?.(targetEntry, 'client')"));
  assert.ok(contextMenuCode.includes("onCopyDiscordReceipt?.(targetEntry, 'booster')"));
  assert.ok(appCode.includes('activeProfileId={activeProfileId}'));
});

test('i18n contains English and Persian translations for date ranges, batch Discord and undo', () => {
  assert.ok(i18nCode.includes("'ledger.dateRange': 'Date Range'"));
  assert.ok(i18nCode.includes("'ledger.dateRange': 'بازه زمانی'"));
  assert.ok(i18nCode.includes("'ledger.bulkDiscord': 'Discord'"));
  assert.ok(i18nCode.includes("'ledger.bulkDiscord': 'دیسکورد'"));
  assert.ok(i18nCode.includes("'ledger.undoDelete': 'Undo'"));
  assert.ok(i18nCode.includes("'ledger.undoDelete': 'بازگردانی'"));
});
