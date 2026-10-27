import React from 'react';
import { formatMoneyParts } from '../../lib/currencies';
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

export default MoneyDisplay;
