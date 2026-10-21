import React, { useMemo, useState } from 'react';
import { CircleCheck, ClipboardList, Clock, Percent, Plus, Search, SearchX, Store } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { orderRows } from '../../lib/ledger/selectors';
import { convertMinor, normalizeCurrency } from '../../lib/ledger/money';
import { orderRateOpts, paymentsAppliedTo } from '../../lib/ledger/engine';
import { LIFECYCLES } from '../../lib/ledger/ledgerStore';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { DayHeader, EmptyState, Initial, LIFE_ICON, LIFE_STYLE, GameTile, Meta, Money, Segmented, UndoLink } from './parts';
import { RowActions } from './RowActions';
import { groupByDay } from '../../lib/ledger/grouping';

const PAGE = 40;
const ACTIVE = new Set(['pending', 'working', 'on_hold', 'disputed']);
const LIFE_LABEL = { pending: 'Pending', working: 'Working', on_hold: 'On hold', done: 'Done', failed: 'Failed', disputed: 'Disputed', refunded: 'Refunded' };

export function OrdersView({ categories, onNewOrder, onEdit, onReceipt, onOpenProofs, onOpenPerson }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, partyById } = ledger;
  const [view, setView] = useState('active');
  const [money, setMoney] = useState('all');
  const [personId, setPersonId] = useState('');
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
    if (money === 'collect' && (r.dead || r.money.collected)) return false;
    if (money === 'pay' && (r.dead || r.money.shareTotalMinor === 0 || r.money.boostersPaid)) return false;
    if (personId && !r.shares.some((s) => s.party.id === personId)) return false;
    if (q) {
      const hay = [r.order.title, r.order.orderRef, r.order.game, r.order.source, r.payer ? f.name(r.payer) : '', ...r.shares.map((s) => f.name(s.party))].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, view, money, personId, q]);

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
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
        <Segmented
          ariaLabel={f.t('lg.orders.money', 'Money')}
          value={money}
          onChange={(v) => { setMoney(v); setLimit(PAGE); }}
          options={[
            { value: 'all', label: f.t('lg.orders.anyMoney', 'Any') },
            { value: 'collect', label: f.t('lg.orders.toCollect', 'To collect') },
            { value: 'pay', label: f.t('lg.orders.toPay', 'To pay out') },
          ]}
        />
        {people.length > 0 && (
          <div className="w-36">
            <Select
              value={personId}
              onChange={(v) => { setPersonId(v); setLimit(PAGE); }}
              options={[{ value: '', label: f.t('lg.orders.anyPerson', 'Any booster') }, ...people.map((p) => ({ value: p.id, label: f.name(p) }))]}
              ariaLabel={f.t('lg.orders.person', 'Booster')}
            />
          </div>
        )}
        <div className="w-48">
          <Input data-ledger-search prefixIcon={<Search className="w-3.5 h-3.5" />} value={local} onChange={(e) => setLocal(e.target.value)} placeholder={f.t('lg.orders.search', 'Search orders')} aria-label={f.t('lg.orders.search', 'Search orders')} />
        </div>
        <Button variant="primary" size="sm" className="ms-auto" onClick={onNewOrder}><Plus className="w-3.5 h-3.5" />{f.t('lg.newOrder', 'New order')}</Button>
      </div>
      {error && <p role="alert" className="mb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title={f.t('lg.orders.none', 'No orders match')} body={f.t('lg.orders.noneBody', 'Try a different filter.')} />
      ) : (
        <div>
          {groupByDay(filtered.slice(0, limit), (r) => r.order.dateTime).map((day, di) => {
            const dayKept = day.rows.filter((r) => !r.dead).reduce((sum, r) => sum + convertMinor(r.marginMinor, r.order.currency, ledger.displayCurrency, ledger.rates, orderRateOpts(r.order)), 0);
            return (
              <section key={day.key} aria-label={f.dayLabel(day.iso)}>
                <DayHeader first={di === 0} label={f.dayLabel(day.iso)} aside={dayKept !== 0 && <>{f.t('lg.wf.keep', 'you keep')} <Money minor={dayKept} currency={ledger.displayCurrency} compact approx /></>} />
                <ul className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/40 dark:bg-zinc-900/20">
                  {day.rows.map((r) => {
                    const o = r.order;
                    const flagged = ledger.unresolvedFlags.some((x) => x.orderId === o.id);
                    const mixed = normalizeCurrency(o.currency) !== normalizeCurrency(ledger.displayCurrency);
                    const style = LIFE_STYLE[o.lifecycle] || LIFE_STYLE.pending;
                    const feePct = o.grossMinor > 0 && o.platformFeeMinor > 0 ? Math.round((o.platformFeeMinor / o.grossMinor) * 1000) / 10 : 0;
                    const payerName = r.payer ? f.name(r.payer) : o.source;
                    return (
                      <li key={o.id} className={cn('group flex gap-3 px-3 py-3 transition-colors hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 first:rounded-t-xl last:rounded-b-xl', r.dead && 'opacity-60')}>
                        <GameTile game={o.game} categories={categories} lifecycle={o.lifecycle} className="mt-0.5" />

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
                                className={cn('!h-6 !px-1.5 !text-[11.5px] !border-transparent !bg-transparent hover:!bg-zinc-200/70 dark:hover:!bg-zinc-800', style.text)}
                              />
                            </div>
                            {!r.dead && (r.money.collected ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CircleCheck className="h-3.5 w-3.5" />{f.t('lg.collected', 'Collected')}</span>
                                <UndoLink revealOnHover applied={paymentsAppliedTo(ctx, 'order', o.id)} onUndo={() => guard(() => ledger.undoPaid('order', o.id))} undoLabel={f.t('lg.undo', 'Undo')} sharedLabel={f.t('lg.undo.shared', 'Part of a bigger payment')} sharedHelp={f.t('lg.undo.sharedHelp', 'Paid together with other work. Void that payment in Money to undo it.')} />
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <span className="text-zinc-700 dark:text-zinc-400">
                                  {f.t('lg.waitingOn', 'Waiting on {name}', { name: r.payer ? f.name(r.payer) : f.t('lg.order.payer', 'the payer') })}
                                  {r.money.partlyCollected && <> · <Money minor={r.money.receivableMinor - r.money.receivedMinor} currency={o.currency} compact /> {f.t('lg.left', 'left')}</>}
                                </span>
                                <button type="button" onClick={() => guard(() => ledger.markOrderCollected(o.id))} className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 font-medium text-zinc-800 dark:text-zinc-200 transition-colors hover:bg-zinc-200/70 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500">
                                  <CircleCheck className="h-3 w-3" />{f.t('lg.markCollected', 'Mark collected')}
                                </button>
                              </span>
                            ))}
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
                          <RowActions editLabel={f.t('lg.order.edit', 'Edit order')} onReceipt={() => onReceipt(o.id)} onProofs={() => onOpenProofs('order', o.id, o.title || o.orderRef, o.legacyId)} onEdit={() => onEdit(o.id)} onDelete={() => guard(() => ledger.deleteOrder(o.id))} />
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
      {filtered.length > limit && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>{f.t('lg.showMore', 'Show more')}</Button>
        </div>
      )}
    </div>
  );
}
