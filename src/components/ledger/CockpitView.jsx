import React, { useMemo } from 'react';
import { ArrowDownToLine, ArrowUpRight, Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { cockpitSummary } from '../../lib/ledger/selectors';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { BalanceRail, EmptyState, Initial, Money, SectionTitle } from './parts';

const MAX_ATTENTION = 8;
const TOP_PEOPLE = 6;

export function CockpitView({ onNavigate, onPay, onReceive, onNewOrder, onOpenOrder, onImport }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, data, partyById, rates, displayCurrency, notice, unresolvedFlags } = ledger;
  const cur = displayCurrency || 'TOMAN';

  const summary = useMemo(
    () =>
      ctx
        ? cockpitSummary(ctx, data.parties, {
            rates,
            displayCurrency: cur,
            flaggedOrderIds: [...new Set(unresolvedFlags.map((x) => x.orderId))],
          })
        : null,
    [ctx, data, rates, cur, unresolvedFlags]
  );

  if (!summary) return null;

  const hasOrders = ctx.orders.length > 0;
  if (!hasOrders) {
    return (
      <EmptyState
        title={f.t('lg.empty.title', 'Track what you owe and what you earn')}
        body={f.t('lg.empty.body', 'Add an order, say who did the work and what they get. Checkpoint keeps each booster’s balance and your margin up to date.')}
      >
        <Button variant="primary" onClick={onNewOrder}><Plus className="w-3.5 h-3.5" />{f.t('lg.newOrder', 'New order')}</Button>
        <Button variant="outline" onClick={onImport}>{f.t('lg.import.link', 'Import from a spreadsheet')}</Button>
      </EmptyState>
    );
  }

  const owingPeople = summary.people.filter((p) => p.display.owedNowMinor > 0).length;
  const owes = summary.owedNowMinor > 0;

  const attentionText = (item) => {
    const order = item.orderId ? ctx.orderById.get(item.orderId) : null;
    const title = order?.title || order?.orderRef || '—';
    const name = item.partyId ? f.name(partyById.get(item.partyId)) : '';
    switch (item.type) {
      case 'booster_overdue':
        return { text: f.t('lg.att.overdue', '{name} has been waiting {days} days to be paid', { name, days: f.formatNumber(item.days) }), action: f.t('lg.pay.short', 'Pay'), run: () => onPay(item.partyId) };
      case 'collected_not_paid_out':
        return { text: f.t('lg.att.collected', '“{title}” is paid by the client, but the boosters are not paid yet', { title }), action: f.t('lg.open', 'Open'), run: () => onOpenOrder(item.orderId) };
      case 'paid_out_before_collected':
        return { text: f.t('lg.att.exposed', 'You paid the boosters on “{title}” before collecting from the client', { title }), action: f.t('lg.open', 'Open'), run: () => onOpenOrder(item.orderId) };
      case 'advance_idle':
        return { text: f.t('lg.att.advance', '{name} has an advance but no open work', { name }), action: f.t('lg.open', 'Open'), run: () => { ledger.setSelectedPartyId(item.partyId); onNavigate('people'); } };
      case 'needs_review':
        return { text: f.t('lg.att.review', '“{title}” came from your old data. Check how it was split', { title }), action: f.t('lg.review', 'Review'), run: () => onOpenOrder(item.orderId) };
      default:
        return null;
    }
  };

  const attention = summary.attention.map((i) => ({ item: i, ...(attentionText(i) || {}) })).filter((x) => x.text);

  return (
    <div className="space-y-8 pb-8">
      {ledger.hasDemo && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs">
          <p className="flex-1 text-amber-900 dark:text-amber-200">{f.t('lg.sample.banner', 'You are looking at sample data. Nothing here is yours.')}</p>
          <button type="button" onClick={() => ledger.removeSample()} className="font-medium text-amber-900 dark:text-amber-200 hover:underline">{f.t('lg.sample.remove', 'Remove sample data')}</button>
        </div>
      )}

      {ledger.interrupted && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs">
          <p className="flex-1 text-amber-900 dark:text-amber-200">{f.t('lg.interrupted', 'Checkpoint was closed while saving. Please check the numbers on the last order or payment you changed.')}</p>
          {ledger.interrupted.id && ctx.orderById.has(ledger.interrupted.id) && (
            <button type="button" onClick={() => onOpenOrder(ledger.interrupted.id)} className="font-medium text-amber-900 dark:text-amber-200 hover:underline">{f.t('lg.review', 'Review')}</button>
          )}
          <button type="button" onClick={ledger.dismissInterrupted} className="font-medium text-amber-900 dark:text-amber-200 hover:underline">{f.t('lg.interrupted.dismiss', 'Got it')}</button>
        </div>
      )}

      {notice && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 px-3.5 py-2.5 text-xs">
          <p className="flex-1 text-zinc-700 dark:text-zinc-300">
            {notice.snapshot
              ? f.t('lg.notice', 'Your {orders} orders were upgraded. Nothing was removed, and a backup was saved first.', { orders: f.formatNumber(notice.orders) })
              : f.t('lg.notice.web', 'Your {orders} orders were upgraded. Nothing was removed; your original entries are kept unchanged.', { orders: f.formatNumber(notice.orders) })}
            {notice.flaggedOrders > 0 && ' ' + f.t('lg.notice.flagged', '{n} need a quick look.', { n: f.formatNumber(notice.flaggedOrders) })}
          </p>
          <button type="button" onClick={ledger.dismissNotice} aria-label={f.t('common.close', 'Close')} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* The one number people come here for */}
      <section aria-labelledby="owe-heading">
        <h1 id="owe-heading" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {owes ? f.t('lg.cockpit.owe', 'You owe your boosters') : f.t('lg.cockpit.clear', 'You are all settled up')}
        </h1>
        <div className={cn('mt-1 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums', owes ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100')}>
          <Money minor={summary.owedNowMinor} currency={cur} approx={summary.isApproximate} />
        </div>
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {owes && f.t('lg.cockpit.across', 'Across {n} people', { n: f.formatNumber(owingPeople) })}
          {summary.committedMinor > 0 && <>{owes ? ' · ' : ''}{f.t('lg.cockpit.committed', '{amount} more on work in progress', { amount: f.money(summary.committedMinor, cur, true) })}</>}
          {summary.advancesMinor > 0 && <> · {f.t('lg.cockpit.advanced', '{amount} already advanced', { amount: f.money(summary.advancesMinor, cur, true) })}</>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => onPay(null)}><ArrowUpRight className="w-3.5 h-3.5" />{f.t('lg.pay.title', 'Settle up')}</Button>
          <Button variant="outline" onClick={() => onReceive(null)}><ArrowDownToLine className="w-3.5 h-3.5" />{f.t('lg.recv.title', 'Receive payout')}</Button>
          <Button variant="outline" onClick={onNewOrder}><Plus className="w-3.5 h-3.5" />{f.t('lg.newOrder', 'New order')}</Button>
        </div>
      </section>

      {/* Money coming in and what you keep */}
      <section className="grid gap-x-10 gap-y-6 sm:grid-cols-2 border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6">
        <div>
          <SectionTitle>{f.t('lg.cockpit.owedToMe', 'Owed to you')}</SectionTitle>
          <div className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            <Money minor={summary.owedToMeMinor} currency={cur} />
          </div>
          <ul className="mt-2 space-y-1">
            {summary.payers.map((p) => (
              <li key={p.payerId} className="flex items-baseline gap-2 text-xs">
                <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">{f.name(partyById.get(p.payerId) || (p.payerId === '' ? { id: 'party_unknown_payer' } : null))}</span>
                <span className="text-zinc-400 tabular-nums">
                  {p.releasableMinor > 0 && <>{f.t('lg.payer.releasable', '{amount} ready', { amount: f.money(p.releasableMinor, cur, true) })}</>}
                  {p.releasableMinor > 0 && p.heldMinor > 0 && ' · '}
                  {p.heldMinor > 0 && <>{f.t('lg.payer.held', '{amount} on hold', { amount: f.money(p.heldMinor, cur, true) })}</>}
                </span>
                {p.overdueMinor > 0 && <span className="text-rose-600 dark:text-rose-400 tabular-nums">{f.t('lg.payer.overdue', '{amount} overdue', { amount: f.money(p.overdueMinor, cur, true) })}</span>}
              </li>
            ))}
            {summary.payers.length === 0 && <li className="text-xs text-zinc-400">{f.t('lg.cockpit.nothingOwed', 'Nobody owes you anything right now.')}</li>}
          </ul>
        </div>
        <div>
          <SectionTitle>{f.t('lg.cockpit.margin', 'What you keep')}</SectionTitle>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            <Money minor={summary.realizedMarginMinor} currency={cur} />
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            <span className="block">{f.t('lg.cockpit.pipeline', '{amount} more once current orders finish', { amount: f.money(summary.pipelineMarginMinor, cur, true) })}</span>
            {summary.exposureMinor > 0 && (
              <span className="block text-amber-700 dark:text-amber-300">{f.t('lg.cockpit.exposure', '{amount} paid out before the client paid you', { amount: f.money(summary.exposureMinor, cur, true) })}</span>
            )}
          </p>
        </div>
      </section>

      {/* Boosters ranked by balance, each with its rail */}
      <section className="border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6">
        <SectionTitle aside={<button type="button" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => onNavigate('people')}>{f.t('lg.seeAll', 'See all')}</button>}>
          {f.t('lg.cockpit.people', 'Boosters by balance')}
        </SectionTitle>
        {summary.people.filter((p) => p.display.netMinor !== 0).length === 0 ? (
          <p className="text-xs text-zinc-400 py-3">{summary.people.length === 0 ? f.t('lg.cockpit.noPeople', 'Boosters appear here once you add them to an order.') : f.t('lg.cockpit.allSettled', 'Everyone is paid up.')}</p>
        ) : (
          <ul className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
            {summary.people.filter((p) => p.display.netMinor !== 0).slice(0, TOP_PEOPLE).map(({ party, display, agingDays, openOrders }) => (
              <li key={party.id}>
                <button
                  type="button"
                  onClick={() => { ledger.setSelectedPartyId(party.id); onNavigate('people'); }}
                  className="w-full text-start py-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-2"><Initial name={f.name(party)} className="h-5 w-5" /><span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{f.name(party)}</span></span>
                  <span className={cn('text-sm font-medium tabular-nums text-end', display.netMinor > 0 ? 'text-amber-700 dark:text-amber-400' : display.netMinor < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400')}>
                    <Money minor={Math.abs(display.netMinor)} currency={cur} compact approx={display.isApproximate} />
                    {display.netMinor < 0 && <span className="ms-1 text-[10px] font-normal">{f.t('lg.credit.short', 'credit')}</span>}
                  </span>
                  <BalanceRail
                    paid={display.paidMinor}
                    due={display.payableMinor}
                    committed={display.committedMinor}
                    label={f.t('lg.rail.label', 'Paid {paid}, due {due}, in progress {inprog}', { paid: f.money(display.paidMinor, cur, true), due: f.money(display.payableMinor, cur, true), inprog: f.money(display.committedMinor, cur, true) })}
                  />
                  <span className="text-[11px] text-zinc-400 text-end tabular-nums">
                    {openOrders > 0 && f.t('lg.openOrders', '{n} open', { n: f.formatNumber(openOrders) })}
                    {openOrders > 0 && agingDays > 0 && display.payableMinor > 0 && ' · '}
                    {display.payableMinor > 0 && agingDays > 0 && f.t('lg.waiting', 'waiting {n}d', { n: f.formatNumber(agingDays) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-zinc-400 dark:bg-zinc-500" />{f.t('lg.legend.paid', 'Paid')}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-amber-500" />{f.t('lg.legend.due', 'Due now')}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-amber-500/40" />{f.t('lg.legend.progress', 'In progress')}</span>
        </p>
      </section>

      <section className="border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6">
        <SectionTitle aside={<button type="button" onClick={onImport} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">{f.t('lg.import.link', 'Import from a spreadsheet')}</button>}>{f.t('lg.cockpit.attention', 'Needs attention')}</SectionTitle>
        {attention.length === 0 ? (
          <p className="text-xs text-zinc-400">{f.t('lg.cockpit.noAttention', 'Nothing needs your attention.')}</p>
        ) : (
          <ul className="space-y-1.5">
            {attention.slice(0, MAX_ATTENTION).map(({ item, text, action, run }, i) => (
              <li key={`${item.type}-${item.orderId || item.partyId}-${i}`} className="flex items-center gap-3 text-xs">
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', item.severity === 'warn' ? 'bg-amber-500' : 'bg-zinc-400')} aria-hidden="true" />
                <span className="flex-1 text-zinc-700 dark:text-zinc-300">{text}</span>
                <button type="button" onClick={run} className="shrink-0 font-medium text-zinc-900 dark:text-zinc-100 hover:underline">{action}</button>
              </li>
            ))}
            {attention.length > MAX_ATTENTION && (
              <li className="text-[11px] text-zinc-400">{f.t('lg.more.n', '+{n} more', { n: f.formatNumber(attention.length - MAX_ATTENTION) })}</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
