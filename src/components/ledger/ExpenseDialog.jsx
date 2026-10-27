import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { DateTimePicker, toLocalISOString } from '../ui/DateTimePicker';
import { CURRENCIES } from '../../lib/currencies';
import { parseAmountShorthand, toMinor, normalizeCurrency } from '../../lib/ledger/money';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { AmountInput } from './AmountInput';
import { useFormDraft } from './useFormDraft';
import { DraftNotice } from './FormLayout';

const PRESETS = [
  ['lg.exp.repairs', 'Repairs'],
  ['lg.exp.consumables', 'Consumables'],
  ['lg.exp.gold', 'Gold bought'],
  ['lg.exp.fees', 'Fees'],
  ['lg.exp.software', 'Software'],
];

/** Money that went out and is not tied to a person or a job: repairs, consumables, fees, tools. It lowers what you keep. */
export function ExpenseDialog({ open, onClose }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { displayCurrency, ctx } = ledger;
  const [what, setWhat] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState(displayCurrency || 'TOMAN');
  const [dateTime, setDateTime] = useState(() => toLocalISOString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const whatRef = useRef(null);

  // the form as a fresh dialog opens it (also what Clear goes back to)
  const loadForm = () => {
    setWhat('');
    setAmountText('');
    setError('');
    setDateTime(toLocalISOString());
    // the currency of the last expense, else the one amounts are shown in
    const last = ctx ? [...ctx.effectivePayments].filter((p) => p.kind === 'expense').sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime))[0] : null;
    setCurrency(normalizeCurrency(last?.currency || displayCurrency || 'TOMAN'));
  };
  useEffect(() => {
    if (!open) return undefined;
    loadForm();
    const id = setTimeout(() => whatRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const draft = useFormDraft({
    open,
    key: 'expense_new',
    hasContent: (v) => Boolean(v.what.trim() || v.amountText.trim()),
    value: { what, amountText, currency, dateTime },
    restore: (d) => {
      if (typeof d.what === 'string') setWhat(d.what);
      if (typeof d.amountText === 'string') setAmountText(d.amountText);
      if (d.currency) setCurrency(d.currency);
      if (d.dateTime) setDateTime(d.dateTime);
    },
  });

  const major = parseAmountShorthand(amountText);
  const amountMinor = major === null ? 0 : toMinor(major, currency);
  const canSave = amountMinor > 0 && !busy;

  const save = async () => {
    if (savingRef.current || amountMinor <= 0) return;
    savingRef.current = true;
    setBusy(true);
    setError('');
    try {
      await ledger.addExpense({ amountMinor, currency, dateTime: new Date(dateTime).toISOString(), note: what.trim() });
      await draft.discard();
      onClose();
    } catch (e) {
      setError(e?.message || f.t('lg.err.generic', 'That could not be saved.'));
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col max-h-[90vh]" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(); }}>
        <DialogHeader onClose={onClose}>
          <DialogTitle>{f.t('lg.exp.title', 'Add an expense')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <label className="block">
            <span className="text-xs text-zinc-500">{f.t('lg.exp.what', 'What was it for?')}</span>
            <Input ref={whatRef} value={what} onChange={(e) => setWhat(e.target.value)} placeholder={f.t('lg.exp.whatHint', 'e.g. repair bill')} className="mt-1" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(([key, en]) => (
              <button key={key} type="button" onClick={() => setWhat(f.t(key, en))} className="h-6 px-2 rounded-md text-[11px] bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">{f.t(key, en)}</button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <label className="block">
              <span className="text-xs text-zinc-500">{f.t('lg.amount', 'Amount')}</span>
              <div className="mt-1"><AmountInput value={amountText} onChange={setAmountText} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} placeholder={f.t('lg.amount.hint', 'e.g. 3m, 250k, 1,200,000')} className="text-base" /></div>
            </label>
            <Select value={currency} onChange={setCurrency} options={Object.keys(CURRENCIES).map((c) => ({ value: c, label: c }))} ariaLabel={f.t('lg.currency', 'Currency')} className="w-24" />
          </div>
          <div>
            <span className="text-xs text-zinc-500">{f.t('lg.date', 'Date')}</span>
            <DateTimePicker value={dateTime} onChange={setDateTime} className="mt-1" />
          </div>
          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <DraftNotice draft={draft} onClear={() => draft.clear(loadForm)} />
          <Button variant="ghost" onClick={onClose}>{f.t('common.cancel', 'Cancel')}</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>{f.t('lg.exp.cta', 'Add expense')}</Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
