import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(
  ({ className, type = 'text', prefixIcon = null, containerClassName, dir, hasError, error, ...props }, ref) => {
    const isInvalid = Boolean(hasError || error || (props['aria-invalid'] && props['aria-invalid'] !== 'false'));

    const borderClasses = isInvalid
      ? 'border-rose-500/80 dark:border-rose-500/80 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40 dark:focus:ring-rose-500/40'
      : 'border-zinc-200/80 dark:border-zinc-800/80 focus:border-zinc-300 dark:focus:border-zinc-700 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600';

    if (prefixIcon) {
      return (
        <div className={cn('relative flex items-center w-full', containerClassName)}>
          <div className="absolute left-2.5 rtl:left-auto rtl:right-2.5 text-zinc-400 dark:text-zinc-500 flex items-center justify-center shrink-0 z-10 pointer-events-auto">
            {prefixIcon}
          </div>
          <input
            type={type}
            dir={dir}
            ref={ref}
            aria-invalid={isInvalid ? true : undefined}
            className={cn(
              'w-full h-9 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/80 border pl-8 rtl:pl-3 rtl:pr-8 pr-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none transition-all duration-100',
              borderClasses,
              className
            )}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        type={type}
        dir={dir}
        ref={ref}
        aria-invalid={isInvalid ? true : undefined}
        className={cn(
          'w-full h-9 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/80 border px-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none transition-all duration-100',
          borderClasses,
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef(
  ({ className, rows = 3, dir, hasError, error, ...props }, ref) => {
    const isInvalid = Boolean(hasError || error || (props['aria-invalid'] && props['aria-invalid'] !== 'false'));

    const borderClasses = isInvalid
      ? 'border-rose-500/80 dark:border-rose-500/80 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40 dark:focus:ring-rose-500/40'
      : 'border-zinc-200/80 dark:border-zinc-800/80 focus:border-zinc-300 dark:focus:border-zinc-700 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600';

    return (
      <textarea
        ref={ref}
        rows={rows}
        dir={dir}
        aria-invalid={isInvalid ? true : undefined}
        className={cn(
          'w-full min-h-[84px] max-h-48 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/80 border px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none transition-all duration-100 resize-y selection:bg-zinc-200 dark:selection:bg-zinc-800',
          borderClasses,
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export default Input;
