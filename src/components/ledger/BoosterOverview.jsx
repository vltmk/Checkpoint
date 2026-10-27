import React, { useMemo } from 'react';
import { ArrowDownToLine, Plus, Receipt, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { boosterOverview } from '../../lib/ledger/boosterSelectors';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { BalanceRail, EmptyState, Initial, Money, SectionTitle } from './parts';

const MAX_ATTENTION = 6;

/** The Booster's home screen: who owes me, what I earned and spent this month, and what needs a nudge. */
export function BoosterOverview({ onNavigate, onReceive, onNewJob, onExpense, onOpenJob, onImport }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, data, partyById, rates, displayCurrency, notice, interrupted } = ledger;
  const cur = displayCurrency || 'TOMAN';

  const ov = useMemo(
    () => (ctx ? boosterOverview(ctx, data.parties, { rates, displayCurrency: cur, monthKey: f.monthKey }) : null),
    [ctx, data, rates, cur, f.monthKey]
  );
  if (!ov) return null;

  if (ctx.orders.length === 0 && ctx.effectivePayments.length === 0) {
    return (
      <EmptyState
        title={f.t('lg.ov.emptyTitle', 'Track your jobs and what you are owed')}
        body={f.t('lg.ov.emptyBody', 'Add a job when you finish one. Checkpoint shows who still owes you, what you earned this month, and what you spent.')}
      >
        <Button variant="primary" onClick={onNewJob}><Plus className="w-3.5 h-3.5" />{f.t('lg.job.new', 'Add a job')}</Button>
        <Button variant="outline" onClick={onImport}>{f.t('lg.import.link', 'Import from a spreadsheet')}</Button>
      </EmptyState>
    );
  }

  const owed = ov.owedMinor > 0;
  const clients = ov.payers.filter((p) => p.owedMinor > 0 || p.progressMinor > 0);
  const nameOf = (key) => f.name(key ? partyById.get(key) : { id: '' });
  const attention = ov.attention.slice(0, MAX_ATTENTION);

  return (
    <div className="space-y-8 pb-8">
      {ledger.hasDemo && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs">
          <p className="flex-1 text-amber-900 dark:text-amber-200">{f.t('lg.sample.banner', 'You are looking at sample data. Nothing here is yours.')}</p>
          <button type="button" onClick={() => ledger.removeSample()} className="font-medium text-amber-900 dark:text-amber-200 hover:underline">{f.t('lg.sample.remove', 'Remove sample data')}</button>
        </div>
      )}
      {interrupted && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs">
          <p className="flex-1 text-amber-900 dark:text-amber-200">{f.t('lg.interrupted', 'Checkpoint was closed while saving. Please check the numbers on the last order or payment you changed.')}</p>
          <button type="button" onClick={ledger.dismissInterrupted} className="font-medium text-amber-900 dark:text-amber-200 hover:underline">{f.t('lg.interrupted.dismiss', 'Got it')}</button>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 px-3.5 py-2.5 text-xs">
          <p className="flex-1 text-zinc-700 dark:text-zinc-300">
            {notice.snapshot
              ? f.t('lg.notice.jobs', 'Your {orders} jobs were upgraded. Nothing was removed, and a backup was saved first.', { orders: f.formatNumber(notice.orders) })
              : f.t('lg.notice.jobsWeb', 'Your {orders} jobs were upgraded. Nothing was removed; your original entries are kept unchanged.', { orders: f.formatNumber(notice.orders) })}
          </p>
          <button type="button" onClick={ledger.dismissNotice} aria-label={f.t('common.close', 'Close')} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <section aria-labelledby="owed-heading">
        <h1 id="owed-heading" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {owed ? f.t('lg.ov.owed', 'You are owed') : f.t('lg.ov.allPaid', 'Everyone has paid you')}
        </h1>
        <div className={cn('mt-1 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums', owed ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100')}>
          <Money minor={ov.owedMinor} currency={cur} approx={ov.isApproximate} />
        </div>
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {owed && f.t('lg.ov.across', 'From {n} clients · the oldest has waited {d} days', { n: f.formatNumber(ov.owingClients), d: f.formatNumber(ov.oldestDays) })}
          {ov.progressMinor > 0 && <>{owed ? ' · ' : ''}{f.t('lg.ov.progress', '{amount} more on jobs in progress', { amount: f.money(ov.progressMinor, cur, true) })}</>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onNewJob}><Plus className="w-3.5 h-3.5" />{f.t('lg.job.new', 'Add a job')}</Button>
          <Button variant="outline" onClick={() => onReceive(null)}><ArrowDownToLine className="w-3.5 h-3.5" />{f.t('lg.ov.received', 'Payment received')}</Button>
          <Button variant="outline" onClick={onExpense}><Receipt className="w-3.5 h-3.5" />{f.t('lg.exp.title', 'Add an expense')}</Button>
        </div>
      </section>

      <section className="border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6">
        <SectionTitle>{f.t('lg.ov.thisMonth', 'This month')}</SectionTitle>
        <dl className="grid grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-zinc-500">{f.t('lg.ov.earned', 'Earned')}</dt>
            <dd className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"><Money minor={ov.earnedMinor} currency={cur} compact /></dd>
            <dd className="text-[11px] text-zinc-400">{f.t('lg.ov.jobs', '{n} jobs', { n: f.formatNumber(ov.jobsThisMonth) })}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{f.t('lg.ov.spent', 'Spent')}</dt>
            <dd className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"><Money minor={ov.spentMinor} currency={cur} compact /></dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{f.t('lg.ov.kept', 'You keep')}</dt>
            <dd className={cn('text-xl font-semibold tabular-nums', ov.keptMinor < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-100')}><Money minor={ov.keptMinor} currency={cur} compact /></dd>
          </div>
        </dl>
      </section>

      <section className="border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6">
        <SectionTitle aside={<button type="button" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => onNavigate('people')}>{f.t('lg.seeAll', 'See all')}</button>}>
          {f.t('lg.ov.whoOwes', 'Who owes you')}
        </SectionTitle>
        {clients.length === 0 ? (
          <p className="text-xs text-zinc-400 py-2">{f.t('lg.ov.nobody', 'Nobody owes you anything right now.')}</p>
        ) : (
          <ul className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
            {clients.slice(0, 6).map((p) => (
              <li key={p.key || 'none'}>
                <button
                  type="button"
                  onClick={() => { ledger.setSelectedClientKey(p.key); onNavigate('people'); }}
                  className="w-full text-start py-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-2"><Initial name={f.name(p.party)} className="h-5 w-5" /><span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{f.name(p.party)}</span></span>
                  <span className={cn('text-sm font-medium tabular-nums text-end', p.owedMinor > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400')}>
                    {p.owedMinor > 0 ? <Money minor={p.owedMinor} currency={cur} compact approx={p.isApproximate} /> : '—'}
                  </span>
                  <BalanceRail incoming paid={p.collectedMinor} due={p.owedMinor} committed={p.progressMinor}
                    label={f.t('lg.ov.railLabel', 'Received {paid}, owed {due}, in progress {inprog}', { paid: f.money(p.collectedMinor, cur, true), due: f.money(p.owedMinor, cur, true), inprog: f.money(p.progressMinor, cur, true) })} />
                  <span className="text-[11px] text-zinc-400 text-end tabular-nums">
                    {p.owedMinor > 0 && p.agingDays > 0 && f.t('lg.waiting', 'waiting {n}d', { n: f.formatNumber(p.agingDays) })}
                    {p.owedMinor > 0 && p.agingDays > 0 && p.progressMinor > 0 && ' · '}
                    {p.progressMinor > 0 && f.t('lg.ov.inProgressShort', '{amount} in progress', { amount: f.money(p.progressMinor, cur, true) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {ov.teamOwedMinor > 0 && (
          <button type="button" onClick={() => { ledger.setClientsView('team'); onNavigate('people'); }} className="mt-3 text-xs text-amber-700 dark:text-amber-300 hover:underline">
            {f.t('lg.ov.team', 'You owe your teammates {amount}', { amount: f.money(ov.teamOwedMinor, cur, true) })}
          </button>
        )}
        {ov.teamOnOwedMinor > 0 && ov.owedMinor > 0 && (
          <p className="mt-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
            {f.t('lg.ov.net', 'Net after your team: {amount}', { amount: f.money(Math.max(0, ov.owedMinor - ov.teamOnOwedMinor), cur, true) })}
          </p>
        )}
      </section>

      <section className="border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6">
        <SectionTitle aside={<button type="button" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => onNavigate('money')}>{f.t('lg.seeAll', 'See all')}</button>}>
          {f.t('lg.ov.recent', 'Recent money')}
        </SectionTitle>
        {ov.recentPayments.length === 0 ? (
          <p className="text-xs text-zinc-400 py-2">{f.t('lg.ov.noRecent', 'Payments you receive and expenses you add show up here.')}</p>
        ) : (
          <ul className="space-y-1.5">
            {ov.recentPayments.map((p) => {
              const isExpense = p.kind === 'expense';
              return (
                <li key={p.id} className="flex items-baseline gap-3 text-xs">
                  <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                    {isExpense ? (p.note || f.t('lg.ov.expense', 'Expense')) : f.t('lg.money.from', 'From {name}', { name: f.name(partyById.get(p.partyId) || { id: '' }) })}
                  </span>
                  <span className="text-zinc-400">{f.date(p.dateTime)}</span>
                  <span className={cn('tabular-nums w-24 text-end', isExpense ? 'text-zinc-700 dark:text-zinc-300' : 'text-emerald-700 dark:text-emerald-400')}>
                    {isExpense ? '−' : '+'}<Money minor={p.amountMinor} currency={p.currency} compact />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {attention.length > 0 && (
        <section className="border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6">
          <SectionTitle>{f.t('lg.cockpit.attention', 'Needs attention')}</SectionTitle>
          <ul className="space-y-1.5">
            {attention.map((a) => (
              <li key={`${a.type}-${a.key}`} className="flex items-center gap-3 text-xs">
                <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-amber-500" aria-hidden="true" />
                <span className="flex-1 text-zinc-700 dark:text-zinc-300">{f.t('lg.ov.attOverdue', '{name} has owed you for {days} days', { name: nameOf(a.key), days: f.formatNumber(a.days) })}</span>
                <button type="button" onClick={() => onReceive(a.key)} className="shrink-0 font-medium text-zinc-900 dark:text-zinc-100 hover:underline">{f.t('lg.ov.received', 'Payment received')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
