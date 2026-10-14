import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderText } from '../src/lib/orderParser.js';

test('orderParser: parses G2G order URL, ID, and price', () => {
  const sample = `
Order #OD-9928174
Mythic+ 15 Keystone Run
Price: $45.00
Platform: G2G
https://www.g2g.com/order/OD-9928174
`;
  const result = parseOrderText(sample);
  assert.equal(result.orderId, 'OD-9928174');
  assert.equal(result.price, 45);
  assert.equal(result.currency, 'USD');
  assert.equal(result.source, 'G2G');
  assert.match(result.title, /Mythic\+ 15 Keystone Run/);
  assert.equal(result.link, 'https://www.g2g.com/order/OD-9928174');
  assert.ok(result.confidence > 0.8);
});

test('orderParser: protects +15 keystone from being parsed as price', () => {
  const sample = `+15 Ara-Kara Dungeon Clear - 25 EUR on FunPay`;
  const result = parseOrderText(sample);
  assert.equal(result.price, 25);
  assert.equal(result.currency, 'EUR');
  assert.equal(result.source, 'FunPay');
  assert.match(result.title, /Ara-Kara Dungeon Clear/);
});

test('orderParser: parses Persian order format', () => {
  const sample = `
شناسه سفارش: 88472
عنوان: رید هیروئیک نربار
مبلغ: 350000 تومان
منبع: دیسکورد
`;
  const result = parseOrderText(sample);
  assert.equal(result.orderId, '88472');
  assert.equal(result.price, 350000);
  assert.equal(result.currency, 'TOMAN');
  assert.match(result.title, /رید هیروئیک نربار/);
});

test('orderParser: handles empty or invalid text safely', () => {
  const result = parseOrderText('');
  assert.equal(result.confidence, 0);
  assert.equal(result.price, null);
  assert.equal(result.orderId, null);
});
