import React from 'react';
import { Input } from '../ui/Input';
import { parseAmountShorthand } from '../../lib/ledger/money';
import { toPersianDigits } from '../../lib/persianCalendar';
import { cn } from '../../lib/utils';
import { useLedgerFormat } from './format';

/** A number as amount text: grouped thousands, in Persian digits and separators in Farsi. */
export function formatAmountText(n, isFa) {
  if (n === null || !Number.isFinite(n)) return '';
  const en = n.toLocaleString('en-US', { maximumFractionDigits: 8 });
  return isFa ? toPersianDigits(en).replace(/,/g, '٬').replace(/\./g, '٫') : en;
}

/**
 * An amount field. Takes English or Persian digits, any thousands separator (, ، ٬ or spaces), shorthand (3m, 250k,
 * ۳ میلیون) and a stray unit (تومان, $). On leaving the field the number is rewritten with grouped thousands in the app's
 * language, so a long Toman amount is readable at a glance; shorthand stays as typed and shows its value underneath.
 */
export function AmountInput({ value, onChange, className, hasError, showValue = true, ...props }) {
  const f = useLedgerFormat();
  const parsed = parseAmountShorthand(value);
  const plain = /^[\s\d۰-۹٠-٩,،٬.٫]*$/.test(value || '');
  const blur = (e) => {
    if (parsed !== null && plain) onChange(formatAmountText(parsed, f.isFa));
    props.onBlur?.(e);
  };
  return (
    <div className="min-w-0">
      <Input
        {...props}
        dir="ltr"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={blur}
        hasError={hasError || ((value || '').trim() !== '' && parsed === null)}
        className={cn('tabular-nums', className)}
      />
      {showValue && parsed !== null && !plain && (
        <span className="mt-1 block text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400" dir="ltr">= {formatAmountText(parsed, f.isFa)}</span>
      )}
    </div>
  );
}
