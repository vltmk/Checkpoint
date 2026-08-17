import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, Check } from 'lucide-react';
import { STATUSES } from '../../lib/currencies';

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

export function StatusBadge({
  status,
  onClick,
  onSelectStatus,
  className,
  interactive = false,
}) {
  const style = STATUS_STYLES[status] || STATUS_STYLES['Paid'];
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
      <div className="relative inline-block" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectStatus) {
              setIsOpen((prev) => !prev);
            } else {
              onClick?.();
            }
          }}
          title={`Status: ${style.label}. Click to change status.`}
          className={cn(
            'group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide select-none transition-all duration-150 active:scale-95 hover:ring-1 hover:ring-zinc-600/60 cursor-pointer',
            style.badgeClass,
            className
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dotClass)} />
          <span>{style.label}</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100 transition-opacity" />
        </button>

        {isOpen && onSelectStatus && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1 w-28 bg-zinc-950 border border-zinc-800 shadow-xl rounded-lg p-1 space-y-0.5 z-50 text-xs"
          >
            {STATUSES.map((st) => {
              const stStyle = STATUS_STYLES[st];
              const isCurrent = st === status;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    onSelectStatus(st);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors',
                    isCurrent
                      ? 'bg-zinc-900 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', stStyle.dotClass)} />
                    <span>{st}</span>
                  </div>
                  {isCurrent && <Check className="w-3 h-3 text-zinc-200" />}
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

