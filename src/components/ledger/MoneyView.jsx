import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowDownToLine, ArrowUpRight, Ban, Clock, ImageIcon, Percent, StickyNote, Wallet } from 'lucide-react';
import { Button } from '../ui/Button';
import { voidedPaymentIds, paymentRateOpts } from '../../lib/ledger/engine';
import { collapseBuckets, bucketKey } from '../../lib/ledger/money';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { DayHeader, EmptyState, Meta, Money, Segmented } from './parts';
import { groupByDay } from '../../lib/ledger/grouping';

// what a payment looks like in the list: money in, money out, or a fee
const DIRECTION_ICON = { in: ArrowDownLeft, out: ArrowUpRight, expense: Percent };
const DIRECTION_TILE = {
  in: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  out: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  expense: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
};

const PAGE = 50;

/** Every payment in and out, newest first. Voided payments stay visible, struck through, so history is honest. */
export function MoneyView({ onPay, onReceive, onOpenProofs }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, partyById, rates, displayCurrency } = ledger;
  const cur = displayCurrency || 'TOMAN';
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [confirmVoid, setConfirmVoid] = useState(null);
  const [error, setError] = useState('');

  const rows = useMemo(() => {
    if (!ctx) return [];
    const voided = voidedPaymentIds(ctx.payments);
    return ctx.payments
      .filter((p) => !p.voidsPaymentId)
      .map((p) => ({ p, voided: voided.has(p.id) }))
      .sort((a, b) => Date.parse(b.p.dateTime) - Date.parse(a.p.dateTime));
  }, [ctx]);

  const kindOf = (p) => (p.kind === 'expense' ? 'expense' : p.direction === 'in' ? 'in' : 'out');
  const shown = rows.filter(({ p }) => filter === 'all' || kindOf(p) === filter);

  const totals = useMemo(() => {
    const live = rows.filter((r) => !r.voided).map((r) => r.p);
    // each payment is valued at the rates it was made at, so a later rate change does not move what was received or paid
    const pick = (k) => {
      const buckets = {};
      for (const p of live.filter((x) => kindOf(x) === k)) {
        const key = bucketKey(p.currency, paymentRateOpts(p));
        buckets[key] = (buckets[key] || 0) + p.amountMinor;
      }
      return collapseBuckets(buckets, cur, rates);
    };
    return { in: pick('in'), out: pick('out'), expense: pick('expense') };
  }, [rows, cur, rates]);

  if (!ctx) return null;

  const guard = async (fn) => {
    setError('');
    try { await fn(); } catch (e) { setError(e?.message || f.t('lg.err.generic', 'That could not be saved.')); }
  };

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="primary" onClick={() => onPay(null)}><ArrowUpRight className="w-3.5 h-3.5" />{f.t('lg.pay.title', 'Settle up')}</Button>
        <Button variant="outline" onClick={() => onReceive(null)}><ArrowDownToLine className="w-3.5 h-3.5" />{f.t('lg.recv.title', 'Receive payout')}</Button>
      </div>

      <dl className="grid grid-cols-3 gap-4 border-y border-zinc-200/80 dark:border-zinc-800/80 py-3 mb-4">
        {[
          ['in', f.t('lg.money.received', 'Received'), 'text-emerald-700 dark:text-emerald-400'],
          ['out', f.t('lg.money.paidOut', 'Paid out'), 'text-amber-700 dark:text-amber-400'],
          ['expense', f.t('lg.money.fees', 'Fees and expenses'), 'text-zinc-700 dark:text-zinc-300'],
        ].map(([k, label, tone]) => (
          <div key={k}>
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className={cn('text-lg font-semibold tabular-nums', tone)}><Money minor={totals[k].minor} currency={cur} compact approx={totals[k].isApproximate} /></dd>
          </div>
        ))}
      </dl>

      <Segmented
        ariaLabel={f.t('lg.money.filter', 'Filter payments')}
        value={filter}
        onChange={(v) => { setFilter(v); setLimit(PAGE); }}
        options={[
          { value: 'all', label: f.t('lg.orders.all', 'All') },
          { value: 'in', label: f.t('lg.money.received', 'Received') },
          { value: 'out', label: f.t('lg.money.paidOut', 'Paid out') },
          { value: 'expense', label: f.t('lg.money.fees', 'Fees and expenses') },
        ]}
      />
      {error && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {shown.length === 0 ? (
        <EmptyState icon={Wallet} title={f.t('lg.money.empty', 'No payments yet')} body={f.t('lg.money.emptyBody', 'When you pay a booster or a platform pays you, it shows up here.')} />
      ) : (
        <div className="mt-3">
          {groupByDay(shown.slice(0, limit), ({ p }) => p.dateTime).map((day, di) => (
            <section key={day.key} aria-label={f.dayLabel(day.iso)}>
              <DayHeader first={di === 0} label={f.dayLabel(day.iso)} />
              <ul className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/40 dark:bg-zinc-900/20">
                {day.rows.map(({ p, voided }) => {
                  const k = kindOf(p);
                  const name = f.name(partyById.get(p.partyId));
                  const Icon = DIRECTION_ICON[k];
                  return (
                    <li key={p.id} className={cn('group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 first:rounded-t-xl last:rounded-b-xl', voided && 'opacity-50')}>
                      <span aria-hidden="true" className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', DIRECTION_TILE[k])}><Icon className="h-4 w-4" strokeWidth={1.75} /></span>
                      <div className="min-w-0 flex-1">
                        <div className={cn('truncate text-sm text-zinc-900 dark:text-zinc-100', voided && 'line-through')}>
                          {k === 'in' && f.t('lg.money.from', 'From {name}', { name })}
                          {k === 'out' && (p.kind === 'advance' ? f.t('lg.money.advanceTo', 'Advance to {name}', { name }) : f.t('lg.money.to', 'To {name}', { name }))}
                          {k === 'expense' && f.t('lg.money.expense', 'Fee ({name})', { name })}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <Meta icon={Clock} title={`${f.date(p.dateTime)} ${f.time(p.dateTime)}`}>{f.time(p.dateTime)}</Meta>
                          {p.origin === 'migrated' && <Meta>{f.t('lg.money.migrated', 'from your old data')}</Meta>}
                          {p.note && <Meta icon={StickyNote} title={p.note}>{p.note}</Meta>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-end">
                        <span className={cn('tabular-nums text-sm font-medium', k === 'in' ? 'text-emerald-700 dark:text-emerald-400' : k === 'out' ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300', voided && 'line-through')}>
                          {k === 'in' ? '+' : '−'}<Money minor={p.amountMinor} currency={p.currency} compact />
                        </span>
                        <span className="flex items-center gap-1 text-[11.5px] opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <button type="button" aria-label={f.t('lg.proofs', 'Screenshots')} title={f.t('lg.proofs', 'Screenshots')} onClick={() => onOpenProofs('payment', p.id, f.t('lg.payment', 'Payment'))} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"><ImageIcon className="h-3.5 w-3.5" /></button>
                          {!voided && (confirmVoid === p.id ? (
                            <button type="button" autoFocus onBlur={() => setConfirmVoid(null)} onClick={() => { setConfirmVoid(null); guard(() => ledger.voidPayment(p.id)); }} className="h-6 rounded-md bg-rose-500/10 px-2 font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-500/20">{f.t('lg.void.confirm', 'Void it?')}</button>
                          ) : (
                            <button type="button" onClick={() => setConfirmVoid(p.id)} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-rose-600 dark:hover:text-rose-400"><Ban className="h-3 w-3" />{f.t('lg.void', 'Void')}</button>
                          ))}
                          {voided && <span className="px-1.5 text-zinc-500">{f.t('lg.payment.voidedShort', 'Voided')}</span>}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {shown.length > limit && (
        <div className="mt-4 text-center"><Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>{f.t('lg.showMore', 'Show more')}</Button></div>
      )}
    </div>
  );
}
