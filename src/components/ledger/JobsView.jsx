import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ClipboardList, Clock, Percent, Plus, SearchX, Store, Users } from 'lucide-react';
import { dateBounds, inDateBounds } from '../../lib/ledger/dateFilter';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { orderRows } from '../../lib/ledger/selectors';
import { LIFECYCLES } from '../../lib/ledger/ledgerStore';
import { convertMinor, normalizeCurrency } from '../../lib/ledger/money';
import { orderRateOpts, paymentsAppliedTo, payerKey } from '../../lib/ledger/engine';
import { selectionRecap } from '../../lib/ledger/selection';
import { UNKNOWN_PAYER_ID } from '../../lib/ledger/legacyMapper';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { DateFilter, DayHeader, EmptyState, LIFE_ICON, LIFE_STYLE, GameTile, ListToolbar, Meta, Money, Segmented, SelectModeButton, ToolbarSearch, PaidToggle } from './parts';
import { RowActions, openOnRowKey } from './RowActions';
import { useOrderProofs } from './useOrderProofs';
import { groupByDay } from '../../lib/ledger/grouping';
import { useRowSelection } from './useRowSelection';
import { SelectionBar } from './SelectionBar';
import { markRowsCollected, selectionCsv } from './selectionTools';
import { copyText } from './files';

const PAGE = 40;
const ACTIVE = new Set(['pending', 'working', 'on_hold', 'disputed']);
const LIFE_LABEL = { pending: 'Pending', working: 'Working', on_hold: 'On hold', done: 'Done', failed: 'Failed', disputed: 'Disputed', refunded: 'Refunded' };

