import React from 'react';
import { Input } from '../ui/Input';
import { useLedgerFormat } from './format';

/**
 * The exchange rates saved with one job. They start as today's rates; change them when logging an older job.
 * `value` is { gold, usd, eur } as text. Totals value the job with these rates, never with later ones.
 */
export function RateLockFields({ value, onChange, goldUnit = '1k' }) {
  const f = useLedgerFormat();
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  const field = (key, label) => (
    <label className="block">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <Input dir="ltr" inputMode="decimal" value={value[key]} onChange={set(key)} aria-label={label} className="mt-0.5 tabular-nums" />
    </label>
  );
  return (
    <div>
      <div className="text-xs text-zinc-500">{f.t('lg.rates.title', 'Exchange rates saved with this job')}</div>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {field('gold', goldUnit === '1' ? f.t('lg.rates.gold1', 'Gold (Toman per 1)') : f.t('lg.rates.gold1k', 'Gold (Toman per 1k)'))}
        {field('usd', f.t('lg.rates.usd', 'USD (Toman per $1)'))}
        {field('eur', f.t('lg.rates.eur', 'EUR (USD per €1)'))}
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">{f.t('lg.rates.hint', 'These stay with the job. Later rate changes will not change what it earned. Edit them if you are logging an older job.')}</p>
    </div>
  );
}
