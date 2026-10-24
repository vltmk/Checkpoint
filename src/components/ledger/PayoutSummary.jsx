import React from 'react';
import { CircleCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { DialogContent, DialogFooter } from '../ui/Dialog';
import { useLedgerFormat } from './format';
import { Money } from './parts';

/**
 * What a saved payout did, shown before the dialog closes: which orders it covered (in full or in part), what is left
 * over, each fee on the way, and what reached the account. Undo voids the payout and its fees in one go.
 */
export function PayoutSummary({ result, error, busy, onUndo, onDone }) {
  const f = useLedgerFormat();
  const { covered, leftoverMinor, feeLines, releasedMinor, netMinor, currency } = result;
  return (
    <>
      <DialogContent>
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            {f.t('lg.recv.doneTitle', 'Payout recorded')}
          </p>

          <div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{f.t('lg.recv.coveredHead', 'Covered')}</div>
            {covered.length === 0 ? (
              <p className="text-xs text-zinc-500">{f.t('lg.recv.coveredNone', 'No order was covered. The whole amount stays as credit with them.')}</p>
            ) : (
              <ul className="mt-1 divide-y divide-zinc-200/70 dark:divide-zinc-800/70 rounded-md border border-zinc-200/80 dark:border-zinc-800/80">
                {covered.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">{c.title}</span>
                    <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">
                      <span className={c.full ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}>
                        {c.full ? f.t('lg.recv.full', 'in full') : f.t('lg.recv.partlyCovered', 'partly')}
                      </span>
                      {' · '}<Money minor={c.appliedMinor} currency={c.currency} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {leftoverMinor > 0 && (
            <p className="text-xs text-zinc-700 dark:text-zinc-300">
              {f.t('lg.recv.stayLeft', '{amount} is not tied to any order yet. It stays as credit with them.', { amount: f.money(leftoverMinor, currency) })}
            </p>
          )}

          <div className="rounded-md border border-zinc-200/80 dark:border-zinc-800/80 px-2.5 py-2 text-xs tabular-nums text-zinc-700 dark:text-zinc-300 space-y-1">
            <div className="flex justify-between gap-3"><span>{f.t('lg.recv.releasedHead', 'Platform released')}</span><span>{f.money(releasedMinor, currency)}</span></div>
            {feeLines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 text-zinc-500 dark:text-zinc-400">
                <span>− {l.label || f.t('lg.recv.feeUnnamed', 'Fee')}</span><span>{f.money(l.feeMinor, currency)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-zinc-200/70 dark:border-zinc-800/70 pt-1 font-medium text-zinc-900 dark:text-zinc-100">
              <span>{f.t('lg.recv.receivedHead', 'Reached your account')}</span><span>{f.money(netMinor, currency)}</span>
            </div>
          </div>

          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="ghost" disabled={busy} onClick={onUndo}>{f.t('lg.recv.undoPayout', 'Undo this payout')}</Button>
        <Button variant="primary" onClick={onDone}>{f.t('lg.done', 'Done')}</Button>
      </DialogFooter>
    </>
  );
}
