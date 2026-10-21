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
const ledgerQueryCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'ledgerQuery.js'), 'utf8');
const shortcutsCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ShortcutsModal.jsx'), 'utf8');
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

test('ShortcutsModal accurately documents Ctrl+Shift+P and Ctrl+F', () => {
  assert.ok(shortcutsCode.includes("'Ctrl', 'Shift', 'P'"));
  assert.ok(shortcutsCode.includes('Ctrl+F'));
});

