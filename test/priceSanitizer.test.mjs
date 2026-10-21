import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizePriceInput } from '../src/lib/currencies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('sanitizePriceInput: converts numbers with dots to raw digits', () => {
  assert.equal(sanitizePriceInput('60.699'), '60699');
  assert.equal(sanitizePriceInput('1.250.000'), '1250000');
  assert.equal(sanitizePriceInput('60.000'), '60000');
  assert.equal(sanitizePriceInput('5.000.000'), '5000000');
});

test('sanitizePriceInput: converts numbers with commas to raw digits', () => {
  assert.equal(sanitizePriceInput('60,699'), '60699');
  assert.equal(sanitizePriceInput('1,250,000'), '1250000');
  assert.equal(sanitizePriceInput('60,000'), '60000');
});

test('sanitizePriceInput: handles Persian and Arabic digits and separators', () => {
  assert.equal(sanitizePriceInput('۶۰.۶۹۹'), '60699');
  assert.equal(sanitizePriceInput('۶۰,۶۹۹'), '60699');
  assert.equal(sanitizePriceInput('۶۰٬۶۹۹'), '60699'); // Persian thousands separator
  assert.equal(sanitizePriceInput('۶۰٫۶۹۹'), '60699'); // Persian decimal separator
  assert.equal(sanitizePriceInput('۱.۲۵۰.۰۰۰'), '1250000');
});

test('sanitizePriceInput: handles mixed formats with decimal cents (.00 or ,00)', () => {
  assert.equal(sanitizePriceInput('60,699.00'), '60699');
  assert.equal(sanitizePriceInput('60.699,00'), '60699');
  assert.equal(sanitizePriceInput('60.00'), '60');
  assert.equal(sanitizePriceInput('60,00'), '60');
});

test('sanitizePriceInput: preserves leading signs for income and expense modes', () => {
  assert.equal(sanitizePriceInput('+60.699'), '+60699');
  assert.equal(sanitizePriceInput('-60.699'), '-60699');
  assert.equal(sanitizePriceInput('+60,699'), '+60699');
  assert.equal(sanitizePriceInput('-60,699'), '-60699');
  assert.equal(sanitizePriceInput('-'), '-');
  assert.equal(sanitizePriceInput('+'), '+');
});

test('sanitizePriceInput: strips currency words and whitespace', () => {
  assert.equal(sanitizePriceInput('60.699 تومان'), '60699');
  assert.equal(sanitizePriceInput('60,699 Toman'), '60699');
  assert.equal(sanitizePriceInput('60.699 G'), '60699');
  assert.equal(sanitizePriceInput('  60.699  '), '60699');
  assert.equal(sanitizePriceInput('60 699'), '60699');
});

test('sanitizePriceInput: supports k and m multipliers', () => {
  assert.equal(sanitizePriceInput('60k'), '60000');
  assert.equal(sanitizePriceInput('60.5k'), '60500');
  assert.equal(sanitizePriceInput('1.5m'), '1500000');
  assert.equal(sanitizePriceInput('100K'), '100000');
});

test('sanitizePriceInput: handles empty, invalid or falsy inputs', () => {
  assert.equal(sanitizePriceInput(''), '');
  assert.equal(sanitizePriceInput(null), '');
  assert.equal(sanitizePriceInput(undefined), '');
  assert.equal(sanitizePriceInput('0'), '0');
  assert.equal(sanitizePriceInput(60699), '60699');
});
