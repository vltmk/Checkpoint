import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { DialogFooter } from '../ui/Dialog';
import { useLedgerFormat } from './format';

/**
 * The layout shared by the Add order and Add job dialogs: the form on the start side, a live summary on the end
 * side. The two panes scroll on their own, so the summary (what you keep, screenshots) never scrolls away.
 */
export function FormPanes({ form, summary }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_248px]">
      <div className="min-h-0 overflow-y-auto px-5 py-4 space-y-5">{form}</div>
      <aside className="min-h-0 overflow-y-auto border-s border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/30 px-4 py-4 space-y-4">
        {summary}
      </aside>
    </div>
  );
}

/** One group of fields with a quiet heading (What, Money, Team...). `aside` sits on the heading's end. */
export function FormSection({ title, aside, children, className }) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">{title}</h3>
        {aside}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * A labelled field: the label above, an error (or a hint) below. `htmlFor` is optional; without it the label wraps
 * the control, which names it for screen readers too.
 */
export function Field({ label, hint, error, children, className, as = 'label' }) {
  const Tag = as;
  return (
    <Tag className={cn('block min-w-0', className)}>
      {label && <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}</span>}
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-[11px] text-rose-600 dark:text-rose-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-zinc-500 dark:text-zinc-500">{hint}</span>
      ) : null}
    </Tag>
  );
}

/** A small choice button (a recent client, a platform, a cut preset). */
export function Chip({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-6 px-2 rounded-md text-[11px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500',
        active
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800',
        className
      )}
    >
      {children}
    </button>
  );
}

/** A collapsible group for the fields most entries never need. */
export function Disclosure({ title, open, onToggle, children, count = 0 }) {
  return (
    <details open={open} onToggle={(e) => onToggle(e.currentTarget.open)} className="group/disc rounded-lg border border-zinc-200/80 dark:border-zinc-800/80">
      <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-150 group-open/disc:rotate-90 rtl:rotate-180 rtl:group-open/disc:rotate-90" />
        {title}
        {count > 0 && <span className="ms-auto text-[10.5px] font-normal text-zinc-400 tabular-nums">{count}</span>}
      </summary>
      <div className="space-y-3 border-t border-zinc-200/80 dark:border-zinc-800/80 px-3 py-3">{children}</div>
    </details>
  );
}

/** One line of the live money summary. */
export function SummaryRow({ label, value, muted, strong, tone, aside }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn('min-w-0', muted ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-700 dark:text-zinc-300', strong && 'font-medium')}>{label}</span>
      <span className={cn('shrink-0 tabular-nums', strong && 'text-base font-semibold', tone === 'good' && 'text-emerald-700 dark:text-emerald-400', tone === 'bad' && 'text-rose-600 dark:text-rose-400')}>
        {value}
        {aside && <span className="ms-1.5 text-[11px] font-normal text-zinc-400">{aside}</span>}
      </span>
    </div>
  );
}

/** The summary card at the top of the end pane. */
export function SummaryCard({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">{title}</h3>
      <div className="space-y-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 px-3 py-2.5 text-xs" aria-live="polite">
        {children}
      </div>
    </div>
  );
}

/** A horizontal rule inside the summary card, above the total. */
export function SummaryDivider() {
  return <div className="my-1.5 border-t border-zinc-200 dark:border-zinc-800" />;
}

/**
 * The dialog footer: the save error, or the draft's state with a Clear button, or the shortcut hint, on the start
 * side; Cancel and Save on the end side. `draft` comes from useFormDraft (restored, dirty, onClear).
 */
export function FormFooter({ error, onCancel, onSave, busy, saveLabel, draft }) {
  const f = useLedgerFormat();
  const showDraft = draft && (draft.restored || draft.dirty);
  return (
    <DialogFooter className="justify-between">
      <span className="flex min-w-0 items-center gap-2 text-xs" role={error ? 'alert' : undefined}>
        {error ? (
          <span className="truncate text-rose-600 dark:text-rose-400">{error}</span>
        ) : showDraft ? (
          <>
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-zinc-500 dark:text-zinc-400">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              {draft.restored ? f.t('lg.draft.restored', 'Draft restored') : f.t('lg.draft.saved', 'Draft saved')}
            </span>
            <button type="button" onClick={draft.onClear} className="shrink-0 rounded px-1.5 py-0.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">
              {f.t('lg.draft.clear', 'Clear')}
            </button>
          </>
        ) : (
          <span className="truncate text-zinc-400 dark:text-zinc-500">{f.t('lg.form.saveHint', 'Ctrl + Enter to save')}</span>
        )}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" onClick={onCancel}>{f.t('common.cancel', 'Cancel')}</Button>
        <Button variant="primary" disabled={busy} onClick={onSave}>{saveLabel}</Button>
      </div>
    </DialogFooter>
  );
}

/** "Draft saved / restored · Clear", for dialogs with their own footer. Renders nothing while the form is untouched. */
export function DraftNotice({ draft, onClear }) {
  const f = useLedgerFormat();
  if (!draft || !(draft.restored || draft.dirty)) return null;
  return (
    <span className="me-auto flex min-w-0 items-center gap-2 text-xs">
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-zinc-500 dark:text-zinc-400">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        {draft.restored ? f.t('lg.draft.restored', 'Draft restored') : f.t('lg.draft.saved', 'Draft saved')}
      </span>
      <button type="button" onClick={onClear} className="shrink-0 rounded px-1.5 py-0.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">
        {f.t('lg.draft.clear', 'Clear')}
      </button>
    </span>
  );
}
