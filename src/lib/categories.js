/**
 * categories.js - Category & Game Management for CHECKPOINT
 * Manages category identities, custom icons (squircle base64 data URLs),
 * accent colors, and 135° minimal mixed gradient styling.
 */

import { trackerDB } from './db.js';

export const CATEGORIES_STORAGE_KEY = 'checkpoint_custom_categories_v1';
export const LEGACY_CATEGORIES_STORAGE_KEY = 'vault_custom_categories_v1';

export const DEFAULT_WOW_COLOR = '#C68A4C'; // Warm orange-brown-gold

export const DEFAULT_FALLBACK_CATEGORY = {
  id: 'cat_general',
  name: 'General',
  color: '#71717A', // Titanium slate
  icon: null,
  isDefault: false,
};

export const PRESET_ACCENT_COLORS = [
  { name: 'WoW Gold', hex: '#C68A4C' },
  { name: 'Amber Orange', hex: '#EA580C' },
  { name: 'Arcane Violet', hex: '#8B5CF6' },
  { name: 'Frost Cyan', hex: '#0EA5E9' },
  { name: 'Cobalt Blue', hex: '#3B82F6' },
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Neon Lime', hex: '#84CC16' },
  { name: 'Crimson Red', hex: '#F43F5E' },
  { name: 'Rose Pink', hex: '#EC4899' },
  { name: 'Titanium Slate', hex: '#71717A' },
];

export const DEFAULT_CATEGORIES = [
  {
    id: 'cat_wow_retail',
    name: 'World of Warcraft',
    color: DEFAULT_WOW_COLOR,
    icon: null, // Uses built-in retail SVG
    isDefault: true,
    supportsGold: true,
  },
  {
    id: 'cat_wow_classic',
    name: 'World of Warcraft Classic',
    color: DEFAULT_WOW_COLOR,
    icon: null, // Uses built-in retail/classic SVG
    isDefault: true,
    supportsGold: true,
  },
];

/**
 * Load categories from the settings store.
 */
export async function loadCategories() {
  let list = [];
  try {
    const saved = await trackerDB.getSetting(CATEGORIES_STORAGE_KEY, null);
    if (saved) {
      list = Array.isArray(saved) ? saved : JSON.parse(saved);
    }
  } catch (err) {
    console.warn('Failed to load categories:', err);
  }

  // Ensure default categories are present and WoW has supportsGold: true
  const existingNames = new Set(list.map((c) => c.name?.toLowerCase().trim()));
  const merged = list.map((c) => {
    const isWoW = c.name?.toLowerCase().includes('world of warcraft');
    return {
      ...c,
      supportsGold: c.supportsGold !== undefined ? Boolean(c.supportsGold) : isWoW,
    };
  });

  DEFAULT_CATEGORIES.forEach((def) => {
    if (!existingNames.has(def.name.toLowerCase().trim())) {
      merged.push({ ...def });
    }
  });

  return merged;
}

/**
 * Save categories to the settings store.
 */
export async function saveCategories(categories) {
  if (!Array.isArray(categories)) return false;
  try {
    await trackerDB.setSetting(CATEGORIES_STORAGE_KEY, categories);
    return true;
  } catch (err) {
    console.error('Failed to save categories:', err);
    return false;
  }
}

/**
 * Add or update category. If renaming an existing category, updates ledger entries.
 */
export async function addOrUpdateCategory(category, oldName = null) {
  const current = await loadCategories();
  const index = current.findIndex(
    (c) => (oldName ? c.name === oldName : c.name === category.name) || c.id === category.id
  );

  let updatedList;
  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = { ...current[index], ...category };
  } else {
    updatedList = [...current, category];
  }

  // If name changed, propagate to entries in DB
  if (oldName && category.name && oldName !== category.name) {
    try {
      await trackerDB.updateGameName(oldName, category.name);
    } catch (err) {
      console.warn('Failed to propagate game name change:', err);
    }
  }

  await saveCategories(updatedList);
  return updatedList;
}

/**
 * Delete a category from registry and reassign existing logs to fallback category.
 */
