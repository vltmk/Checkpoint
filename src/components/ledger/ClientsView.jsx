import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, Ban, Check, CircleCheck, ClipboardCopy, Clock, Download, ImageIcon, Plus, ReceiptText, Search, StickyNote, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { payerAging, payerList, payerOwedByCurrency, payerStatement, payerParty } from '../../lib/ledger/boosterSelectors';
import { STATEMENT_PERIODS, periodStart, statementPeriod } from '../../lib/ledger/statementPeriod';
import { buildClientStatementCsv, buildClientStatementText } from '../../lib/ledger/statementText';
import { fromMinor } from '../../lib/ledger/money';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { copyText, saveTextFile, withBom } from './files';
import { AgingStrip, BalanceRail, EmptyState, Initial, Meta, Money, Segmented, TOOLBAR_INPUT, SectionTitle, StatusTile, UndoLink, coversTitles } from './parts';
import { paymentsAppliedTo } from '../../lib/ledger/engine';
import { PeopleView } from './PeopleView';
import { openOnBlankClick } from './RowActions';
import { CloseShort } from './CloseShort';
import { PartyNote } from './PartyNote';

/** Who owes the booster, one client at a time. A "Team" view appears when jobs are split with teammates. */
export function ClientsView({ onReceive, onPay, onOpenJob, onReceipt, onOpenProofs, onNewJob }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, data, partyById, rates, displayCurrency, selectedClientKey, setSelectedClientKey } = ledger;
  const cur = displayCurrency || 'TOMAN';
  const [view, setView] = useState('clients');
  const [query, setQuery] = useState('');
  const [flash, setFlash] = useState('');
  const [confirmVoid, setConfirmVoid] = useState(null);
  const [error, setError] = useState('');
  const [proofCounts, setProofCounts] = useState({});
  const [period, setPeriod] = useState('all');

  const hasTeam = useMemo(() => Boolean(ctx && ctx.shares.some((s) => s.state !== 'cancelled' && partyById.get(s.partyId)?.kind === 'booster' && s.partyId !== 'party_unassigned')), [ctx, partyById]);
  const clients = useMemo(() => (ctx ? payerList(ctx, data.parties, { rates, displayCurrency: cur }) : []), [ctx, data, rates, cur]);
  const filtered = clients.filter((c) => !query.trim() || f.name(c.party).toLowerCase().includes(query.trim().toLowerCase()));

  const selected = selectedClientKey === null || selectedClientKey === undefined ? null : clients.find((c) => c.key === selectedClientKey) || null;
  const aging = useMemo(() => (ctx && selected ? payerAging(ctx, selected.key, { rates, displayCurrency: cur }) : null), [ctx, selected, rates, cur]);
  const statement = useMemo(
    () => (ctx && selected ? payerStatement(ctx, selected.key, { rates, displayCurrency: cur }) : null),
    [ctx, selected, rates, cur]
  );

  // what the client owes per currency, and the history for the chosen period (balances are never limited by it)
  const owedByCur = useMemo(() => (ctx && selected ? payerOwedByCurrency(ctx, selected.key) : {}), [ctx, selected]);
  const periodView = useMemo(() => (statement ? statementPeriod(statement.events, periodStart(period)) : null), [statement, period]);

  useEffect(() => { setConfirmVoid(null); setError(''); }, [selectedClientKey]);
  // open the client who owes the most, so the statement side is never an empty "pick one"
  const firstKey = filtered[0]?.key;
  useEffect(() => { if ((selectedClientKey === null || selectedClientKey === undefined) && firstKey !== undefined) setSelectedClientKey(firstKey); }, [selectedClientKey, firstKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let live = true;
    ledger.store()?.countProofsByOwner().then((c) => live && setProofCounts(c)).catch(() => {});
    return () => { live = false; };
  }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!flash) return undefined;
    const id = setTimeout(() => setFlash(''), 2200);
    return () => clearTimeout(id);
  }, [flash]);

  const guard = async (fn) => { setError(''); try { await fn(); } catch (e) { setError(e?.message || f.t('lg.err.generic', 'That could not be saved.')); } };

  if (!ctx) return null;

  const tabs = hasTeam && (
    <div className="mb-4">
      <Segmented ariaLabel={f.t('lg.clients.view', 'View')} value={view} onChange={setView}
        options={[{ value: 'clients', label: f.t('lg.clients.clients', 'Clients') }, { value: 'team', label: f.t('lg.clients.team', 'Team') }]} />
    </div>
  );
  if (view === 'team' && hasTeam) {
    return <div>{tabs}<PeopleView onPay={onPay} onOpenOrder={onOpenJob} onReceipt={onReceipt} onOpenProofs={onOpenProofs} onNewOrder={onNewJob} /></div>;
  }

  const copyStatement = async () => {
    const name = f.name(selected.party);
    await copyText(buildClientStatementText({ party: { name }, statement, displayCurrency: cur, language: f.language, formatMinor: (m, c) => f.money(m, c), formatDate: f.date }));
    setFlash(f.t('lg.copied', 'Copied'));
  };
  const exportCsv = async () => {
    const csv = buildClientStatementCsv({ statement, displayCurrency: cur, formatMajor: (m, c) => fromMinor(m, c) });
    await saveTextFile(`statement-${(f.name(selected.party) || 'client').replace(/[^\p{L}\p{N}]+/gu, '-')}.csv`, withBom(csv));
  };

  const list = (
    <div className={cn('min-w-0', selected && 'hidden min-[900px]:block')}>
      <div className="mb-3">
        <Input data-ledger-search className={TOOLBAR_INPUT} prefixIcon={<Search className="w-3.5 h-3.5" />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={f.t('lg.clients.search', 'Search clients')} aria-label={f.t('lg.clients.search', 'Search clients')} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={clients.length === 0 ? f.t('lg.clients.empty', 'No clients yet') : f.t('lg.people.none', 'No match')} body={clients.length === 0 ? f.t('lg.clients.emptyBody', 'When you add a job and say who pays, they show up here with what they owe you.') : undefined}>
          {clients.length === 0 && <Button variant="primary" onClick={onNewJob}><Plus className="w-3.5 h-3.5" />{f.t('lg.job.new', 'Add a job')}</Button>}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
          {filtered.map((c) => (
            <li key={c.key || 'none'} className={cn('rounded-md transition-colors', selected?.key === c.key ? 'bg-zinc-100 dark:bg-zinc-900' : 'hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50')}>
              <button type="button" onClick={() => setSelectedClientKey(c.key)} aria-current={selected?.key === c.key}
                className="w-full text-start py-2.5 px-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5">
                <span className="flex min-w-0 items-center gap-2"><Initial name={f.name(c.party)} className="h-5 w-5" /><span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{f.name(c.party)}</span></span>
                <span className={cn('text-sm tabular-nums font-medium', c.owedMinor > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400')}><Money minor={c.owedMinor} currency={cur} compact /></span>
                <BalanceRail incoming paid={c.collectedMinor} due={c.owedMinor} committed={c.progressMinor} label={f.name(c.party)} className="col-span-2" />
                {c.owedMinor > 0 && c.agingDays > 0 && <span className="col-span-2 text-[11px] text-zinc-400">{f.t('lg.waiting', 'waiting {n}d', { n: f.formatNumber(c.agingDays) })}</span>}
              </button>
              {selected?.key === c.key && c.party?.id && <PartyNote party={c.party} onSave={(patch) => guard(() => ledger.setPartySettings(c.party.id, patch))} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const detail = selected && statement && (
    <div className="min-w-0">
      <button type="button" onClick={() => setSelectedClientKey(null)} className="min-[900px]:hidden mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />{f.t('lg.back', 'Back')}
      </button>
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">{f.name(selected.party)}</h1>
      <div className="mt-3">
        <div className="text-xs text-zinc-500">{statement.balanceMinor < 0 ? f.t('lg.clients.ahead', 'They have paid ahead') : f.t('lg.clients.owes', 'They owe you')}</div>
        <div className={cn('text-3xl font-semibold tracking-tight tabular-nums', statement.owedMinor > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100')}>
          <Money minor={Math.abs(statement.balanceMinor < 0 ? statement.balanceMinor : statement.owedMinor)} currency={cur} approx={statement.isApproximate} />
        </div>
        {statement.progressMinor > 0 && <p className="mt-1 text-xs text-zinc-500">{f.t('lg.ov.progress', '{amount} more on jobs in progress', { amount: f.money(statement.progressMinor, cur, true) })}</p>}
        {statement.creditMinor > 0 && <p className="mt-1 text-xs text-zinc-500">{f.t('lg.credit.line', 'Credit with you: {amount}', { amount: f.money(statement.creditMinor, cur) })}</p>}
        <BalanceRail incoming className="mt-3" paid={selected.collectedMinor} due={selected.owedMinor} committed={selected.progressMinor} label={f.name(selected.party)} />
        {aging && <AgingStrip label={f.t('lg.age.label', 'How long it has waited')} buckets={aging.buckets} currency={cur} approx={aging.isApproximate} />}
        {Object.keys(owedByCur).length > 1 && (
          <div className="mt-3">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{f.t('lg.statement.byCurrency', 'Owed, by currency')}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-zinc-800 dark:text-zinc-200">
              {Object.entries(owedByCur).map(([c, n]) => <span key={c}><Money minor={n} currency={c} /></span>)}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => onReceive(selected.key)}>{f.t('lg.ov.received', 'Payment received')}</Button>
        <Button variant="ghost" onClick={copyStatement}>{flash ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}{flash || f.t('lg.clients.copy', 'Copy what they owe')}</Button>
        <Button variant="ghost" onClick={exportCsv}><Download className="w-3.5 h-3.5" />{f.t('lg.statement.csv', 'Download CSV')}</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>{f.t('lg.statement.history', 'History')}</SectionTitle>
          <Segmented
            ariaLabel={f.t('lg.statement.period', 'Period')}
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'all', label: f.t('lg.period.all', 'All time') },
              { value: '30', label: f.t('lg.period.d30', '30 days') },
              { value: '90', label: f.t('lg.period.d90', '90 days') },
              { value: 'year', label: f.t('lg.period.year', 'This year') },
            ].filter((o) => STATEMENT_PERIODS.includes(o.value))}
          />
        </div>
        {period !== 'all' && (
          <p className="mt-1 text-[11.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {f.t('lg.statement.opening', 'Opening {amount}', { amount: f.money(periodView.opening, cur) })} · {f.t('lg.statement.closing', 'Closing {amount}', { amount: f.money(periodView.closing, cur) })}
          </p>
        )}
        <ul className="mt-2 divide-y divide-zinc-200/60 dark:divide-zinc-800/60 rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/40 dark:bg-zinc-900/20">
          {[...periodView.shown].reverse().map((e) => {
            const isJob = e.type === 'job';
            const at = isJob ? e.order.dateTime : e.payment.dateTime;
            const paidOn = isJob && e.paidAt ? f.t('lg.statement.paidOn', 'paid {date}', { date: f.date(new Date(e.paidAt).toISOString()) }) : '';
            return (
              <li
                key={e.id}
                // a click on blank space opens the job's receipt (its Edit button leads to the editor)
                onClick={isJob && onReceipt ? openOnBlankClick(() => onReceipt(e.order.id)) : undefined}
                className={cn('group flex items-center gap-3 px-3 py-2.5 first:rounded-t-xl last:rounded-b-xl', isJob && onReceipt && 'cursor-pointer hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50', e.voided && 'opacity-50')}
              >
                {isJob
                  ? <StatusTile lifecycle={e.order.lifecycle} className="h-8 w-8" />
                  : <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><ArrowDownLeft className="h-4 w-4" strokeWidth={1.75} /></span>}
                <div className="min-w-0 flex-1">
                  {isJob ? (
                    <button type="button" onClick={() => onOpenJob(e.order.id)} className="block max-w-full text-start truncate text-sm text-zinc-900 dark:text-zinc-100 hover:underline">
                      {e.order.title || e.order.orderRef || '—'}
                    </button>
                  ) : (
                    <div className={cn('truncate text-sm text-zinc-900 dark:text-zinc-100', e.voided && 'line-through')}>
                      {e.voided ? f.t('lg.payment.voided', 'Payment (voided)') : e.payment.kind === 'writeoff' ? f.t('lg.writeoff.done', 'Closed short') : f.t('lg.clients.paymentIn', 'Payment received')}
                    </div>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <Meta icon={Clock} title={`${f.date(at)} ${f.time(at)}`}>{f.date(at)} · {f.time(at)}</Meta>
                    {!isJob && e.payment.note && <Meta icon={StickyNote} title={e.payment.note}>{e.payment.note}</Meta>}
                    {isJob && e.order.orderRef && <Meta title={e.order.orderRef}>#{e.order.orderRef}</Meta>}
                    {paidOn && <Meta title={paidOn}>{paidOn}</Meta>}
                    {!isJob && e.covers?.length > 0 && <Meta title={coversTitles(e.covers)}>{f.t('lg.statement.covers', 'Covers {list}', { list: coversTitles(e.covers) })}</Meta>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-end text-[11.5px]">
                  {isJob ? (
                    <>
                      <span className="tabular-nums text-sm font-medium text-zinc-900 dark:text-zinc-100"><Money minor={e.amountMinor} currency={e.currency} compact /></span>
                      <span className="flex items-center justify-end gap-2">
                        {onReceipt && <button type="button" onClick={() => onReceipt(e.order.id)} aria-label={f.t('lg.receipt', 'Receipt')} title={f.t('lg.receipt', 'Receipt')} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"><ReceiptText className="h-3.5 w-3.5" /></button>}
                        {e.appliedMinor >= e.amountMinor ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CircleCheck className="h-3.5 w-3.5" />{f.t('lg.jobs.paidStamp', 'Paid')}</span>
                            <UndoLink revealOnHover applied={paymentsAppliedTo(ctx, 'order', e.order.id)} onUndo={() => guard(() => ledger.undoPaid('order', e.order.id))} undoLabel={f.t('lg.undo', 'Undo')} sharedLabel={f.t('lg.undo.shared', 'Part of a bigger payment')} sharedHelp={f.t('lg.undo.sharedHelp', 'Paid together with other work. Void that payment in Money to undo it.')} />
                          </>
                        ) : e.done ? (
                          <>
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">{e.appliedMinor > 0 ? f.t('lg.share.partly', 'Partly paid') : f.t('lg.clients.unpaid', 'Unpaid')}</span>
                            <button type="button" onClick={() => guard(() => ledger.markOrderCollected(e.order.id))} className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 font-medium text-zinc-800 dark:text-zinc-200 transition-colors hover:bg-zinc-200/70 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500">
                              <CircleCheck className="h-3 w-3" />{f.t('lg.jobs.markPaid', 'Mark paid')}
                            </button>
                            <CloseShort amountMinor={e.amountMinor - e.appliedMinor} currency={e.currency} onConfirm={(note) => guard(() => ledger.writeOff(e.order.id, note))} />
                          </>
                        ) : <span className="text-zinc-500">{f.t('lg.share.progress', 'In progress')}</span>}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={cn('tabular-nums text-sm font-medium text-emerald-700 dark:text-emerald-400', e.voided && 'line-through')}>+<Money minor={e.amountMinor} currency={e.currency} compact /></span>
                      <span className="flex items-center justify-end gap-2">
                        <button type="button" aria-label={f.t('lg.proofs', 'Screenshots')} title={f.t('lg.proofs', 'Screenshots')} onClick={() => onOpenProofs('payment', e.payment.id, f.t('lg.payment', 'Payment'))} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"><ImageIcon className="h-3.5 w-3.5" />{proofCounts[`payment:${e.payment.id}`] || ''}</button>
                        {!e.voided && (confirmVoid === e.id
                          ? <button type="button" autoFocus onBlur={() => setConfirmVoid(null)} onClick={() => { setConfirmVoid(null); guard(() => ledger.voidPayment(e.payment.id)); }} className="h-6 rounded-md bg-rose-500/10 px-2 font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-500/20">{f.t('lg.void.confirm', 'Void it?')}</button>
                          : <button type="button" onClick={() => setConfirmVoid(e.id)} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-rose-600 dark:hover:text-rose-400"><Ban className="h-3 w-3" />{f.t('lg.void', 'Void')}</button>)}
                      </span>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  return (
    <div>
      {tabs}
      <div className="grid min-[900px]:grid-cols-[18rem_minmax(0,1fr)] gap-x-10 gap-y-6 pb-8">
        {list}
        {detail || (
          <div className="hidden min-[900px]:block pt-10">
            <EmptyState title={f.t('lg.clients.pick', 'Pick a client')} body={f.t('lg.clients.pickBody', 'You will see every job for them, what is paid, and what they still owe.')} />
          </div>
        )}
      </div>
    </div>
  );
}
