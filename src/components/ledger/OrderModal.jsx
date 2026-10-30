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
import { isPlatformName, suggestedFeePct } from '../../lib/ledger/platforms';
import { slug } from '../../lib/ledger/legacyMapper';
import { quoteShareTexts, splitEvenly } from '../../lib/ledger/quote';
import { parseAmountShorthand, toMinor, fromMinor, normalizeCurrency } from '../../lib/ledger/money';
import { LIFECYCLES } from '../../lib/ledger/ledgerStore';
import { UNKNOWN_PAYER_ID } from '../../lib/ledger/legacyMapper';
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

const CUT_PRESETS = [10, 15, 20, 25, 30];
const LIFECYCLE_LABELS = {
  pending: 'Pending', working: 'Working', on_hold: 'On hold', done: 'Done', failed: 'Failed', disputed: 'Disputed', refunded: 'Refunded',
};

const blankRow = () => ({ key: Math.random().toString(36).slice(2), name: '', amountText: '', partyId: null, saveNew: false });
const PAYER_KINDS = ['client', 'platform'];
const BOOSTER_KINDS = ['booster'];

// Format a minor amount for a text input (no separators, plain digits)
const toInputText = (minor, currency) => (minor ? String(fromMinor(minor, currency)) : '');

/**
 * Create or edit an order: who pays, what they pay, who does the work and what each person gets.
 * Margin is not typed in. It is whatever is left, shown live, so it can never disagree with the shares.
 *
 * `initial` carries a quote from the calculator: { clientPrice, currency, platformFeePct, platform, boosterCount, boosterPool }.
 */
