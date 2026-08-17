import React from 'react';
import { cn } from '../../lib/utils';

export const STATUS_STYLES = {
  Paid: {
    label: 'Paid',
    badgeClass: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/40',
    dotClass: 'bg-emerald-400',
  },
  Pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-950/40 text-amber-400 border border-amber-800/40 hover:bg-amber-900/40',
    dotClass: 'bg-amber-400',
  },
  Working: {
    label: 'Working',
    badgeClass: 'bg-blue-950/40 text-blue-400 border border-blue-800/40 hover:bg-blue-900/40',
    dotClass: 'bg-blue-400',
  },
  'On Hold': {
    label: 'On Hold',
    badgeClass: 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800',
    dotClass: 'bg-zinc-500',
  },
};

export function Badge({ children, className, variant = 'default', size = 'sm' }) {
  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variants = {
    default: 'bg-zinc-900 text-zinc-300 border border-zinc-800',
    subtle: 'bg-zinc-900/40 text-zinc-400 border border-zinc-800/60',
    tag: 'bg-zinc-900/60 text-zinc-400 border border-zinc-800 font-mono hover:text-zinc-200',
    emerald: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40',
    blue: 'bg-blue-950/40 text-blue-400 border border-blue-800/40',
    amber: 'bg-amber-950/40 text-amber-400 border border-amber-800/40',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-md tracking-tight leading-none',
        variants[variant] || variants.default,
        sizeStyles[size] || sizeStyles.sm,
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, onClick, className, interactive = false }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES['Paid'];

  if (interactive) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        title={`Status: ${style.label}. Click to flip.`}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide select-none transition-all duration-150 active:scale-95',
          style.badgeClass,
          className
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dotClass)} />
        <span>{style.label}</span>
      </button>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide select-none',
        style.badgeClass,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dotClass)} />
      <span>{style.label}</span>
    </span>
  );
}

export default Badge;
