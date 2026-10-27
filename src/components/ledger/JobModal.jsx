import { incrementLocalWorkCount } from '../../lib/telemetry';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { DateTimePicker, toLocalISOString } from '../ui/DateTimePicker';
import { CURRENCIES } from '../../lib/currencies';
import { categorySupportsGold, categoryGoldUnit } from '../../lib/categories';
import { CategoryModal } from '../ui/CategoryModal';
import { parseAmountShorthand, toMinor, fromMinor, normalizeCurrency } from '../../lib/ledger/money';
import { LIFECYCLES } from '../../lib/ledger/ledgerStore';
import { UNKNOWN_PAYER_ID, slug } from '../../lib/ledger/legacyMapper';
import { isPlatformName, suggestedFeePct } from '../../lib/ledger/platforms';

import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { GoldRateField, RateLockFields } from './RateLockFields';
import { ProofField, useProofDraft } from './ProofField';
import { GameField } from './GameField';
import { goldRateStart, rateFormFor, rateFieldsFromForm } from '../../lib/ledger/rateLock';
import { LifeDot, Money, Segmented } from './parts';
import { PartyCombobox, usePartyChoices } from './PartyCombobox';
import { AmountInput } from './AmountInput';
import { useFormDraft } from './useFormDraft';
import { Chip, Disclosure, Field, FormFooter, FormPanes, FormSection, SummaryCard, SummaryDivider, SummaryRow } from './FormLayout';

