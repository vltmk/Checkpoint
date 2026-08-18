import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'w-full h-9 rounded-lg bg-zinc-900/60 border border-zinc-800 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-150',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ className, rows = 3, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full min-h-[84px] max-h-48 rounded-lg bg-zinc-900/60 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-150 resize-y selection:bg-zinc-800',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export default Input;

