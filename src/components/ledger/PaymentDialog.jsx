import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { DateTimePicker, toLocalISOString } from '../ui/DateTimePicker';
import { CURRENCIES } from '../../lib/currencies';
import { parseAmountShorthand, toMinor, fromMinor, convertMinor, normalizeCurrency, bucketsByCurrency } from '../../lib/ledger/money';
import { withdrawalRule } from '../../lib/ledger/platforms';
import { partyBalance, shareTargetsFor, orderTargetsFor, payerKey } from '../../lib/ledger/engine';
import { NO_PAYER } from '../../lib/ledger/boosterSelectors';
import { previewSettleUp, previewReceivePayout, computeWithdrawal } from '../../lib/ledger/actions';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { Money } from './parts';

const MAX_PROOF_BYTES = 4 * 1024 * 1024;

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/**
 * mode 'pay'     : money going to a booster (Settle up). Applies to that person's oldest unpaid work.
 * mode 'receive' : money arriving from a platform or client. Applies to that payer's oldest uncollected orders.
 */
export function PaymentDialog({ open, onClose, mode = 'pay', partyId = null, advance = false, onDone }) {
  const ledger = useLedger();
  const { ctx, partyById, rates, displayCurrency } = ledger;
  const f = useLedgerFormat();
  const isPay = mode === 'pay';
  const asBooster = ledger.profileId === 'booster';

  const [pickedId, setPickedId] = useState(partyId);
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState(displayCurrency || 'TOMAN');
  const [dateTime, setDateTime] = useState(() => toLocalISOString());
  // withdrawal fee (receive mode): % and flat, and whether the amount typed already has the fee taken out
  const [feePctText, setFeePctText] = useState('');
  const [feeFlatText, setFeeFlatText] = useState('');
  const [takenOut, setTakenOut] = useState(true);
  const [remember, setRemember] = useState(true);
  // exchange rates for this one payment (start from the app's usual rates)
  const [rateOver, setRateOver] = useState({});
  const [note, setNote] = useState('');
  const [includeOpen, setIncludeOpen] = useState(true);
  const [asAdvance, setAsAdvance] = useState(false);
  const [excluded, setExcluded] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amountRef = useRef(null);

  // Fresh form every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setPickedId(partyId);
    setAmountText('');
    setFeePctText('');
    setFeeFlatText('');
    setTakenOut(true);
    setRemember(true);
    setRateOver({});
    setNote('');
    setExcluded([]);
    setProofs([]);
    setError('');
    setIncludeOpen(true);
    setAsAdvance(Boolean(advance));
    setDateTime(toLocalISOString());
    const party = partyId ? partyById.get(partyId) : null;
    setCurrency(normalizeCurrency(party?.defaultCurrency || displayCurrency || 'TOMAN'));
    const id = setTimeout(() => amountRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open, partyId, partyById, displayCurrency, advance]);

  // "" means money from nobody in particular (a job with no payer); null means nothing chosen yet
  const hasPick = pickedId !== null && pickedId !== undefined && (isPay ? pickedId !== '' : true);
  const party = !hasPick ? null : pickedId === '' ? NO_PAYER : partyById.get(pickedId) || null;

  // The rates actually used: the app's rates, unless this payment overrides them
  const effRates = useMemo(() => {
    const n = (v, base) => (Number(v) > 0 ? Number(v) : base);
    return { ...rates, usdRateTOMAN: n(rateOver.usd, rates?.usdRateTOMAN), goldRateTOMAN: n(rateOver.gold, rates?.goldRateTOMAN), eurRateUSD: n(rateOver.eur, rates?.eurRateUSD) };
  }, [rates, rateOver]);

  // Receiving from a platform: start from what it was last time for that platform
  useEffect(() => {
    if (!open || isPay || !party) return;
    const rule = withdrawalRule(party);
    setFeePctText(rule.pct ? String(rule.pct) : '');
    const flat = rule.flatMinor ? convertMinor(rule.flatMinor, rule.flatCurrency || currency, currency, effRates) : 0;
    setFeeFlatText(flat ? String(fromMinor(flat, currency)) : '');
    setTakenOut(rule.takenOut);
  }, [open, isPay, pickedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const candidates = useMemo(() => {
    if (!ctx) return [];
    if (isPay) {
      return [...partyById.values()].filter((p) => p.kind === 'booster' && !p.archived);
    }
    const keys = [...new Set(ctx.orders.filter((o) => o.kind !== 'expense').map(payerKey))];
    return keys.map((k) => (k === '' ? NO_PAYER : partyById.get(k))).filter(Boolean);
  }, [ctx, partyById, isPay]);

  const amountMajor = parseAmountShorthand(amountText);
  const amountMinor = amountMajor === null ? 0 : toMinor(amountMajor, currency);
  const feePct = Number(String(feePctText).replace(',', '.')) || 0;
  const flatMajor = feeFlatText.trim() ? parseAmountShorthand(feeFlatText) : 0;
  const flatMinor = flatMajor === null ? 0 : toMinor(flatMajor, currency);
  // what the platform released (the orders are credited with this), the fee, and what actually reached the account
  const wd = useMemo(() => (isPay ? { releasedMinor: amountMinor, feeMinor: 0, netMinor: amountMinor } : computeWithdrawal({ enteredMinor: amountMinor, pct: feePct, flatMinor, takenOut })), [isPay, amountMinor, feePct, flatMinor, takenOut]);
  const releasedMinor = wd.releasedMinor;
  const feeMinor = wd.feeMinor;

  const preview = useMemo(() => {
    if (!ctx || !hasPick || amountMinor <= 0 || (isPay && asAdvance)) return null;
    return isPay
      ? previewSettleUp(ctx, { partyId: pickedId, amountMinor, currency, rates: effRates, includeOpen, excludeIds: excluded })
      : previewReceivePayout(ctx, { payerId: pickedId, amountMinor: releasedMinor, currency, rates: effRates, excludeIds: excluded });
  }, [ctx, pickedId, amountMinor, releasedMinor, currency, effRates, includeOpen, excluded, isPay, asAdvance]);

  // Every target the money could go to, so unchecked rows stay visible
  const targets = useMemo(() => {
    if (!ctx || !hasPick) return [];
    return isPay ? shareTargetsFor(ctx, pickedId, { includeOpen }) : orderTargetsFor(ctx, pickedId);
  }, [ctx, pickedId, includeOpen, isPay]);

  const titleFor = (t) => {
    if (t.type === 'share') {
      const share = ctx.shares.find((s) => s.id === t.id);
      const order = share && ctx.orderById.get(share.orderId);
      return order?.title || order?.orderRef || '—';
    }
    const order = ctx.orderById.get(t.id);
    return order?.title || order?.orderRef || '—';
  };

  const dueChips = useMemo(() => {
    if (!ctx || !hasPick || !isPay) return [];
    const bal = partyBalance(ctx, pickedId);
    return Object.entries(bucketsByCurrency(bal.payable)).filter(([, n]) => n > 0).map(([cur, n]) => ({ cur, n }));
  }, [ctx, pickedId, isPay]);

  const applied = new Map((preview?.allocations || []).map((a) => [a.targetId, a]));
  // the rate fields only matter when the payment and what it covers are in different currencies
  const involved = useMemo(() => new Set([currency, ...targets.map((t) => normalizeCurrency(t.currency))]), [currency, targets]);
  const mixedCurrencies = involved.size > 1;

  const addFiles = async (files) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_PROOF_BYTES) {
        setError(f.t('lg.err.proofTooBig', 'That image is over 4 MB. Use a smaller screenshot.'));
        continue;
      }
      const data = await readAsDataUrl(file);
      setProofs((p) => [...p, { name: file.name || 'screenshot.png', data, size: file.size }]);
    }
  };

  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((x) => x.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const canSave = hasPick && amountMinor > 0 && !busy;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const base = { amountMinor, currency, dateTime: new Date(dateTime).toISOString(), note: note.trim() };
      const payment = isPay && asAdvance
        ? await ledger.addAdvance({ partyId: pickedId, rates: effRates, ...base })
        : isPay
        ? await ledger.settleUp({ partyId: pickedId, includeOpen, excludeIds: excluded, rates: effRates, ...base })
        : await ledger.receivePayout({ payerId: pickedId, feeMinor, excludeIds: excluded, rates: effRates, ...base, amountMinor: releasedMinor });
      // remember the withdrawal rule for next time (this platform only)
      if (!isPay && remember && party && (feePct > 0 || flatMinor > 0)) {
        await ledger.setPartySettings(party.id, { withdraw: { pct: feePct, flatMinor, flatCurrency: currency, takenOut } });
      }
      for (const p of proofs) await ledger.addProof({ ownerType: 'payment', ownerId: payment.id, ...p });
      onDone?.(payment);
      onClose();
    } catch (e) {
      setError(e?.message || f.t('lg.err.generic', 'That could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => setExcluded((ex) => (ex.includes(id) ? ex.filter((x) => x !== id) : [...ex, id]));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="max-w-lg">
      <div onPaste={onPaste} className="flex flex-col max-h-[90vh]">
        <DialogHeader onClose={onClose}>
          <DialogTitle>
            {isPay
              ? party ? f.t('lg.pay.titleTo', 'Pay {name}', { name: f.name(party) }) : f.t('lg.pay.title', 'Settle up')
              : party ? f.t('lg.recv.titleFrom', 'Payout from {name}', { name: f.name(party) }) : asBooster ? f.t('lg.ov.received', 'Payment received') : f.t('lg.recv.title', 'Receive payout')}
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          {(partyId === null || partyId === undefined) && (
            <label className="block">
              <span className="text-xs text-zinc-500">{isPay ? f.t('lg.pay.who', 'Who are you paying?') : f.t('lg.recv.who', 'Who paid you?')}</span>
              <Select
                value={pickedId === '' ? '__none__' : pickedId || ''}
                onChange={(v) => { setPickedId(v === '__none__' ? '' : v); setExcluded([]); }}
                options={candidates.map((p) => ({ value: p.id === '' ? '__none__' : p.id, label: f.name(p) }))}
                placeholder={f.t('lg.choose', 'Choose…')}
                ariaLabel={isPay ? f.t('lg.pay.who', 'Who are you paying?') : f.t('lg.recv.who', 'Who paid you?')}
                className="mt-1"
              />
            </label>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <label className="block">
              <span className="text-xs text-zinc-500">{f.t('lg.amount', 'Amount')}</span>
              <Input
                ref={amountRef}
                inputMode="decimal"
                dir="ltr"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSave) save(); }}
                placeholder={f.t('lg.amount.hint', 'e.g. 3m, 250k, 1,200,000')}
                hasError={amountText.trim() !== '' && amountMajor === null}
                className="mt-1 text-base tabular-nums"
              />
            </label>
            <Select
              value={currency}
              onChange={setCurrency}
              options={Object.keys(CURRENCIES).map((c) => ({ value: c, label: c }))}
              ariaLabel={f.t('lg.currency', 'Currency')}
              className="w-24"
            />
          </div>
          {amountText.trim() !== '' && amountMajor === null && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{f.t('lg.err.amount', 'Enter a number, like 3m or 250,000.')}</p>
          )}

          {isPay && dueChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dueChips.map(({ cur, n }) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => { setCurrency(cur); setAmountText(String(n / 10 ** (cur === 'USD' || cur === 'EUR' ? 2 : 0))); }}
                  className="h-6 px-2 rounded-md text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                >
                  {f.t('lg.pay.all', 'Pay everything due')} · <Money minor={n} currency={cur} compact />
                </button>
              ))}
            </div>
          )}

          <div>
            <span className="text-xs text-zinc-500">{f.t('lg.date', 'Date')}</span>
            <DateTimePicker value={dateTime} onChange={setDateTime} className="mt-1" />
          </div>

          {!isPay && (!asBooster || party?.kind === 'platform') && (
            <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 p-3 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{f.t('lg.recv.fee', 'Withdrawal fee (optional)')}</span>
                <span className="text-[11px] text-zinc-400">{f.t('lg.recv.feeHelp', 'Counted as an expense, so it lowers your profit.')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[11px] text-zinc-500">{f.t('lg.recv.feePct', 'Percent')}</span>
                  <Input dir="ltr" inputMode="decimal" value={feePctText} onChange={(e) => setFeePctText(e.target.value)} placeholder="0" aria-label={f.t('lg.recv.feePct', 'Percent')} className="mt-0.5 tabular-nums" />
                </label>
                <label className="block">
                  <span className="text-[11px] text-zinc-500">{f.t('lg.recv.feeFlat', 'Flat amount')} ({currency})</span>
                  <Input dir="ltr" inputMode="decimal" value={feeFlatText} onChange={(e) => setFeeFlatText(e.target.value)} placeholder="0" aria-label={f.t('lg.recv.feeFlat', 'Flat amount')} className="mt-0.5 tabular-nums" />
                </label>
              </div>
              {feeMinor > 0 && (
                <>
                  <label className="flex items-start gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" className="mt-0.5" checked={takenOut} onChange={(e) => setTakenOut(e.target.checked)} />
                    <span>{takenOut ? f.t('lg.recv.takenOut', 'The amount above is what reached my account (the fee is already taken out)') : f.t('lg.recv.onTop', 'The amount above is what the platform released (I pay the fee on top)')}</span>
                  </label>
                  <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300" aria-live="polite">
                    {f.t('lg.recv.summary', 'Platform releases {released} · fee {fee} · you receive {net}', { released: f.money(wd.releasedMinor, currency), fee: f.money(feeMinor, currency), net: f.money(wd.netMinor, currency) })}
                  </p>
                  {party && (
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer">
                      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                      {f.t('lg.recv.remember', 'Remember this fee for {name}', { name: f.name(party) })}
                    </label>
                  )}
                </>
              )}
            </div>
          )}

          {isPay && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={asAdvance} onChange={(e) => setAsAdvance(e.target.checked)} />
              {f.t('lg.pay.asAdvance', 'Record as an advance (do not apply to existing work)')}
            </label>
          )}

          {hasPick && !(isPay && asAdvance) && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {isPay ? f.t('lg.pay.covers', 'This payment covers') : f.t('lg.recv.covers', 'This payout covers')}
                </span>
                {isPay && (
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer">
                    <input type="checkbox" checked={includeOpen} onChange={(e) => setIncludeOpen(e.target.checked)} />
                    {f.t('lg.pay.includeOpen', 'Include work in progress')}
                  </label>
                )}
              </div>
              {targets.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">
                  {isPay
                    ? f.t('lg.pay.nothingDue', 'Nothing is due to this person. The payment will be saved as an advance.')
                    : f.t('lg.recv.nothingDue', 'No unpaid orders for this payer.')}
                </p>
              ) : (
                <ul className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 rounded-md border border-zinc-200/80 dark:border-zinc-800/80 max-h-48 overflow-y-auto">
                  {targets.map((t) => {
                    const a = applied.get(t.id);
                    const skipped = excluded.includes(t.id);
                    return (
                      <li key={t.id} className={cn('flex items-center gap-2 px-2.5 py-1.5 text-xs', skipped && 'opacity-50')}>
                        <input type="checkbox" checked={!skipped} onChange={() => toggle(t.id)} aria-label={titleFor(t)} />
                        <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">{titleFor(t)}</span>
                        <span className="text-zinc-400 tabular-nums"><Money minor={t.outstandingMinor} currency={t.currency} compact /></span>
                        <span className={cn('w-20 text-end tabular-nums', a ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600')}>
                          {a ? <Money minor={a.appliedMinor} currency={t.currency} compact /> : '—'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {preview && preview.remainderMinor > 0 && (
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">
                  {isPay
                    ? f.t('lg.pay.leftover', '{amount} is left over and will stay as advance credit.', { amount: f.money(preview.remainderMinor, currency) })
                    : f.t('lg.recv.leftover', '{amount} is not tied to any order yet.', { amount: f.money(preview.remainderMinor, currency) })}
                </p>
              )}
            </div>
          )}

          {mixedCurrencies && (
            <details className="group">
              <summary className="text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-800 dark:hover:text-zinc-200">
                {f.t('lg.rates.title', 'Exchange rates for this payment')}
                {Object.values(rateOver).some((v) => Number(v) > 0) && <span className="ms-1.5 text-amber-700 dark:text-amber-300">{f.t('lg.rates.custom', '(custom)')}</span>}
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {involved.has('USD') || involved.has('EUR') ? (
                  <label className="block">
                    <span className="text-[11px] text-zinc-500">{f.t('lg.rates.usd', '1 USD in Toman')}</span>
                    <Input dir="ltr" inputMode="decimal" value={rateOver.usd ?? ''} onChange={(e) => setRateOver((r) => ({ ...r, usd: e.target.value }))} placeholder={String(rates?.usdRateTOMAN ?? '')} className="mt-0.5 tabular-nums" />
                  </label>
                ) : null}
                {involved.has('GOLD') ? (
                  <label className="block">
                    <span className="text-[11px] text-zinc-500">{f.t('lg.rates.gold', '1,000 gold in Toman')}</span>
                    <Input dir="ltr" inputMode="decimal" value={rateOver.gold ?? ''} onChange={(e) => setRateOver((r) => ({ ...r, gold: e.target.value }))} placeholder={String(rates?.goldRateTOMAN ?? '')} className="mt-0.5 tabular-nums" />
                  </label>
                ) : null}
                {involved.has('EUR') ? (
                  <label className="block">
                    <span className="text-[11px] text-zinc-500">{f.t('lg.rates.eur', '1 EUR in USD')}</span>
                    <Input dir="ltr" inputMode="decimal" value={rateOver.eur ?? ''} onChange={(e) => setRateOver((r) => ({ ...r, eur: e.target.value }))} placeholder={String(rates?.eurRateUSD ?? '')} className="mt-0.5 tabular-nums" />
                  </label>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">{f.t('lg.rates.help', 'Used to convert between currencies when this payment is applied. Your usual rates are filled in; type a number to use a different one just for this payment.')}</p>
            </details>
          )}

          <details className="group">
            <summary className="text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-800 dark:hover:text-zinc-200">
              {f.t('lg.more', 'Note and proof')}
            </summary>
            <div className="mt-2 space-y-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={f.t('lg.note', 'Note (e.g. bank transfer, reference)')} />
              <div className="flex flex-wrap items-center gap-2">
                {proofs.map((p, i) => (
                  <span key={i} className="relative">
                    <img src={p.data} alt={p.name} className="h-12 w-12 rounded-md object-cover border border-zinc-200 dark:border-zinc-800" />
                    <button
                      type="button"
                      aria-label={f.t('lg.removeProof', 'Remove screenshot')}
                      onClick={() => setProofs((x) => x.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -end-1.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 p-0.5"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <label className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  <ImagePlus className="w-3.5 h-3.5" />
                  {f.t('lg.addProof', 'Paste or add a screenshot')}
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles([...e.target.files])} />
                </label>
              </div>
            </div>
          </details>

          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{f.t('common.cancel', 'Cancel')}</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>
            {isPay ? f.t('lg.pay.cta', 'Record payment') : f.t('lg.recv.cta', 'Record payout')}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
