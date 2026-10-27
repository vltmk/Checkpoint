import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '../ui/Dialog';
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
 * Screenshots attached to one order or payment. Paste an image anywhere in the dialog to add it; click one to see it
 * full size, copy it or save it.
 */
export function ProofGallery({ open, onClose, ownerType, ownerId, title, legacyProofs = [] }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const [proofs, setProofs] = useState([]);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null); // index of the screenshot open full size, or null
  // the provider object changes on every ledger reload; keep a ref so that does not re-run the load
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;

  const load = useCallback(async () => {
    if (!ownerId) return;
    setProofs(await ledgerRef.current.listProofs(ownerType, ownerId));
  }, [ownerType, ownerId]);

  useEffect(() => {
    setProofs([]); // never show the previous owner's screenshots while the new ones load
    if (open) {
      setError('');
      load().catch(() => setError(f.t('lg.err.generic', 'That could not be saved.')));
    }
  }, [open, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = async (files) => {
    setError('');
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > MAX_PROOF_BYTES) {
          setError(f.t('lg.err.proofTooBig', 'That image is over 4 MB. Use a smaller screenshot.'));
          continue;
        }
        await ledger.addProof({ ownerType, ownerId, name: file.name || 'screenshot.png', data: await readAsDataUrl(file), size: file.size });
      }
      await load();
    } catch (e) {
      setError(e?.message || f.t('lg.err.generic', 'That could not be saved.'));
    }
  };

  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((x) => x.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const all = [...legacyProofs.map((p) => ({ ...p, legacy: true })), ...proofs];

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div onPaste={onPaste} className="flex flex-col max-h-[90vh]">
        <DialogHeader onClose={onClose}>
          <DialogTitle>{title || f.t('lg.proofs', 'Screenshots')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {all.length === 0 && <p className="text-xs text-zinc-500">{f.t('lg.proofs.empty', 'No screenshots yet. Paste one here with Ctrl+V.')}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {all.map((p, i) => (
              <figure key={p.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setViewing(i)}
                  aria-label={f.t('lg.proofs.open', 'Open {name}', { name: p.name || f.t('lg.proofs', 'Screenshots') })}
                  className="block w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 cursor-zoom-in"
                >
                  <img src={p.data} alt={p.name} className="h-32 w-full object-cover" />
                </button>
                {!p.legacy && (
                  <button
                    type="button"
                    aria-label={f.t('lg.removeProof', 'Remove screenshot')}
                    onClick={async () => { await ledger.removeProof(p.id); await load(); }}
                    className="absolute top-1.5 end-1.5 rounded-md bg-zinc-900/80 text-white p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </figure>
            ))}
          </div>
          <label className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <ImagePlus className="w-3.5 h-3.5" />
            {f.t('lg.addProof', 'Paste or add a screenshot')}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles([...e.target.files])} />
          </label>
          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </DialogContent>
      </div>
    </Dialog>
    <Lightbox isOpen={open && viewing !== null} start={viewing ?? 0} images={all.map((p) => ({ src: p.data, name: p.name }))} caption={title} onClose={() => setViewing(null)} />
    </>
  );
}
