import React from 'react';
import { motion } from 'motion/react';
import { ClipboardCopy, CircleCheck, Wallet, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useLedgerFormat } from './format';
import { Money } from './parts';
import { cn } from '../../lib/utils';
import { POPOVER } from '../../lib/motion';

/** One figure in the recap: its converted total, and the native amount per currency when more than one is involved. */
function Figure({ label, measure, currency, emphasis = false }) {
  const f = useLedgerFormat();
  const parts = Object.entries(measure.byCurrency || {}).filter(([, n]) => n !== 0);
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 first-letter:uppercase">{label}</div>
      <div className={cn('tabular-nums whitespace-nowrap', emphasis ? 'text-[15px] font-semibold text-zinc-900 dark:text-zinc-100' : 'text-sm font-medium text-zinc-800 dark:text-zinc-200', measure.minor < 0 && 'text-rose-600 dark:text-rose-400')}>
        <Money minor={measure.minor} currency={currency} approx={measure.isApproximate} />
      </div>
      {parts.length > 1 && (
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
          {parts.map(([cur, n]) => <span key={cur} className="whitespace-nowrap" title={f.t('lg.sel.native', 'In its own currency')}><Money minor={n} currency={cur} /></span>)}
        </div>
      )}
    </div>
  );
}

/**
 * The recap for the rows ticked on an Orders or Jobs list: how many, what they add up to (converted, with the
 * native amount per currency beside it), and the three things to do with them.
 * Presentational: the list passes the numbers and the handlers in.
 */
export function SelectionBar({ count, recap, currency, profile, notice, onClear, onSelectAll, allCount, onMarkCollected, onRecordPayout, payoutDisabledReason, onCopy }) {
  const f = useLedgerFormat();
  const isAdvertiser = profile === 'advertiser';
  const payoutLabel = isAdvertiser ? f.t('lg.recv.cta', 'Record payout') : f.t('lg.ov.received', 'Payment received');
  const markLabel = isAdvertiser ? f.t('lg.markCollected', 'Mark collected') : f.t('lg.jobs.markPaid', 'Mark paid');
  return (
    <motion.div
      role="region"
      aria-label={f.t('lg.sel.region', 'Selected rows')}
      initial={{ opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transform: 'translateY(8px)' }}
      transition={POPOVER}
      className="sticky bottom-4 z-20 mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg shadow-black/5 dark:shadow-black/40 px-4 py-3"
    >
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        <div className="flex min-w-[9rem] flex-col">
          <div className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{f.t('lg.sel.count', '{count} selected', { count: f.formatNumber(count) })}</div>
          <div className="mt-1 flex items-center gap-2 text-[11.5px]">
            {allCount > count && <button type="button" onClick={onSelectAll} className="text-zinc-600 dark:text-zinc-400 hover:underline">{f.t('lg.sel.all', 'Select all {count}', { count: f.formatNumber(allCount) })}</button>}
            <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"><X className="h-3 w-3" />{f.t('lg.sel.clear', 'Clear')}</button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap gap-x-6 gap-y-3">
          <Figure label={f.t('lg.wf.price', 'Order pays')} measure={recap.gross} currency={currency} />
          <Figure label={f.t('lg.sel.fees', 'Fees')} measure={recap.fee} currency={currency} />
          <Figure label={f.t('lg.sel.team', 'Team')} measure={recap.boosters} currency={currency} />
          <Figure label={f.t('lg.sel.keep', 'Keep')} measure={recap.keep} currency={currency} emphasis />
          <Figure label={f.t('lg.sel.toCollect', 'To collect')} measure={recap.toCollect} currency={currency} />
          <Figure label={f.t('lg.sel.collected', 'Collected')} measure={recap.collected} currency={currency} />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onMarkCollected}><CircleCheck className="w-3.5 h-3.5" />{markLabel}</Button>
            <span title={payoutDisabledReason || undefined}>
              <Button variant="primary" size="sm" onClick={onRecordPayout} disabled={Boolean(payoutDisabledReason)}><Wallet className="w-3.5 h-3.5" />{payoutLabel}</Button>
            </span>
            <Button variant="ghost" size="sm" onClick={onCopy}><ClipboardCopy className="w-3.5 h-3.5" />{f.t('lg.sel.copyCsv', 'Copy CSV')}</Button>
          </div>
          {notice && <p role="status" className="text-[11.5px] text-zinc-600 dark:text-zinc-400">{notice}</p>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
        {recap.keepAverage && <span>{f.t('lg.sel.average', 'Average {amount}', { amount: f.money(recap.keepAverage.minor, currency) })}</span>}
        {recap.keepMin !== null && <span>{f.t('lg.sel.minMax', 'min {min} · max {max}', { min: f.money(recap.keepMin, currency), max: f.money(recap.keepMax, currency) })}</span>}
        {recap.deadCount > 0 && <span>{f.t('lg.sel.dead', '{count} failed or refunded, not counted', { count: f.formatNumber(recap.deadCount) })}</span>}
      </div>
    </motion.div>
  );
}
