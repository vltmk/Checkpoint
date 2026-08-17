import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] focus:outline-none focus:border-white/30 focus:bg-white/[0.07] focus:ring-1 focus:ring-white/20 transition-all duration-150',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Select = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-zinc-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] focus:outline-none focus:border-white/30 focus:bg-[#0c0c0e] focus:ring-1 focus:ring-white/20 transition-all duration-150 appearance-none cursor-pointer pr-8',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-zinc-400">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
});
Select.displayName = 'Select';

export const Textarea = React.forwardRef(({ className, rows = 3, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] focus:outline-none focus:border-white/30 focus:bg-white/[0.07] focus:ring-1 focus:ring-white/20 transition-all duration-150 resize-y',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';
