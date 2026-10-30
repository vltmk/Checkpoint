import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { CircleCheck, ClipboardList, Clock, Percent, Plus, SearchX, Store } from 'lucide-react';
import { dateBounds, inDateBounds } from '../../lib/ledger/dateFilter';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { isUnsettled, orderRows, orderTab } from '../../lib/ledger/selectors';
import { convertMinor, normalizeCurrency } from '../../lib/ledger/money';
import { canCloseShort, orderRateOpts, paymentsAppliedTo, payerKey } from '../../lib/ledger/engine';
import { selectionRecap } from '../../lib/ledger/selection';
import { LIFECYCLES } from '../../lib/ledger/ledgerStore';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { DateFilter, DayHeader, EmptyState, FilterChip, Initial, LIFE_ICON, LIFE_STYLE, GameTile, ListToolbar, Meta, Money, Segmented, SelectModeButton, ToolbarSearch, PaidToggle } from './parts';
import { RowActions, openOnRowKey } from './RowActions';
import { useOrderProofs } from './useOrderProofs';
import { groupByDay } from '../../lib/ledger/grouping';
import { useRowSelection } from './useRowSelection';
import { MotionDay, MotionRow, useNewRowIds } from './RowMotion';
import { SelectionBar } from './SelectionBar';
import { markRowsCollected, selectionCsv } from './selectionTools';
import { copyText } from './files';
import { CloseShort } from './CloseShort';

const PAGE = 40;
const LIFE_LABEL = { pending: 'Pending', working: 'Working', on_hold: 'On hold', done: 'Done', failed: 'Failed', disputed: 'Disputed', refunded: 'Refunded' };

