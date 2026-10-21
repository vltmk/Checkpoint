import React, { useMemo, useState } from 'react';
import { boosterReport, marginReport } from '../../lib/ledger/selectors';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { EmptyState, Money, Segmented } from './parts';

/**
 * Where the money comes from and goes. Tables with an inline bar, so size is readable without a chart library.
 * Columns that would be empty for the user's kind of work (platform fees, boosters, team) are left out.
 */
export function ReportsView() {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, data, partyById, rates, displayCurrency, profileId } = ledger;
  const cur = displayCurrency || 'TOMAN';
  const isBooster = profileId === 'booster';
  const [groupBy, setGroupBy] = useState('month');

  const report = useMemo(
    () => (ctx ? marginReport(ctx, partyById, { rates, displayCurrency: cur, groupBy: groupBy === 'booster' ? 'month' : groupBy, monthKey: f.monthKey }) : null),
    [ctx, partyById, rates, cur, groupBy, f.monthKey]
  );
  const people = useMemo(() => (ctx && !isBooster ? boosterReport(ctx, data.parties, { rates, displayCurrency: cur }) : []), [ctx, data, rates, cur, isBooster]);

  if (!ctx) return null;
  if (ctx.orders.length === 0) {
    return <EmptyState title={f.t('lg.reports.empty', 'Nothing to report yet')} body={f.t('lg.reports.emptyBody', 'Reports fill in as you add orders.')} />;
  }

  const label = (key) => {
    if (groupBy === 'month') return key ? f.monthLabel(key) : '—';
    if (!key) return groupBy === 'platform' ? f.t('lg.party.unknownPayer', 'Direct / unknown') : f.t('lg.reports.none', 'Not set');
    return key;
  };
  const t = report?.totals;
  const showVolume = !isBooster || (t && (t.feeMinor > 0 || t.boostersMinor > 0));
  const showFee = Boolean(t && t.feeMinor > 0);
  const showTeam = Boolean(t && t.boostersMinor > 0);
  const showExpenses = Boolean(t && t.expensesMinor > 0);
  const marginLabel = isBooster ? f.t('lg.ov.earned', 'Earned') : showExpenses ? f.t('lg.reports.margin2', 'Margin') : f.t('lg.wf.margin', 'You keep');
  const maxKeep = Math.max(1, ...(report?.rows || []).map((r) => Math.abs(r.keepMinor)));
  const maxEarned = Math.max(1, ...people.map((r) => r.earnedMinor));
  const th = 'text-xs font-normal text-zinc-500 pb-1.5';

  const groups = [
    { value: 'month', label: f.t('lg.reports.month', 'Month') },
    { value: 'platform', label: isBooster ? f.t('lg.reports.client', 'Client') : f.t('lg.reports.platform', 'Platform') },
    { value: 'game', label: f.t('lg.reports.game', 'Game') },
    ...(isBooster ? [] : [{ value: 'booster', label: f.t('lg.reports.booster', 'Booster') }]),
  ];

  return (
    <div className="space-y-8 pb-8">
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-xs font-medium text-zinc-500">{groupBy === 'booster' ? f.t('lg.reports.boosters', 'What each booster earned') : isBooster ? f.t('lg.reports.kept', 'What you earned') : f.t('lg.reports.margin', 'What you kept')}</h1>
          <Segmented ariaLabel={f.t('lg.reports.groupBy', 'Group by')} value={groupBy} onChange={setGroupBy} options={groups} />
        </div>

        {groupBy !== 'booster' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr>
                  <th className={th + ' text-start'}>{groups.find((g) => g.value === groupBy)?.label}</th>
                  <th className={th + ' text-end'}>{isBooster ? f.t('lg.reports.jobs', 'Jobs') : f.t('lg.reports.orders', 'Orders')}</th>
                  {showVolume && <th className={th + ' text-end'}>{f.t('lg.reports.volume', 'Volume')}</th>}
                  {showFee && <th className={th + ' text-end'}>{f.t('lg.reports.fee', 'Platform fee')}</th>}
                  {showTeam && <th className={th + ' text-end'}>{isBooster ? f.t('lg.jobs.team', 'team') : f.t('lg.wf.boosters', 'Boosters')}</th>}
                  <th className={th + ' text-end'}>{marginLabel}</th>
                  {showExpenses && <th className={th + ' text-end'}>{isBooster ? f.t('lg.reports.expenses', 'Expenses') : f.t('lg.reports.fees', 'Fees and expenses')}</th>}
                  {showExpenses && <th className={th + ' text-end'}>{isBooster ? f.t('lg.ov.kept', 'You keep') : f.t('lg.wf.margin', 'You keep')}</th>}
                  <th className={th + ' w-24'} aria-hidden="true" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                {report.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="py-2 text-zinc-900 dark:text-zinc-100">{label(r.key)}</td>
                    <td className="py-2 text-end text-zinc-500">{f.formatNumber(r.orders)}</td>
                    {showVolume && <td className="py-2 text-end"><Money minor={r.volumeMinor} currency={cur} compact /></td>}
                    {showFee && <td className="py-2 text-end text-zinc-500"><Money minor={r.feeMinor} currency={cur} compact /></td>}
                    {showTeam && <td className="py-2 text-end text-zinc-500"><Money minor={r.boostersMinor} currency={cur} compact /></td>}
                    <td className={'py-2 text-end ' + (showExpenses ? 'text-zinc-700 dark:text-zinc-300' : 'font-medium')}><Money minor={r.marginMinor} currency={cur} compact approx={report.isApproximate} /></td>
                    {showExpenses && <td className="py-2 text-end text-zinc-500">{r.expensesMinor ? <>−<Money minor={r.expensesMinor} currency={cur} compact /></> : '—'}</td>}
                    {showExpenses && <td className="py-2 text-end font-medium"><Money minor={r.keepMinor} currency={cur} compact /></td>}
                    <td className="py-2 ps-3"><div className="h-1.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, (r.keepMinor / maxKeep) * 100)}%` }} /></div></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-300 dark:border-zinc-700 font-medium">
                  <td className="py-2">{f.t('lg.reports.total', 'Total')}</td>
                  <td className="py-2 text-end">{f.formatNumber(t.orders)}</td>
                  {showVolume && <td className="py-2 text-end"><Money minor={t.volumeMinor} currency={cur} compact /></td>}
                  {showFee && <td className="py-2 text-end"><Money minor={t.feeMinor} currency={cur} compact /></td>}
                  {showTeam && <td className="py-2 text-end"><Money minor={t.boostersMinor} currency={cur} compact /></td>}
                  <td className="py-2 text-end"><Money minor={t.marginMinor} currency={cur} compact /></td>
                  {showExpenses && <td className="py-2 text-end">−<Money minor={t.expensesMinor} currency={cur} compact /></td>}
                  {showExpenses && <td className="py-2 text-end"><Money minor={t.keepMinor} currency={cur} compact /></td>}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr>
                  <th className={th + ' text-start'}>{f.t('lg.reports.booster', 'Booster')}</th>
                  <th className={th + ' text-end'}>{f.t('lg.reports.orders', 'Orders')}</th>
                  <th className={th + ' text-end'}>{f.t('lg.reports.earned', 'Earned')}</th>
                  <th className={th + ' text-end'}>{f.t('lg.legend.paid', 'Paid')}</th>
                  <th className={th + ' text-end'}>{f.t('lg.reports.owed', 'Still owed')}</th>
                  <th className={th + ' w-24'} aria-hidden="true" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                {people.map((r) => (
                  <tr key={r.party.id}>
                    <td className="py-2 text-zinc-900 dark:text-zinc-100">{f.name(r.party)}</td>
                    <td className="py-2 text-end text-zinc-500">{f.formatNumber(r.orders)}</td>
                    <td className="py-2 text-end font-medium"><Money minor={r.earnedMinor} currency={cur} compact approx={r.isApproximate} /></td>
                    <td className="py-2 text-end text-zinc-500"><Money minor={r.paidMinor} currency={cur} compact /></td>
                    <td className="py-2 text-end text-amber-700 dark:text-amber-400"><Money minor={r.owedMinor} currency={cur} compact /></td>
                    <td className="py-2 ps-3"><div className="h-1.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(r.earnedMinor / maxEarned) * 100}%` }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {report?.isApproximate && <p className="mt-2 text-[11px] text-zinc-400">{f.t('lg.approx', 'Amounts in mixed currencies are converted at your current rates.')}</p>}
      </div>
    </div>
  );
}
