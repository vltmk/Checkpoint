/**
 * desktop.js - Native Tauri desktop integration helpers for Nodra Vault
 * Gracefully falls back when running in browser mode.
 */

import { trackerDB } from './db';

export const isTauri = () => {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
};

/**
 * Window Controls
 */
export async function minimizeWindow() {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().minimize();
  } catch (err) {
    console.error('Failed to minimize window:', err);
  }
}

export async function toggleMaximizeWindow() {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().toggleMaximize();
  } catch (err) {
    console.error('Failed to toggle maximize window:', err);
  }
}

export async function isWindowMaximized() {
  if (!isTauri()) return false;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return await getCurrentWindow().isMaximized();
  } catch (err) {
    return false;
  }
}

export async function closeWindow() {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } catch (err) {
    console.error('Failed to close window:', err);
  }
}

export async function hideWindow() {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().hide();
  } catch (err) {
    console.error('Failed to hide window:', err);
  }
}

export async function showWindow() {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.unminimize();
    await win.show();
    await win.setFocus();
  } catch (err) {
    console.error('Failed to show window:', err);
  }
}

export async function isTrayNotificationSent() {
  const local = localStorage.getItem('checkpoint_tray_notified');
  if (local === 'true') return true;
  try {
    const dbVal = await trackerDB.getSetting('checkpoint_tray_notified', null);
    if (dbVal === 'true') {
      localStorage.setItem('checkpoint_tray_notified', 'true');
      return true;
    }
  } catch (e) {}
  return false;
}

export async function setTrayNotificationSent() {
  localStorage.setItem('checkpoint_tray_notified', 'true');
  try {
    await trackerDB.setSetting('checkpoint_tray_notified', 'true');
  } catch (e) {}
}

export async function resetTrayNotificationFlag() {
  localStorage.removeItem('checkpoint_tray_notified');
  try {
    await trackerDB.setSetting('checkpoint_tray_notified', 'false');
  } catch (e) {}
}

/**
 * Dispatches native Windows toast notification via @tauri-apps/plugin-notification
 */
export async function sendTrayNotification(force = false) {
  if (!isTauri()) return false;
  try {
    if (!force) {
      const alreadySent = await isTrayNotificationSent();
      if (alreadySent) return false;
    }

    const {
      isPermissionGranted,
      requestPermission,
      sendNotification,
      onAction,
    } = await import('@tauri-apps/plugin-notification');

    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }

    if (permissionGranted) {
      // Register click listener to restore window
      try {
        await onAction((action) => {
          showWindow();
        });
      } catch (e) {}

      sendNotification({
        title: 'CHECKPOINT',
        body: 'App is minimized to the system tray. Click the tray icon to reopen.',
      });

      if (!force) {
        await setTrayNotificationSent();
      }
      return true;
    }
  } catch (err) {
    console.error('Failed to dispatch native notification:', err);
  }
  return false;
}

/**
 * Listen to tray menu action events emitted from Rust backend
 */
export async function listenToTrayEvents({ onQuickAdd, onSettings }) {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlistenQuickAdd = await listen('tray-quick-add', () => {
      showWindow();
      onQuickAdd?.();
    });
    const unlistenSettings = await listen('tray-settings', () => {
      showWindow();
      onSettings?.();
    });
    return () => {
      if (unlistenQuickAdd) unlistenQuickAdd();
      if (unlistenSettings) unlistenSettings();
    };
  } catch (e) {
    return () => {};
  }
}

export async function startDraggingWindow() {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().startDragging();
  } catch (err) {
    // Ignore drag start error
  }
}

export async function enforceMinWindowSize(minWidth = 800, minHeight = 560) {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    if (LogicalSize && win?.setMinSize) {
      await win.setMinSize(new LogicalSize(minWidth, minHeight));
    }
  } catch (err) {
    // Ignore if not supported
  }
}

/**
 * Native File Dialogs (Save & Open)
 */
