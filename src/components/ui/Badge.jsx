import React from 'react';
import { cn } from '../../lib/utils';
import { STATUS_CONFIG } from '../../lib/currencies';
import { motion } from 'motion/react';

export function Badge({ children, className, variant = 'default', size = 'sm' }) {
  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variants = {
    default: 'bg-white/[0.05] text-zinc-300 border border-white/[0.08]',
    subtle: 'bg-white/[0.02] text-zinc-400 border border-white/[0.04]',
    tag: 'bg-white/[0.04] text-zinc-400 border border-white/[0.06] font-mono hover:text-zinc-200 hover:border-white/20',
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
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Paid'];

  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-all select-none',
        config.badgeClass,
        interactive ? 'cursor-pointer active:scale-95' : '',
        className
      )}
      onClick={onClick}
      title={interactive ? `Current: ${status}. Click to cycle status.` : status}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dotClass)} />
      {config.label}
    </span>
  );

  if (interactive) {
    return (
      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        className="focus:outline-none"
      >
        {content}
      </motion.button>
    );
  }

  return content;
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
