import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, Check } from 'lucide-react';
import { STATUSES } from '../../lib/currencies';
import { useLanguage } from '../../lib/i18n';

export const STATUS_STYLES = {
  Paid: {
    label: 'پرداخت شده',
    badgeClass: 'bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-600/30 dark:border-emerald-800/60 ring-1 ring-inset ring-emerald-600/20 backdrop-blur-md hover:bg-emerald-500/15 dark:hover:bg-emerald-950/40',
    dotClass: 'bg-emerald-600 dark:bg-emerald-400',
  },
  Pending: {
    label: 'درحال انتظار',
    badgeClass: 'bg-amber-500/10 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-600/30 dark:border-amber-800/60 ring-1 ring-inset ring-amber-600/20 backdrop-blur-md hover:bg-amber-500/15 dark:hover:bg-amber-950/40',
    dotClass: 'bg-amber-600 dark:bg-amber-400',
  },
  Working: {
    label: 'درحال انجام',
    badgeClass: 'bg-sky-500/10 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border border-sky-600/30 dark:border-sky-800/60 ring-1 ring-inset ring-sky-600/20 backdrop-blur-md hover:bg-sky-500/15 dark:hover:bg-sky-950/40',
    dotClass: 'bg-sky-600 dark:bg-sky-400',
  },
  'On Hold': {
    label: 'توقف موقت',
    badgeClass: 'bg-zinc-500/10 dark:bg-zinc-900/40 text-zinc-700 dark:text-zinc-400 border border-zinc-400/30 dark:border-zinc-800 ring-1 ring-inset ring-zinc-400/20 backdrop-blur-md hover:bg-zinc-500/15 dark:hover:bg-zinc-900/60',
    dotClass: 'bg-zinc-600 dark:bg-zinc-500',
  },
};

export function Badge({ children, className, variant = 'default', size = 'sm' }) {
  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variants = {
    default: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800',
    subtle: 'bg-zinc-100/60 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-800/60',
    tag: 'bg-zinc-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 font-mono hover:text-zinc-900 dark:hover:text-zinc-200',
    emerald: 'bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-600/25 dark:border-emerald-800/40 ring-1 ring-inset ring-emerald-600/15 backdrop-blur-md',
    blue: 'bg-blue-500/10 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-600/25 dark:border-blue-800/40 ring-1 ring-inset ring-blue-600/15 backdrop-blur-md',
    amber: 'bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-600/25 dark:border-amber-800/40 ring-1 ring-inset ring-amber-600/15 backdrop-blur-md',
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

export function StatusBadge({
  status,
  onClick,
  onSelectStatus,
  className,
  interactive = false,
}) {
  const { t, isRtl } = useLanguage();
  const style = STATUS_STYLES[status] || STATUS_STYLES['Paid'];
  const displayLabel = t('status.' + status, style.label);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  if (interactive) {
    return (
      <div className={cn('relative inline-flex items-center', isOpen && 'z-[70]')} ref={menuRef}>
        <button
          type="button"
          dir={isRtl ? 'rtl' : 'ltr'}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectStatus) {
              setIsOpen((prev) => !prev);
            } else {
              onClick?.();
            }
          }}
          title={`${displayLabel} (${t('status.all')})`}
          className={cn(
            'group inline-flex items-center justify-center gap-1.5 px-2.5 py-1 min-h-[26px] rounded-md text-[11px] font-medium tracking-wide select-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] hover:ring-1 hover:ring-zinc-400 dark:hover:ring-zinc-600/60 cursor-pointer',
            isRtl && 'font-farsi',
            style.badgeClass,
            className
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dotClass)} />
          <span className={cn(isRtl ? 'leading-normal font-farsi' : 'leading-none')}>{displayLabel}</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>

        {isOpen && onSelectStatus && (
          <div
            onClick={(e) => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
            className={cn(
              'absolute top-full mt-1.5 w-36 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg p-1.5 space-y-1 z-[70] text-xs',
              'right-0'
            )}
          >
            {STATUSES.map((st) => {
              const stStyle = STATUS_STYLES[st];
              const isCurrent = st === status;
              const stLabel = t('status.' + st, stStyle?.label || st);
              return (
                <button
                  key={st}
                  type="button"
                  dir={isRtl ? 'rtl' : 'ltr'}
                  onClick={() => {
                    onSelectStatus(st);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] transition-colors',
                    isCurrent
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', stStyle?.dotClass)} />
                    <span className={cn('font-medium leading-normal', isRtl && 'font-farsi')}>{stLabel}</span>
                  </div>
                  {isCurrent && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-200 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      dir={isRtl ? 'rtl' : 'ltr'}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 px-2.5 py-1 min-h-[26px] rounded-md text-[11px] font-medium tracking-wide select-none',
        isRtl && 'font-farsi',
        style.badgeClass,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dotClass)} />
      <span className={cn(isRtl ? 'leading-normal font-farsi' : 'leading-none')}>{displayLabel}</span>
    </span>
  );
}

export default Badge;

