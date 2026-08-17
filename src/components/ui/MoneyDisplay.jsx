import React from 'react';
import { formatMoneyParts, convertCurrency } from '../../lib/currencies';
import { cn } from '../../lib/utils';

export function MoneyDisplay({
  amount,
  currency = 'TOMAN',
  compact = false,
  className = '',
  unitClassName = '',
  prefix = '',
}) {
  const { amount: formattedNum, unit } = formatMoneyParts(amount, currency, compact);

  return (
    <span className={cn('inline-flex items-baseline gap-1 font-mono tracking-tight', className)}>
      {prefix && <span className="text-zinc-500 font-normal mr-0.5">{prefix}</span>}
      <span>{formattedNum}</span>
      {unit && (
        <span
          className={cn(
            unit === 'تومان'
              ? 'text-[0.72em] font-sans font-medium text-zinc-400 opacity-85 select-none'
              : 'text-[0.8em] font-mono font-medium text-zinc-400 select-none',
            unitClassName
          )}
        >
          {unit}
        </span>
      )}
    </span>
  );
}

export function ConvertedSecondaryDisplay({
  amount,
  fromCurrency,
  targetCurrency,
  rates = {},
  customRate = null,
  showRateLabel = false,
  className = '',
}) {
  const from = fromCurrency === 'WOW_GOLD' ? 'GOLD' : (fromCurrency === 'USD' ? 'TOMAN' : fromCurrency);
  const to = targetCurrency === 'WOW_GOLD' ? 'GOLD' : (targetCurrency === 'USD' ? 'TOMAN' : targetCurrency);

  if (from === to) return null;

  const effectiveRate = Number(customRate) > 0 ? Number(customRate) : (Number(rates?.goldRateTOMAN) || 3200);
  const converted = convertCurrency(amount, from, to, rates, effectiveRate);

  return (
    <div className={cn('text-[10px] text-zinc-500 font-mono flex items-center justify-end gap-1', className)}>
      <MoneyDisplay
        amount={converted}
        currency={to}
        prefix="≈"
        unitClassName="text-[0.7em] text-zinc-500"
      />
      {showRateLabel && (
        <span
          className="text-[9px] text-zinc-600 font-mono tracking-tight"
          title={`Locked conversion rate: ${effectiveRate.toLocaleString()} Toman / 1,000 Gold`}
        >
          @{effectiveRate >= 1000 ? `${(effectiveRate / 1000).toFixed(1)}k` : effectiveRate}T
        </span>
      )}
    </div>
  );
}

export default MoneyDisplay;
