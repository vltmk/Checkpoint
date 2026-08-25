import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn, isRTL } from '../../lib/utils';

export function Toast({ toast, onClose }) {
  if (!toast) return null;

  const { title, description, variant = 'default', dir } = toast;
  const isToastRTL = dir === 'rtl' || isRTL(title) || isRTL(description);

  const getIcon = () => {
    switch (variant) {
      case 'destructive':
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
      case 'info':
        return <Info className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'success':
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
  };

  return (
    <motion.div
      dir={isToastRTL ? 'rtl' : 'ltr'}
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'pointer-events-auto w-full flex items-center gap-3.5 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 shadow-2xl backdrop-blur-xl select-none',
        variant === 'destructive'
          ? 'border-red-900/60 bg-zinc-950 text-red-100'
          : 'border-zinc-800 bg-zinc-950 text-zinc-100'
      )}
      role="status"
      aria-live="polite"
    >
      {/* Icon frame */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
        {getIcon()}
      </div>

      {/* Content Area */}
      <div className={cn('flex-1 min-w-0', isToastRTL ? 'pl-1' : 'pr-1')}>
        {title && (
          <div
            className={cn(
              'font-semibold text-zinc-100 break-words',
              isToastRTL
                ? 'text-right font-farsi tracking-normal text-sm leading-[1.6]'
                : 'text-sm tracking-tight leading-snug'
            )}
          >
            {title}
          </div>
        )}
        {description && (
          <div
            className={cn(
              'text-zinc-400 break-words mt-0.5',
              isToastRTL
                ? 'text-right font-farsi tracking-normal text-xs leading-[1.7]'
                : 'text-xs leading-relaxed'
            )}
          >
            {description}
          </div>
        )}
      </div>

      {/* Close button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-700"
          aria-label="Close notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}

export default Toast;

