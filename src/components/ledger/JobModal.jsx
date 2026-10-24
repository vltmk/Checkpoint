import { incrementLocalWorkCount } from '../../lib/telemetry';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { DateTimePicker, toLocalISOString } from '../ui/DateTimePicker';
import { CURRENCIES } from '../../lib/currencies';
import { categorySupportsGold } from '../../lib/categories';
import { CategoryModal } from '../ui/CategoryModal';
import { parseAmountShorthand, toMinor, fromMinor, normalizeCurrency } from '../../lib/ledger/money';
import { LIFECYCLES } from '../../lib/ledger/ledgerStore';
import { UNKNOWN_PAYER_ID, slug } from '../../lib/ledger/legacyMapper';
import { isPlatformName, suggestedFeePct } from '../../lib/ledger/platforms';
import { payerKey } from '../../lib/ledger/engine';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { RateLockFields } from './RateLockFields';
import { ProofField, useProofDraft } from './ProofField';
import { GameField } from './GameField';
import { rateFormFor, rateFieldsFromForm } from '../../lib/ledger/rateLock';
import { LifeDot, Money, Segmented } from './parts';

const LIFE_LABELS = { pending: 'Pending', working: 'Working', on_hold: 'On hold', done: 'Done', failed: 'Failed', disputed: 'Disputed', refunded: 'Refunded' };
const blankRow = () => ({ key: Math.random().toString(36).slice(2), name: '', amountText: '', partyId: null });
const toInputText = (minor, currency) => (minor ? String(fromMinor(minor, currency)) : '');

/**
 * Add or edit a job. The common case is three fields: what, who pays, how much. Everything else is opt-in:
 * "already paid", splitting with teammates, a platform fee, notes.
 */
