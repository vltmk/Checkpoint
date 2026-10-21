import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const navbarCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Navbar.jsx'), 'utf8');
const stepperCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'NumberStepperInput.jsx'), 'utf8');

test('Navbar Rates popover is widened to w-80 and EUR uses NumberStepperInput', () => {
  assert.ok(navbarCode.includes('w-80 p-3.5'));
  assert.ok(!navbarCode.includes('className="text-xs h-7.5"'));
  assert.ok(navbarCode.includes('step={0.01}'));
  assert.ok(navbarCode.includes('value={tempRateEUR}'));
  assert.ok(navbarCode.includes('currency="USD"'));
});

test('NumberStepperInput provides full-height accessible button column and overflow-hidden wrapper', () => {
  assert.ok(stepperCode.includes('w-7 self-stretch'));
  assert.ok(stepperCode.includes('aria-label={`Increment'));
  assert.ok(stepperCode.includes('aria-label={`Decrement'));
  assert.ok(stepperCode.includes('overflow-hidden'));
});
