import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { Lightbox } from '../Lightbox';

const MAX_PROOF_BYTES = 4 * 1024 * 1024;

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/**
 * Screenshots chosen inside an order or job form. Nothing is written until the form is saved: new images wait in
 * memory (`added`), and for an existing order the saved ones are listed (`saved`) with removals held back (`removed`).
 * `commit(ownerId)` then writes it all; whatever it managed to write is dropped from the draft, so a retry only
 * redoes the rest.
 */
export function useProofDraft({ open, ownerId = null, onAdded }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;
  const [saved, setSaved] = useState([]);
  const [added, setAdded] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setAdded([]);
    setRemoved([]);
    setSaved([]);
    setError('');
    if (ownerId) {
      ledgerRef.current.listProofs('order', ownerId).then((list) => { if (live) setSaved(list); }).catch(() => {});
    }
    return () => { live = false; };
  }, [open, ownerId]);

  const addFiles = useCallback(async (files) => {
    setError('');
    const fresh = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_PROOF_BYTES) {
        setError(f.t('lg.err.proofTooBig', 'That image is over 4 MB. Use a smaller screenshot.'));
        continue;
      }
      try {
        fresh.push({ key: Math.random().toString(36).slice(2), name: file.name || 'screenshot.png', data: await readAsDataUrl(file), size: file.size });
      } catch {
        setError(f.t('lg.err.generic', 'That could not be saved.'));
      }
    }
    if (fresh.length) {
      setAdded((a) => [...a, ...fresh]);
      onAdded?.();
    }
  }, [f, onAdded]);

  /** Paste handler for the whole dialog: only swallows the event when it carries an image. */
  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((x) => x.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const commit = async (id) => {
    for (const p of added) {
      await ledgerRef.current.addProof({ ownerType: 'order', ownerId: id, name: p.name, data: p.data, size: p.size });
      setAdded((a) => a.filter((x) => x.key !== p.key));
    }
    for (const proofId of removed) {
      await ledgerRef.current.removeProof(proofId);
      setRemoved((r) => r.filter((x) => x !== proofId));
    }
  };

  const visibleSaved = saved.filter((p) => !removed.includes(p.id));
  return {
    saved: visibleSaved,
    added,
    count: visibleSaved.length + added.length,
    error,
    addFiles,
    onPaste,
    commit,
    removeAdded: (key) => setAdded((a) => a.filter((x) => x.key !== key)),
    removeSaved: (id) => setRemoved((r) => [...r, id]),
    // Clear on the form: drop screenshots pasted since it opened, and bring back any marked for removal
    reset: () => { setAdded([]); setRemoved([]); setError(''); },
  };
}

/** A form's screenshots: thumbnails, a drop and paste target, and a file picker. */
export function ProofField({ draft }) {
  const f = useLedgerFormat();
  const [over, setOver] = useState(false);
  const [viewing, setViewing] = useState(null); // index of the screenshot open full size, or null
  const thumbs = [
    ...draft.saved.map((p) => ({ key: p.id, name: p.name, data: p.data, remove: () => draft.removeSaved(p.id) })),
    ...draft.added.map((p) => ({ key: p.key, name: p.name, data: p.data, remove: () => draft.removeAdded(p.key) })),
  ];
  return (
    <div
      onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); draft.addFiles([...(e.dataTransfer?.files || [])]); }}
      className={cn('flex min-h-[4.5rem] flex-wrap items-center gap-2 rounded-lg border border-dashed p-2 transition-colors', over ? 'border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-900' : 'border-zinc-300 dark:border-zinc-700')}
    >
      {thumbs.map((p, i) => (
        <span key={p.key} className="relative">
          <button
            type="button"
            onClick={() => setViewing(i)}
            aria-label={f.t('lg.proofs.open', 'Open {name}', { name: p.name || f.t('lg.proofs', 'Screenshots') })}
            className="block overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 cursor-zoom-in"
          >
            <img src={p.data} alt={p.name} className="h-14 w-14 object-cover" />
          </button>
          <button
            type="button"
            aria-label={f.t('lg.removeProof', 'Remove screenshot')}
            onClick={p.remove}
            className="absolute -top-1.5 -end-1.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 p-0.5"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <label className="inline-flex items-center gap-1.5 min-h-8 px-2.5 py-1.5 rounded-md text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 focus-within:ring-2 focus-within:ring-zinc-400 dark:focus-within:ring-zinc-500">
        <ImagePlus className="w-3.5 h-3.5" />
        {f.t('lg.addProof', 'Paste or add a screenshot')}
        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { draft.addFiles([...e.target.files]); e.target.value = ''; }} />
      </label>
      <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        <kbd dir="ltr" className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-600 dark:text-zinc-400">{f.t('lg.proofs.keys', 'Ctrl+V')}</kbd>
        {f.t('lg.proofs.drop', 'or drop an image here')}
      </span>
      {draft.error && <p role="alert" className="basis-full text-xs text-rose-600 dark:text-rose-400">{draft.error}</p>}
      <Lightbox isOpen={viewing !== null && thumbs.length > 0} start={viewing ?? 0} images={thumbs.map((p) => ({ src: p.data, name: p.name }))} onClose={() => setViewing(null)} />
    </div>
  );
}
