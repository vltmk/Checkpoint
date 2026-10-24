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
import { KNOWN_PLATFORMS, isPlatformName, suggestedFeePct } from '../../lib/ledger/platforms';
import { slug } from '../../lib/ledger/legacyMapper';
import { quoteShareTexts, splitEvenly } from '../../lib/ledger/quote';
import { parseAmountShorthand, toMinor, fromMinor, normalizeCurrency } from '../../lib/ledger/money';
import { LIFECYCLES } from '../../lib/ledger/ledgerStore';
import { UNKNOWN_PAYER_ID } from '../../lib/ledger/legacyMapper';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { RateLockFields } from './RateLockFields';
import { ProofField, useProofDraft } from './ProofField';
import { GameField } from './GameField';
import { rateFormFor, rateFieldsFromForm } from '../../lib/ledger/rateLock';
import { LifeDot, Money } from './parts';

const CUT_PRESETS = [10, 15, 20, 25, 30];
const LIFECYCLE_LABELS = {
  pending: 'Pending', working: 'Working', on_hold: 'On hold', done: 'Done', failed: 'Failed', disputed: 'Disputed', refunded: 'Refunded',
};

const blankRow = () => ({ key: Math.random().toString(36).slice(2), name: '', amountText: '', partyId: null });

// Format a minor amount for a text input (no separators, plain digits)
const toInputText = (minor, currency) => (minor ? String(fromMinor(minor, currency)) : '');

/**
 * Create or edit an order: who pays, what they pay, who does the work and what each person gets.
 * Margin is not typed in. It is whatever is left, shown live, so it can never disagree with the shares.
 *
 * `initial` carries a quote from the calculator: { clientPrice, currency, platformFeePct, platform, boosterCount, boosterPool }.
 */
