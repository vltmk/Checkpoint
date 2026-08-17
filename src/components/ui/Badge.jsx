import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

// Status dictionary with clean compact labels, colors, and glowing dots
export const STATUS_STYLES = {
  Paid: {
    label: 'Paid',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30',
    dotClass: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
  },
  Pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30',
    dotClass: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]',
  },
  Working: {
    label: 'Working',
    badgeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/30',
    dotClass: 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]',
  },
  'In Progress': {
    label: 'Working',
    badgeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/30',
    dotClass: 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]',
  },
  'On Hold': {
    label: 'On Hold',
    badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30',
    dotClass: 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.7)]',
  },
  Escrow: {
    label: 'On Hold',
    badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30',
    dotClass: 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.7)]',
  },
  Invoiced: {
    label: 'Pending',
    badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30',
    dotClass: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]',
  },
};

export function Badge({ children, className, variant = 'default', size = 'sm' }) {
  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variants = {
    default: 'bg-white/[0.04] text-zinc-300 border border-white/[0.08]',
    subtle: 'bg-white/[0.02] text-zinc-400 border border-white/[0.04]',
    tag: 'bg-white/[0.04] text-zinc-400 border border-white/[0.06] font-mono hover:text-zinc-200 hover:border-white/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
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

  const badgeContent = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide select-none transition-colors duration-150',
        style.badgeClass,
        interactive && 'cursor-pointer',
        className
      )}
      onClick={interactive ? onClick : undefined}
      title={interactive ? `Status: ${style.label}. Click to flip.` : style.label}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dotClass)} />
      <span>{style.label}</span>
    </span>
  );

  if (interactive) {
    return (
      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        className="focus:outline-none inline-flex"
      >
        {badgeContent}
      </motion.button>
    );
  }

  return badgeContent;
}

export function CategoryBadge({ category, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.04] text-zinc-300 border border-white/[0.06] tracking-tight whitespace-nowrap',
        className
      )}
    >
      {category || 'General'}
    </span>
  );
}

export function TagBadge({ tag, className, onClick }) {
  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-white/[0.03] text-zinc-400 border border-white/[0.05] font-mono tracking-tight hover:text-zinc-200 transition-colors',
        onClick ? 'cursor-pointer hover:border-white/20' : '',
        className
      )}
    >
      #{tag}
    </span>
  );
}
