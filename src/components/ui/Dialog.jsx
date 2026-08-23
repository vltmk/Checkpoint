import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dialog({ open, onClose, children, className, maxWidth = 'max-w-xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock scroll when dialog is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'relative z-10 w-full bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden my-0 sm:my-auto max-h-[92vh] flex flex-col',
              maxWidth,
              className
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function DialogHeader({ children, className, onClose }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0 bg-zinc-950',
        className
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function DialogTitle({ children, className }) {
  return (
    <h3 className={cn('text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2', className)}>
      {children}
    </h3>
  );
}

export function DialogContent({ children, className }) {
  return <div className={cn('p-5 space-y-4 overflow-y-auto flex-1', className)}>{children}</div>;
}

export function DialogFooter({ children, className }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-800 shrink-0 bg-zinc-950',
        className
      )}
    >
      {children}
    </div>
  );
}

export default Dialog;
