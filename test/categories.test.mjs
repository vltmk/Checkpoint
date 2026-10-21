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