/** The Booster's jobs: what I did, what it pays, and whether I have been paid. Splits and fees only appear when a job has them. */
export function JobsView({ categories, onNewJob, onEdit, onReceipt, onOpenProofs, onOpenClient, onReceive }) {
  const ledger = useLedger();
  const proofIds = useOrderProofs();
  const f = useLedgerFormat();
  const { ctx, partyById, rates, displayCurrency } = ledger;
  const cur = displayCurrency || 'TOMAN';
  const [view, setView] = useState('all');
  const [money, setMoney] = useState('all');
  const [local, setLocal] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [period, setPeriod] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const rows = useMemo(() => (ctx ? orderRows(ctx, partyById) : []), [ctx, partyById]);
  const q = local.trim().toLowerCase();
  const counts = useMemo(() => ({
    active: rows.filter((r) => ACTIVE.has(r.order.lifecycle)).length,
    done: rows.filter((r) => r.order.lifecycle === 'done').length,
    all: rows.length,
  }), [rows]);

  const bounds = useMemo(() => dateBounds(period, custom), [period, custom]);
  const filtered = useMemo(() => rows.filter((r) => {
    if (!inDateBounds(r.order.dateTime, bounds)) return false;
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
  }), [rows, view, money, q, bounds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ticked rows: "select all" and shift-range work over every filtered row, not just the page on screen
  const sel = useRowSelection(useMemo(() => filtered.map((r) => r.order.id), [filtered]));
  const selectedRows = useMemo(() => filtered.filter((r) => sel.selected.has(r.order.id)), [filtered, sel.selected]);
  const recap = useMemo(() => selectionRecap(selectedRows, { rates, displayCurrency: cur }), [selectedRows, rates, cur]);
  const payers = [...new Set(selectedRows.map((r) => payerKey(r.order)))];
  const payoutBlocked = payers.length > 1 ? f.t('lg.sel.onePayer', 'Pick orders from one payer to record a payout') : '';

  const markSelected = async () => {
    setError('');
    const { marked, lastError } = await markRowsCollected(selectedRows, (id) => ledger.markOrderCollected(id));
    if (lastError) setError(lastError.message || f.t('lg.err.generic', 'That could not be saved.'));
    setNotice(f.t('lg.sel.marked', 'Marked {marked}, skipped {skipped}', { marked: f.formatNumber(marked), skipped: f.formatNumber(selectedRows.length - marked) }));
  };
  const recordPayment = () => onReceive(payers[0] ?? '', selectedRows.map((r) => r.order.id));
  const copySelection = async () => {
    const csv = selectionCsv(selectedRows, {
      headers: [f.t('lg.sel.csv.date', 'Date'), f.t('lg.sel.csv.title', 'Title'), f.t('lg.sel.csv.ref', 'Order ref'), f.t('lg.sel.csv.game', 'Game'), f.t('lg.sel.csv.payer', 'Payer'), f.t('lg.sel.csv.currency', 'Currency'), f.t('lg.wf.price', 'Order pays'), f.t('lg.sel.fees', 'Fees'), f.t('lg.sel.keep', 'Keep'), f.t('lg.sel.toCollect', 'To collect'), f.t('lg.sel.collected', 'Collected')],
      payerName: (r) => (r.payer ? f.name(r.payer) : ''),
      date: (iso) => f.date(iso),
    });
    await copyText(csv);
    setNotice(f.t('lg.copied', 'Copied'));
  };

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
      <ListToolbar
        filters={<>
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
          <DateFilter value={period} onChange={(v) => { setPeriod(v); setLimit(PAGE); }} custom={custom} onCustomChange={(c) => { setCustom(c); setLimit(PAGE); }} />
        </>}
        actions={<>
          <ToolbarSearch value={local} onChange={setLocal} placeholder={f.t('lg.jobs.search', 'Search jobs')} />
          <SelectModeButton active={sel.active} onToggle={sel.active ? sel.exit : sel.enter} label={f.t('lg.sel.select', 'Select')} doneLabel={f.t('lg.sel.done', 'Done')} />
          <Button variant="primary" size="sm" className="rounded-lg" onClick={onNewJob}><Plus className="w-3.5 h-3.5" />{f.t('lg.job.new', 'Add a job')}</Button>
        </>}
      />
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
                      <li key={o.id} tabIndex={0} onKeyDown={openOnRowKey(() => (sel.active ? sel.pick(o.id, {}) : onReceipt(o.id)))} onClick={sel.rowClick(o.id, () => onReceipt(o.id))} className={cn('group cursor-pointer flex gap-3 px-3 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500', sel.has(o.id) ? 'bg-zinc-100/80 dark:bg-zinc-900/70' : 'hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40', r.dead && 'opacity-60')}>
                        <span className="relative mt-0.5 shrink-0">
                          <GameTile game={o.game} categories={categories} size="lg" />
                          {/* the row's box sits on the tile's corner: hidden until hovered, and every row shows one once select mode is on */}
                          <input
                            type="checkbox"
                            checked={sel.has(o.id)}
                            onChange={(e) => sel.pick(o.id, e.nativeEvent)}
                            aria-label={f.t('lg.sel.row', 'Select this row')}
                            className={cn('absolute -start-1.5 -top-1.5 h-4 w-4 cursor-pointer accent-zinc-900 dark:accent-zinc-100 transition-opacity', !sel.active && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')}
                          />
                        </span>

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
                            <RowActions editLabel={f.t('lg.job.edit', 'Edit job')} hasProofs={proofIds.has(o.id)} onProofs={() => onOpenProofs('order', o.id, o.title || o.orderRef, o.legacyId)} onEdit={() => onEdit(o.id)} onDelete={() => guard(() => ledger.deleteOrder(o.id))} />
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
      {/* the bar leaves the way it came, instead of vanishing when the last row is unticked */}
      <AnimatePresence>
      {selectedRows.length > 0 && (
        <SelectionBar
          key="selection"
          profile="booster"
          count={selectedRows.length}
          recap={recap}
          currency={cur}
          notice={notice}
          allCount={filtered.length}
          onSelectAll={sel.selectAll}
          onClear={() => { sel.clear(); setNotice(''); }}
          onMarkCollected={markSelected}
          onRecordPayout={recordPayment}
          payoutDisabledReason={payoutBlocked}
          onCopy={copySelection}
        />
      )}
      </AnimatePresence>
      {filtered.length > limit && <div className="mt-4 text-center"><Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>{f.t('lg.showMore', 'Show more')}</Button></div>}
    </div>
  );
}