export async function deleteCategory(nameOrId, fallbackName = 'General') {
  const current = await loadCategories();
  const target = String(nameOrId || '').toLowerCase().trim();
  const deletedCategory = current.find(
    (c) => c.name.toLowerCase().trim() === target || c.id === nameOrId
  );

  let filtered = current.filter(
    (c) => c.name.toLowerCase().trim() !== target && c.id !== nameOrId
  );

  // If all categories were deleted, guarantee at least the default fallback category exists
  if (filtered.length === 0) {
    filtered = [{ ...DEFAULT_FALLBACK_CATEGORY }];
  }

  // Migrate existing work logs in DB to the fallback category name
  const oldGameName = deletedCategory ? deletedCategory.name : nameOrId;
  const targetFallback = fallbackName || filtered[0].name;

  if (oldGameName && targetFallback && oldGameName !== targetFallback) {
    try {
      await trackerDB.updateGameName(oldGameName, targetFallback);
    } catch (err) {
      console.warn('Failed to migrate work records to fallback category:', err);
    }
  }

  await saveCategories(filtered);
  return filtered;
}

/**
 * Get category metadata for a given game name.
 */
export function getCategoryByName(name, categoriesList = []) {
  if (!name) {
    if (categoriesList.length > 0) {
      return categoriesList[0];
    }
    return {
      name: 'General',
      color: '#71717A',
      icon: null,
      isDefault: false,
    };
  }

  const cleanName = name.trim();
  const found = categoriesList.find(
    (c) => c.name?.toLowerCase().trim() === cleanName.toLowerCase()
  );

  if (found) return found;

  const isWoW =
    cleanName === 'World of Warcraft' ||
    cleanName === 'World of Warcraft Classic' ||
    cleanName.toLowerCase().includes('warcraft');

  return {
    name: cleanName,
    color: isWoW ? DEFAULT_WOW_COLOR : '#71717A',
    icon: null,
    isDefault: isWoW,
  };
}

/**
 * Whether a game offers Gold as a currency. A category's own setting wins; a game that is not a category yet
 * is judged by its name, and an empty game does not restrict anything.
 */
export function categorySupportsGold(name, categoriesList = []) {
  const clean = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (!clean) return true;
  const cat = categoriesList.find((c) => c.name?.trim().toLowerCase() === clean);
  if (cat && cat.supportsGold !== undefined) return Boolean(cat.supportsGold);
  return clean.includes('world of warcraft');
}

/**
 * Intelligently merge imported categories into existing category registry.
 */
export function mergeCategories(existing = [], imported = []) {
  if (!Array.isArray(imported) || imported.length === 0) {
    return existing;
  }

  const merged = [...existing];

  for (const item of imported) {
    if (!item || !item.name) continue;
    const nameLower = item.name.toLowerCase().trim();
    const existingIndex = merged.findIndex(
      (c) => c.name.toLowerCase().trim() === nameLower || (item.id && c.id === item.id)
    );

    const cleanCategory = {
      id: item.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: item.name.trim(),
      color: item.color || DEFAULT_WOW_COLOR,
      icon: typeof item.icon === 'string' && item.icon.startsWith('data:image/') ? item.icon : (item.icon || null),
      isDefault: Boolean(item.isDefault),
    };

    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...cleanCategory,
      };
    } else {
      merged.push(cleanCategory);
    }
  }

  return merged;
}

/**
 * Import categories from a backup payload, intelligently merge and persist.
 */
export async function importCategories(imported = []) {
  const current = await loadCategories();
  const merged = mergeCategories(current, imported);
  await saveCategories(merged);
  return merged;
}

/**
 * Calculate dominant vibrant color from an image / canvas.
 */
export function extractDominantColor(canvas) {
  try {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const imgData = ctx.getImageData(0, 0, width, height).data;

    let bestColor = null;
    let maxScore = -1;

    // Sample pixels with a step for efficiency
    const step = Math.max(1, Math.floor((width * height) / 1000)) * 4;

    for (let i = 0; i < imgData.length; i += step) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];

      if (a < 180) continue; // Ignore transparent/semi-transparent pixels

      // RGB to HSL
      const rN = r / 255;
      const gN = g / 255;
      const bN = b / 255;
      const max = Math.max(rN, gN, bN);
      const min = Math.min(rN, gN, bN);
      const delta = max - min;
      const l = (max + min) / 2;

      // Ignore pure blacks, whites, and low-saturation grays
      if (l < 0.15 || l > 0.88 || delta < 0.15) continue;

      const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (s < 0.25) continue;

      // Score based on saturation and balanced lightness
      const score = s * (1 - Math.abs(l - 0.5));
      if (score > maxScore) {
        maxScore = score;
        bestColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
      }
    }

    return bestColor || DEFAULT_WOW_COLOR;
  } catch (err) {
    return DEFAULT_WOW_COLOR;
  }
}
