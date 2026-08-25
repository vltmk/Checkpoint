import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine Tailwind classes with clsx and twMerge
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Detects if a text string contains Right-to-Left (RTL) script characters
 * such as Persian/Farsi, Arabic, or Hebrew.
 */
export function isRTL(text) {
  if (!text || typeof text !== 'string') return false;
  // Arabic / Persian unicode blocks + presentation forms
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return rtlRegex.test(text);
}

/**
 * Returns 'rtl' or 'ltr' based on explicit direction setting or auto-detected content
 */
export function getTextDirection(text, explicitDir) {
  if (explicitDir === 'rtl' || explicitDir === 'ltr') return explicitDir;
  return isRTL(text) ? 'rtl' : 'ltr';
}

/**
 * Determines if a notification or announcement item should be rendered in RTL mode.
 */
export function isNotificationRTL(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.dir === 'rtl') return true;
  if (item.dir === 'ltr') return false;
  if (item.lang === 'fa' || item.lang === 'per' || item.lang === 'ar') return true;
  return isRTL(item.title) || isRTL(item.message);
}
