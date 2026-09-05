import React from 'react';
import { formatMoneyParts, convertCurrency } from '../../lib/currencies';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';

export function MoneyDisplay({
  amount,
  currency = 'TOMAN',
  compact = false,
  className = '',
  unitClassName = '',
  prefix = '',
}) {
  const { language } = useLanguage();
  const isGold = currency === 'GOLD' || currency === 'WOW_GOLD';
  const usePersianDigits = language === 'fa' && !isGold;
  const { amount: formattedNum, magnitude, unit } = formatMoneyParts(amount, currency, compact, usePersianDigits);

  return (
    <span
      dir={isGold ? 'ltr' : undefined}
      className={cn(
        'inline-flex items-baseline gap-1 tracking-tight',
        isGold && '[direction:ltr]',
        className
      )}
    >
      {prefix && <span className="text-zinc-500 font-normal mr-0.5">{prefix}</span>}
      <span dir="ltr" className="inline-flex items-baseline [direction:ltr]">
        <span>{formattedNum}</span>
        {magnitude && (
          <span className="text-[0.72em] text-zinc-500 font-medium select-none ml-0.5">
            {magnitude}
          </span>
        )}
      </span>
      {unit && (
        <span
          className={cn(
            isGold
              ? 'text-[0.8em] font-bold text-amber-400 select-none'
              : 'text-[0.72em] font-farsi font-medium text-zinc-400 opacity-85 select-none',
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
  isPerOneGold = false,
  showRateLabel = false,
  className = '',
}) {
  const from = fromCurrency === 'WOW_GOLD' ? 'GOLD' : (fromCurrency === 'USD' ? 'TOMAN' : fromCurrency);
  const to = targetCurrency === 'WOW_GOLD' ? 'GOLD' : (targetCurrency === 'USD' ? 'TOMAN' : targetCurrency);

  if (from === to) return null;

  const defaultRate = isPerOneGold ? 7000 : (Number(rates?.goldRateTOMAN) || 3200);
  const effectiveRate = Number(customRate) > 0 ? Number(customRate) : defaultRate;
  const converted = convertCurrency(amount, from, to, rates, effectiveRate, isPerOneGold);

  return (
    <div className={cn('text-[10px] text-zinc-500 flex items-center justify-end gap-1', className)}>
      <MoneyDisplay
        amount={converted}
        currency={to}
        prefix="≈"
        unitClassName={to === 'GOLD' ? 'text-[0.75em] font-bold text-amber-400' : 'text-[0.7em] text-zinc-500'}
      />
      {showRateLabel && (
        <span
          className="text-[9px] text-zinc-500 dark:text-zinc-400 tracking-tight inline-flex items-baseline"
          title={
            isPerOneGold
              ? `Locked conversion rate: ${effectiveRate.toLocaleString()} Toman / 1 Gold`
              : `Locked conversion rate: ${effectiveRate.toLocaleString()} Toman / 1,000 Gold`
          }
        >
          @{effectiveRate >= 1000 ? (
            <>
              {(effectiveRate / 1000).toFixed(1)}
              <span className="text-[0.8em] text-zinc-500 font-medium">k</span>
            </>
          ) : (
            effectiveRate
          )}
          {isPerOneGold ? 'T/G' : 'T'}
        </span>
      )}
    </div>
  );
}

export default MoneyDisplay;
