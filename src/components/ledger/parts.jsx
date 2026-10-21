import React from 'react';
import { AlertTriangle, CircleCheck, CircleDashed, CirclePause, CirclePlay, CircleX, Undo2 } from 'lucide-react';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import { GameIcon } from '../ui/GameIcon';
import { fromMinor } from '../../lib/ledger/money';
import { cn } from '../../lib/utils';

/** Integer minor units rendered through the app's money component (keeps Toman/Gold/USD/EUR styling). */
export function Money({ minor, currency, compact = false, className, approx = false }) {
  return (
    <span className={cn('tabular-nums', className)}>
      {approx && <span className="text-zinc-400 me-0.5" aria-hidden="true">≈</span>}
      {/* the Toman mark follows the text size (it was a fixed 24px, which dwarfed small figures) */}
      <MoneyDisplay amount={fromMinor(minor, currency)} currency={currency} compact={compact} iconSize="min(1.5em, 26px)" />
    </span>
  );
}

/**
 * The balance rail: one thin bar per person.
 *   solid zinc  = already paid
 *   solid amber = earned and due now
 *   hatched     = committed to work still in progress
 * Segment widths are relative to the person's total, so the bar reads as "how settled is this account".
 */
export function BalanceRail({ paid = 0, due = 0, committed = 0, label, className, incoming = false }) {
  const total = paid + due + committed;
  const pct = (n) => (total > 0 ? `${(n / total) * 100}%` : '0%');
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800', className)}
    >
      {paid > 0 && <div className="h-full bg-zinc-400 dark:bg-zinc-500" style={{ width: pct(paid) }} />}
      {due > 0 && <div className={cn('h-full', incoming ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400')} style={{ width: pct(due) }} />}
      {committed > 0 && (
        <div
          className={cn('h-full', incoming ? 'bg-emerald-500/40 dark:bg-emerald-400/35' : 'bg-amber-500/40 dark:bg-amber-400/35')}
          style={{
            width: pct(committed),
            backgroundImage:
              'repeating-linear-gradient(135deg, transparent 0 3px, rgba(255,255,255,0.55) 3px 5px)',
          }}
        />
      )}
    </div>
  );
}

/** A section heading used across the ledger screens: quiet, sentence case, with an optional right-side slot. */
export function SectionTitle({ children, aside, className }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 mb-2', className)}>
      <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{children}</h2>
      {aside}
    </div>
  );
}

/** Pill-style segmented control for small filter sets. */
export function Segmented({ value, onChange, options, ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-900 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-6 px-2.5 rounded text-[11px] font-medium transition-colors select-none',
            value === o.value
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          {o.label}
          {o.count > 0 && <span className="ms-1 text-[10px] text-zinc-400 tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, children }) {
  return (
    <div className="py-12 text-center">
      {Icon && (
        <span aria-hidden="true" className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-500/10 text-zinc-500 dark:text-zinc-400">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </span>
      )}
      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</p>
      {body && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">{body}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * Order status colours. One accent per state so a list can be scanned by eye:
 * grey = not started, blue = being worked on, amber = paused, green = done, red = failed, orange = disputed, violet = refunded.
 */
export const LIFE_STYLE = {
  pending: { dot: 'bg-zinc-400', text: 'text-zinc-600 dark:text-zinc-400', bar: 'border-zinc-300 dark:border-zinc-700' },
  working: { dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300', bar: 'border-sky-500/70' },
  on_hold: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', bar: 'border-amber-500/70' },
  done: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bar: 'border-emerald-500/60' },
  failed: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', bar: 'border-rose-500/70' },
  disputed: { dot: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', bar: 'border-orange-500/70' },
  refunded: { dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', bar: 'border-violet-500/70' },
};

export function LifeDot({ lifecycle, className }) {
  return <span aria-hidden="true" className={cn('inline-block h-2 w-2 rounded-full shrink-0', (LIFE_STYLE[lifecycle] || LIFE_STYLE.pending).dot, className)} />;
}

/**
 * "Undo" for a paid job or share. Voids the payment that covered only this item (history is kept in Money).
 * If the item was paid as part of a bigger payment it cannot be undone alone, and says so instead.
 */
export function UndoLink({ applied, onUndo, undoLabel, sharedLabel, sharedHelp, className, revealOnHover = false }) {
  if (!applied || applied.length === 0) return null;
  // inside a `group` row: hidden until the row is hovered or something in it has focus
  const reveal = revealOnHover ? 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100' : '';
  if (applied.some((x) => x.exclusive)) {
    return (
      <button type="button" onClick={onUndo} className={cn('text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline-offset-2 hover:underline', reveal, className)}>
        {undoLabel}
      </button>
    );
  }
  return <span title={sharedHelp} className={cn('text-zinc-500', reveal, className)}>{sharedLabel}</span>;
}

// --- list rows ---------------------------------------------------------------------------------------------------

/** One icon per order status, so a list reads by shape as well as by colour. */
export const LIFE_ICON = {
  pending: CircleDashed,
  working: CirclePlay,
  on_hold: CirclePause,
  done: CircleCheck,
  failed: CircleX,
  disputed: AlertTriangle,
  refunded: Undo2,
};

const LIFE_TILE = {
  pending: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400',
  working: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  on_hold: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  disputed: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  refunded: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
};

/** The status of an order as a tinted tile: the leading mark of every Orders / Jobs row. */
export function StatusTile({ lifecycle, className }) {
  const Icon = LIFE_ICON[lifecycle] || LIFE_ICON.pending;
  return (
    <span aria-hidden="true" className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', LIFE_TILE[lifecycle] || LIFE_TILE.pending, className)}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </span>
  );
}

/**
 * The leading mark of an Orders / Jobs row: the game's own icon (the category icon, tinted with its accent colour),
 * with the order status as a small badge on the corner. The game says what it is; the badge says where it stands.
 */
export function GameTile({ game, categories, lifecycle, className }) {
  const Status = LIFE_ICON[lifecycle] || LIFE_ICON.pending;
  const category = Array.isArray(categories) && game ? categories.find((c) => c.name?.trim().toLowerCase() === String(game).trim().toLowerCase()) : null;
  const tint = /^#[0-9a-f]{6}$/i.test(category?.color || '') ? `${category.color}1f` : undefined;
  return (
    <span className={cn('relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10', className)} style={tint ? { backgroundColor: tint } : undefined}>
      <GameIcon game={game} categories={categories} className="h-[22px] w-[22px] object-contain" />
      <span aria-hidden="true" className={cn('absolute -bottom-1 -end-1 inline-flex h-[15px] w-[15px] items-center justify-center rounded-full text-white ring-2 ring-zinc-50 dark:ring-zinc-950', (LIFE_STYLE[lifecycle] || LIFE_STYLE.pending).dot)}>
        <Status className="h-[9px] w-[9px]" strokeWidth={3} />
      </span>
    </span>
  );
}

/** A small fact on a row's second line: a quiet icon and its text. */
export function Meta({ icon: Icon, children, title, className }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 min-w-0 text-[11.5px] text-zinc-500 dark:text-zinc-400', className)}>
      {Icon && <Icon className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** The first letter of a name in a small circle, so a person is recognised before their name is read. */
export function Initial({ name, className }) {
  const letter = Array.from(String(name || '?').trim())[0] || '?';
  return (
    <span aria-hidden="true" className={cn('inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300', className)}>
      {letter.toUpperCase()}
    </span>
  );
}

/** The heading of one day in a list: the day on one side, what that day came to on the other. */
export function DayHeader({ label, aside, first = false }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 px-1 pb-1.5 text-[11.5px]', first ? 'pt-1' : 'pt-5')}>
      <h3 className="font-medium text-zinc-700 dark:text-zinc-300">{label}</h3>
      {aside && <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{aside}</span>}
    </div>
  );
}
