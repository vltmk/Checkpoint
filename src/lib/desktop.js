/**
 * desktop.js - Native Tauri desktop integration helpers for Nodra Vault
 * Gracefully falls back when running in browser mode.
 */

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

/**
 * Native File Dialogs (Save & Open)
 */
export async function saveFileNative({ defaultPath, filters, content }) {
  if (!isTauri()) return false;
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    const filePath = await save({
      defaultPath: defaultPath || 'backup.json',
      filters: filters || [{ name: 'JSON Backup', extensions: ['json'] }],
    });

    if (filePath) {
      await writeTextFile(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
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

/**
 * Native Clipboard helper
 */
export async function copyTextNative(text) {
  if (isTauri()) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
      return true;
    } catch (e) {
      // Fallback
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}
