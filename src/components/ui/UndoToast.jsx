import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';

/**
 * UndoToast - High-density, monochromatic floating toast for transient deletion undo
 * Renders into document.body to ensure it floats cleanly above all layouts
 */
export function UndoToast({
  isOpen = false,
  message = '',
  count = 1,
  onUndo,
  onDismiss,
  duration = 6000,
}) {
  const { language, t, isRtl, formatNumber } = useLanguage();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isOpen) {
      setProgress(100);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (elapsed >= duration) {
        clearInterval(interval);
        onDismiss?.();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, duration, onDismiss]);

  if (typeof document === 'undefined') return null;

  const displayMessage =
    message ||
    (count > 1
      ? t('ledger.multiDeleted', '{count} jobs deleted').replace('{count}', formatNumber(count))
      : t('ledger.singleDeleted', 'Job deleted'));

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="undo-toast"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          dir={isRtl ? 'rtl' : 'ltr'}
          className={cn(
            'fixed bottom-6 left-6 z-[120] flex flex-col overflow-hidden rounded-xl',
            'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100',
            'border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-black/10 dark:shadow-black/50',
            'min-w-[280px] max-w-[calc(100vw-3rem)] text-xs select-none'
          )}
        >
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
              {displayMessage}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onUndo}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer active:scale-95',
                  'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
                  isRtl && 'font-farsi'
                )}
              >
                <RotateCcw className="w-3 h-3 stroke-[2.5]" />
                <span>{t('ledger.undoDelete', 'Undo')}</span>
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                title={t('common.close', 'Close')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Micro Countdown Progress Line */}
          <div className="h-0.5 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-zinc-400 dark:bg-zinc-500 transition-all ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default UndoToast;
