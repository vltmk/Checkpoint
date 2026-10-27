import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Download } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle } from './ui/Dialog';
import { Button } from './ui/Button';
import { isTauri, saveImageNative, copyImageNative, downloadImageBlob } from '../lib/desktop';
import { useLanguage } from '../lib/i18n';

/** A screenshot as PNG, whatever it was pasted as: the clipboard only takes PNG reliably. */
async function toPngDataUrl(src) {
  if (/^data:image\/png/i.test(src)) return src;
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

const extensionOf = (src) => (src.match(/^data:image\/(png|jpe?g|webp|gif)/i)?.[1] || 'png').replace('jpeg', 'jpg');
const safeName = (name) => String(name || 'screenshot').replace(/\.[a-z0-9]+$/i, '').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'screenshot';

/**
 * Look at a screenshot full size, step through the others (arrow keys too), copy it to the clipboard or save it.
 * It opens over whatever dialog it came from, so Esc closes only the viewer.
 *
 * images: [{ src, name }], start: the index to open at. The older single-image form (imgSrc, caption) still works.
 */
export function Lightbox({ isOpen, onClose, images, start = 0, imgSrc, caption = '' }) {
  const { t, isRtl } = useLanguage();
  const list = images?.length ? images : imgSrc ? [{ src: imgSrc, name: caption }] : [];
  const [index, setIndex] = useState(start);
  const [done, setDone] = useState('');

  useEffect(() => { if (isOpen) { setIndex(Math.min(start, Math.max(0, list.length - 1))); setDone(''); } }, [isOpen, start]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = list[index] || null;
  const many = list.length > 1;
  const step = useCallback((d) => { setDone(''); setIndex((i) => (i + d + list.length) % list.length); }, [list.length]);

  // arrows step through the screenshots; in Farsi the picture order reads right to left
  useEffect(() => {
    if (!isOpen || !many) return undefined;
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const forward = e.key === 'ArrowRight' ? !isRtl : isRtl;
      step(forward ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, many, isRtl, step]);

  const flash = (key) => { setDone(key); setTimeout(() => setDone((d) => (d === key ? '' : d)), 1600); };

  const copy = async () => {
    if (!current) return;
    try {
      flash((await copyImageNative({ dataUrl: await toPngDataUrl(current.src) })) ? 'copy' : 'copyFail');
    } catch (err) {
      console.error('Copying the screenshot failed:', err);
      flash('copyFail');
    }
  };

  const download = async () => {
    if (!current) return;
    const filename = `${safeName(current.name || caption)}.${extensionOf(current.src)}`;
    if (isTauri()) {
      const res = await saveImageNative({ defaultPath: filename, dataUrl: current.src });
      if (res?.success) flash('save');
      return;
    }
    const blob = await (await fetch(current.src)).blob();
    downloadImageBlob(blob, filename);
    flash('save');
  };

  const done1 = <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />;
  const arrow = 'absolute top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400';

  return (
    <Dialog open={Boolean(isOpen && current)} onClose={onClose} maxWidth="max-w-4xl" level={2}>
      {current && (
        <div className="flex max-h-[90vh] min-h-0 flex-col">
          <DialogHeader
            onClose={onClose}
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={copy}>
                  {done === 'copy' ? done1 : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {done === 'copy' ? t('lightbox.copied', 'Copied') : done === 'copyFail' ? t('lightbox.copyFailed', 'Could not copy') : t('lightbox.copy', 'Copy')}
                </Button>
                <Button variant="outline" size="sm" onClick={download}>
                  {done === 'save' ? done1 : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
                  {t('lightbox.download', 'Download')}
                </Button>
              </>
            }
          >
            <DialogTitle className="min-w-0">
              <span className="truncate">{current.name || caption || t('lightbox.title', 'Screenshot')}</span>
              {many && <span className="shrink-0 text-xs font-normal tabular-nums text-zinc-500 dark:text-zinc-400">{index + 1} / {list.length}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-zinc-100 dark:bg-zinc-900/60 p-4">
            <img src={current.src} alt={current.name || caption || ''} className="max-h-[72vh] w-auto max-w-full rounded-md border border-zinc-200 dark:border-zinc-800 object-contain" />
            {many && (
              <>
                <button type="button" onClick={() => step(-1)} aria-label={t('lightbox.prev', 'Previous screenshot')} className={`${arrow} start-3`}>
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label={t('lightbox.next', 'Next screenshot')} className={`${arrow} end-3`}>
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default Lightbox;
