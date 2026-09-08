import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { ChevronDown, Check } from 'lucide-react';
import { STATUSES } from '../../lib/currencies';
import { useLanguage } from '../../lib/i18n';

export const STATUS_STYLES = {
  Paid: {
    label: 'پرداخت شده',
    badgeClass: 'bg-emerald-500/10 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-600/30 dark:border-emerald-800/60 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-500/15 dark:hover:bg-emerald-950/70',
    dotClass: 'bg-emerald-600 dark:bg-emerald-400',
  },
  Pending: {
    label: 'درحال انتظار',
    badgeClass: 'bg-amber-500/10 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-600/30 dark:border-amber-800/60 ring-1 ring-inset ring-amber-600/20 hover:bg-amber-500/15 dark:hover:bg-amber-950/70',
    dotClass: 'bg-amber-600 dark:bg-amber-400',
  },
  Working: {
    label: 'درحال انجام',
    badgeClass: 'bg-sky-500/10 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-600/30 dark:border-sky-800/60 ring-1 ring-inset ring-sky-600/20 hover:bg-sky-500/15 dark:hover:bg-sky-950/70',
    dotClass: 'bg-sky-600 dark:bg-sky-400',
  },
  'On Hold': {
    label: 'توقف موقت',
    badgeClass: 'bg-zinc-500/10 dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-400 border border-zinc-400/30 dark:border-zinc-800 ring-1 ring-inset ring-zinc-400/20 hover:bg-zinc-500/15 dark:hover:bg-zinc-900/70',
    dotClass: 'bg-zinc-600 dark:bg-zinc-500',
  },
  Failed: {
    label: 'ناموفق',
    badgeClass: 'bg-rose-500/10 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-600/30 dark:border-rose-800/60 ring-1 ring-inset ring-rose-600/20 hover:bg-rose-500/15 dark:hover:bg-rose-950/70',
    dotClass: 'bg-rose-600 dark:bg-rose-400',
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
    tag: 'bg-zinc-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200',
    emerald: 'bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-600/25 dark:border-emerald-800/40 ring-1 ring-inset ring-emerald-600/15',
    blue: 'bg-blue-500/10 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-600/25 dark:border-blue-800/40 ring-1 ring-inset ring-blue-600/15',
    amber: 'bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-600/25 dark:border-amber-800/40 ring-1 ring-inset ring-amber-600/15',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-md tracking-tight leading-normal',
        variants[variant] || variants.default,
        sizeStyles[size] || sizeStyles.sm,
        className
      )}
    >
      {children}
    </span>
  );
}

export const STATUS_ROW_STYLES = {
  Paid: {
    borderClass: 'border-emerald-600/50 dark:border-emerald-500/40 hover:border-emerald-600/75 dark:hover:border-emerald-500/65',
    bgClass: 'bg-emerald-500/[0.04] dark:bg-emerald-400/[0.05] hover:bg-emerald-500/[0.07] dark:hover:bg-emerald-400/[0.07]',
    glowClass: 'shadow-[0_0_8px_rgba(16,185,129,0.14)] dark:shadow-[0_0_10px_rgba(52,211,153,0.12)]',
  },
  Pending: {
    borderClass: 'border-amber-600/50 dark:border-amber-500/40 hover:border-amber-600/75 dark:hover:border-amber-500/65',
    bgClass: 'bg-amber-500/[0.04] dark:bg-amber-400/[0.05] hover:bg-amber-500/[0.07] dark:hover:bg-amber-400/[0.07]',
    glowClass: 'shadow-[0_0_8px_rgba(245,158,11,0.14)] dark:shadow-[0_0_10px_rgba(251,191,36,0.12)]',
  },
  Working: {
    borderClass: 'border-sky-600/50 dark:border-sky-500/40 hover:border-sky-600/75 dark:hover:border-sky-500/65',
    bgClass: 'bg-sky-500/[0.04] dark:bg-sky-400/[0.05] hover:bg-sky-500/[0.07] dark:hover:bg-sky-400/[0.07]',
    glowClass: 'shadow-[0_0_8px_rgba(14,165,233,0.14)] dark:shadow-[0_0_10px_rgba(56,189,248,0.12)]',
  },
  'On Hold': {
    borderClass: 'border-zinc-400/50 dark:border-zinc-600/50 hover:border-zinc-500/75 dark:hover:border-zinc-500/70',
    bgClass: 'bg-zinc-500/[0.04] dark:bg-zinc-400/[0.05] hover:bg-zinc-500/[0.07] dark:hover:bg-zinc-400/[0.07]',
    glowClass: 'shadow-[0_0_8px_rgba(161,161,170,0.12)] dark:shadow-[0_0_10px_rgba(113,113,122,0.12)]',
  },
  Failed: {
    borderClass: 'border-rose-600/50 dark:border-rose-500/40 hover:border-rose-600/75 dark:hover:border-rose-500/65',
    bgClass: 'bg-rose-500/[0.04] dark:bg-rose-400/[0.05] hover:bg-rose-500/[0.07] dark:hover:bg-rose-400/[0.07]',
    glowClass: 'shadow-[0_0_8px_rgba(244,63,94,0.14)] dark:shadow-[0_0_10px_rgba(251,113,133,0.12)]',
  },
};

