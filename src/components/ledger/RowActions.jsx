import React, { useState } from 'react';
import { CopyPlus, ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLedgerFormat } from './format';

const BUTTON = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 transition-colors hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500';

/**
 * Keyboard twin of a row click: Enter (or Space) on the focused row itself opens it. Keys pressed on a control
 * inside the row are that control's own.
 */
export const openOnRowKey = (open) => (e) => {
  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  open();
};

/**
 * Click handler for a whole row: a click on blank space runs `open`, a click on a button, link or field (or the end of
 * selecting text) does not, so the row's own controls keep doing their own thing.
 */
export const openOnBlankClick = (open) => (e) => {
  if (e.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
  if (String(window.getSelection?.() || '').length > 0) return;
  open();
};

/**
 * Screenshots, edit and delete for one Orders / Jobs row (the receipt opens from the row itself: a click, or Enter
 * when the row has focus). They sit quietly until the row is hovered or focused, then come up to full strength;
 * delete asks once, in place.
 */
export function RowActions({ onProofs, hasProofs = true, onEdit, onDuplicate, onDelete, editLabel, duplicateLabel, className }) {
  const f = useLedgerFormat();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={cn('flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100', className)}>
      {hasProofs && <button type="button" onClick={onProofs} aria-label={f.t('lg.proofs', 'Screenshots')} title={f.t('lg.proofs', 'Screenshots')} className={BUTTON}><ImageIcon className="h-3.5 w-3.5" /></button>}
      <button type="button" onClick={onEdit} aria-label={editLabel} title={editLabel} className={BUTTON}><Pencil className="h-3.5 w-3.5" /></button>
      {onDuplicate && <button type="button" onClick={onDuplicate} aria-label={duplicateLabel} title={duplicateLabel} className={BUTTON}><CopyPlus className="h-3.5 w-3.5" /></button>}
      {confirm ? (
        <button
          type="button"
          autoFocus
          onClick={() => { setConfirm(false); onDelete(); }}
          onBlur={() => setConfirm(false)}
          className="h-7 rounded-md bg-rose-500/10 px-2 text-[11px] font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
        >
          {f.t('lg.delete.confirm', 'Delete it?')}
        </button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} aria-label={f.t('lg.delete', 'Delete')} title={f.t('lg.delete', 'Delete')} className={cn(BUTTON, 'hover:text-rose-600 dark:hover:text-rose-400')}><Trash2 className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}