export function OrderModal({ open, onClose, existing = null, copyOf = null, initial = null, categories = [], onRefreshCategories, onSaved }) {
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
  const draftRestoredRef = useRef(false);
  // the names the form was loaded with, so an unchanged person keeps their id instead of being re-resolved by name
  const loadedRef = useRef({ payer: null, payerId: null });
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);
  // set once the order is saved but a screenshot failed, so the next Save only retries the screenshots
  const proofOnlyRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const proofs = useProofDraft({ open, ownerId: existing?.order?.id || null });

  // payers and boosters the seller has used before (no built-in platform list): saved ones first, then the most recent
  const payerChoices = usePartyChoices(ctx, partyById, PAYER_KINDS, f);
  const boosterChoices = usePartyChoices(ctx, partyById, BOOSTER_KINDS, f);
  const savedPayers = payerChoices.filter((p) => p.saved).slice(0, 8);
  const [savePayer, setSavePayer] = useState(false);
  // the star on a name: an existing person is saved at once, a new name is saved with the order
  const toggleSaved = (person, onNew) => (person ? ledger.setPartySettings(person.id, { saved: !person.saved }).catch(() => {}) : onNew());
  // the platform fee is a percentage of the price, or a fixed amount in the order's currency
  const [feeMode, setFeeMode] = useState('percent');
  const partyByName = (name) => {
    const k = slug(name);
    return k ? [...partyById.values()].find((p) => p.kind !== 'booster' && slug(p.name) === k && !p.id.startsWith('demo_')) : null;
  };
  // Load the form each time it opens
  // the form as a fresh dialog opens it (also what Clear goes back to)
  const loadForm = () => {
    setError('');
    setBusy(false);
    setTried(false);
    setSavePayer(false);
    proofOnlyRef.current = null;
    // a copy starts from another order's values but is saved as a new one
    const source = existing || copyOf;
    if (source) {
      const { order, shares } = source;
      // details someone filled in stay in view when they edit the order again
      setMoreOpen(!copyOf && Boolean(order.orderRef || order.link || order.expectedPayoutAt));
      setTitle(order.title || '');
      setGame(order.game || '');
      const loadedPayer = order.payerId ? f.name(partyById.get(order.payerId)) : order.source || '';
      // the placeholder payer from the upgrade is shown as an empty field, and stays "no payer" unless the user names one
      const shownPayer = order.payerId === UNKNOWN_PAYER_ID ? '' : loadedPayer;
      loadedRef.current = { payer: shownPayer, payerId: order.payerId || null };
      setPayerName(shownPayer);
      setOrderRef(copyOf ? '' : order.orderRef || '');
      setDateTime(order.dateTime && !copyOf ? toLocalISOString(new Date(order.dateTime)) : toLocalISOString());
      setCurrency(normalizeCurrency(order.currency));
      setGrossText(toInputText(order.grossMinor, order.currency));
      if (order.feeType === 'flat') {
        setFeeMode('flat');
        setFeePct(toInputText(order.platformFeeMinor, order.currency));
      } else {
        const pct = order.grossMinor > 0 ? (order.platformFeeMinor / order.grossMinor) * 100 : 0;
        setFeeMode('percent');
        setFeePct(String(Math.round(pct * 100) / 100));
      }
      setLifecycle(copyOf ? 'working' : order.lifecycle);
      setRows(shares.length ? shares.map((s) => { const nm = f.name(partyById.get(s.partyId)); return { key: s.id, name: nm, origName: nm, amountText: toInputText(s.amountMinor, order.currency), partyId: s.partyId }; }) : [blankRow()]);
      // equal shares reopen as an even split with the cut taken from what is left; anything else stays custom
      const amounts = shares.map((s) => s.amountMinor);
      const pool = Math.max(0, order.grossMinor - (order.platformFeeMinor || 0));
      const sum = amounts.reduce((a, b) => a + b, 0);
      const even = amounts.length > 0 && Math.max(...amounts) - Math.min(...amounts) <= 1 && sum <= pool;
      setAutoSplit(even);
      setCutMode(even ? 'flat' : 'percent');
      setCutValue(even ? toInputText(pool - sum, order.currency) : '20');
      setNote(order.note || '');
      setLink(copyOf ? '' : order.link || '');
      setPayoutDate(order.expectedPayoutAt && !copyOf ? toLocalISOString(new Date(order.expectedPayoutAt)) : '');
      // a copy is a new order, so it takes today's rates
      setRateForm(rateFormFor(copyOf ? null : order, ledger.rates));
    } else {
      setMoreOpen(false);
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
      setFeeMode('percent');
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
  };
  useEffect(() => { if (open) loadForm(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const choosePayer = (name) => {
    setPayerName(name);
    const known = partyByName(name);
    if (!existing && !initial?.clientPrice && known && feeMode === 'percent') setFeePct(String(suggestedFeePct(name, known)));
  };

  const grossMajor = parseAmountShorthand(grossText);
  const grossMinor = grossMajor === null ? 0 : toMinor(grossMajor, currency);
  const feeTyped = parseAmountShorthand(feePct) ?? 0;
  const feePctNum = feeMode === 'percent' ? Math.min(100, Math.max(0, feeTyped)) : 0;
  // a flat fee can never be more than the order pays
  const feeMinor = feeMode === 'flat' ? Math.min(grossMinor, toMinor(feeTyped, currency)) : Math.round((grossMinor * feePctNum) / 100);
  const receivable = Math.max(0, grossMinor - feeMinor);

  // Gold is offered only for games whose category supports it; an order already in gold keeps the choice
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
    if (currency === 'GOLD' && !categorySupportsGold(name, list)) setCurrency('USD');
  };

  const cutNum = parseAmountShorthand(cutValue) ?? 0;
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

  const badPrice = grossText.trim() !== '' && grossMajor === null;
  const titleErr = !title.trim() && !orderRef.trim() ? f.t('lg.err.title', 'Give the order a title or an order number.') : '';
  const priceErr = badPrice
    ? f.t('lg.err.amountFormat', 'That is not a number Checkpoint understands. Try 3m, 250k or 1,200,000.')
    : grossMinor <= 0 ? f.t('lg.err.price', 'Enter what the order pays.') : '';
  const problems = [];
  if (titleErr) problems.push(titleErr);
  if (priceErr) problems.push(priceErr);
  if (goldRateErr) problems.push(goldRateErr);
  if (duplicateNames) problems.push(f.t('lg.err.dupe', 'A booster can only be on an order once.'));
  if (shownRows.some((r) => !r.name.trim() && amountOf(r) > 0)) problems.push(f.t('lg.err.noName', 'A share has an amount but no booster.'));

  // what was typed survives an accidental close: one draft per new order and per order being edited
  const draft = useFormDraft({
    open,
    // no draft for a copy: it would put an old "new order" draft over the copied values
    key: existing ? `order_${existing.order.id}` : copyOf ? null : 'order_new',
    stamp: existing?.order?.updatedAt || null,
    hasContent: (v) => Boolean(v.title.trim() || v.payerName.trim() || v.grossText.trim() || v.note.trim() || v.orderRef.trim() || v.link.trim() || v.rows.some((r) => r.name.trim())),
    value: { title, game, payerName, orderRef, dateTime, currency, grossText, feePct, feeMode, rateForm, lifecycle, rows, autoSplit, cutMode, cutValue, note, link, payoutDate, savePayer, moreOpen },
    restore: (d) => {
      if ('title' in d) setTitle(d.title);
      if ('game' in d) setGame(d.game);
      if ('payerName' in d) setPayerName(d.payerName);
      if ('orderRef' in d) setOrderRef(d.orderRef);
      if ('dateTime' in d) setDateTime(d.dateTime);
      if ('currency' in d) setCurrency(d.currency);
      if ('grossText' in d) setGrossText(d.grossText);
      if ('feePct' in d) setFeePct(d.feePct);
      if ('feeMode' in d) setFeeMode(d.feeMode);
      if ('rateForm' in d) setRateForm(d.rateForm);
      if ('lifecycle' in d) setLifecycle(d.lifecycle);
      if ('rows' in d) setRows(d.rows);
      if ('autoSplit' in d) setAutoSplit(d.autoSplit);
      if ('cutMode' in d) setCutMode(d.cutMode);
      if ('cutValue' in d) setCutValue(d.cutValue);
      if ('note' in d) setNote(d.note);
      if ('link' in d) setLink(d.link);
      if ('payoutDate' in d) setPayoutDate(d.payoutDate);
      if ('savePayer' in d) setSavePayer(d.savePayer);
      if ('moreOpen' in d) setMoreOpen(d.moreOpen);
    },
  });
  draftRestoredRef.current = draft.restored;

  const save = async () => {
    if (savingRef.current) return; // already saving
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
      const payerKind = isPlatformName(payerName) || partyByName(payerName)?.kind === 'platform' ? 'platform' : 'client';
      // unchanged payer: keep the stored one (this is what protects the upgrade's placeholder payer)
      const payerUnchanged = existing && payerName.trim() === loadedRef.current.payer;
      const payerId = payerUnchanged
        ? loadedRef.current.payerId
        : payerName.trim() ? (await ledger.addPerson(payerKind, payerName.trim())).id : null;
      if (payerId && savePayer && !partyById.get(payerId)?.settings?.saved) await ledger.setPartySettings(payerId, { saved: true });
      const shares = [];
      for (const r of shownRows) {
        if (!r.name.trim()) continue;
        // unchanged person: keep their id. Looking them up by name would turn "Unassigned" into a brand new
        // booster and re-open a debt that was already settled.
        const keep = r.partyId && r.name.trim() === r.origName;
        const partyId = keep ? r.partyId : (await ledger.addPerson('booster', r.name.trim())).id;
        if (r.saveNew) await ledger.setPartySettings(partyId, { saved: true });
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
          feeType: feeMode,
          feeRate: feeMode === 'percent' ? feePctNum : null,
          note: note.trim(),
          link: link.trim(),
          expectedPayoutAt: payoutDate ? new Date(payoutDate).toISOString() : null,
        },
        shares,
      });
      await draft.discard();
      if (!existing) incrementLocalWorkCount();
      // remember what this seller uses for the platform, so the next order starts from it
      if (payerId && payerKind === 'platform' && feeMode === 'percent' && Math.abs(feePctNum - suggestedFeePct(payerName, partyByName(payerName))) > 0.0001) {
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

  const showPriceErr = Boolean(priceErr) && (tried || badPrice);
  const form = (
    <>
      <FormSection title={f.t('lg.form.what', 'What')}>
        <Field label={f.t('lg.order.title', 'What is the order?')} error={tried ? titleErr : ''}>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={f.t('lg.order.titleHint', 'e.g. Mythic+ 15 timed, 4 runs')} hasError={tried && Boolean(titleErr)} className="text-sm" dir="auto" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <GameField label={f.t('lg.order.game', 'Game')} value={game} onChange={pickGame} categories={categories} onAdd={() => setCategoryOpen(true)} />
          <Field label={f.t('lg.order.from', 'Where is it from?')} as="div">
            <PartyCombobox
              value={payerName}
              onChange={choosePayer}
              people={payerChoices}
              onToggleSave={(p) => toggleSaved(p, () => setSavePayer((v) => !v))}
              pendingSave={savePayer}
              placeholder={f.t('lg.order.fromHint2', 'A platform or a client name')}
              ariaLabel={f.t('lg.order.from', 'Where is it from?')}
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
        <div className="grid grid-cols-[minmax(0,1fr)_6rem_7rem] gap-3">
          <Field label={f.t('lg.order.price', 'The order pays')} error={showPriceErr ? priceErr : ''}>
            <AmountInput value={grossText} onChange={setGrossText} placeholder="100" hasError={showPriceErr} className="text-sm font-medium" />
          </Field>
          <Field label={f.t('lg.currency', 'Currency')} as="div">
            <Select value={currency} onChange={setCurrency} options={currencyChoices.map((c) => ({ value: c, label: c }))} ariaLabel={f.t('lg.currency', 'Currency')} />
          </Field>
          <Field label={f.t('lg.order.feeLabel', 'Platform fee')} as="div">
            <div className="relative">
              <AmountInput value={feePct} onChange={setFeePct} showValue={false} className="pe-10" aria-label={f.t('lg.order.feeLabel', 'Platform fee')} />
              {/* one tap switches between a percentage and a fixed amount */}
              <button
                type="button"
                onClick={() => { setFeeMode((m) => (m === 'percent' ? 'flat' : 'percent')); setFeePct('0'); }}
                title={feeMode === 'percent' ? f.t('lg.order.feeToFlat', 'Use a fixed amount') : f.t('lg.order.feeToPct', 'Use a percentage')}
                className="absolute inset-y-1 end-1 rounded-md px-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                {feeMode === 'percent' ? '%' : currency}
              </button>
            </div>
          </Field>
        </div>
        {currency === 'GOLD' && (
          <GoldRateField value={rateForm} onChange={setRateForm} hint={goldHint} error={tried ? goldRateErr : ''} />
        )}
      </FormSection>

      <FormSection title={f.t('lg.form.when', 'Status and date')}>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
          <Field label={f.t('lg.order.status', 'Status')} as="div">
            <Select value={lifecycle} onChange={setLifecycle} options={LIFECYCLES.map((l) => ({ value: l, label: f.t(`lg.life.${l}`, LIFECYCLE_LABELS[l]), icon: <LifeDot lifecycle={l} /> }))} ariaLabel={f.t('lg.order.status', 'Status')} />
          </Field>
          <Field label={f.t('lg.date', 'Date')} as="div">
            <DateTimePicker value={dateTime} onChange={setDateTime} />
          </Field>
        </div>
      </FormSection>

      {/* Who does the work and what they get */}
      <FormSection
        title={f.t('lg.order.boosters', 'Who does the work?')}
        aside={(
          <Segmented
            value={autoSplit ? 'even' : 'custom'}
            onChange={(v) => {
              if (v === 'even') setAutoSplit(true);
              else if (autoSplit) { setRows(shownRows); setAutoSplit(false); }
            }}
            ariaLabel={f.t('lg.order.splitMode', 'How the shares are set')}
            options={[
              { value: 'even', label: f.t('lg.order.splitEven', 'Split evenly') },
              { value: 'custom', label: f.t('lg.order.splitCustom', 'Custom amounts') },
            ]}
          />
        )}
      >
        <ul className="space-y-2">
          {shownRows.map((r) => (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] gap-2 items-center">
              <PartyCombobox
                value={r.name}
                onChange={(v) => setRow(r.key, { name: v })}
                people={boosterChoices}
                onToggleSave={(p) => toggleSaved(p, () => setRow(r.key, { saveNew: !r.saveNew }))}
                pendingSave={r.saveNew}
                placeholder={f.t('lg.order.boosterName', 'Booster name')}
                ariaLabel={f.t('lg.order.boosterName', 'Booster name')}
              />
              <AmountInput value={r.amountText} onChange={(v) => editAmount(r.key, v)} placeholder="0" aria-label={f.t('lg.order.share', 'Their share')} showValue={false} />
              <button type="button" aria-label={f.t('lg.remove', 'Remove')} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blankRow()]))} className="rounded-md p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-900"><X className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setRows((rs) => [...rs, blankRow()])} className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
          <Plus className="w-3 h-3" />{f.t('lg.order.addBooster', 'Add a booster')}
        </button>

        {autoSplit && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="me-1 text-zinc-600 dark:text-zinc-400">{f.t('lg.order.myCut', 'My cut')}</span>
            {CUT_PRESETS.map((p) => (
              <Chip key={p} active={cutMode === 'percent' && cutNum === p} onClick={() => { setCutMode('percent'); setCutValue(String(p)); }}>{f.formatNumber(p)}%</Chip>
            ))}
            <Input dir="ltr" inputMode="decimal" value={cutValue} onChange={(e) => setCutValue(e.target.value)} className="!h-6 w-20 text-[11px] tabular-nums" aria-label={f.t('lg.order.myCut', 'My cut')} />
            <Chip onClick={() => setCutMode((m) => (m === 'percent' ? 'flat' : 'percent'))}>{cutMode === 'percent' ? '%' : currency}</Chip>
          </div>
        )}
        {!autoSplit && namedRows.length > 0 && !overpaid && receivable > 0 && (
          <p className="text-xs text-zinc-500">
            {f.t('lg.order.myCutNow', 'My cut: {amount} ({pct}%)', { amount: f.money(margin, currency), pct: f.formatNumber(Math.round((margin / receivable) * 1000) / 10) })}
          </p>
        )}
        {overpaid && <p className="text-xs text-rose-600 dark:text-rose-400">{f.t('lg.wf.overpaid', 'The shares add up to more than the order pays after fees.')}</p>}
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
        <Field label={f.t('lg.order.payout', 'Platform pays you on (optional)')} as="div">
          {payoutDate ? (
            <div className="flex items-center gap-2">
              <DateTimePicker value={payoutDate} onChange={setPayoutDate} />
              <button type="button" onClick={() => setPayoutDate('')} className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">{f.t('lg.clear', 'Clear')}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setPayoutDate(dateTime)} className="block text-xs text-zinc-700 dark:text-zinc-300 hover:underline">{f.t('lg.order.setPayout', 'Set a date')}</button>
          )}
        </Field>
        <RateLockFields value={rateForm} onChange={setRateForm} goldUnit={existing?.order?.rateUnit} showGold={false} />
      </Disclosure>
    </>
  );

  const summary = (
    <>
      <SummaryCard title={f.t('lg.form.summary', 'Summary')}>
        <SummaryRow label={f.t('lg.wf.price', 'Order pays')} value={<Money minor={grossMinor} currency={currency} />} />
        {feeMinor > 0 && <SummaryRow muted label={f.t('lg.wf.fee', 'Platform fee')} value={<>−<Money minor={feeMinor} currency={currency} /></>} />}
        <SummaryRow muted label={f.t('lg.wf.boosters', 'Boosters')} value={<>−<Money minor={shareTotal} currency={currency} /></>} />
        <SummaryDivider />
        <SummaryRow
          strong
          label={overpaid ? f.t('lg.wf.loss', 'You would lose') : f.t('lg.wf.margin', 'You keep')}
          value={<Money minor={Math.abs(margin)} currency={currency} />}
          tone={overpaid ? 'bad' : margin > 0 ? 'good' : undefined}
          aside={grossMinor > 0 && !overpaid ? `${f.formatNumber(Math.round((margin / grossMinor) * 100))}%` : null}
        />
      </SummaryCard>

      <Field label={f.t('lg.proofs', 'Screenshots')} as="div">
        <ProofField draft={proofs} />
      </Field>
    </>
  );

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="max-w-[800px]">
      <div
        className="flex flex-col max-h-[92vh] min-h-0"
        onPaste={proofs.onPaste}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(); }}
      >
        <DialogHeader onClose={onClose}>
          <DialogTitle>{existing ? f.t('lg.order.edit', 'Edit order') : f.t('lg.newOrder', 'New order')}</DialogTitle>
        </DialogHeader>
        <FormPanes form={form} summary={summary} />
        <FormFooter error={error} onCancel={onClose} onSave={save} busy={busy} saveLabel={existing ? f.t('common.save', 'Save') : f.t('lg.order.create', 'Add order')} draft={{ restored: draft.restored, dirty: draft.dirty, onClear: () => { draft.clear(loadForm); proofs.reset(); } }} />
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
