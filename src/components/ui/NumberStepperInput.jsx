import React, { useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { sanitizePriceInput } from '../../lib/currencies';

export function NumberStepperInput({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  placeholder = '0',
  className,
  inputClassName,
  currency = 'TOMAN',
  disabled = false,
  required = false,
  prefixIcon = null,
  ...props
}) {
  const { isRtl } = useLanguage();
  const holdTimeoutRef = useRef(null);
  const holdIntervalRef = useRef(null);

  // Compute smart step if not explicitly provided or default
  const effectiveStep =
    step !== 1
      ? step
      : currency === 'GOLD'
      ? 1000
      : currency === 'TOMAN'
      ? 50000
      : 1;

  const handleStep = useCallback(
    (delta) => {
      const currentNum = parseFloat(value) || 0;
      let nextNum = currentNum + delta;

      if (min !== undefined && nextNum < min) nextNum = min;
      if (max !== undefined && nextNum > max) nextNum = max;

      // Handle integer vs float cleanly
      const isFloat = String(effectiveStep).includes('.');
      const formatted = isFloat ? nextNum.toFixed(2) : String(Math.round(nextNum));

      onChange?.({ target: { value: formatted } });
    },
    [value, effectiveStep, min, max, onChange]
  );

  const stopHold = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
  };

  const startHold = (delta) => {
    handleStep(delta);
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        handleStep(delta);
      }, 75);
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleStep(effectiveStep);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleStep(-effectiveStep);
    }
  };

  return (
    <div
      className={cn(
        'relative flex items-center w-full h-9 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-150 focus-within:border-zinc-400 dark:focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-400 dark:focus-within:ring-zinc-500',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {prefixIcon && (
        <div className="flex items-center shrink-0 pl-2.5 rtl:pl-0 rtl:pr-2.5 text-zinc-400 dark:text-zinc-500 z-10 pointer-events-auto">
          {prefixIcon}
        </div>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onPaste={(e) => {
          const clipboard = e.clipboardData?.getData('text');
          if (clipboard) {
            const cleaned = sanitizePriceInput(clipboard);
            if (cleaned) {
              e.preventDefault();
              e.target.value = cleaned;
              onChange?.(e);
              props.onPaste?.(e);
              return;
            }
          }
          props.onPaste?.(e);
        }}
        onChange={(e) => {
          // Convert Persian/Arabic digits to English digits
          let raw = e.target.value
            .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
          
          const hasMinus = raw.includes('-');
          const hasPlus = raw.includes('+');

          // Normalize commas, dots, multipliers, and formatting
          let val = sanitizePriceInput(raw).replace(/[-+]/g, '');

          if (hasMinus) {
            val = '-' + val;
          } else if (hasPlus) {
            val = '+' + val;
          }
          
          e.target.value = val;
          onChange?.(e);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={cn(
          'w-full h-full bg-transparent flex-1 min-w-0 text-xs font-medium text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none',
          prefixIcon
            ? (isRtl ? 'pr-2 pl-8 text-right' : 'pl-2 pr-8 text-left')
            : (isRtl ? 'pl-8 pr-3 text-right' : 'pr-8 pl-3 text-left'),
          inputClassName
        )}
        {...props}
      />

      {/* Stacked Incremental Stepper Chevrons */}
      <div
        className={cn(
          'absolute top-1 bottom-1 w-5 flex flex-col items-center justify-between',
          isRtl
            ? 'left-1 border-r border-zinc-200 dark:border-zinc-800/80 pr-0.5'
            : 'right-1 border-l border-zinc-200 dark:border-zinc-800/80 pl-0.5'
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={() => startHold(effectiveStep)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => startHold(effectiveStep)}
          onTouchEnd={stopHold}
          className="flex-1 w-full flex items-center justify-center rounded-t text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={`Increment (+${effectiveStep.toLocaleString()})`}
        >
          <ChevronUp className="w-3 h-3 stroke-[2.5]" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={() => startHold(-effectiveStep)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => startHold(-effectiveStep)}
          onTouchEnd={stopHold}
          className="flex-1 w-full flex items-center justify-center rounded-b text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={`Decrement (-${effectiveStep.toLocaleString()})`}
        >
          <ChevronDown className="w-3 h-3 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}

export default NumberStepperInput;
