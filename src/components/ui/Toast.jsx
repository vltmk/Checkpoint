import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Toast({ toast, onClose }) {
  if (!toast) return null;

  const { title, description, variant = 'default' } = toast;

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
      <div className="flex-1 min-w-0 pr-1">
        {title && (
          <div className="text-sm font-semibold text-zinc-100 tracking-tight leading-snug break-words">
            {title}
          </div>
        )}
        {description && (
          <div className="text-xs text-zinc-400 leading-relaxed mt-0.5 break-words">
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

