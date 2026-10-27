import React from 'react';
import { Input } from '../ui/Input';
import { AmountInput } from './AmountInput';
import { useLedgerFormat } from './format';

/**
 * The exchange rates saved with one job. They start as today's rates; change them when logging an older job.
 * `value` is { gold, usd, eur } as text. Totals value the job with these rates, never with later ones.
 */
export function RateLockFields({ value, onChange, goldUnit = '1k', showGold = true }) {
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
      {/* the gold rate only matters for games that trade in gold (a category setting) or a job priced in gold */}
      <div className={showGold ? 'mt-1 grid grid-cols-3 gap-2' : 'mt-1 grid grid-cols-2 gap-2'}>
        {showGold && field('gold', goldUnit === '1' ? f.t('lg.rates.gold1', 'Gold (Toman per 1)') : f.t('lg.rates.gold1k', 'Gold (Toman per 1k)'))}
        {field('usd', f.t('lg.rates.usd', 'USD (Toman per $1)'))}
        {field('eur', f.t('lg.rates.eur', 'EUR (USD per €1)'))}
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">{f.t('lg.rates.hint', 'These stay with the job. Later rate changes will not change what it earned. Edit them if you are logging an older job.')}</p>
    </div>
  );
}

/**
 * The gold rate of a job priced in gold, shown next to its amount. Gold of each game is its own currency, so the rate
 * is asked for on the job (prefilled from the last one used for that game) instead of being one setting for everything.
 * `value` is the form's rate text { gold, goldUnit }; the unit is per 1 gold or per 1,000.
 */
export function GoldRateField({ value, onChange, hint, error }) {
  const f = useLedgerFormat();
  const perOne = value.goldUnit === '1';
  return (
    <div className="min-w-0 max-w-[18rem]">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
        {perOne ? f.t('lg.gold.rate1', 'Gold rate (Toman per 1 gold)') : f.t('lg.gold.rate1k', 'Gold rate (Toman per 1,000 gold)')}
      </span>
      <div className="relative">
        <AmountInput
          value={value.gold}
          onChange={(gold) => onChange({ ...value, gold })}
          hasError={Boolean(error)}
          showValue={false}
          className="pe-16"
          aria-label={f.t('lg.gold.rate', 'Gold rate')}
        />
        <button
          type="button"
          onClick={() => onChange({ ...value, goldUnit: perOne ? '1k' : '1' })}
          title={f.t('lg.gold.unitHelp', 'Switch between a price per 1 gold and per 1,000 gold')}
          className="absolute inset-y-1 end-1 rounded-md px-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
        >
          {perOne ? f.t('lg.gold.per1', 'per 1') : f.t('lg.gold.per1k', 'per 1k')}
        </button>
      </div>
      {error
        ? <span role="alert" className="mt-1 block text-[11px] text-rose-600 dark:text-rose-400">{error}</span>
        : hint ? <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span> : null}
    </div>
  );
}
