import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Ban, Check, CircleCheck, ClipboardCopy, Clock, Download, ImageIcon, Pencil, Plus, Search, StickyNote, Trash2, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { partyStatement, peopleList } from '../../lib/ledger/selectors';
import { buildStatementCsv, buildStatementText } from '../../lib/ledger/statementText';
import { fromMinor } from '../../lib/ledger/money';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { copyText, saveTextFile, withBom } from './files';
import { BalanceRail, EmptyState, Initial, Meta, Money, SectionTitle, StatusTile, TOOLBAR_INPUT, UndoLink } from './parts';
import { paymentsAppliedTo } from '../../lib/ledger/engine';

const shareState = (e) => {
  if (e.appliedMinor >= e.amountMinor) return 'paid';
  if (e.appliedMinor > 0) return 'partly';
  return e.earned ? 'due' : 'progress';
};

const STATE_STYLE = {
  paid: 'text-zinc-400',
  partly: 'text-amber-700 dark:text-amber-300',
  due: 'text-amber-700 dark:text-amber-300 font-medium',
  progress: 'text-zinc-500',
};

export function PeopleView({ onPay, onOpenOrder, onOpenProofs, onNewOrder }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, data, partyById, rates, displayCurrency, selectedPartyId, setSelectedPartyId } = ledger;
  const cur = displayCurrency || 'TOMAN';
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState('');
  const [confirmVoid, setConfirmVoid] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [proofCounts, setProofCounts] = useState({});
  const [error, setError] = useState('');

  const people = useMemo(
    () => (ctx ? peopleList(ctx, data.parties, { rates, displayCurrency: cur }) : []),
    [ctx, data, rates, cur]
  );
  // The catch-all person from migrated orders only shows while something is still unsettled on it
  const filtered = people
    .filter((p) => p.party.id !== 'party_unassigned' || p.display.netMinor !== 0 || p.party.id === selectedPartyId)
    .filter((p) => !query.trim() || f.name(p.party).toLowerCase().includes(query.trim().toLowerCase()));

  const selected = selectedPartyId ? partyById.get(selectedPartyId) : null;
  // open the person with the biggest balance, so the statement side is never an empty "pick one"
  const firstId = filtered[0]?.party.id;
  useEffect(() => { if (!selectedPartyId && firstId) setSelectedPartyId(firstId); }, [selectedPartyId, firstId]); // eslint-disable-line react-hooks/exhaustive-deps
  const statement = useMemo(
    () => (ctx && selected ? partyStatement(ctx, selected.id, { rates, displayCurrency: cur }) : null),
    [ctx, selected, rates, cur]
  );

  // Switching to another person must not carry a half-open rename or a pending void with it
  useEffect(() => {
    setRenaming(false);
    setConfirmRemove(false);
    setConfirmVoid(null);
    setError('');
  }, [selectedPartyId]);

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

  const guard = async (fn) => {
    setError('');
    try { await fn(); } catch (e) { setError(e?.message || f.t('lg.err.generic', 'That could not be saved.')); }
  };

  const addPerson = () => guard(async () => {
    const name = newName.trim();
    if (!name) return;
    let p = await ledger.addPerson('booster', name);
    // a removed (archived) booster with the same name comes back instead of staying hidden
    if (p.archived) p = await ledger.archivePerson(p, false) || { ...p, archived: 0 };
    setNewName('');
    setAdding(false);
    setSelectedPartyId(p.id);
  });

  const removePerson = () => guard(async () => {
    setConfirmRemove(false);
    // archiving never hides money still owed or held, so refuse rather than leave a "removed" booster on the list
    if (statement.display.netMinor !== 0) throw new Error(f.t('lg.person.removeBlocked', 'Settle up first. This booster still has a balance.'));
    await ledger.archivePerson(selected, true);
    setSelectedPartyId(null);
  });

  const copyStatement = async () => {
    const text = buildStatementText({
      party: { ...selected, name: f.name(selected) }, statement, displayCurrency: cur, language: f.language,
      formatMinor: (m, c) => f.money(m, c), formatDate: f.date,
    });
    await copyText(text);
    setFlash(f.t('lg.copied', 'Copied'));
  };

  const exportCsv = async () => {
    const csv = buildStatementCsv({ statement, displayCurrency: cur, formatMajor: (m, c) => fromMinor(m, c) });
    await saveTextFile(`statement-${selected.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.csv`, withBom(csv));
  };

  if (!ctx) return null;

  const list = (
    <div className={cn('min-w-0', selected && 'hidden min-[900px]:block')}>
      <div className="flex items-center gap-2 mb-3">
        <Input
          data-ledger-search
          className={TOOLBAR_INPUT}
          prefixIcon={<Search className="w-3.5 h-3.5" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={f.t('lg.people.search', 'Search boosters')}
          aria-label={f.t('lg.people.search', 'Search boosters')}
        />
        <Button variant="outline" size="icon" className="rounded-lg" aria-label={f.t('lg.people.add', 'Add booster')} onClick={() => setAdding((v) => !v)}><Plus className="w-3.5 h-3.5" /></Button>
      </div>
      {adding && (
        <form onSubmit={(e) => { e.preventDefault(); addPerson(); }} className="flex gap-2 mb-3">
          <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={f.t('lg.people.name', 'Booster name')} aria-label={f.t('lg.people.name', 'Booster name')} />
          <Button variant="primary" type="submit" disabled={!newName.trim()}>{f.t('lg.add', 'Add')}</Button>
        </form>
      )}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={people.length === 0 ? f.t('lg.people.empty', 'No boosters yet') : f.t('lg.people.none', 'No match')}
          body={people.length === 0 ? f.t('lg.people.emptyBody', 'Add a booster, or add an order and pick who did the work.') : undefined}
        >
          {people.length === 0 && <Button variant="primary" onClick={onNewOrder}>{f.t('lg.newOrder', 'New order')}</Button>}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {filtered.map(({ party, display, agingDays }) => (
            <li key={party.id}>
              <button
                type="button"
                onClick={() => setSelectedPartyId(party.id)}
                aria-current={selectedPartyId === party.id}
                className={cn('w-full text-start py-3 px-3 rounded-lg border border-zinc-200/70 dark:border-zinc-800/70 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 transition-colors', selectedPartyId === party.id ? 'bg-zinc-100 dark:bg-zinc-900' : 'hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50')}
              >
                <span className="flex min-w-0 items-center gap-2"><Initial name={f.name(party)} className="h-5 w-5" /><span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{f.name(party)}</span></span>
                <span className={cn('text-sm tabular-nums font-medium', display.netMinor > 0 ? 'text-amber-700 dark:text-amber-400' : display.netMinor < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400')}>
                  <Money minor={Math.abs(display.netMinor)} currency={cur} compact />
                </span>
                <BalanceRail paid={display.paidMinor} due={display.payableMinor} committed={display.committedMinor} label={f.name(party)} className="col-span-2" />
                {display.payableMinor > 0 && agingDays > 0 && <span className="col-span-2 text-[11px] text-zinc-400">{f.t('lg.waiting', 'waiting {n}d', { n: f.formatNumber(agingDays) })}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const detail = selected && statement && (
    <div className="min-w-0">
      <button type="button" onClick={() => setSelectedPartyId(null)} className="min-[900px]:hidden mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />{f.t('lg.back', 'Back')}
      </button>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {renaming ? (
            <form onSubmit={(e) => { e.preventDefault(); guard(async () => { await ledger.renamePerson(selected, renameText.trim() || selected.name); setRenaming(false); }); }} className="flex gap-2">
              <Input autoFocus value={renameText} onChange={(e) => setRenameText(e.target.value)} aria-label={f.t('lg.people.name', 'Booster name')} />
              <Button variant="primary" type="submit">{f.t('common.save', 'Save')}</Button>
            </form>
          ) : (
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span className="truncate">{f.name(selected)}</span>
              <button type="button" aria-label={f.t('lg.rename', 'Rename')} onClick={() => { setRenameText(selected.name); setRenaming(true); }} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><Pencil className="w-3.5 h-3.5" /></button>
              {confirmRemove ? (
                <button type="button" autoFocus onBlur={() => setConfirmRemove(false)} onClick={removePerson} className="h-6 rounded-md bg-rose-500/10 px-2 text-[11px] font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-500/20">{f.t('lg.person.removeConfirm', 'Remove?')}</button>
              ) : (
                <button type="button" aria-label={f.t('lg.person.remove', 'Remove booster')} title={f.t('lg.person.remove', 'Remove booster')} onClick={() => setConfirmRemove(true)} className="text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </h1>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs text-zinc-500">
          {statement.display.netMinor < 0 ? f.t('lg.statement.credit', 'They hold your advance') : f.t('lg.statement.owe', 'You owe')}
        </div>
        <div className={cn('text-3xl font-semibold tracking-tight tabular-nums', statement.display.netMinor > 0 ? 'text-amber-700 dark:text-amber-400' : statement.display.netMinor < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100')}>
          <Money minor={Math.abs(statement.display.netMinor)} currency={cur} approx={statement.isApproximate} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {f.t('lg.statement.split', '{due} due now · {progress} on work in progress', { due: f.money(statement.display.payableMinor, cur, true), progress: f.money(statement.display.committedMinor, cur, true) })}
          {statement.display.advanceMinor > 0 && ' · ' + f.t('lg.cockpit.advanced', '{amount} already advanced', { amount: f.money(statement.display.advanceMinor, cur, true) })}
        </p>
        <BalanceRail className="mt-3" paid={statement.display.paidMinor} due={statement.display.payableMinor} committed={statement.display.committedMinor} label={f.name(selected)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => onPay(selected.id)}>{f.t('lg.pay.title', 'Settle up')}</Button>
        <Button variant="outline" onClick={() => onPay(selected.id, { advance: true })}>{f.t('lg.advance', 'Add advance')}</Button>
        <Button variant="ghost" onClick={copyStatement}>{flash ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}{flash || f.t('lg.statement.copy', 'Copy statement')}</Button>
        <Button variant="ghost" onClick={exportCsv}><Download className="w-3.5 h-3.5" />{f.t('lg.statement.csv', 'Download CSV')}</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="mt-6">
        <SectionTitle>{f.t('lg.statement.history', 'History')}</SectionTitle>
        {statement.events.length === 0 ? (
          <p className="text-xs text-zinc-400 py-3">{f.t('lg.statement.empty', 'No work or payments yet. Add this booster to an order to start their balance.')}</p>
        ) : (
          <ul className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/40 dark:bg-zinc-900/20">
            {[...statement.events].reverse().map((e) => {
              const isShare = e.type === 'share';
              const at = isShare ? e.order.dateTime : e.payment.dateTime;
              return (
                <li key={e.id} className={cn('flex items-center gap-3 px-3 py-2.5 first:rounded-t-xl last:rounded-b-xl', e.voided && 'opacity-50')}>
                  {isShare
                    ? <StatusTile lifecycle={e.order.lifecycle} className="h-8 w-8" />
                    : <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><ArrowUpRight className="h-4 w-4" strokeWidth={1.75} /></span>}
                  <div className="min-w-0 flex-1">
                    {isShare ? (
                      <button type="button" onClick={() => onOpenOrder(e.order.id)} className="block max-w-full text-start truncate text-sm text-zinc-900 dark:text-zinc-100 hover:underline">
                        {e.order.title || e.order.orderRef || '—'}
                      </button>
                    ) : (
                      <div className={cn('truncate text-sm text-zinc-900 dark:text-zinc-100', e.voided && 'line-through')}>
                        {e.voided ? f.t('lg.payment.voided', 'Payment (voided)') : e.payment.kind === 'advance' ? f.t('lg.payment.advance', 'Advance') : f.t('lg.payment', 'Payment')}
                      </div>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <Meta icon={Clock} title={`${f.date(at)} ${f.time(at)}`}>{f.date(at)} · {f.time(at)}</Meta>
                      {!isShare && e.payment.note && <Meta icon={StickyNote} title={e.payment.note}>{e.payment.note}</Meta>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-end text-[11.5px]">
                    {isShare ? (
                      <>
                        <span className="tabular-nums text-sm font-medium text-zinc-900 dark:text-zinc-100"><Money minor={e.amountMinor} currency={e.currency} compact /></span>
                        <span className="flex items-center justify-end gap-2">
                          <span className={STATE_STYLE[shareState(e)]}>
                            {f.t(`lg.share.${shareState(e)}`, { paid: 'Paid', partly: 'Partly paid', due: 'Due', progress: 'In progress' }[shareState(e)])}
                            {shareState(e) === 'partly' && <> · <Money minor={e.amountMinor - e.appliedMinor} currency={e.currency} compact /> {f.t('lg.left', 'left')}</>}
                          </span>
                          {e.appliedMinor > 0 && <UndoLink applied={paymentsAppliedTo(ctx, 'share', e.share.id)} onUndo={() => guard(() => ledger.undoPaid('share', e.share.id))} undoLabel={f.t('lg.undo', 'Undo')} sharedLabel={f.t('lg.undo.shared', 'Part of a bigger payment')} sharedHelp={f.t('lg.undo.sharedHelp', 'Paid together with other work. Void that payment in Money to undo it.')} />}
                          {shareState(e) !== 'paid' && (
                            <button type="button" onClick={() => guard(() => ledger.markSharePaid(e.share.id))} className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 font-medium text-zinc-800 dark:text-zinc-200 transition-colors hover:bg-zinc-200/70 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500">
                              <CircleCheck className="h-3 w-3" />{f.t('lg.markPaid', 'Mark paid')}
                            </button>
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={cn('tabular-nums text-sm font-medium text-emerald-700 dark:text-emerald-400', e.voided && 'line-through')}>−<Money minor={e.amountMinor} currency={e.currency} compact /></span>
                        <span className="flex items-center justify-end gap-2">
                          <button type="button" aria-label={f.t('lg.proofs', 'Screenshots')} title={f.t('lg.proofs', 'Screenshots')} onClick={() => onOpenProofs('payment', e.payment.id, f.t('lg.payment', 'Payment'))} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">
                            <ImageIcon className="h-3.5 w-3.5" />{proofCounts[`payment:${e.payment.id}`] || ''}
                          </button>
                          {!e.voided && (confirmVoid === e.id ? (
                            <button type="button" autoFocus onBlur={() => setConfirmVoid(null)} onClick={() => { setConfirmVoid(null); guard(() => ledger.voidPayment(e.payment.id)); }} className="h-6 rounded-md bg-rose-500/10 px-2 font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-500/20">{f.t('lg.void.confirm', 'Void it?')}</button>
                          ) : (
                            <button type="button" onClick={() => setConfirmVoid(e.id)} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-rose-600 dark:hover:text-rose-400"><Ban className="h-3 w-3" />{f.t('lg.void', 'Void')}</button>
                          ))}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid min-[900px]:grid-cols-[18rem_minmax(0,1fr)] gap-x-10 gap-y-6 pb-8">
      {list}
      {detail || (
        <div className="hidden min-[900px]:block pt-10">
          <EmptyState title={f.t('lg.people.pick', 'Pick a booster')} body={f.t('lg.people.pickBody', 'You will see everything you owe them, work by work, and every payment you made.')} />
        </div>
      )}
    </div>
  );
}
