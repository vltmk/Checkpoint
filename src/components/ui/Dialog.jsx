import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FrostedGlass } from './FrostedGlass';

let openDialogCount = 0;

function lockBodyScroll() {
  openDialogCount++;
  if (openDialogCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

function unlockBodyScroll() {
  openDialogCount = Math.max(0, openDialogCount - 1);
  if (openDialogCount === 0) {
    document.body.style.overflow = '';
  }
}

export function Dialog({ open, onClose, children, className, maxWidth = 'max-w-xl', floatingActions = null }) {
  const shouldReduceMotion = useReducedMotion();
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock scroll when dialog is open (ref-counted for nested modals)
  useEffect(() => {
    if (open) {
      lockBodyScroll();
      return () => {
        unlockBodyScroll();
      };
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          {/* Scrim Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 dark:bg-black/50 backdrop-blur-xs"
          />

          {/* Floating Sheet Container */}
          <div className={cn('relative z-10 w-full my-0 sm:my-auto flex justify-center items-center', maxWidth)}>
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
              role="dialog"
              aria-modal="true"
              className={cn(
                'relative z-10 w-full max-h-[92vh] flex flex-col bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl shadow-2xl shadow-black/50 overflow-hidden',
                className
              )}
            >
              {children}
            </motion.div>

            {floatingActions && (
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
                className="absolute -right-12 sm:-right-14 top-0 z-30 flex flex-col pointer-events-auto"
                dir="ltr"
              >
                {floatingActions}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function DialogHeader({ children, className, onClose, actions }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50 relative z-20',
        className
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 text-start">{children}</div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function DialogTitle({ children, className }) {
  return (
    <h3 className={cn('text-sm font-medium tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2', className)}>
      {children}
    </h3>
  );
}

export function DialogContent({ children, className }) {
  return <div className={cn('p-5 space-y-4 overflow-y-auto flex-1 relative z-20', className)}>{children}</div>;
}

export function DialogFooter({ children, className }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200/80 dark:border-zinc-800/80 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50 relative z-10',
        className
      )}
    >
      {children}
    </div>
  );
}

export default Dialog;
