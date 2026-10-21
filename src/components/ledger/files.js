import { isTauri, saveFileNative, copyTextNative } from '../../lib/desktop';

/** Save text through the native dialog on desktop, or a browser download on web. Returns true when written. */
export async function saveTextFile(fileName, content, { mime = 'text/csv;charset=utf-8', filterName = 'CSV Spreadsheet', ext = 'csv' } = {}) {
  if (isTauri()) {
    const res = await saveFileNative({ defaultPath: fileName, filters: [{ name: filterName, extensions: [ext] }], content });
    if (res?.success) return true;
    if (res?.cancelled) return false;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export const copyText = copyTextNative;

/** Excel on Windows needs a BOM to read UTF-8 (Persian) CSV correctly. */
export const withBom = (csv) => String.fromCharCode(0xfeff) + csv;
