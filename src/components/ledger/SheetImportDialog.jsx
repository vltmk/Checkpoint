import React, { useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { CURRENCIES } from '../../lib/currencies';
import { buildImport, detectDateOrder, IMPORT_FIELDS, parseDelimited, suggestMapping } from '../../lib/ledger/sheetImport';
import { cn } from '../../lib/utils';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { Money } from './parts';

const MAX_BYTES = 2 * 1024 * 1024;
const PREVIEW_ROWS = 5;
// fields people almost always have; the rest sit behind "more columns"
const MAIN_FIELDS = ['date', 'title', 'platform', 'price', 'booster', 'boosterAmount'];

const FIELD_LABELS = {
  date: ['Date', 'تاریخ'], title: ['Order', 'سفارش'], orderRef: ['Order number', 'شماره سفارش'], platform: ['Platform or client', 'پلتفرم یا مشتری'],
  price: ['Price', 'مبلغ'], currency: ['Currency', 'ارز'], fee: ['Platform fee', 'کارمزد پلتفرم'], booster: ['Booster', 'بوستر'],
  boosterAmount: ['Booster pay', 'سهم بوستر'], status: ['Status', 'وضعیت'], collected: ['Client paid (yes/no)', 'پرداخت مشتری (بله/خیر)'],
  boosterPaid: ['Booster paid (yes/no)', 'پرداخت به بوستر (بله/خیر)'], game: ['Game', 'بازی'],
};

/**
 * Bring an existing spreadsheet in: paste cells straight from Google Sheets (or pick a CSV), check the column
 * matching, see what will be created, then import. Importing the same sheet again adds nothing new.
 */
export function SheetImportDialog({ open, onClose }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const [text, setText] = useState('');
  const [mapping, setMapping] = useState({});
  const [currency, setCurrency] = useState('USD');
  const [dateOrder, setDateOrder] = useState('mdy');
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const parsed = useMemo(() => (text.trim() ? parseDelimited(text) : null), [text]);
  const headers = parsed?.rows[0] || [];
  const dataRows = useMemo(() => (parsed ? parsed.rows.slice(1) : []), [parsed]);

  const load = (raw) => {
    setText(raw);
    setDone(null);
    setError('');
    const p = parseDelimited(raw);
    if (p.rows.length > 1) {
      const m = suggestMapping(p.rows[0]);
      setMapping(m);
      setDateOrder(detectDateOrder(p.rows.slice(1).map((r) => r[m.date ?? -1])));
      setShowMore(false);
    }
  };

  const onFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(f.t('lg.import.tooBig', 'That file is over 2 MB. Export only the rows you need.'));
      return;
    }
    load(await file.text());
  };

  const result = useMemo(() => {
    if (!parsed || dataRows.length === 0) return null;
    return buildImport(dataRows, mapping, { defaultCurrency: currency, dateOrder });
  }, [parsed, dataRows, mapping, currency, dateOrder]);

  const reset = () => {
    setText('');
    setMapping({});
    setDone(null);
    setError('');
  };

  const doImport = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await ledger.importRecords(result.records);
      setDone({ orders: result.stats.orders, skipped: res?.skipped || 0 });
    } catch (e) {
      setError(e?.message || f.t('lg.err.generic', 'That could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const label = (field) => FIELD_LABELS[field][f.isFa ? 1 : 0];
  const colOptions = [{ value: '', label: f.t('lg.import.none', '— not in my sheet —') }, ...headers.map((h, i) => ({ value: String(i), label: h || `#${i + 1}` }))];
  const fields = showMore ? IMPORT_FIELDS : MAIN_FIELDS;
  const warnCount = result?.warnings.length || 0;
  const canImport = Boolean(result && result.stats.orders > 0) && !busy && !done;

  return (
    <Dialog open={open} onClose={() => { onClose(); setTimeout(reset, 200); }} maxWidth="max-w-2xl">
      <div className="flex flex-col max-h-[92vh]">
        <DialogHeader onClose={() => { onClose(); setTimeout(reset, 200); }}>
          <DialogTitle>{f.t('lg.import.title', 'Import from a spreadsheet')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {done ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{f.t('lg.import.done', '{n} orders imported.', { n: f.formatNumber(done.orders) })}</p>
              <p className="mt-1 text-xs text-zinc-500">{f.t('lg.import.doneHelp', 'Run the same import again any time: orders that are already here are not added twice.')}</p>
              {done.skipped > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{f.t('lg.import.skipped', '{n} rows could not be used and were left out.', { n: f.formatNumber(done.skipped) })}</p>}
            </div>
          ) : !parsed || dataRows.length === 0 ? (
            <>
              <p className="text-xs text-zinc-500">{f.t('lg.import.help', 'In Google Sheets, select your table (with the header row), copy it, and paste it below. One row per order works best. Rows that share an order number become one order with several boosters.')}</p>
              <textarea
                value={text}
                onChange={(e) => load(e.target.value)}
                placeholder={f.t('lg.import.paste', 'Paste your table here')}
                aria-label={f.t('lg.import.paste', 'Paste your table here')}
                dir="auto"
                className="w-full h-40 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/80 dark:bg-zinc-900/80 p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
              <label className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900">
                <FileUp className="w-3.5 h-3.5" />
                {f.t('lg.import.file', 'Or choose a CSV file')}
                <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
              {text.trim() && dataRows.length === 0 && <p className="text-xs text-rose-600 dark:text-rose-400">{f.t('lg.import.noRows', 'That has a header row but no data rows.')}</p>}
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-500">{f.t('lg.import.rows', '{n} rows found. Check that each field matches the right column.', { n: f.formatNumber(dataRows.length) })}</p>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
                {fields.map((field) => (
                  <label key={field} className="block">
                    <span className="text-xs text-zinc-500">{label(field)}</span>
                    <Select
                      value={mapping[field] === null || mapping[field] === undefined ? '' : String(mapping[field])}
                      onChange={(v) => setMapping((m) => ({ ...m, [field]: v === '' ? null : Number(v) }))}
                      options={colOptions}
                      ariaLabel={label(field)}
                      className="mt-1"
                    />
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => setShowMore((v) => !v)} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                {showMore ? f.t('lg.import.fewer', 'Fewer columns') : f.t('lg.import.more', 'More columns (fee, status, paid…)')}
              </button>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
                <label className="block">
                  <span className="text-xs text-zinc-500">{f.t('lg.import.currency', 'Currency when a row does not say')}</span>
                  <Select value={currency} onChange={setCurrency} options={Object.keys(CURRENCIES).map((c) => ({ value: c, label: c }))} ariaLabel={f.t('lg.currency', 'Currency')} className="mt-1" />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500">{f.t('lg.import.dateOrder', 'Dates like 10/05/2026 mean')}</span>
                  <Select
                    value={dateOrder}
                    onChange={setDateOrder}
                    options={[{ value: 'mdy', label: f.t('lg.import.mdy', 'October 5 (month first)') }, { value: 'dmy', label: f.t('lg.import.dmy', '10 May (day first)') }]}
                    ariaLabel={f.t('lg.import.dateOrder', 'Dates like 10/05/2026 mean')}
                    className="mt-1"
                  />
                </label>
              </div>

              {result && (
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{f.t('lg.import.preview', 'This will add')}</span>
                    <span className="text-xs text-zinc-500">
                      {f.t('lg.import.counts', '{orders} orders · {people} boosters', { orders: f.formatNumber(result.stats.orders), people: f.formatNumber(result.records.parties.filter((p) => p.kind === 'booster').length) })}
                    </span>
                  </div>
                  <ul className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 rounded-md border border-zinc-200/80 dark:border-zinc-800/80">
                    {result.records.orders.slice(0, PREVIEW_ROWS).map((o) => {
                      const sh = result.records.shares.filter((s) => s.orderId === o.id);
                      return (
                        <li key={o.id} className="flex items-center gap-3 px-2.5 py-1.5 text-xs">
                          <span className="flex-1 truncate text-zinc-800 dark:text-zinc-200">{o.title || o.orderRef}</span>
                          <span className="text-zinc-400 truncate max-w-[6rem]">{sh.map((s) => result.records.parties.find((p) => p.id === s.partyId)?.name).join(', ')}</span>
                          <Money minor={o.grossMinor} currency={o.currency} compact />
                        </li>
                      );
                    })}
                  </ul>
                  {result.stats.orders > PREVIEW_ROWS && <p className="mt-1 text-[11px] text-zinc-400">{f.t('lg.more.n', '+{n} more', { n: f.formatNumber(result.stats.orders - PREVIEW_ROWS) })}</p>}
                  {(warnCount > 0 || result.stats.skipped > 0) && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      {f.t('lg.import.warn', '{n} rows have a problem (a date, price or amount could not be read). They are imported as far as possible; check them afterwards.', { n: f.formatNumber(new Set(result.warnings.filter((w) => w.row).map((w) => w.row)).size + result.stats.skipped) })}
                    </p>
                  )}
                </div>
              )}
              <button type="button" onClick={reset} className={cn('text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100')}>{f.t('lg.import.startOver', 'Paste something else')}</button>
            </>
          )}
          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </DialogContent>
        <DialogFooter>
          {done ? (
            <Button variant="primary" onClick={() => { onClose(); setTimeout(reset, 200); }}>{f.t('common.done', 'Done')}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { onClose(); setTimeout(reset, 200); }}>{f.t('common.cancel', 'Cancel')}</Button>
              <Button variant="primary" disabled={!canImport} onClick={doImport}>
                {f.t('lg.import.cta', 'Import {n} orders', { n: f.formatNumber(result?.stats.orders || 0) })}
              </Button>
            </>
          )}
        </DialogFooter>
      </div>
    </Dialog>
  );
}