export async function saveFileNative({ defaultPath, filters, content }) {
  if (!isTauri()) return { success: false, error: 'Not running in desktop mode' };
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    const filePath = await save({
      defaultPath: defaultPath || 'backup.json',
      filters: filters || [{ name: 'JSON Backup', extensions: ['json'] }],
    });

    if (filePath) {
      const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await writeTextFile(filePath, text);
      return { success: true, filePath };
    }
    return { success: false, cancelled: true };
  } catch (err) {
    console.error('Native save file error:', err);
    return { success: false, error: err };
  }
}

export async function openFileNative({ filters }) {
  if (!isTauri()) return null;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');

    const selectedPath = await open({
      multiple: false,
      directory: false,
      filters: filters || [{ name: 'JSON Backup', extensions: ['json'] }],
    });

    if (selectedPath && typeof selectedPath === 'string') {
      const content = await readTextFile(selectedPath);
      return { success: true, filePath: selectedPath, content };
    }
    return { success: false, cancelled: true };
  } catch (err) {
    console.error('Native open file error:', err);
    return { success: false, error: err };
  }
}

export async function saveImageNative({ defaultPath, dataUrl, filename }) {
  if (!isTauri() || !dataUrl) return false;
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');

    const suggested = defaultPath || filename || 'screenshot_proof.png';
    const filePath = await save({
      defaultPath: suggested,
      filters: [{ name: 'PNG Image', extensions: ['png', 'jpg', 'jpeg'] }],
    });

    if (filePath) {
      const base64 = dataUrl.split(',')[1] || dataUrl;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await writeFile(filePath, bytes);
      return { success: true, filePath };
    }
    return { success: false, cancelled: true };
  } catch (err) {
    console.error('Native save image error:', err);
    return { success: false, error: err };
  }
}

/**
 * Native & Web Image Clipboard helper
 * Accepts { blob, dataUrl } and writes to system clipboard.
 */
export async function copyImageNative({ blob, dataUrl }) {
  // 1. Try Tauri native writeImage
  if (isTauri()) {
    try {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      if (blob) {
        const arrayBuffer = await blob.arrayBuffer();
        await writeImage(new Uint8Array(arrayBuffer));
        return true;
      } else if (dataUrl) {
        const base64 = dataUrl.split(',')[1] || dataUrl;
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await writeImage(bytes);
        return true;
      }
    } catch (e) {
      console.warn('Native clipboard writeImage failed, falling back to navigator.clipboard:', e);
    }
  }

  // 2. Try modern Web Async Clipboard API
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
    try {
      let imageBlob = blob;
      if (!imageBlob && dataUrl) {
        const res = await fetch(dataUrl);
        imageBlob = await res.blob();
      }
      if (imageBlob) {
        // Ensure standard PNG type for clipboard compatibility
        const pngBlob =
          imageBlob.type === 'image/png'
            ? imageBlob
            : new Blob([imageBlob], { type: 'image/png' });
        const item = new ClipboardItem({ 'image/png': pngBlob });
        await navigator.clipboard.write([item]);
        return true;
      }
    } catch (e) {
      console.error('Browser clipboard image write error:', e);
    }
  }

  return false;
}

/**
 * Native & Web Text Clipboard helper
 */
export async function copyTextNative(text) {
  if (isTauri()) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
      return true;
    } catch (e) {
      console.warn('Native clipboard write failed, using browser fallback:', e);
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.error('Clipboard write error:', e);
    }
  }
  return false;
}

/**
 * Web Download helper for Blobs / Images
 */
export function downloadImageBlob(blob, filename = 'checkpoint_receipt.png') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Open external URL safely in default system browser
 */
export async function openExternalUrl(url) {
  if (!url || typeof url !== 'string') return;
  const cleanUrl = url.trim();

  // Enforce protocol safety (HTTPS or local development)
  if (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://localhost')) {
    console.warn('[Desktop] Refusing to open insecure or unapproved protocol URL:', cleanUrl);
    return;
  }

  if (typeof window !== 'undefined') {
    window.open(cleanUrl, '_blank', 'noopener,noreferrer');
  }
}


