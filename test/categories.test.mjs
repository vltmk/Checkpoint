import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const categoriesCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'categories.js'), 'utf8');
const settingsCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'SettingsModal.jsx'), 'utf8');
const categoryModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ui', 'CategoryModal.jsx'), 'utf8');
const appCode = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf8');
const i18nCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'i18n.jsx'), 'utf8');

test('DEFAULT_WOW_COLOR is warm orange-brown-gold #C68A4C', () => {
  assert.ok(categoriesCode.includes("export const DEFAULT_WOW_COLOR = '#C68A4C';"));
});

test('DEFAULT_CATEGORIES contains World of Warcraft with DEFAULT_WOW_COLOR', () => {
  assert.ok(categoriesCode.includes("name: 'World of Warcraft'"));
  assert.ok(categoriesCode.includes("name: 'World of Warcraft Classic'"));
  assert.ok(categoriesCode.includes("color: DEFAULT_WOW_COLOR"));
});

test('PRESET_ACCENT_COLORS contains 10 curated preset colors', () => {
  assert.ok(categoriesCode.includes("{ name: 'WoW Gold', hex: '#C68A4C' }"));
  assert.ok(categoriesCode.includes("{ name: 'Cobalt Blue', hex: '#3B82F6' }"));
  assert.ok(categoriesCode.includes("{ name: 'Neon Lime', hex: '#84CC16' }"));
  assert.ok(categoriesCode.includes("{ name: 'Rose Pink', hex: '#EC4899' }"));
});

test('deleteCategory migrates existing records to fallback category', () => {
  assert.ok(categoriesCode.includes("fallbackName = 'General'"));
  assert.ok(categoriesCode.includes("trackerDB.updateGameName(oldGameName, targetFallback)"));
});

test('mergeCategories intelligently merges imported categories', () => {
  assert.ok(categoriesCode.includes('export function mergeCategories(existing = [], imported = [])'));
  assert.ok(categoriesCode.includes('cleanCategory'));
  assert.ok(categoriesCode.includes('existingIndex >= 0'));
});

test('CategoryModal has no type="color" native picker and no preview card', () => {
  assert.ok(!categoryModalCode.includes('type="color"'));
  assert.ok(!categoryModalCode.includes('Ledger Row Preview'));
});

test('SettingsModal allows deleting any category and migrates logs', () => {
  assert.ok(!settingsCode.includes('{!cat.isDefault && ('));
  assert.ok(settingsCode.includes('deleteCategory(cat.id || cat.name, fallbackName)'));
});

test('App.jsx exports categories and restores them on import', () => {
  assert.ok(appCode.includes('categories: currentCategories'));
  assert.ok(appCode.includes('importCategories(rawCategories)'));
});

test('i18n contains translations for categories and cropper', () => {
  assert.ok(i18nCode.includes("'categories.title': 'Categories & Games'"));
  assert.ok(i18nCode.includes("'categories.title': 'دسته‌بندی‌ها و بازی‌ها'"));
  assert.ok(i18nCode.includes("'categories.accentColor': 'Accent Color'"));
  assert.ok(i18nCode.includes("'categories.accentColor': 'رنگ شاخص'"));
});

test('categorySupportsGold only offers Gold for categories that turned it on', () => {
  const src = categoriesCode.match(/export function categorySupportsGold[\s\S]*?\r?\n}\r?\n/)[0].replace('export ', '');
  const categorySupportsGold = new Function(`${src}; return categorySupportsGold;`)();
  const list = [
    { name: 'World of Warcraft', supportsGold: true },
    { name: 'Valorant', supportsGold: false },
    { name: 'Gold Game', supportsGold: true },
    { name: 'Legacy Game' },
  ];
  assert.equal(categorySupportsGold('', list), false);
  assert.equal(categorySupportsGold(undefined, list), false);
  assert.equal(categorySupportsGold(' valorant ', list), false);
  assert.equal(categorySupportsGold('GOLD GAME', list), true);
  assert.equal(categorySupportsGold('Legacy Game', list), false);
  assert.equal(categorySupportsGold('World of Warcraft', list), true);
  assert.equal(categorySupportsGold('World of Warcraft Classic', []), false); // not a category: no guessing from the name
  assert.equal(categorySupportsGold('Elden Ring', []), false);
});

test('both Add Work modals pick the game from the categories and can create one in place', () => {
  const read = (f) => fs.readFileSync(path.join(rootDir, 'src', 'components', 'ledger', f), 'utf8');
  for (const file of ['OrderModal.jsx', 'JobModal.jsx']) {
    const code = read(file);
    assert.ok(code.includes('<GameField'), `${file} uses the game picker`);
    assert.ok(code.includes('<CategoryModal'), `${file} can open the category editor`);
    assert.ok(code.includes('categorySupportsGold'), `${file} gates Gold on the category`);
    assert.ok(!code.includes('list="lg-games"'), `${file} no longer has the bare text input`);
  }
  const shell = read('LedgerShell.jsx');
  assert.equal((shell.match(/onRefreshCategories=\{onRefreshCategories\}/g) || []).length, 2);
  assert.ok(appCode.includes('onRefreshCategories={refreshCategories}'));
});

test('gold units: WoW Classic is per 1, retail per 1,000, and older saved categories get a sensible unit', () => {
  assert.ok(categoriesCode.includes("goldUnit: '1', // classic gold is quoted per 1"));
  assert.ok(categoriesCode.includes("goldUnit: '1k', // retail gold is quoted per 1,000"));
  const src = categoriesCode.match(/export function categoryGoldUnit[\s\S]*?\r?\n}\r?\n/)[0].replace('export ', '');
  const categoryGoldUnit = new Function(`${src}; return categoryGoldUnit;`)();
  const list = [{ name: 'WoW Classic', goldUnit: '1' }, { name: 'World of Warcraft', goldUnit: '1k' }, { name: 'Other' }];
  assert.equal(categoryGoldUnit('wow classic', list), '1');
  assert.equal(categoryGoldUnit('World of Warcraft', list), '1k');
  assert.equal(categoryGoldUnit('Other', list), '1k');
  assert.equal(categoryGoldUnit('Unknown', list), '1k');
});

test('importing categories keeps their gold flag and unit', () => {
  const src = categoriesCode.match(/export function mergeCategories[\s\S]*?\r?\n}\r?\n/)[0].replace('export ', '');
  const mergeCategories = new Function('DEFAULT_WOW_COLOR', `${src}; return mergeCategories;`)('#c68a4c');
  const out = mergeCategories([], [{ name: 'Lost Ark', supportsGold: true, goldUnit: '1' }, { name: 'Valorant', supportsGold: false }]);
  assert.deepEqual(out.map((c) => [c.name, c.supportsGold, c.goldUnit]), [['Lost Ark', true, '1'], ['Valorant', false, undefined]]);
});
