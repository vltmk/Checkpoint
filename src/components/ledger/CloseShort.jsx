import React, { useState } from 'react';
import { Scissors } from 'lucide-react';
import { useLedgerFormat } from './format';

const BUTTON = 'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500';

/**
 * "Close short": the payer paid less than the order was written for, so clear what is still owed, with a reason.
 * Two steps, like Void: nothing is written until the second click. The shortfall is a write-off, not cash.
 */
export function CloseShort({ amountMinor, currency, onConfirm }) {
  const f = useLedgerFormat();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={BUTTON}>
        <Scissors className="h-3 w-3" />{f.t('lg.writeoff.button', 'Close short')}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-zinc-700 dark:text-zinc-300">{f.t('lg.writeoff.confirm', 'Close {amount} short?', { amount: f.money(amountMinor, currency) })}</span>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={f.t('lg.writeoff.reason', 'Reason (optional)')}
        aria-label={f.t('lg.writeoff.reason', 'Reason (optional)')}
        className="h-6 w-36 rounded-md border border-zinc-300 bg-white px-2 text-[11.5px] text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:ring-zinc-500"
      />
      <button
        type="button"
        autoFocus
        onClick={() => { setOpen(false); onConfirm(reason.trim() || f.t('lg.writeoff.reasonDefault', 'Paid short')); }}
        className="h-6 rounded-md bg-zinc-900 px-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {f.t('lg.writeoff.cta', 'Close it')}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-6 px-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
        {f.t('lg.writeoff.cancel', 'Cancel')}
      </button>
    </span>
  );
}