export function JobModal({ open, onClose, existing = null, categories = [], onRefreshCategories }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, partyById, displayCurrency } = ledger;

  const [title, setTitle] = useState('');
  const [payerName, setPayerName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState('TOMAN');
  const [paid, setPaid] = useState(false);
  const [done, setDone] = useState(true);
  const [lifecycle, setLifecycle] = useState('done');
  const [dateTime, setDateTime] = useState(() => toLocalISOString());
  const [orderRef, setOrderRef] = useState('');
  const [game, setGame] = useState('');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [feePct, setFeePct] = useState('0');
  const [rateForm, setRateForm] = useState(() => rateFormFor(null, {}));
  const [teamOn, setTeamOn] = useState(false);
  const [rows, setRows] = useState([blankRow()]);
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const loadedRef = useRef({ payer: null, payerId: null });
  // set once the job is saved but a screenshot failed, so the next Save only retries the screenshots
  const proofOnlyRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const proofs = useProofDraft({ open, ownerId: existing?.order?.id || null, onAdded: () => setMoreOpen(true) });

  const clients = useMemo(() => {
    if (!ctx) return [];
    const seen = new Map();
    for (const o of [...ctx.orders].sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime))) {
      const k = payerKey(o);
      if (k && !seen.has(k)) seen.set(k, partyById.get(k));
    }
    return [...seen.values()].filter(Boolean).slice(0, 6);
  }, [ctx, partyById]);

  const partyByName = (name) => {
    const k = slug(name);
    return k ? [...partyById.values()].find((p) => p.kind !== 'booster' && slug(p.name) === k && !p.id.startsWith('demo_')) : null;
  };
  const teammateNames = useMemo(
    () => [...new Set([...partyById.values()].filter((p) => p.kind === 'booster' && !p.archived && p.id !== 'party_unassigned' && !p.id.startsWith('demo_')).map((p) => p.name))],
    [partyById]
  );

  useEffect(() => {
    if (!open) return;
    setError('');
    setBusy(false);
    setMoreOpen(false);
    proofOnlyRef.current = null;
    if (existing) {
      const { order, shares } = existing;
      const shown = order.payerId === UNKNOWN_PAYER_ID ? '' : order.payerId ? f.name(partyById.get(order.payerId)) : order.source || '';
      loadedRef.current = { payer: shown, payerId: order.payerId || null };
      setTitle(order.title || '');
      setPayerName(shown);
      setCurrency(normalizeCurrency(order.currency));
      setAmountText(toInputText(order.grossMinor, order.currency));
      setLifecycle(order.lifecycle);
      setDone(order.lifecycle === 'done');
      setDateTime(order.dateTime ? toLocalISOString(new Date(order.dateTime)) : toLocalISOString());
      setOrderRef(order.orderRef || '');
      setGame(order.game || '');
      setNote(order.note || '');
      setLink(order.link || '');
      setFeePct(String(order.grossMinor > 0 ? Math.round(((order.platformFeeMinor || 0) / order.grossMinor) * 10000) / 100 : 0));
      setTeamOn(shares.length > 0);
      setRows(shares.length ? shares.map((s) => { const nm = f.name(partyById.get(s.partyId)); return { key: s.id, name: nm, origName: nm, amountText: toInputText(s.amountMinor, order.currency), partyId: s.partyId }; }) : [blankRow()]);
      setPaid(false);
      setRateForm(rateFormFor(order, ledger.rates));
    } else {
      loadedRef.current = { payer: null, payerId: null };
      const latest = ctx ? [...ctx.orders].sort((a, b) => Date.parse(b.updatedAt || b.dateTime) - Date.parse(a.updatedAt || a.dateTime))[0] : null;
      setTitle('');
      setPayerName('');
      setCurrency(normalizeCurrency(latest?.currency || displayCurrency || 'TOMAN'));
      setAmountText('');
      setPaid(false);
      setDone(true);
      setLifecycle('done');
      setDateTime(toLocalISOString());
      setOrderRef('');
      setGame(latest?.game || categories[0]?.name || '');
      setNote('');
      setLink('');
      setFeePct('0');
      setTeamOn(false);
      setRows([blankRow()]);
      setRateForm(rateFormFor(null, ledger.rates));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const major = parseAmountShorthand(amountText);
  const grossMinor = major === null ? 0 : toMinor(major, currency);
  const payerIsPlatform = isPlatformName(payerName) || partyByName(payerName)?.kind === 'platform';
  const feePctNum = payerIsPlatform ? Math.min(100, Math.max(0, Number(feePct) || 0)) : 0;
  const feeMinor = Math.round((grossMinor * feePctNum) / 100);
  const receivable = Math.max(0, grossMinor - feeMinor);
  // Gold is offered only for games whose category supports it; a job already in gold keeps the choice
  const goldOk = categorySupportsGold(game, categories);
  const currencyChoices = Object.keys(CURRENCIES).filter((c) => c !== 'GOLD' || goldOk || currency === 'GOLD');
  const pickGame = (name, list = categories) => {
    setGame(name);
    if (currency === 'GOLD' && !categorySupportsGold(name, list)) setCurrency('TOMAN');
  };
  const amountOf = (r) => { const v = parseAmountShorthand(r.amountText); return v === null ? 0 : toMinor(v, currency); };
  const named = teamOn ? rows.filter((r) => r.name.trim()) : [];
  const teamTotal = named.reduce((s, r) => s + amountOf(r), 0);
  const mine = receivable - teamTotal;
  const overpaid = mine < 0;

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const splitEqually = () => {
    const people = named.length + 1;
    if (people < 2) return;
    const base = Math.floor(receivable / people);
    setRows((rs) => rs.map((r) => (r.name.trim() ? { ...r, amountText: toInputText(base, currency) } : r)));
  };

  const dupes = (() => { const seen = new Set(); for (const r of named) { const k = slug(r.name); if (seen.has(k)) return true; seen.add(k); } return false; })();
  const problems = [];
  if (!title.trim() && !orderRef.trim()) problems.push(f.t('lg.err.title', 'Give the order a title or an order number.'));
  if (grossMinor <= 0) problems.push(f.t('lg.job.errAmount', 'Enter how much the job pays.'));
  if (dupes) problems.push(f.t('lg.err.dupe', 'A booster can only be on an order once.'));
  if (teamOn && rows.some((r) => !r.name.trim() && amountOf(r) > 0)) problems.push(f.t('lg.err.noName', 'A share has an amount but no booster.'));

  const save = async () => {
    if (savingRef.current) return;
    if (problems.length) { setError(problems[0]); return; }
    savingRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (proofOnlyRef.current) {
        await proofs.commit(proofOnlyRef.current);
        onClose();
        return;
      }
      const payerKind = payerIsPlatform ? 'platform' : 'client';
      const unchanged = existing && payerName.trim() === loadedRef.current.payer;
      const payerId = unchanged ? loadedRef.current.payerId : payerName.trim() ? (await ledger.addPerson(payerKind, payerName.trim())).id : null;
      const shares = [];
      if (teamOn) {
        for (const r of rows) {
          if (!r.name.trim()) continue;
          const keep = r.partyId && r.name.trim() === r.origName;
          shares.push({ partyId: keep ? r.partyId : (await ledger.addPerson('booster', r.name.trim())).id, amountMinor: amountOf(r) });
        }
      }
      const base = existing?.order || {};
      const status = existing ? lifecycle : done ? 'done' : 'working';
      const id = base.id || `ord_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      await ledger.saveOrder({
        order: {
          ...base, id, kind: 'income', title: title.replace(/\s*\n\s*/g, ' ').trim(), game: game.trim(), source: payerName.trim(), orderRef: orderRef.trim(),
          payerId, dateTime: new Date(dateTime).toISOString(), lifecycle: status, currency, grossMinor, platformFeeMinor: feeMinor,
          // the day's exchange rates stay with the job, so a later rate change never moves what it earned
          ...rateFieldsFromForm(rateForm, { base, currentRates: ledger.rates }),
          note: note.trim(), link: link.trim(), expectedPayoutAt: base.expectedPayoutAt || null,
        },
        shares,
      });
      if (!existing) incrementLocalWorkCount();
      if (!existing && paid && receivable > 0) await ledger.markOrderCollected(id);
      if (payerId && payerKind === 'platform' && Math.abs(feePctNum - suggestedFeePct(payerName, partyByName(payerName))) > 0.0001) {
        await ledger.setPartySettings(payerId, { feePct: feePctNum });
      }
      try {
        await proofs.commit(id);
      } catch {
        proofOnlyRef.current = id;
        setError(f.t('lg.err.proofsFailed', 'Saved, but a screenshot could not be attached. Press Save to try again.'));
        return;
      }
      onClose();
    } catch (e) {
      setError(e?.message || f.t('lg.err.generic', 'That could not be saved.'));
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  const label = 'text-xs text-zinc-500';
  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col max-h-[92vh]" onPaste={proofs.onPaste} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(); }}>
        <DialogHeader onClose={onClose}>
          <DialogTitle>{existing ? f.t('lg.job.edit', 'Edit job') : f.t('lg.job.new', 'Add a job')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <label className="block">
            <span className={label}>{f.t('lg.job.what', 'What did you do?')}</span>
            <textarea
              autoFocus
              rows={3}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
              placeholder={f.t('lg.job.whatHint', 'e.g. Heroic raid carry')}
              dir="auto"
              className="mt-1 w-full min-h-[5.5rem] resize-y rounded-lg bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 px-3 py-2 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none focus:border-zinc-300 dark:focus:border-zinc-700 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all duration-100"
            />
          </label>

          <GameField label={f.t('lg.order.game', 'Game')} value={game} onChange={pickGame} categories={categories} onAdd={() => setCategoryOpen(true)} />

          <div>
            <span className={label}>{f.t('lg.job.payer', 'Who pays you?')}</span>
            <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder={f.t('lg.job.payerHint', 'A guild, advertiser or client (optional)')} aria-label={f.t('lg.job.payer', 'Who pays you?')} className="mt-1" />
            {clients.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {clients.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setPayerName(p.name); if (!existing) setFeePct(String(suggestedFeePct(p.name, p))); }}
                    className={cn('h-6 px-2 rounded-md text-[11px] transition-colors', slug(payerName) === slug(p.name) ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800')}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <label className="block">
              <span className={label}>{teamOn ? f.t('lg.job.total', 'Total for the job') : f.t('lg.job.earn', 'You earn')}</span>
              <Input dir="ltr" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder={f.t('lg.amount.hint', 'e.g. 3m, 250k, 1,200,000')} hasError={amountText.trim() !== '' && major === null} className="mt-1 text-base tabular-nums" />
            </label>
            <Select value={currency} onChange={setCurrency} options={currencyChoices.map((c) => ({ value: c, label: c }))} ariaLabel={f.t('lg.currency', 'Currency')} className="w-24" />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {!existing && (
              <label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
                {f.t('lg.job.paid', 'Already paid')}
              </label>
            )}
            {!existing ? (
              <Segmented ariaLabel={f.t('lg.order.status', 'Status')} value={done ? 'done' : 'working'} onChange={(v) => setDone(v === 'done')}
                options={[{ value: 'done', label: f.t('lg.job.finished', 'Finished') }, { value: 'working', label: f.t('lg.job.inProgress', 'In progress') }]} />
            ) : (
              <Select value={lifecycle} onChange={setLifecycle} ariaLabel={f.t('lg.order.status', 'Status')} className="w-36"
                options={LIFECYCLES.map((l) => ({ value: l, label: f.t(`lg.life.${l}`, LIFE_LABELS[l]), icon: <LifeDot lifecycle={l} /> }))} />
            )}
          </div>

          <div>
            <span className={label}>{f.t('lg.date', 'Date')}</span>
            <DateTimePicker value={dateTime} onChange={setDateTime} className="mt-1" />
          </div>

          {/* Splitting with teammates is opt-in, so a solo job stays three fields */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={teamOn} onChange={(e) => setTeamOn(e.target.checked)} />
              {f.t('lg.job.team', 'I split this job with teammates')}
            </label>
            {teamOn && (
              <div className="mt-2 space-y-1.5">
                {rows.map((r) => (
                  <div key={r.key} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-center">
                    <Input list="lg-teammates" value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} placeholder={f.t('lg.job.teammate', 'Teammate')} aria-label={f.t('lg.job.teammate', 'Teammate')} />
                    <Input dir="ltr" inputMode="decimal" value={r.amountText} onChange={(e) => setRow(r.key, { amountText: e.target.value })} placeholder="0" aria-label={f.t('lg.order.share', 'Their share')} className="tabular-nums" />
                    <button type="button" aria-label={f.t('lg.remove', 'Remove')} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blankRow()]))} className="text-zinc-400 hover:text-rose-600 p-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <datalist id="lg-teammates">{teammateNames.map((n) => <option key={n} value={n} />)}</datalist>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setRows((rs) => [...rs, blankRow()])} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"><Plus className="w-3 h-3" />{f.t('lg.job.addTeammate', 'Add a teammate')}</button>
                  {named.length > 0 && <button type="button" onClick={splitEqually} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">{f.t('lg.job.splitEqually', 'Split equally with me')}</button>}
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs flex items-baseline justify-between" aria-live="polite">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{overpaid ? f.t('lg.wf.loss', 'You would lose') : f.t('lg.job.keep', 'You keep')}</span>
                  <span className={cn('tabular-nums text-base font-semibold', overpaid ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400')}><Money minor={Math.abs(mine)} currency={currency} /></span>
                </div>
                {overpaid && <p className="text-xs text-rose-600 dark:text-rose-400">{f.t('lg.wf.overpaid', 'The shares add up to more than the order pays after fees.')}</p>}
              </div>
            )}
          </div>

          <details open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
            <summary className="text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-800 dark:hover:text-zinc-200">{f.t('lg.order.more', 'More details')}</summary>
            <div className="mt-2 space-y-2">
              <Input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder={f.t('lg.order.ref', 'Order number')} aria-label={f.t('lg.order.ref', 'Order number')} />
              {payerIsPlatform && (
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  {f.t('lg.order.fee', 'Platform fee %')}
                  <Input dir="ltr" inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value)} className="w-24 tabular-nums" />
                </label>
              )}
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder={f.t('lg.order.link', 'Link to the order')} aria-label={f.t('lg.order.link', 'Link to the order')} dir="ltr" />
              <RateLockFields value={rateForm} onChange={setRateForm} goldUnit={existing?.order?.rateUnit} />
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={f.t('lg.note.order', 'Notes')} aria-label={f.t('lg.note.order', 'Notes')} />
              <div>
                <span className={label}>{f.t('lg.proofs', 'Screenshots')}</span>
                <div className="mt-1"><ProofField draft={proofs} /></div>
              </div>
            </div>
          </details>

          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{f.t('common.cancel', 'Cancel')}</Button>
          <Button variant="primary" disabled={busy} onClick={save}>{existing ? f.t('common.save', 'Save') : f.t('lg.job.cta', 'Add job')}</Button>
        </DialogFooter>
      </div>
    </Dialog>
    {/* beside the dialog, not inside it, so its keys and focus stay its own */}
    <CategoryModal
      isOpen={categoryOpen}
      onClose={() => setCategoryOpen(false)}
      onSave={async (cat, list) => { await onRefreshCategories?.(); pickGame(cat.name, list || [cat, ...categories]); }}
    />
    </>
  );
}