export function StatusBadge({
  status,
  onClick,
  onSelectStatus,
  className,
  interactive = false,
  variant = 'row',
}) {
  const { t, isRtl } = useLanguage();
  const style = STATUS_STYLES[status] || STATUS_STYLES['Paid'];
  const rowStyle = STATUS_ROW_STYLES[status] || STATUS_ROW_STYLES['Paid'];
  const displayLabel = t('status.' + status, style.label);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    openUpwards: false,
    alignLeft: isRtl,
  });
  const menuRef = useRef(null);
  const popoverRef = useRef(null);

  const calculatePosition = useCallback(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const dropdownHeight = 205;
    const dropdownWidth = 144;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const shouldOpenUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    let willAlignLeft = isRtl;
    if (isRtl) {
      const wouldClipRight = rect.left + dropdownWidth > window.innerWidth - 8;
      willAlignLeft = !wouldClipRight;
    } else {
      const wouldClipLeft = rect.right - dropdownWidth < 8;
      willAlignLeft = wouldClipLeft;
    }

    let left = willAlignLeft ? rect.left : rect.right - dropdownWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - dropdownWidth - 8));

    setCoords({
      top: rect.bottom + 6,
      bottom: window.innerHeight - rect.top + 6,
      left,
      openUpwards: shouldOpenUp,
      alignLeft: willAlignLeft,
    });
  }, [isRtl]);

  useLayoutEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        (!popoverRef.current || !popoverRef.current.contains(e.target))
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    const handleReposition = () => {
      calculatePosition();
    };

    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, calculatePosition]);

  if (interactive) {
    return (
      <div className={cn('relative inline-flex items-center', isOpen && 'z-[70]')} ref={menuRef}>
        <button
          type="button"
          dir={isRtl ? 'rtl' : 'ltr'}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectStatus) {
              if (!isOpen) {
                calculatePosition();
              }
              setIsOpen((prev) => !prev);
            } else {
              onClick?.();
            }
          }}
          title={`${displayLabel} (${t('status.all')})`}
          className={cn(
            'group inline-flex items-center justify-center gap-1.5 px-2.5 py-1 min-h-[26px] rounded-md text-[11px] font-medium tracking-wide select-none transition-all duration-150 active:scale-[0.97] cursor-pointer',
            isRtl && 'font-farsi',
            variant === 'row'
              ? cn(
                  'text-zinc-700 dark:text-zinc-300 border backdrop-blur-[2px]',
                  rowStyle.borderClass,
                  rowStyle.bgClass,
                  rowStyle.glowClass
                )
              : style.badgeClass,
            className
          )}
        >
          {variant !== 'row' && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dotClass)} />}
          <span className="leading-normal">{displayLabel}</span>
          <ChevronDown
            className={cn(
              'w-2.5 h-2.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 opacity-60 group-hover:opacity-100 transition-all duration-150 shrink-0',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {isOpen && onSelectStatus && (
                <motion.div
                  key="status-badge-popover"
                  ref={popoverRef}
                  initial={{ opacity: 0, scale: 0.96, y: coords.openUpwards ? 4 : -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: coords.openUpwards ? 4 : -4 }}
                  transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  dir={isRtl ? 'rtl' : 'ltr'}
                  style={{
                    position: 'fixed',
                    left: `${coords.left}px`,
                    ...(coords.openUpwards
                      ? { bottom: `${coords.bottom}px` }
                      : { top: `${coords.top}px` }),
                    transformOrigin: `${coords.openUpwards ? 'bottom' : 'top'} ${coords.alignLeft ? 'left' : 'right'}`,
                  }}
                  className="w-36 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg p-1.5 space-y-1 z-[9999] text-xs"
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
                            ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-medium'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', stStyle?.dotClass)} />
                          <span className={cn('font-medium leading-normal', isRtl && 'font-farsi')}>{stLabel}</span>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200 shrink-0" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
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
        variant === 'row'
          ? cn(
              'text-zinc-700 dark:text-zinc-300 border backdrop-blur-[2px]',
              rowStyle.borderClass,
              rowStyle.bgClass,
              rowStyle.glowClass
            )
          : style.badgeClass,
        className
      )}
    >
      {variant !== 'row' && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dotClass)} />}
      <span className="leading-normal">{displayLabel}</span>
    </span>
  );
}

export default Badge;

