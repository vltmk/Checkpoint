import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dialog({ open, onClose, children, className, maxWidth = 'max-w-2xl' }) {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-xl"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={cn(
              'relative z-10 w-full bg-[#08080a]/90 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.12)] overflow-hidden my-auto',
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
        'flex items-center justify-between px-6 py-4 border-b border-white/[0.07] bg-white/[0.02]',
        className
      )}
    >
      <div className="flex items-center gap-3">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function DialogTitle({ children, className }) {
  return (
    <h3 className={cn('text-sm font-semibold tracking-tight text-white flex items-center gap-2', className)}>
      {children}
    </h3>
  );
}

export function DialogContent({ children, className }) {
  return <div className={cn('p-6 space-y-4 max-h-[80vh] overflow-y-auto', className)}>{children}</div>;
}

export function DialogFooter({ children, className }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2.5 px-6 py-4 border-t border-white/[0.07] bg-white/[0.02]',
        className
      )}
    >
      {children}
    </div>
  );
}
