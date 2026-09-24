import React from 'react';
import { formatMoneyParts, convertCurrency } from '../../lib/currencies';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import { TomanIcon } from './Icons';

export function MoneyDisplay({
  amount,
  currency = 'TOMAN',
  compact = false,
  className = '',
  unitClassName = '',
  iconClassName = '',
  iconSize,
  prefix = '',
}) {
  const { language } = useLanguage();
  const isGold = currency === 'GOLD' || currency === 'WOW_GOLD';
  const isUSD = currency === 'USD';
  const isEUR = currency === 'EUR';
  const isFiatSymbol = isUSD || isEUR;
  const usePersianDigits = language === 'fa' && !isGold && !isFiatSymbol;
  const { amount: formattedNum, magnitude, unit } = formatMoneyParts(amount, currency, compact, usePersianDigits);

  return (
    <span
      dir={isGold || isFiatSymbol ? 'ltr' : undefined}
      className={cn(
        'inline-flex items-center gap-1 tracking-tight',
        (isGold || isFiatSymbol) && '[direction:ltr]',
        className
      )}
    >
      {prefix && <span className="text-zinc-500 font-normal mr-0.5 inline-flex items-center leading-none">{prefix}</span>}
      {isFiatSymbol && unit && (
        <span className={cn('text-[0.9em] font-medium text-zinc-500 dark:text-zinc-400 select-none leading-none mr-0.5', unitClassName)}>
          {unit}
        </span>
      )}
      <span dir="ltr" className="inline-flex items-center [direction:ltr]">
        <span className="leading-none">{formattedNum}</span>
        {magnitude && (
          <span className="text-[0.72em] text-zinc-500 font-medium select-none ml-0.5 leading-none">
            {magnitude}
          </span>
        )}
      </span>
      {unit && !isFiatSymbol && (
        isGold ? (
          <span
            className={cn(
              'text-[0.8em] font-medium text-amber-400 select-none leading-none',
              unitClassName
            )}
          >
            {unit}
          </span>
        ) : (
          <span
            className={cn(
              'inline-flex items-center justify-center text-zinc-500 dark:text-zinc-400 select-none shrink-0 leading-none',
              unitClassName
            )}
            title="تومان"
          >
            <TomanIcon
              size={iconSize}
              className={cn(
                iconSize ? '' : 'w-[24px] h-[24px] min-w-[24px] min-h-[24px]',
                iconClassName
              )}
            />
          </span>
        )
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
        unitClassName={to === 'GOLD' ? 'text-[0.75em] font-medium text-amber-400' : 'text-[0.7em] text-zinc-500'}
      />
      {showRateLabel && (
        <span
          className="text-[9px] text-zinc-500 dark:text-zinc-400 tracking-tight inline-flex items-center"
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
          {isPerOneGold ? (
            <span className="inline-flex items-center gap-0.5 ml-0.5">
              <TomanIcon className="w-[24px] h-[24px] min-w-[24px] min-h-[24px] shrink-0" />/G
            </span>
          ) : (
            <TomanIcon className="w-[24px] h-[24px] min-w-[24px] min-h-[24px] inline-block shrink-0 ml-0.5" />
          )}
        </span>
      )}
    </div>
  );
}

export default MoneyDisplay;