export function OrderModal({ open, onClose, existing = null, initial = null, categories = [], onRefreshCategories, onSaved }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, partyById, displayCurrency } = ledger;

  const [title, setTitle] = useState('');
  const [game, setGame] = useState('');
  const [payerName, setPayerName] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [dateTime, setDateTime] = useState(() => toLocalISOString());
  const [currency, setCurrency] = useState('USD');
  const [grossText, setGrossText] = useState('');
  const [feePct, setFeePct] = useState('0');
  const [rateForm, setRateForm] = useState(() => rateFormFor(null, {}));
  const [lifecycle, setLifecycle] = useState('working');
  const [rows, setRows] = useState([blankRow()]);
  const [autoSplit, setAutoSplit] = useState(true);
  const [cutMode, setCutMode] = useState('percent');
  const [cutValue, setCutValue] = useState('20');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [payoutDate, setPayoutDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  // a ref, not state: Ctrl+Enter pressed twice in one tick must not start two saves before React re-renders
  const savingRef = useRef(false);
  // the names the form was loaded with, so an unchanged person keeps their id instead of being re-resolved by name
  const loadedRef = useRef({ payer: null, payerId: null });
  const [error, setError] = useState('');
  // set once the order is saved but a screenshot failed, so the next Save only retries the screenshots
  const proofOnlyRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const proofs = useProofDraft({ open, ownerId: existing?.order?.id || null, onAdded: () => setMoreOpen(true) });

  // Known payers and boosters, for one-tap choices
  const payerChoices = useMemo(() => {
    const names = new Set(KNOWN_PLATFORMS.map((p) => p.label));
    // the placeholder payer made by the upgrade is not a real choice
    if (ctx) for (const o of ctx.orders) { if (o.payerId === UNKNOWN_PAYER_ID) continue; const n = partyById.get(o.payerId)?.name; if (n) names.add(n); }
    return [...names];
  }, [ctx, partyById]);
  const partyByName = (name) => {
    const k = slug(name);
    return k ? [...partyById.values()].find((p) => p.kind !== 'booster' && slug(p.name) === k && !p.id.startsWith('demo_')) : null;
  };
  const boosterNames = useMemo(
    () => [...new Set([...partyById.values()].filter((p) => p.kind === 'booster' && !p.archived && p.id !== 'party_unassigned' && !p.id.startsWith('demo_')).map((p) => p.name))],
    [partyById]
  );

  // Load the form each time it opens
  useEffect(() => {
    if (!open) return;
    setError('');
    setBusy(false);
    setMoreOpen(false);
    proofOnlyRef.current = null;
    if (existing) {
      const { order, shares } = existing;
      setTitle(order.title || '');
      setGame(order.game || '');
      const loadedPayer = order.payerId ? f.name(partyById.get(order.payerId)) : order.source || '';
      // the placeholder payer from the upgrade is shown as an empty field, and stays "no payer" unless the user names one
      const shownPayer = order.payerId === UNKNOWN_PAYER_ID ? '' : loadedPayer;
      loadedRef.current = { payer: shownPayer, payerId: order.payerId || null };
      setPayerName(shownPayer);
      setOrderRef(order.orderRef || '');
      setDateTime(order.dateTime ? toLocalISOString(new Date(order.dateTime)) : toLocalISOString());
      setCurrency(normalizeCurrency(order.currency));
      setGrossText(toInputText(order.grossMinor, order.currency));
      const pct = order.grossMinor > 0 ? (order.platformFeeMinor / order.grossMinor) * 100 : 0;
      setFeePct(String(Math.round(pct * 100) / 100));
      setLifecycle(order.lifecycle);
      setRows(shares.length ? shares.map((s) => { const nm = f.name(partyById.get(s.partyId)); return { key: s.id, name: nm, origName: nm, amountText: toInputText(s.amountMinor, order.currency), partyId: s.partyId }; }) : [blankRow()]);
      setAutoSplit(false);
      setNote(order.note || '');
      setLink(order.link || '');
      setPayoutDate(order.expectedPayoutAt ? toLocalISOString(new Date(order.expectedPayoutAt)) : '');
      setRateForm(rateFormFor(order, ledger.rates));
    } else {
      // a quote brings its own currency; otherwise reuse the one on the latest order, then the display currency
      const latest = ctx ? [...ctx.orders].sort((a, b) => Date.parse(b.updatedAt || b.dateTime) - Date.parse(a.updatedAt || a.dateTime))[0] : null;
      const cur = normalizeCurrency(initial?.currency || latest?.currency || displayCurrency || 'USD');
      setTitle('');
      setGame(categories[0]?.name || '');
      setPayerName(initial?.platform || '');
      setOrderRef('');
      setDateTime(toLocalISOString());
      setCurrency(cur);
      setGrossText(initial?.clientPrice ? String(initial.clientPrice) : '');
      setFeePct(String(initial?.platformFeePct ?? 0));
      setLifecycle('working');
      const n = Math.max(1, Number(initial?.boosterCount) || 1);
      // the pool is split here in minor units, so the cuts add up to exactly what the quote promised
      const texts = quoteShareTexts(initial, cur);
      setRows(Array.from({ length: n }, (_, i) => ({ ...blankRow(), amountText: texts ? texts[i] : '' })));
      setAutoSplit(!texts);
      setCutMode('percent');
      setCutValue('20');
      setNote('');
      setLink('');
      setPayoutDate('');
      setRateForm(rateFormFor(null, ledger.rates));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const grossMajor = parseAmountShorthand(grossText);
  const grossMinor = grossMajor === null ? 0 : toMinor(grossMajor, currency);
  const feePctNum = Math.min(100, Math.max(0, Number(feePct) || 0));
  const feeMinor = Math.round((grossMinor * feePctNum) / 100);
  const receivable = Math.max(0, grossMinor - feeMinor);

  // Gold is offered only for games whose category supports it; an order already in gold keeps the choice
  const goldOk = categorySupportsGold(game, categories);
  const currencyChoices = Object.keys(CURRENCIES).filter((c) => c !== 'GOLD' || goldOk || currency === 'GOLD');
  const pickGame = (name, list = categories) => {
    setGame(name);
    if (currency === 'GOLD' && !categorySupportsGold(name, list)) setCurrency('USD');
  };

  const cutNum = Number(cutValue) || 0;
  const myCutMinor = cutMode === 'percent' ? Math.round((receivable * Math.min(100, cutNum)) / 100) : toMinor(parseAmountShorthand(cutValue) ?? 0, currency);
  const namedRows = rows.filter((r) => r.name.trim());

  // While auto-splitting, boosters share what the seller leaves
  const autoAmounts = useMemo(
    () => splitEvenly(Math.max(0, receivable - myCutMinor), Math.max(1, namedRows.length)),
    [receivable, myCutMinor, namedRows.length]
  );
  const shownRows = useMemo(() => {
    if (!autoSplit) return rows;
    let i = 0;
    return rows.map((r) => (r.name.trim() ? { ...r, amountText: toInputText(autoAmounts[i++], currency) } : { ...r, amountText: '' }));
  }, [rows, autoSplit, autoAmounts, currency]);

  const amountOf = (r) => {
    const v = parseAmountShorthand(r.amountText);
    return v === null ? 0 : toMinor(v, currency);
  };
  const shareTotal = shownRows.filter((r) => r.name.trim()).reduce((s, r) => s + amountOf(r), 0);
  const margin = receivable - shareTotal;
  const overpaid = margin < 0;

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const editAmount = (key, text) => {
    if (autoSplit) {
      // first manual edit freezes the current split so the user edits real numbers
      setRows(shownRows.map((r) => (r.key === key ? { ...r, amountText: text } : r)));
      setAutoSplit(false);
    } else setRow(key, { amountText: text });
  };

  const duplicateNames = (() => {
    const seen = new Set();
    for (const r of namedRows) {
      const k = r.name.trim().toLowerCase();
      if (seen.has(k)) return true;
      seen.add(k);
    }
    return false;
  })();

  const problems = [];
  if (!title.trim() && !orderRef.trim()) problems.push(f.t('lg.err.title', 'Give the order a title or an order number.'));
  if (grossMinor <= 0) problems.push(f.t('lg.err.price', 'Enter what the order pays.'));
  if (duplicateNames) problems.push(f.t('lg.err.dupe', 'A booster can only be on an order once.'));
  if (shownRows.some((r) => !r.name.trim() && amountOf(r) > 0)) problems.push(f.t('lg.err.noName', 'A share has an amount but no booster.'));

  const save = async () => {
    if (savingRef.current) return; // already saving
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
      const payerKind = isPlatformName(payerName) || partyByName(payerName)?.kind === 'platform' ? 'platform' : 'client';
      // unchanged payer: keep the stored one (this is what protects the upgrade's placeholder payer)
      const payerUnchanged = existing && payerName.trim() === loadedRef.current.payer;
      const payerId = payerUnchanged
        ? loadedRef.current.payerId
        : payerName.trim() ? (await ledger.addPerson(payerKind, payerName.trim())).id : null;
      const shares = [];
      for (const r of shownRows) {
        if (!r.name.trim()) continue;
        // unchanged person: keep their id. Looking them up by name would turn "Unassigned" into a brand new
        // booster and re-open a debt that was already settled.
        const keep = r.partyId && r.name.trim() === r.origName;
        const partyId = keep ? r.partyId : (await ledger.addPerson('booster', r.name.trim())).id;
        shares.push({ partyId, amountMinor: amountOf(r) });
      }
      const base = existing?.order || {};
      const id = base.id || `ord_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const saved = await ledger.saveOrder({
        order: {
          ...base,
          id,
          kind: 'income',
          title: title.trim(),
          game: game.trim(),
          source: payerName.trim(),
          orderRef: orderRef.trim(),
          payerId,
          dateTime: new Date(dateTime).toISOString(),
          lifecycle,
          currency,
          // the day's gold, USD and EUR rates stay with the order, so later rate changes never rewrite history
          ...rateFieldsFromForm(rateForm, { base, currentRates: ledger.rates }),
          grossMinor,
          platformFeeMinor: feeMinor,
          note: note.trim(),
          link: link.trim(),
          expectedPayoutAt: payoutDate ? new Date(payoutDate).toISOString() : null,
        },
        shares,
      });
      if (!existing) incrementLocalWorkCount();
      // remember what this seller uses for the platform, so the next order starts from it
      if (payerId && payerKind === 'platform' && Math.abs(feePctNum - suggestedFeePct(payerName, partyByName(payerName))) > 0.0001) {
        await ledger.setPartySettings(payerId, { feePct: feePctNum });
      }
      try {
        await proofs.commit(id);
      } catch {
        proofOnlyRef.current = id;
        onSaved?.(saved);
        setError(f.t('lg.err.proofsFailed', 'Saved, but a screenshot could not be attached. Press Save to try again.'));
        return;
      }
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(e?.message || f.t('lg.err.generic', 'That could not be saved.'));
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  const labelCls = 'text-xs text-zinc-500';

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="max-w-xl">
      <div
        className="flex flex-col max-h-[92vh]"
        onPaste={proofs.onPaste}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(); }}
      >
        <DialogHeader onClose={onClose}>
          <DialogTitle>{existing ? f.t('lg.order.edit', 'Edit order') : f.t('lg.newOrder', 'New order')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <label className="block">
            <span className={labelCls}>{f.t('lg.order.title', 'What is the order?')}</span>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={f.t('lg.order.titleHint', 'e.g. Mythic+ 15 timed, 4 runs')} className="mt-1" />
          </label>

          <GameField label={f.t('lg.order.game', 'Game')} value={game} onChange={pickGame} categories={categories} onAdd={() => setCategoryOpen(true)} />

          <div>
            <span className={labelCls}>{f.t('lg.order.from', 'Where is it from?')}</span>
            <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder={f.t('lg.order.fromHint', 'G2G, FunPay, a client name…')} className="mt-1" aria-label={f.t('lg.order.from', 'Where is it from?')} />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {payerChoices.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setPayerName(n);
                    // the fee this seller used last time for the platform, else the platform's usual one.
                    // A quote already carries its own fee, which the seller chose in the calculator: keep it.
                    if (!existing && !initial?.clientPrice) setFeePct(String(suggestedFeePct(n, partyByName(n))));
                  }}
                  className={cn('h-6 px-2 rounded-md text-[11px] transition-colors', payerName.trim().toLowerCase() === n.toLowerCase() ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800')}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
            <label className="block">
              <span className={labelCls}>{f.t('lg.order.price', 'The order pays')}</span>
              <Input dir="ltr" inputMode="decimal" value={grossText} onChange={(e) => setGrossText(e.target.value)} placeholder="100" hasError={grossText.trim() !== '' && grossMajor === null} className="mt-1 text-base tabular-nums" />
            </label>
            <Select value={currency} onChange={setCurrency} options={currencyChoices.map((c) => ({ value: c, label: c }))} ariaLabel={f.t('lg.currency', 'Currency')} className="w-24" />
            <label className="block w-24">
              <span className={labelCls}>{f.t('lg.order.fee', 'Platform fee %')}</span>
              <Input dir="ltr" inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value)} className="mt-1 tabular-nums" />
            </label>
          </div>

          {/* Who does the work and what they get */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{f.t('lg.order.boosters', 'Who does the work?')}</span>
              {!autoSplit && namedRows.length > 0 && (
                <button type="button" onClick={() => setAutoSplit(true)} className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">{f.t('lg.order.resplit', 'Split evenly after my cut')}</button>
              )}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {shownRows.map((r) => (
                <li key={r.key} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-center">
                  <Input list="lg-boosters" value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} placeholder={f.t('lg.order.boosterName', 'Booster name')} aria-label={f.t('lg.order.boosterName', 'Booster name')} />
                  <Input dir="ltr" inputMode="decimal" value={r.amountText} onChange={(e) => editAmount(r.key, e.target.value)} placeholder="0" aria-label={f.t('lg.order.share', 'Their share')} className="tabular-nums" />
                  <button type="button" aria-label={f.t('lg.remove', 'Remove')} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blankRow()]))} className="text-zinc-400 hover:text-rose-600 p-1"><X className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
            <datalist id="lg-boosters">{boosterNames.map((n) => <option key={n} value={n} />)}</datalist>
            <button type="button" onClick={() => setRows((rs) => [...rs, blankRow()])} className="mt-1.5 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Plus className="w-3 h-3" />{f.t('lg.order.addBooster', 'Add a booster')}
            </button>

            {autoSplit && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-zinc-500">{f.t('lg.order.myCut', 'My cut')}</span>
                {CUT_PRESETS.map((p) => (
                  <button key={p} type="button" onClick={() => { setCutMode('percent'); setCutValue(String(p)); }} className={cn('h-6 px-2 rounded-md text-[11px]', cutMode === 'percent' && Number(cutValue) === p ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300')}>{f.formatNumber(p)}%</button>
                ))}
                <Input dir="ltr" inputMode="decimal" value={cutValue} onChange={(e) => setCutValue(e.target.value)} className="w-20 h-6 text-[11px]" aria-label={f.t('lg.order.myCut', 'My cut')} />
                <button type="button" onClick={() => setCutMode((m) => (m === 'percent' ? 'flat' : 'percent'))} className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">{cutMode === 'percent' ? '%' : currency}</button>
              </div>
            )}
          </div>

          {/* Live waterfall: the margin is what is left */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3.5 py-3 text-xs space-y-1" aria-live="polite">
            <Row label={f.t('lg.wf.price', 'Order pays')} value={<Money minor={grossMinor} currency={currency} />} />
            {feeMinor > 0 && <Row label={f.t('lg.wf.fee', 'Platform fee')} value={<>−<Money minor={feeMinor} currency={currency} /></>} muted />}
            <Row label={f.t('lg.wf.boosters', 'Boosters')} value={<>−<Money minor={shareTotal} currency={currency} /></>} muted />
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-1.5 mt-1.5">
              <Row
                label={overpaid ? f.t('lg.wf.loss', 'You would lose') : f.t('lg.wf.margin', 'You keep')}
                value={<Money minor={Math.abs(margin)} currency={currency} />}
                strong
                tone={overpaid ? 'bad' : margin > 0 ? 'good' : undefined}
                aside={grossMinor > 0 && !overpaid ? `${f.formatNumber(Math.round((margin / grossMinor) * 100))}%` : null}
              />
            </div>
          </div>
          {overpaid && <p className="text-xs text-rose-600 dark:text-rose-400">{f.t('lg.wf.overpaid', 'The shares add up to more than the order pays after fees.')}</p>}

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelCls}>{f.t('lg.order.status', 'Status')}</span>
              <Select value={lifecycle} onChange={setLifecycle} options={LIFECYCLES.map((l) => ({ value: l, label: f.t(`lg.life.${l}`, LIFECYCLE_LABELS[l]), icon: <LifeDot lifecycle={l} /> }))} ariaLabel={f.t('lg.order.status', 'Status')} className="mt-1" />
            </label>
            <div>
              <span className={labelCls}>{f.t('lg.date', 'Date')}</span>
              <DateTimePicker value={dateTime} onChange={setDateTime} className="mt-1" />
            </div>
          </div>

          <details open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
            <summary className="text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-800 dark:hover:text-zinc-200">{f.t('lg.order.more', 'More details')}</summary>
            <div className="mt-2 space-y-2">
              <Input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder={f.t('lg.order.ref', 'Order number')} aria-label={f.t('lg.order.ref', 'Order number')} />
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder={f.t('lg.order.link', 'Link to the order')} aria-label={f.t('lg.order.link', 'Link to the order')} dir="ltr" />
              <div>
                <span className={labelCls}>{f.t('lg.order.payout', 'Platform pays you on (optional)')}</span>
                {payoutDate ? (
                  <div className="mt-1 flex items-center gap-2">
                    <DateTimePicker value={payoutDate} onChange={setPayoutDate} />
                    <button type="button" onClick={() => setPayoutDate('')} className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">{f.t('lg.clear', 'Clear')}</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setPayoutDate(dateTime)} className="mt-1 block text-xs text-zinc-700 dark:text-zinc-300 hover:underline">{f.t('lg.order.setPayout', 'Set a date')}</button>
                )}
              </div>
              <RateLockFields value={rateForm} onChange={setRateForm} goldUnit={existing?.order?.rateUnit} />
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={f.t('lg.note.order', 'Notes')} aria-label={f.t('lg.note.order', 'Notes')} />
              <div>
                <span className={labelCls}>{f.t('lg.proofs', 'Screenshots')}</span>
                <div className="mt-1"><ProofField draft={proofs} /></div>
              </div>
            </div>
          </details>

          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{f.t('common.cancel', 'Cancel')}</Button>
          <Button variant="primary" disabled={busy} onClick={save}>{existing ? f.t('common.save', 'Save') : f.t('lg.order.create', 'Add order')}</Button>
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

function Row({ label, value, muted, strong, tone, aside }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn(muted ? 'text-zinc-500' : 'text-zinc-700 dark:text-zinc-300', strong && 'font-medium')}>{label}</span>
      <span className={cn('tabular-nums', strong && 'text-base font-semibold', tone === 'good' && 'text-emerald-700 dark:text-emerald-400', tone === 'bad' && 'text-rose-600 dark:text-rose-400')}>
        {value}
        {aside && <span className="ms-2 text-xs font-normal text-zinc-400">{aside}</span>}
      </span>
    </div>
  );
}