export function OrdersView({ categories, onNewOrder, onEdit, onDuplicate, onReceipt, onOpenProofs, onOpenPerson, onReceive }) {
  const ledger = useLedger();
  const proofIds = useOrderProofs();
  const f = useLedgerFormat();
  const { ctx, partyById } = ledger;
  const [view, setView] = useState('active');
  const [money, setMoney] = useState('all');
  const [personId, setPersonId] = useState('');
  const [local, setLocal] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [period, setPeriod] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const rows = useMemo(() => (ctx ? orderRows(ctx, partyById) : []), [ctx, partyById]);
  const newIds = useNewRowIds(useMemo(() => rows.map((r) => r.order.id), [rows]));

  const q = local.trim().toLowerCase();
  const counts = useMemo(() => ({
    // finished orders stay Active until the payer has paid and every booster on them is paid
    active: rows.filter((r) => orderTab(r) === 'active').length,
    done: rows.filter((r) => orderTab(r) === 'done').length,
    all: rows.length,
  }), [rows]);

  const bounds = useMemo(() => dateBounds(period, custom), [period, custom]);
  const narrowing = money !== 'all' || personId !== '' || period !== 'all';
  const clearFilters = () => { setMoney('all'); setPersonId(''); setPeriod('all'); setCustom({ from: '', to: '' }); setLimit(PAGE); };
  const filtered = useMemo(() => rows.filter((r) => {
    if (!inDateBounds(r.order.dateTime, bounds)) return false;
    if (view !== 'all' && orderTab(r) !== view) return false;
    if (money === 'collect' && (r.dead || r.money.collected)) return false;
    if (money === 'pay' && (r.dead || r.money.shareTotalMinor === 0 || r.money.boostersPaid)) return false;
    if (personId && !r.shares.some((s) => s.party.id === personId)) return false;
    if (q) {
      const hay = [r.order.title, r.order.orderRef, r.order.game, r.order.source, r.payer ? f.name(r.payer) : '', ...r.shares.map((s) => f.name(s.party))].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, view, money, personId, q, bounds]);

  // ticked rows: "select all" and shift-range work over every filtered row, not just the page on screen
  const sel = useRowSelection(useMemo(() => filtered.map((r) => r.order.id), [filtered]));
  const selectedRows = useMemo(() => filtered.filter((r) => sel.selected.has(r.order.id)), [filtered, sel.selected]);
  const recap = useMemo(() => selectionRecap(selectedRows, { rates: ledger.rates, displayCurrency: ledger.displayCurrency }), [selectedRows, ledger.rates, ledger.displayCurrency]);
  const payers = [...new Set(selectedRows.map((r) => payerKey(r.order)))];
  const payoutBlocked = payers.length > 1 ? f.t('lg.sel.onePayer', 'Pick orders from one payer to record a payout') : '';

  const markSelected = async () => {
    setError('');
    const { marked, lastError } = await markRowsCollected(selectedRows, (id) => ledger.markOrderCollected(id));
    if (lastError) setError(lastError.message || f.t('lg.err.generic', 'That could not be saved.'));
    setNotice(f.t('lg.sel.marked', 'Marked {marked}, skipped {skipped}', { marked: f.formatNumber(marked), skipped: f.formatNumber(selectedRows.length - marked) }));
  };
  const recordPayout = () => onReceive(payers[0] ?? '', selectedRows.map((r) => r.order.id));
  const copySelection = async () => {
    const csv = selectionCsv(selectedRows, {
      headers: [f.t('lg.sel.csv.date', 'Date'), f.t('lg.sel.csv.title', 'Title'), f.t('lg.sel.csv.ref', 'Order ref'), f.t('lg.sel.csv.game', 'Game'), f.t('lg.sel.csv.payer', 'Payer'), f.t('lg.sel.csv.currency', 'Currency'), f.t('lg.wf.price', 'Order pays'), f.t('lg.sel.fees', 'Fees'), f.t('lg.sel.keep', 'Keep'), f.t('lg.sel.toCollect', 'To collect'), f.t('lg.sel.collected', 'Collected')],
      payerName: (r) => (r.payer ? f.name(r.payer) : r.order.source || ''),
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
      <EmptyState icon={ClipboardList} title={f.t('lg.orders.empty', 'No orders yet')} body={f.t('lg.orders.emptyBody', 'Add your first order. You will see what it pays, who does the work and what you keep.')}>
        <Button variant="primary" onClick={onNewOrder}><Plus className="w-3.5 h-3.5" />{f.t('lg.newOrder', 'New order')}</Button>
      </EmptyState>
    );
  }

  const people = [...partyById.values()].filter((p) => p.kind === 'booster' && rows.some((r) => r.shares.some((s) => s.party.id === p.id)));

  return (
    <div className="pb-8">
      <ListToolbar
        shown={filtered.length}
        total={rows.length}
        onClear={narrowing ? clearFilters : undefined}
        tabs={
          <Segmented
            ariaLabel={f.t('lg.orders.view', 'Order view')}
            value={view}
            onChange={(v) => { setView(v); setLimit(PAGE); }}
            options={[
              { value: 'active', label: f.t('lg.orders.active', 'Active'), count: counts.active },
              { value: 'done', label: f.t('lg.orders.done', 'Done'), count: counts.done },
              { value: 'all', label: f.t('lg.orders.all', 'All'), count: counts.all },
            ]}
          />
        }
        filters={<>
          <FilterChip
            label={f.t('lg.orders.money', 'Money')}
            value={money}
            active={money !== 'all'}
            onChange={(v) => { setMoney(v); setLimit(PAGE); }}
            options={[
              { value: 'all', label: f.t('lg.orders.anyMoney', 'Any') },
              { value: 'collect', label: f.t('lg.orders.toCollect', 'To collect') },
              { value: 'pay', label: f.t('lg.orders.toPay', 'To pay out') },
            ]}
          />
          {people.length > 0 && (
            <FilterChip
              label={f.t('lg.orders.person', 'Booster')}
              value={personId}
              active={personId !== ''}
              onChange={(v) => { setPersonId(v); setLimit(PAGE); }}
              options={[{ value: '', label: f.t('lg.orders.anyPerson', 'Any booster') }, ...people.map((p) => ({ value: p.id, label: f.name(p) }))]}
            />
          )}
          <DateFilter value={period} onChange={(v) => { setPeriod(v); setLimit(PAGE); }} custom={custom} onCustomChange={(c) => { setCustom(c); setLimit(PAGE); }} />
        </>}
        actions={<>
          <ToolbarSearch value={local} onChange={setLocal} placeholder={f.t('lg.orders.search', 'Search orders')} />
          <SelectModeButton active={sel.active} onToggle={sel.active ? sel.exit : sel.enter} label={f.t('lg.sel.select', 'Select')} doneLabel={f.t('lg.sel.done', 'Done')} />
          <Button variant="primary" size="sm" className="rounded-lg" onClick={onNewOrder}><Plus className="w-3.5 h-3.5" />{f.t('lg.newOrder', 'New order')}</Button>
        </>}
      />
      {error && <p role="alert" className="mb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title={f.t('lg.orders.none', 'No orders match')} body={f.t('lg.orders.noneBody', 'Try a different filter.')} />
      ) : (
        <div>
          <AnimatePresence initial={false}>
          {groupByDay(filtered.slice(0, limit), (r) => r.order.dateTime).map((day, di) => {
            const dayKept = day.rows.filter((r) => !r.dead).reduce((sum, r) => sum + convertMinor(r.marginMinor, r.order.currency, ledger.displayCurrency, ledger.rates, orderRateOpts(r.order)), 0);
            const dayIsNew = day.rows.every((r) => newIds.has(r.order.id));
            return (
              <MotionDay key={day.key} isNew={dayIsNew} aria-label={f.dayLabel(day.iso)}>
                <DayHeader first={di === 0} label={f.dayLabel(day.iso)} aside={dayKept !== 0 && <>{f.t('lg.wf.keep', 'you keep')} <Money minor={dayKept} currency={ledger.displayCurrency} compact approx /></>} />
                <ul className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/40 dark:bg-zinc-900/20">
                  <AnimatePresence initial={false}>
                  {day.rows.map((r) => {
                    const o = r.order;
                    const flagged = ledger.unresolvedFlags.some((x) => x.orderId === o.id);
                    const mixed = normalizeCurrency(o.currency) !== normalizeCurrency(ledger.displayCurrency);
                    const style = LIFE_STYLE[o.lifecycle] || LIFE_STYLE.pending;
                    const feePct = o.grossMinor > 0 && o.platformFeeMinor > 0 ? Math.round((o.platformFeeMinor / o.grossMinor) * 1000) / 10 : 0;
                    const payerName = r.payer ? f.name(r.payer) : o.source;
                    return (
                      <MotionRow key={o.id} isNew={!dayIsNew && newIds.has(o.id)} dimmed={r.dead} tabIndex={0} onKeyDown={openOnRowKey(() => (sel.active ? sel.pick(o.id, {}) : onReceipt(o.id)))} onClick={sel.rowClick(o.id, () => onReceipt(o.id))} className={cn('group cursor-pointer flex gap-3 px-3 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500', sel.has(o.id) ? 'bg-zinc-100/80 dark:bg-zinc-900/70' : 'hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40')}>
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
                            {flagged && <button type="button" onClick={() => onEdit(o.id)} className="shrink-0 text-[11px] text-amber-700 dark:text-amber-400 hover:underline">{f.t('lg.checkSplit', 'Check split')}</button>}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {payerName && <Meta icon={Store}>{payerName}</Meta>}
                            {o.game && <Meta>{o.game}</Meta>}
                            <Meta icon={Clock} title={`${f.date(o.dateTime)} ${f.time(o.dateTime)}`}>{f.time(o.dateTime)}</Meta>
                            {feePct > 0 && <Meta icon={Percent} title={f.t('lg.order.fee', 'Platform fee %')}>{f.formatNumber(feePct)}%</Meta>}
                          </div>

                          {/* who does the work, and whether they are paid */}
                          {r.shares.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {r.shares.map((s) => (
                                <li key={s.share.id}>
                                  <button
                                    type="button"
                                    onClick={() => onOpenPerson(s.party.id)}
                                    title={s.paid ? f.t('lg.chip.paid', 'Paid') : f.t('lg.chip.open', 'Open the statement')}
                                    className={cn('inline-flex items-center gap-1.5 h-6 ps-1 pe-2 rounded-full text-[11px] border transition-colors hover:border-zinc-400 dark:hover:border-zinc-600', s.paid ? 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400' : s.partlyPaid ? 'border-amber-500/40 text-amber-800 dark:text-amber-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200')}
                                  >
                                    <Initial name={f.name(s.party)} />
                                    <span className="truncate max-w-[8rem]">{f.name(s.party)}</span>
                                    <Money minor={s.paid ? s.share.amountMinor : s.outstandingMinor} currency={o.currency} compact />
                                    {s.paid && <CircleCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-label={f.t('lg.chip.paid', 'Paid')} />}
                                  </button>
                                </li>
                              ))}
                            </ul>
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
                            {/* finished, but money still has to move: why a done order is still under Active */}
                            {isUnsettled(r) && (
                              <span
                                title={f.t('lg.orders.unsettledHelp', 'Finished, but the payer has not paid it all or a booster is still owed. It moves to Done once both are settled.')}
                                className="inline-flex h-5 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
                              >
                                {f.t('lg.orders.unsettled', 'Unsettled')}
                              </span>
                            )}
                            {!r.dead && !r.money.collected && (
                              <span className="text-zinc-700 dark:text-zinc-400">
                                {f.t('lg.waitingOn', 'Waiting on {name}', { name: r.payer ? f.name(r.payer) : f.t('lg.order.payer', 'the payer') })}
                                {r.money.partlyCollected && <> · <Money minor={r.money.receivableMinor - r.money.receivedMinor} currency={o.currency} compact /> {f.t('lg.left', 'left')}</>}
                                {canCloseShort(ctx, o) && (
                                  <> · <CloseShort amountMinor={r.money.receivableMinor - r.money.receivedMinor} currency={o.currency} onConfirm={(note) => guard(() => ledger.writeOff(o.id, note))} /></>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end justify-between gap-2 text-end">
                          <div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 first-letter:uppercase">{f.t('lg.wf.keep', 'you keep')}</div>
                            <div className={cn('text-[15px] font-semibold tabular-nums', r.marginMinor < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-100')}><Money minor={r.marginMinor} currency={o.currency} compact /></div>
                            <div className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400" title={`${f.t('lg.wf.price', 'Order pays')} − ${f.t('lg.wf.feeShort', 'fee')} − ${f.t('lg.wf.boostersShort', 'boosters')}`}>
                              {f.t('lg.wf.price', 'Order pays')} <Money minor={o.grossMinor} currency={o.currency} compact />
                            </div>
                            {mixed && <div className="text-[11px] tabular-nums text-zinc-500"><Money minor={convertMinor(r.marginMinor, o.currency, ledger.displayCurrency, ledger.rates, orderRateOpts(o))} currency={ledger.displayCurrency} compact approx /></div>}
                          </div>
                          <div className="flex items-center gap-2">
                            {!r.dead && (
                              <PaidToggle
                                paid={r.money.collected}
                                applied={paymentsAppliedTo(ctx, 'order', o.id)}
                                onPay={() => guard(() => ledger.markOrderCollected(o.id))}
                                onUndo={() => guard(() => ledger.undoPaid('order', o.id))}
                                labels={{ paid: f.t('lg.collected', 'Collected'), markPaid: f.t('lg.markCollected', 'Mark collected'), undo: f.t('lg.undo', 'Undo'), sharedHelp: f.t('lg.undo.sharedHelp', 'Paid together with other work. Void that payment in Money to undo it.') }}
                              />
                            )}
                            <RowActions editLabel={f.t('lg.order.edit', 'Edit order')} hasProofs={proofIds.has(o.id)} onProofs={() => onOpenProofs('order', o.id, o.title || o.orderRef, o.legacyId)} onEdit={() => onEdit(o.id)} duplicateLabel={f.t('lg.order.duplicate', 'Duplicate order')} onDuplicate={() => onDuplicate(o.id)} onDelete={() => guard(() => ledger.deleteOrder(o.id))} />
                          </div>
                        </div>
                      </MotionRow>
                    );
                  })}
                  </AnimatePresence>
                </ul>
              </MotionDay>
            );
          })}
          </AnimatePresence>
        </div>
      )}
      {/* the bar leaves the way it came, instead of vanishing when the last row is unticked */}
      <AnimatePresence>
      {selectedRows.length > 0 && (
        <SelectionBar
          key="selection"
          profile="advertiser"
          count={selectedRows.length}
          recap={recap}
          currency={ledger.displayCurrency}
          notice={notice}
          allCount={filtered.length}
          onSelectAll={sel.selectAll}
          onClear={() => { sel.clear(); setNotice(''); }}
          onMarkCollected={markSelected}
          onRecordPayout={recordPayout}
          payoutDisabledReason={payoutBlocked}
          onCopy={copySelection}
        />
      )}
      </AnimatePresence>
      {filtered.length > limit && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>{f.t('lg.showMore', 'Show more')}</Button>
        </div>
      )}
    </div>
  );
}
