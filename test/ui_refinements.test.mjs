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
const ledgerCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'views', 'LedgerView.jsx'), 'utf8');

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

test('LedgerView implements narrow vertical category column anchored to the left', () => {
  assert.ok(ledgerCode.includes("writingMode: 'vertical-rl'"));
  assert.ok(ledgerCode.includes("transform: 'rotate(180deg)'"));
  assert.ok(ledgerCode.includes("tracking-widest uppercase"));
  assert.ok(ledgerCode.includes("{/* Line 2: Notes only (Category is displayed on the left vertical column) */}"));
});

test('LedgerView implements left game-colour accent bar and preserves 135deg mask composite', () => {
  assert.ok(ledgerCode.includes('backgroundColor: accentColor'));
  assert.ok(ledgerCode.includes("linear-gradient(135deg"));
  assert.ok(ledgerCode.includes("maskComposite"));
});

test('LedgerView provides interactive status dot and game icon dropdown menu', () => {
  assert.ok(ledgerCode.includes('isStatusPickerOpen'));
  assert.ok(ledgerCode.includes('statusPickerRef'));
  assert.ok(ledgerCode.includes('data-no-row-click="true"'));
  assert.ok(ledgerCode.includes('handleStatusSelect?.(entry, st)'));
});

test('Cockpit card container does not clip currency dropdown and applies boundary clamping', () => {
  assert.ok(!ledgerCode.includes('cockpitHeroRef}\n        className={cn(\n          "sticky top-0 z-30 rounded-xl bg-white/95 dark:bg-zinc-950/95 border-b border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-md transition-all duration-200 shadow-xs relative overflow-hidden"'));
  assert.ok(ledgerCode.includes('currencyMenuPlacement'));
  assert.ok(ledgerCode.includes('currencyMenuPlacement.flipUp'));
  assert.ok(ledgerCode.includes('metrics.boosterPayouts'));
});
