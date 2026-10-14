import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({ className, type = 'text', prefixIcon = null, containerClassName, dir, ...props }, ref) => {
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
          className={cn(
            'w-full h-9 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/80 border border-transparent pl-8 rtl:pl-3 rtl:pr-8 pr-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none focus:border-zinc-300 dark:focus:border-zinc-700 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all duration-100',
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
      className={cn(
        'w-full h-9 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/80 border border-transparent px-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none focus:border-zinc-300 dark:focus:border-zinc-700 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all duration-100',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ className, rows = 3, dir, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      dir={dir}
      className={cn(
        'w-full min-h-[84px] max-h-48 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/80 border border-transparent px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none focus:border-zinc-300 dark:focus:border-zinc-700 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all duration-100 resize-y selection:bg-zinc-200 dark:selection:bg-zinc-800',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export default Input;