const LIFE_LABELS = { pending: 'Pending', working: 'Working', on_hold: 'On hold', done: 'Done', failed: 'Failed', disputed: 'Disputed', refunded: 'Refunded' };
// a new teammate is paid by the client by default: that is how most split jobs work for a booster
const blankRow = () => ({ key: Math.random().toString(36).slice(2), name: '', amountText: '', partyId: null, paidBy: 'payer', saveNew: false });
const PAYER_KINDS = ['client', 'platform'];
const TEAM_KINDS = ['booster'];
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
  const [payTeamToo, setPayTeamToo] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const draftRestoredRef = useRef(false);
  const loadedRef = useRef({ payer: null, payerId: null });
  // set once the job is saved but a screenshot failed, so the next Save only retries the screenshots
  const proofOnlyRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const proofs = useProofDraft({ open, ownerId: existing?.order?.id || null });

  // everyone who has paid me before, and the teammates I have split with: saved ones first, then the most recent
  const payerChoices = usePartyChoices(ctx, partyById, PAYER_KINDS, f);
  const teammateChoices = usePartyChoices(ctx, partyById, TEAM_KINDS, f);
  const savedPayers = payerChoices.filter((p) => p.saved).slice(0, 8);
  const [savePayer, setSavePayer] = useState(false);
  // the star on a name: an existing person is saved at once, a new name is saved when the job is
  const toggleSaved = (person, onNew) => (person ? ledger.setPartySettings(person.id, { saved: !person.saved }).catch(() => {}) : onNew());

  const partyByName = (name) => {
    const k = slug(name);
    return k ? [...partyById.values()].find((p) => p.kind !== 'booster' && slug(p.name) === k && !p.id.startsWith('demo_')) : null;
  };
  // the form as a fresh dialog opens it (also what Clear goes back to)
  const loadForm = () => {
    setError('');
    setBusy(false);
    setTried(false);
    setPayTeamToo(false);
    setSavePayer(false);
    proofOnlyRef.current = null;
    if (existing) {
      const { order, shares } = existing;
      // details someone filled in stay in view when they edit the job again
      setMoreOpen(Boolean(order.orderRef || order.link));
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
      setFeeOn((order.platformFeeMinor || 0) > 0);
      setTeamOn(shares.length > 0);
      setRows(shares.length ? shares.map((s) => { const nm = f.name(partyById.get(s.partyId)); return { key: s.id, name: nm, origName: nm, amountText: toInputText(s.amountMinor, order.currency), partyId: s.partyId, paidBy: s.paidBy === 'payer' ? 'payer' : 'me' }; }) : [blankRow()]);
      setPaid(false);
      setRateForm(rateFormFor(order, ledger.rates));
    } else {
      setMoreOpen(false);
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
      setFeeOn(false);
      setTeamOn(false);
      setRows([blankRow()]);
      setRateForm(rateFormFor(null, ledger.rates));
    }
  };
  useEffect(() => { if (open) loadForm(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const choosePayer = (name) => {
    setPayerName(name);
    const known = partyByName(name);
    if (!existing && known) setFeePct(String(suggestedFeePct(name, known)));
  };

  const major = parseAmountShorthand(amountText);
  const grossMinor = major === null ? 0 : toMinor(major, currency);
  const payerIsPlatform = isPlatformName(payerName) || partyByName(payerName)?.kind === 'platform';
  // a fee field for platforms, or for any payer once the user asks for one
  const [feeOn, setFeeOn] = useState(false);
  const showFee = payerIsPlatform || feeOn;
  const feePctNum = showFee ? Math.min(100, Math.max(0, parseAmountShorthand(feePct) || 0)) : 0;
  const feeMinor = Math.round((grossMinor * feePctNum) / 100);
  const receivable = Math.max(0, grossMinor - feeMinor);
  // Gold is offered only for games whose category supports it; a job already in gold keeps the choice
  const goldOk = categorySupportsGold(game, categories);
  const currencyChoices = Object.keys(CURRENCIES).filter((c) => c !== 'GOLD' || goldOk || currency === 'GOLD');
  // a gold job asks for its own rate: start from the last one used for this game (each game's gold is its own currency)
  const goldStart = useMemo(() => (ctx ? goldRateStart(ctx.orders, game, { categoryUnit: categoryGoldUnit(game, categories), fallbackPer1k: ledger.rates?.goldRateTOMAN }) : null), [ctx, game, categories]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // a restored draft keeps the rate it was typed with
    if (!open || existing || currency !== 'GOLD' || draftRestoredRef.current) return;
    setRateForm((r) => ({ ...r, gold: goldStart?.rate ? String(goldStart.rate) : '', goldUnit: goldStart?.unit ?? '1k' }));
  }, [open, currency, goldStart?.rate, goldStart?.unit]); // eslint-disable-line react-hooks/exhaustive-deps
  const goldRateErr = currency === 'GOLD' && !(parseAmountShorthand(rateForm.gold) > 0) ? f.t('lg.gold.rateErr', 'Enter what this gold is worth in Toman.') : '';
  const goldHint = goldStart?.source === 'game'
    ? f.t('lg.gold.lastGame', 'The last rate you used for {game}', { game })
    : goldStart?.source === 'any' ? f.t('lg.gold.lastAny', 'The last gold rate you used') : '';
  const pickGame = (name, list = categories) => {
    setGame(name);
    if (currency === 'GOLD' && !categorySupportsGold(name, list)) setCurrency('TOMAN');
  };
  const amountOf = (r) => { const v = parseAmountShorthand(r.amountText); return v === null ? 0 : toMinor(v, currency); };
  const named = teamOn ? rows.filter((r) => r.name.trim()) : [];
  const teamTotal = named.reduce((s, r) => s + amountOf(r), 0);
  const payerTeamTotal = named.filter((r) => r.paidBy === 'payer').reduce((s, r) => s + amountOf(r), 0);
  const myTeamTotal = teamTotal - payerTeamTotal;
  // what the client hands me: the job, less the fee, less what they pay my teammates themselves
  const clientPaysMe = Math.max(0, receivable - payerTeamTotal);
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
  const badAmount = amountText.trim() !== '' && major === null;
  const titleErr = !title.trim() && !orderRef.trim() ? f.t('lg.err.title', 'Give the order a title or an order number.') : '';
  const amountErr = badAmount
    ? f.t('lg.err.amountFormat', 'That is not a number Checkpoint understands. Try 3m, 250k or 1,200,000.')
    : grossMinor <= 0 ? f.t('lg.job.errAmount', 'Enter how much the job pays.') : '';
  const problems = [];
  if (titleErr) problems.push(titleErr);
  if (amountErr) problems.push(amountErr);
  if (goldRateErr) problems.push(goldRateErr);
  if (dupes) problems.push(f.t('lg.err.dupe', 'A booster can only be on an order once.'));
  if (teamOn && rows.some((r) => !r.name.trim() && amountOf(r) > 0)) problems.push(f.t('lg.err.noName', 'A share has an amount but no booster.'));

  // what was typed survives an accidental close: one draft per new job and per job being edited
  const draft = useFormDraft({
    open,
    key: existing ? `job_${existing.order.id}` : 'job_new',
    stamp: existing?.order?.updatedAt || null,
    hasContent: (v) => Boolean(v.title.trim() || v.payerName.trim() || v.amountText.trim() || v.note.trim() || v.orderRef.trim() || v.link.trim() || (v.teamOn && v.rows.some((r) => r.name.trim() || r.amountText.trim()))),
    value: { title, payerName, amountText, currency, paid, done, lifecycle, dateTime, orderRef, game, note, link, feePct, feeOn, rateForm, teamOn, rows, payTeamToo, savePayer, moreOpen },
    restore: (d) => {
      if ('title' in d) setTitle(d.title);
      if ('payerName' in d) setPayerName(d.payerName);
      if ('amountText' in d) setAmountText(d.amountText);
      if ('currency' in d) setCurrency(d.currency);
      if ('paid' in d) setPaid(d.paid);
      if ('done' in d) setDone(d.done);
      if ('lifecycle' in d) setLifecycle(d.lifecycle);
      if ('dateTime' in d) setDateTime(d.dateTime);
      if ('orderRef' in d) setOrderRef(d.orderRef);
      if ('game' in d) setGame(d.game);
      if ('note' in d) setNote(d.note);
      if ('link' in d) setLink(d.link);
      if ('feePct' in d) setFeePct(d.feePct);
      if ('feeOn' in d) setFeeOn(d.feeOn);
      if ('rateForm' in d) setRateForm(d.rateForm);
      if ('teamOn' in d) setTeamOn(d.teamOn);
      if ('rows' in d) setRows(d.rows);
      if ('payTeamToo' in d) setPayTeamToo(d.payTeamToo);
      if ('savePayer' in d) setSavePayer(d.savePayer);
      if ('moreOpen' in d) setMoreOpen(d.moreOpen);
    },
  });
  draftRestoredRef.current = draft.restored;

  const save = async () => {
    if (savingRef.current) return;
    setTried(true);
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
      if (payerId && savePayer && !partyById.get(payerId)?.settings?.saved) await ledger.setPartySettings(payerId, { saved: true });
      const shares = [];
      if (teamOn) {
        for (const r of rows) {
          if (!r.name.trim()) continue;
          const keep = r.partyId && r.name.trim() === r.origName;
          const partyId = keep ? r.partyId : (await ledger.addPerson('booster', r.name.trim())).id;
          if (r.saveNew) await ledger.setPartySettings(partyId, { saved: true });
          shares.push({ partyId, amountMinor: amountOf(r), paidBy: r.paidBy === 'payer' ? 'payer' : 'me' });
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
      await draft.discard();
      if (!existing) incrementLocalWorkCount();
      if (!existing && paid && clientPaysMe > 0) await ledger.markOrderCollected(id);
      // "already paid" can also settle the teammates I pay myself, so a finished split job needs no second step
      if (!existing && paid && payTeamToo && myTeamTotal > 0) {
        const after = await ledger.store().loadContext();
        for (const sh of after.shares.filter((x) => x.orderId === id && x.paidBy !== 'payer' && x.state !== 'cancelled')) {
          await ledger.markSharePaid(sh.id);
        }
      }
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

  const showAmountErr = Boolean(amountErr) && (tried || badAmount);
  const form = (
    <>
      <FormSection title={f.t('lg.form.what', 'What')}>
        <Field label={f.t('lg.job.what', 'What did you do?')} error={tried ? titleErr : ''}>
          <Textarea
            autoFocus
            autoGrow
            rows={2}
            maxRows={5}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
            placeholder={f.t('lg.job.whatHint', 'e.g. Heroic raid carry')}
            dir="auto"
            hasError={tried && Boolean(titleErr)}
            className="text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <GameField label={f.t('lg.order.game', 'Game')} value={game} onChange={pickGame} categories={categories} onAdd={() => setCategoryOpen(true)} />
          <Field label={f.t('lg.job.payer', 'Who pays you?')} as="div">
            <PartyCombobox
              value={payerName}
              onChange={choosePayer}
              people={payerChoices}
              onToggleSave={(p) => toggleSaved(p, () => setSavePayer((v) => !v))}
              pendingSave={savePayer}
              placeholder={f.t('lg.job.payerHint', 'A guild, advertiser or client (optional)')}
              ariaLabel={f.t('lg.job.payer', 'Who pays you?')}
            />
          </Field>
        </div>
        {savedPayers.length > 0 && (
          <div className="-mt-1 flex flex-wrap gap-1.5">
            {savedPayers.map((p) => (
              <Chip key={p.id} active={slug(payerName) === slug(p.name)} onClick={() => choosePayer(p.name)}>{p.name}</Chip>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection title={f.t('lg.form.money', 'Money')}>
        <div className={cn('grid gap-3', showFee ? 'grid-cols-[minmax(0,1fr)_6rem_6rem]' : 'grid-cols-[minmax(0,1fr)_6rem]')}>
          <Field label={teamOn ? f.t('lg.job.total', 'Total for the job') : f.t('lg.job.earn', 'You earn')} error={showAmountErr ? amountErr : ''}>
            <AmountInput value={amountText} onChange={setAmountText} placeholder={f.t('lg.amount.hint', 'e.g. 3m, 250k, 1,200,000')} hasError={showAmountErr} className="text-sm font-medium" />
          </Field>
          <Field label={f.t('lg.currency', 'Currency')} as="div">
            <Select value={currency} onChange={setCurrency} options={currencyChoices.map((c) => ({ value: c, label: c }))} ariaLabel={f.t('lg.currency', 'Currency')} />
          </Field>
          {showFee && (
            <Field label={f.t('lg.order.fee', 'Platform fee %')}>
              <AmountInput value={feePct} onChange={setFeePct} showValue={false} />
            </Field>
          )}
        </div>
        {!showFee && (
          <button type="button" onClick={() => setFeeOn(true)} className="-mt-1 inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            <Plus className="w-3 h-3" aria-hidden="true" />{f.t('lg.job.addFee', 'Add a fee taken from this job')}
          </button>
        )}
        {currency === 'GOLD' && (
          <GoldRateField value={rateForm} onChange={setRateForm} hint={goldHint} error={tried ? goldRateErr : ''} />
        )}
      </FormSection>

      <FormSection title={f.t('lg.form.when', 'Status and date')}>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
          <Field label={f.t('lg.order.status', 'Status')} as="div">
            {!existing ? (
              <Segmented className="flex w-full [&>button]:flex-1" ariaLabel={f.t('lg.order.status', 'Status')} value={done ? 'done' : 'working'} onChange={(v) => setDone(v === 'done')}
                options={[{ value: 'done', label: f.t('lg.job.finished', 'Finished') }, { value: 'working', label: f.t('lg.job.inProgress', 'In progress') }]} />
            ) : (
              <Select value={lifecycle} onChange={setLifecycle} ariaLabel={f.t('lg.order.status', 'Status')}
                options={LIFECYCLES.map((l) => ({ value: l, label: f.t(`lg.life.${l}`, LIFE_LABELS[l]), icon: <LifeDot lifecycle={l} /> }))} />
            )}
          </Field>
          <Field label={f.t('lg.date', 'Date')} as="div">
            <DateTimePicker value={dateTime} onChange={setDateTime} />
          </Field>
        </div>
      </FormSection>

      {/* Splitting with teammates is opt-in, so a solo job stays three fields */}
      <FormSection
        title={f.t('lg.form.team', 'Team')}
        aside={
          <label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={teamOn} onChange={(e) => setTeamOn(e.target.checked)} className="accent-zinc-900 dark:accent-zinc-100" />
            {f.t('lg.job.team', 'I split this job with teammates')}
          </label>
        }
      >
        {teamOn ? (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto_auto] gap-2 items-center">
                <PartyCombobox
                  value={r.name}
                  onChange={(v) => setRow(r.key, { name: v })}
                  people={teammateChoices}
                  onToggleSave={(p) => toggleSaved(p, () => setRow(r.key, { saveNew: !r.saveNew }))}
                  pendingSave={r.saveNew}
                  placeholder={f.t('lg.job.teammate', 'Teammate')}
                  ariaLabel={f.t('lg.job.teammate', 'Teammate')}
                />
                <AmountInput value={r.amountText} onChange={(v) => setRow(r.key, { amountText: v })} placeholder="0" aria-label={f.t('lg.order.share', 'Their share')} showValue={false} />
                <Segmented
                  ariaLabel={f.t('lg.job.whoPays', 'Who pays them?')}
                  value={r.paidBy}
                  onChange={(v) => setRow(r.key, { paidBy: v })}
                  options={[
                    { value: 'payer', label: f.t('lg.job.paidByClient', 'Client pays'), title: f.t('lg.job.paidByClientHelp', 'The client pays this teammate directly. You owe them nothing.') },
                    { value: 'me', label: f.t('lg.job.paidByMe', 'I pay'), title: f.t('lg.job.paidByMeHelp', 'The client pays you and you pay this teammate. Their share shows under Team until you pay it.') },
                  ]}
                />
                <button type="button" aria-label={f.t('lg.remove', 'Remove')} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blankRow()]))} className="rounded-md p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-900"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setRows((rs) => [...rs, blankRow()])} className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"><Plus className="w-3 h-3" />{f.t('lg.job.addTeammate', 'Add a teammate')}</button>
              {named.length > 0 && <button type="button" onClick={splitEqually} className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">{f.t('lg.job.splitEqually', 'Split equally with me')}</button>}
            </div>
            {overpaid && <p className="text-xs text-rose-600 dark:text-rose-400">{f.t('lg.wf.overpaid', 'The shares add up to more than the order pays after fees.')}</p>}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{f.t('lg.job.soloHint', 'Solo job. Turn this on if teammates share the money.')}</p>
        )}
      </FormSection>

      <FormSection title={f.t('lg.note.order', 'Notes')}>
        <Textarea autoGrow rows={3} maxRows={10} value={note} onChange={(e) => setNote(e.target.value)} placeholder={f.t('lg.note.hint', 'Anything to remember: what was agreed, what is left to do…')} aria-label={f.t('lg.note.order', 'Notes')} dir="auto" />
      </FormSection>

      <Disclosure title={f.t('lg.order.more', 'More details')} open={moreOpen} onToggle={setMoreOpen}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={f.t('lg.order.ref', 'Order number')}>
            <Input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} dir="auto" />
          </Field>
          <Field label={f.t('lg.order.link', 'Link to the order')}>
            <Input value={link} onChange={(e) => setLink(e.target.value)} dir="ltr" placeholder="https://" />
          </Field>
        </div>
        <RateLockFields value={rateForm} onChange={setRateForm} goldUnit={existing?.order?.rateUnit} showGold={false} />
      </Disclosure>
    </>
  );

  const summary = (
    <>
      <SummaryCard title={f.t('lg.form.summary', 'Summary')}>
        <SummaryRow label={f.t('lg.jobs.total', 'Job paid')} value={<Money minor={grossMinor} currency={currency} />} />
        {feeMinor > 0 && <SummaryRow muted label={f.t('lg.wf.fee', 'Platform fee')} value={<>−<Money minor={feeMinor} currency={currency} /></>} />}
        {teamOn && payerTeamTotal > 0 && <SummaryRow muted label={f.t('lg.job.sumClientTeam', 'Teammates, client pays')} value={<>−<Money minor={payerTeamTotal} currency={currency} /></>} />}
        {teamOn && myTeamTotal > 0 && <SummaryRow muted label={f.t('lg.job.sumMyTeam', 'Teammates, you pay')} value={<>−<Money minor={myTeamTotal} currency={currency} /></>} />}
        <SummaryDivider />
        <SummaryRow strong label={overpaid ? f.t('lg.wf.loss', 'You would lose') : f.t('lg.job.keep', 'You keep')} value={<Money minor={Math.abs(mine)} currency={currency} />} tone={overpaid ? 'bad' : mine > 0 ? 'good' : undefined} />
        {teamOn && payerTeamTotal > 0 && (
          <p className="pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{f.t('lg.job.clientPaysYou', 'The client pays you {amount}', { amount: f.money(clientPaysMe, currency) })}</p>
        )}
      </SummaryCard>

      <div className="space-y-3">
        {!existing && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="accent-zinc-900 dark:accent-zinc-100" />
              {f.t('lg.job.paid', 'Already paid')}
            </label>
            {paid && teamOn && myTeamTotal > 0 && (
              <label className="flex items-center gap-1.5 ps-5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={payTeamToo} onChange={(e) => setPayTeamToo(e.target.checked)} className="accent-zinc-900 dark:accent-zinc-100" />
                {f.t('lg.job.paidTeamToo', 'I paid my teammates too')}
              </label>
            )}
          </div>
        )}
      </div>

      <Field label={f.t('lg.proofs', 'Screenshots')} as="div">
        <ProofField draft={proofs} />
      </Field>
    </>
  );

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="max-w-[800px]">
      <div className="flex flex-col max-h-[92vh] min-h-0" onPaste={proofs.onPaste} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(); }}>
        <DialogHeader onClose={onClose}>
          <DialogTitle>{existing ? f.t('lg.job.edit', 'Edit job') : f.t('lg.job.new', 'Add a job')}</DialogTitle>
        </DialogHeader>
        <FormPanes form={form} summary={summary} />
        <FormFooter error={error} onCancel={onClose} onSave={save} busy={busy} saveLabel={existing ? f.t('common.save', 'Save') : f.t('lg.job.cta', 'Add job')} draft={{ restored: draft.restored, dirty: draft.dirty, onClear: () => { draft.clear(loadForm); proofs.reset(); } }} />
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
