import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FrostedGlass } from './FrostedGlass';
import { useLanguage } from '../../lib/i18n';

let openDialogCount = 0;

// Open dialogs in the order they opened. Only the topmost one handles Escape and traps focus.
const dialogStack = [];

// True while any Dialog is open, so app-level Escape handlers can leave the key to the dialog
export const hasOpenDialog = () => dialogStack.length > 0;

// Dialogs that are not this component (e.g. confirm popups portaled from the comboboxes) mark themselves
// with role="dialog". Focus or Escape inside one of them belongs to that element, not to the dialog below it.
const isFocusInForeignDialog = (ownElement) => {
  const active = document.activeElement;
  const foreign = active?.closest?.('[role="dialog"]');
  return Boolean(foreign && foreign !== ownElement);
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const DialogContext = createContext({ titleId: undefined });

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
  const titleId = useId();
  const [hasTitle, setHasTitle] = useState(false);
  const dialogRef = useRef(null);
  const tokenRef = useRef({});
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape closes only the topmost dialog, and never one whose focus is inside a foreign dialog
  useEffect(() => {
    if (!open) return undefined;
    const token = tokenRef.current;
    dialogStack.push(token);
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape' || dialogStack[dialogStack.length - 1] !== token) return;
      if (isFocusInForeignDialog(dialogRef.current)) return;
      onCloseRef.current?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const index = dialogStack.indexOf(token);
      if (index !== -1) dialogStack.splice(index, 1);
    };
  }, [open]);

  // Focus management: move focus into the dialog, keep Tab inside it, and return focus on close
  useEffect(() => {
    if (!open) return undefined;
    const token = tokenRef.current;
    const previouslyFocused = document.activeElement;
    const container = dialogRef.current;
    if (container && !container.contains(document.activeElement)) {
      container.focus();
    }

    const handleTab = (e) => {
      if (e.key !== 'Tab' || dialogStack[dialogStack.length - 1] !== token || !dialogRef.current) return;
      if (isFocusInForeignDialog(dialogRef.current)) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const insideDialog = dialogRef.current.contains(active);
      if (e.shiftKey && (!insideDialog || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!insideDialog || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleTab);
    return () => {
      window.removeEventListener('keydown', handleTab);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

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
    <DialogContext.Provider value={{ titleId, setHasTitle }}>
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
            className="fixed inset-0 bg-black/40 dark:bg-black/60"
          />

          {/* Floating Sheet Container */}
          <div className={cn('relative z-10 w-full my-0 sm:my-auto flex justify-center items-center', maxWidth)}>
            <motion.div
              ref={dialogRef}
              tabIndex={-1}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={hasTitle ? titleId : undefined}
              className={cn(
                'relative z-10 w-full max-h-[92vh] flex flex-col bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl shadow-2xl shadow-black/50 overflow-hidden outline-none',
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
    </DialogContext.Provider>
  );
}

export function DialogHeader({ children, className, onClose, actions }) {
  const { t } = useLanguage();
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
            aria-label={t('common.close', 'Close')}
            title={t('common.close', 'Close')}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export function DialogTitle({ children, className }) {
  const { titleId, setHasTitle } = useContext(DialogContext);
  // Tell the parent dialog it has a name, so aria-labelledby only points at a rendered heading
  useEffect(() => {
    setHasTitle?.(true);
    return () => setHasTitle?.(false);
  }, [setHasTitle]);
  return (
    <h3 id={titleId} className={cn('text-sm font-medium tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2', className)}>
      {children}
    </h3>
  );
}

export function DialogContent({ children, className }) {
  return <div className={cn('p-5 space-y-4 overflow-y-auto flex-1 min-h-0 relative z-20', className)}>{children}</div>;
}

export function DialogFooter({ children, className }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200/80 dark:border-zinc-800/80 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50 relative z-30',
        className
      )}
    >
      {children}
    </div>
  );
}

export default Dialog;
