/**
 * desktop.js - Native Tauri desktop integration helpers for CHECKPOINT
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
    const { exit } = await import('@tauri-apps/plugin-process');
    await exit(0);
    return;
  } catch (err) {
    // fallback if process exit is not available
  }
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().destroy();
    return;
  } catch (err) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch (e) {
      console.error('Failed to close window:', e);
    }
  }
}

export async function hideWindow() {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().hide();
  } catch (err) {
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().hide();
    } catch (e) {
      console.error('Failed to hide window:', e);
    }
  }
}

export async function showWindow() {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    try {
      await win.unminimize();
    } catch (_) {}
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
    if (dbVal === 'true' || dbVal === true) {
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
    } = await import('@tauri-apps/plugin-notification');

    let permissionGranted = false;
    try {
      permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
    } catch (e) {
      permissionGranted = true;
    }

    if (permissionGranted) {
      try {
        sendNotification({
          title: 'CHECKPOINT',
          body: 'App is minimized to the system tray. Click the tray icon to reopen.',
        });
      } catch (sendErr) {}

      if (!force) {
        await setTrayNotificationSent();
      }
      return true;
    }
  } catch (err) {
    console.warn('Failed to dispatch native notification:', err);
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

  // Enforce protocol safety via standard URL parsing (reject javascript:, file:, data:, etc.)
  try {
    const parsed = new URL(cleanUrl);
    const isHttps = parsed.protocol === 'https:';
    const isMailto = parsed.protocol === 'mailto:';
    const isLocalHttp = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

    if (!isHttps && !isMailto && !isLocalHttp) {
      console.warn('[Desktop] Refusing to open unapproved protocol URL:', cleanUrl);
      return;
    }
  } catch (e) {
    console.warn('[Desktop] Invalid URL format:', cleanUrl);
    return;
  }

  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(cleanUrl);
      return;
    } catch (err) {
      console.warn('[Desktop] Native openUrl failed, falling back to window.open:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.open(cleanUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Open local directory or file in OS file explorer
 */
export async function openPathNative(path) {
  if (!path || !isTauri()) return false;
  try {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    await openPath(path);
    return true;
  } catch (err) {
    console.warn('[Desktop] Native openPath failed:', err);
    return false;
  }
}

/**
 * Select a local directory using native folder dialog
 */
export async function selectDirectoryNative({ title, defaultPath } = {}) {
  if (!isTauri()) return null;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      multiple: false,
      title: title || 'Select Backup Directory',
      defaultPath,
    });
    return typeof selected === 'string' ? selected : null;
  } catch (err) {
    console.error('Failed to select directory:', err);
    return null;
  }
}

/**
 * Dispatches a native desktop notification
 */
export async function sendDesktopNotification({ title = 'CHECKPOINT', body = '' } = {}) {
  if (!isTauri()) return false;
  try {
    const {
      isPermissionGranted,
      requestPermission,
      sendNotification,
    } = await import('@tauri-apps/plugin-notification');

    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }

    if (permissionGranted) {
      sendNotification({
        title,
        body,
      });
      return true;
    }
  } catch (err) {
    console.warn('Failed to send desktop notification:', err);
  }
  return false;
}

/**
 * Asynchronously optimizes screenshot proofs (resizes large 4K/wide screenshots to maxDimension, e.g. 1920px)
 * Keeps proof files crisp, legible, and compact for SQLite persistence.
 */
export async function optimizeImageProof(blobOrDataUrl, maxDimension = 1920, quality = 0.85) {
  if (!blobOrDataUrl) return null;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          return resolve(typeof blobOrDataUrl === 'string' ? blobOrDataUrl : null);
        }

        // Calculate scaling ratio if larger than maxDimension
        let scale = 1;
        if (width > maxDimension || height > maxDimension) {
          scale = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(typeof blobOrDataUrl === 'string' ? blobOrDataUrl : null);
        }

        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl;
        try {
          dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch (e) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const approxSize = Math.round((dataUrl.length * 3) / 4);
        resolve({ dataUrl, width, height, size: approxSize });
      };

      img.onerror = () => {
        resolve(typeof blobOrDataUrl === 'string' ? { dataUrl: blobOrDataUrl, size: 0 } : null);
      };

      if (typeof blobOrDataUrl === 'string') {
        img.src = blobOrDataUrl;
      } else if (blobOrDataUrl instanceof Blob || blobOrDataUrl instanceof File) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          img.src = ev.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blobOrDataUrl);
      } else {
        resolve(null);
      }
    } catch (err) {
      console.warn('Image proof optimization failed:', err);
      resolve(typeof blobOrDataUrl === 'string' ? { dataUrl: blobOrDataUrl, size: 0 } : null);
    }
  });
}

/**
 * Generates a lightweight deterministic fingerprint of ledger state and financial parameters.
 * Used by automated backup systems to skip redundant export writes when no data has changed.
 */
export function generateLedgerFingerprint(entries = [], currency = 'TOMAN', goldRate = 0) {
  try {
    let sumUpdated = 0;
    let sumIncome = 0;
    const ids = [];

    for (const e of entries) {
      if (!e) continue;
      ids.push(e.id || '');
      sumIncome += Number(e.income) || 0;
      sumUpdated += Number(e.updated_at) || 0;
    }

    return `${entries.length}_${sumIncome}_${sumUpdated}_${currency}_${goldRate}_${ids.slice(0, 10).join(':')}`;
  } catch (err) {
    return `${Date.now()}`;
  }
}

/**
 * Native Directory Pruner for Scheduled Backups
 * Lists files matching prefix pattern in target directory, sorts chronologically,
 * and deletes older files exceeding maxFiles retention limit.
 */
export async function pruneOldBackupsNative({ backupDir, maxFiles = 5, prefix = 'checkpoint_autobackup_' } = {}) {
  if (!isTauri() || !backupDir || maxFiles <= 0) return { pruned: 0, total: 0 };
  try {
    const { readDir, remove } = await import('@tauri-apps/plugin-fs');
    const entries = await readDir(backupDir);
    if (!Array.isArray(entries)) return { pruned: 0, total: 0 };

    const sep = backupDir.includes('\\') ? '\\' : '/';
    const cleanDir = backupDir.replace(/[/\\]+$/, '');

    // Match files strictly named checkpoint_autobackup_*.json
    const backupFiles = entries
      .filter((file) => {
        const name = file?.name || '';
        return name.startsWith(prefix) && name.endsWith('.json') && !file.isDirectory;
      })
      .map((file) => file.name)
      .sort((a, b) => b.localeCompare(a)); // Descending: newest first (ISO timestamps sort alphabetically)

    let pruned = 0;
    if (backupFiles.length > maxFiles) {
      const filesToDelete = backupFiles.slice(maxFiles);
      for (const fileName of filesToDelete) {
        try {
          const filePath = `${cleanDir}${sep}${fileName}`;
          await remove(filePath);
          pruned++;
        } catch (delErr) {
          console.warn(`[AutoBackup] Failed to prune old backup file: ${fileName}`, delErr);
        }
      }
    }

    return { pruned, total: backupFiles.length - pruned };
  } catch (err) {
    console.warn('[AutoBackup] Pruning failed:', err);
    return { pruned: 0, total: 0, error: err };
  }
}



