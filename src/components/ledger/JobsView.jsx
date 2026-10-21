import React, { useMemo, useState } from 'react';
import { ClipboardList, Clock, Percent, Plus, Search, SearchX, Store, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { orderRows } from '../../lib/ledger/selectors';
import { LIFECYCLES } from '../../lib/ledger/ledgerStore';
import { convertMinor, normalizeCurrency } from '../../lib/ledger/money';
import { orderRateOpts, paymentsAppliedTo } from '../../lib/ledger/engine';
import { UNKNOWN_PAYER_ID } from '../../lib/ledger/legacyMapper';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { DayHeader, EmptyState, LIFE_ICON, LIFE_STYLE, GameTile, Meta, Money, Segmented, PaidToggle, TOOLBAR_INPUT } from './parts';
import { RowActions, openOnBlankClick } from './RowActions';
import { useOrderProofs } from './useOrderProofs';
import { groupByDay } from '../../lib/ledger/grouping';

const PAGE = 40;
const ACTIVE = new Set(['pending', 'working', 'on_hold', 'disputed']);
const LIFE_LABEL = { pending: 'Pending', working: 'Working', on_hold: 'On hold', done: 'Done', failed: 'Failed', disputed: 'Disputed', refunded: 'Refunded' };

/** The Booster's jobs: what I did, what it pays, and whether I have been paid. Splits and fees only appear when a job has them. */
export function JobsView({ categories, onNewJob, onEdit, onReceipt, onOpenProofs, onOpenClient }) {
  const ledger = useLedger();
  const proofIds = useOrderProofs();
  const f = useLedgerFormat();
  const { ctx, partyById, rates, displayCurrency } = ledger;
  const cur = displayCurrency || 'TOMAN';
  const [view, setView] = useState('all');
  const [money, setMoney] = useState('all');
  const [local, setLocal] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [error, setError] = useState('');

  const rows = useMemo(() => (ctx ? orderRows(ctx, partyById) : []), [ctx, partyById]);
  const q = local.trim().toLowerCase();
  const counts = useMemo(() => ({
    active: rows.filter((r) => ACTIVE.has(r.order.lifecycle)).length,
    done: rows.filter((r) => r.order.lifecycle === 'done').length,
    all: rows.length,
  }), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const l = r.order.lifecycle;
    if (view === 'active' && !ACTIVE.has(l)) return false;
    if (view === 'done' && l !== 'done') return false;
    if (money === 'unpaid' && (r.dead || r.money.collected)) return false;
    if (money === 'paid' && !r.money.collected) return false;
    if (q) {
      const hay = [r.order.title, r.order.orderRef, r.order.game, r.order.source, r.payer ? f.name(r.payer) : ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, view, money, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const guard = async (fn) => {
    setError('');
    try { await fn(); } catch (e) { setError(e?.message || f.t('lg.err.generic', 'That could not be saved.')); }
  };

  if (!ctx) return null;
  if (rows.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title={f.t('lg.jobs.empty', 'No jobs yet')} body={f.t('lg.jobs.emptyBody', 'Add a job when you finish one. You will see what it paid and whether you have been paid.')}>
        <Button variant="primary" onClick={onNewJob}><Plus className="w-3.5 h-3.5" />{f.t('lg.job.new', 'Add a job')}</Button>
      </EmptyState>
    );
  }

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented ariaLabel={f.t('lg.orders.view', 'Order view')} value={view} onChange={(v) => { setView(v); setLimit(PAGE); }}
          options={[
            { value: 'all', label: f.t('lg.orders.all', 'All'), count: counts.all },
            { value: 'active', label: f.t('lg.jobs.inProgress', 'In progress'), count: counts.active },
            { value: 'done', label: f.t('lg.orders.done', 'Done'), count: counts.done },
          ]} />
        <Segmented ariaLabel={f.t('lg.orders.money', 'Money')} value={money} onChange={(v) => { setMoney(v); setLimit(PAGE); }}
          options={[
            { value: 'all', label: f.t('lg.orders.anyMoney', 'Any') },
            { value: 'unpaid', label: f.t('lg.jobs.unpaid', 'Unpaid') },
            { value: 'paid', label: f.t('lg.jobs.paid', 'Paid') },
          ]} />
        <div className="w-48">
          <Input data-ledger-search className={TOOLBAR_INPUT} prefixIcon={<Search className="w-3.5 h-3.5" />} value={local} onChange={(e) => setLocal(e.target.value)} placeholder={f.t('lg.jobs.search', 'Search jobs')} aria-label={f.t('lg.jobs.search', 'Search jobs')} />
        </div>
        <Button variant="primary" size="sm" className="ms-auto rounded-lg" onClick={onNewJob}><Plus className="w-3.5 h-3.5" />{f.t('lg.job.new', 'Add a job')}</Button>
      </div>
      {error && <p role="alert" className="mb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title={f.t('lg.jobs.none', 'No jobs match')} body={f.t('lg.orders.noneBody', 'Try a different filter.')} />
      ) : (
        <div>
          {groupByDay(filtered.slice(0, limit), (r) => r.order.dateTime).map((day, di) => {
            const dayEarned = day.rows.filter((r) => !r.dead).reduce((sum, r) => sum + convertMinor(r.marginMinor, r.order.currency, cur, rates, orderRateOpts(r.order)), 0);
            return (
              <section key={day.key} aria-label={f.dayLabel(day.iso)}>
                <DayHeader first={di === 0} label={f.dayLabel(day.iso)} aside={dayEarned !== 0 && <>{f.t('lg.day.earned', 'earned')} <Money minor={dayEarned} currency={cur} compact approx /></>} />
                <ul className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/40 dark:bg-zinc-900/20">
                  {day.rows.map((r) => {
                    const o = r.order;
                    const style = LIFE_STYLE[o.lifecycle] || LIFE_STYLE.pending;
                    const hasTeam = r.shares.length > 0;
                    const flagged = ledger.unresolvedFlags.some((x) => x.orderId === o.id);
                    const mixed = normalizeCurrency(o.currency) !== normalizeCurrency(cur);
                    const feePct = o.grossMinor > 0 && o.platformFeeMinor > 0 ? Math.round((o.platformFeeMinor / o.grossMinor) * 1000) / 10 : 0;
                    return (
                      <li key={o.id} onClick={openOnBlankClick(() => onReceipt(o.id))} className={cn('group cursor-pointer flex gap-3 px-3 py-3 transition-colors hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 first:rounded-t-xl last:rounded-b-xl', r.dead && 'opacity-60')}>
                        <GameTile game={o.game} categories={categories} lifecycle={o.lifecycle} className="mt-0.5" />

                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <button type="button" onClick={() => onEdit(o.id)} className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:underline text-start">{o.title || o.orderRef || '—'}</button>
                            {o.orderRef && o.title && <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0" dir="ltr">#{o.orderRef}</span>}
                            {flagged && <button type="button" onClick={() => onEdit(o.id)} className="shrink-0 text-[11px] text-amber-700 dark:text-amber-300 hover:underline">{f.t('lg.checkSplit', 'Check split')}</button>}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {r.payer
                              ? <button type="button" onClick={() => onOpenClient(r.payer.id)} className="inline-flex min-w-0 items-center gap-1 text-[11.5px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline"><Store className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" /><span className="truncate">{f.name(r.payer)}</span></button>
                              : <Meta icon={Store}>{f.t('lg.party.unknownPayer', 'Direct / unknown')}</Meta>}
                            {o.game && <Meta>{o.game}</Meta>}
                            <Meta icon={Clock} title={`${f.date(o.dateTime)} ${f.time(o.dateTime)}`}>{f.time(o.dateTime)}</Meta>
                            {feePct > 0 && <Meta icon={Percent} title={f.t('lg.order.fee', 'Platform fee %')}>{f.formatNumber(feePct)}%</Meta>}
                            {hasTeam && <Meta icon={Users} title={r.shares.map((s) => f.name(s.party)).join(', ')}>{r.shares.map((s) => f.name(s.party)).join(', ')}</Meta>}
                          </div>

                          {(hasTeam || o.platformFeeMinor > 0) && (
                            <p className="mt-1 flex flex-wrap gap-x-2 text-[11.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
                              <span>{f.t('lg.jobs.total', 'Job paid')} <Money minor={o.grossMinor} currency={o.currency} compact /></span>
                              {o.platformFeeMinor > 0 && <span>− <Money minor={o.platformFeeMinor} currency={o.currency} compact /> {f.t('lg.wf.feeShort', 'fee')}</span>}
                              {hasTeam && <span>− <Money minor={r.money.shareTotalMinor} currency={o.currency} compact /> {f.t('lg.jobs.team', 'team')}</span>}
                            </p>
                          )}

                          <div className="mt-auto flex min-h-[2.25rem] flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 text-[11.5px]">
                            <div className="w-[7.5rem] shrink-0">
                              <Select
                                value={o.lifecycle}
                                onChange={(v) => guard(() => ledger.setLifecycle(o.id, v))}
                                options={LIFECYCLES.map((l) => { const Icon = LIFE_ICON[l]; return { value: l, label: f.t(`lg.life.${l}`, LIFE_LABEL[l]), icon: <Icon className={cn('h-3.5 w-3.5', (LIFE_STYLE[l] || LIFE_STYLE.pending).text)} /> }; })}
                                ariaLabel={f.t('lg.order.status', 'Status')}
                                className={cn('!h-6 !px-1.5 !text-[11.5px] !border-transparent', style.pill, style.text)}
                              />
                            </div>
                            {!r.dead && !r.money.collected && (
                              <span className="text-zinc-700 dark:text-zinc-400">
                                {r.payer && r.payer.id !== UNKNOWN_PAYER_ID ? f.t('lg.waitingOn', 'Waiting on {name}', { name: f.name(r.payer) }) : f.t('lg.jobs.unpaidStamp', 'Not paid yet')}
                                {r.money.partlyCollected && <> · <Money minor={r.money.receivableMinor - r.money.receivedMinor} currency={o.currency} compact /> {f.t('lg.left', 'left')}</>}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end justify-between gap-2 text-end">
                          <div>
                            <div className="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"><Money minor={r.marginMinor} currency={o.currency} /></div>
                            {mixed && <div className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400"><Money minor={convertMinor(r.marginMinor, o.currency, cur, rates, orderRateOpts(o))} currency={cur} compact approx /></div>}
                          </div>
                          <div className="flex items-center gap-2">
                            {!r.dead && (
                              <PaidToggle
                                paid={r.money.collected}
                                applied={paymentsAppliedTo(ctx, 'order', o.id)}
                                onPay={() => guard(() => ledger.markOrderCollected(o.id))}
                                onUndo={() => guard(() => ledger.undoPaid('order', o.id))}
                                labels={{ paid: f.t('lg.jobs.paidStamp', 'Paid'), markPaid: f.t('lg.jobs.markPaid', 'Mark paid'), undo: f.t('lg.undo', 'Undo'), sharedHelp: f.t('lg.undo.sharedHelp', 'Paid together with other work. Void that payment in Money to undo it.') }}
                              />
                            )}
                            <RowActions editLabel={f.t('lg.job.edit', 'Edit job')} onReceipt={() => onReceipt(o.id)} hasProofs={proofIds.has(o.id)} onProofs={() => onOpenProofs('order', o.id, o.title || o.orderRef, o.legacyId)} onEdit={() => onEdit(o.id)} onDelete={() => guard(() => ledger.deleteOrder(o.id))} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {filtered.length > limit && <div className="mt-4 text-center"><Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>{f.t('lg.showMore', 'Show more')}</Button></div>}
    </div>
  );
}
