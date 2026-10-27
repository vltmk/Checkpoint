import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { POPOVER } from '../../lib/motion';
import { slug, UNASSIGNED_PARTY_ID, UNKNOWN_PAYER_ID } from '../../lib/ledger/legacyMapper';
import { useLedgerFormat } from './format';

const MAX_SHOWN = 8;

/**
 * A name field for a client, platform, booster or teammate that knows the people already in the ledger.
 *  - typing lists the matches (saved ones first, then the most recently used); Tab or Enter takes the first
 *  - the arrow opens the whole list
 *  - the star saves a person, so they stay at the top of the list and show as a one-tap chip
 * Nothing is suggested from a built-in list: only names the user has entered before.
 *
 * people: [{ id, name, saved, hint? }]. value is the typed name (a new name is fine: it is created on save).
 * onToggleSave(person) saves or unsaves an existing person; for a name that is not in the ledger yet the star
 * calls onToggleSave(null) and the caller remembers to save it once it exists (`pendingSave`).
 */
export function PartyCombobox({ value, onChange, people, onToggleSave, pendingSave = false, placeholder, ariaLabel, autoFocus }) {
  const f = useLedgerFormat();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false); // filter only after the user types, so the arrow shows everyone
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState(null);

  const q = slug(value || '');
  const current = useMemo(() => people.find((p) => slug(p.name) === q) || null, [people, q]);
  const matches = useMemo(() => {
    const list = typed && q ? people.filter((p) => slug(p.name).includes(q)) : people;
    // names that start with what was typed come before names that only contain it
    return [...list]
      .sort((a, b) => Number(Boolean(b.saved)) - Number(Boolean(a.saved)) || (typed && q ? Number(slug(b.name).startsWith(q)) - Number(slug(a.name).startsWith(q)) : 0))
      .slice(0, MAX_SHOWN);
  }, [people, q, typed]);
  const showList = open && matches.length > 0 && !(matches.length === 1 && current && slug(matches[0].name) === q && typed);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < 240 && r.top > below;
    setAnchor({
      left: r.left,
      width: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      maxHeight: Math.max(140, Math.min(280, (up ? r.top : below) - 12)),
    });
  }, [open, matches.length]);

  // the list is fixed to the window: close it when anything scrolls or the window resizes, or on a click elsewhere
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e?.target instanceof Node && (listRef.current?.contains(e.target) || wrapRef.current?.contains(e.target))) return;
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', close);
    };
  }, [open]);

  useEffect(() => { setActive(0); }, [q, open]);

  const pick = (p) => {
    onChange(p.name);
    setOpen(false);
    setTyped(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); setTyped(false); return; }
      setActive((i) => Math.min(matches.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && showList && matches[active] && !(e.ctrlKey || e.metaKey)) {
      // Tab fills the highlighted name and moves on; Enter fills it and stays
      if (slug(matches[active].name) !== q || e.key === 'Enter') {
        if (e.key === 'Enter') e.preventDefault();
        pick(matches[active]);
      }
    } else if (e.key === 'Escape' && open) {
      // close the list, not the dialog around it
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
      setOpen(false);
    }
  };

  const starred = current ? Boolean(current.saved) : pendingSave;

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => { onChange(e.target.value); setTyped(true); setOpen(true); }}
        onFocus={() => { setTyped(false); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        dir="auto"
        className={cn(
          'h-9 w-full rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/80 dark:bg-zinc-900/80 ps-3 pe-[3.75rem] text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none focus:border-zinc-300 dark:focus:border-zinc-700 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-[background-color,border-color,box-shadow] duration-100'
        )}
      />
      <div className="absolute inset-y-0 end-1 flex items-center gap-0.5">
        {value.trim() && onToggleSave && (
          <button
            type="button"
            onClick={() => onToggleSave(current)}
            aria-pressed={starred}
            aria-label={starred ? f.t('lg.party.unsave', 'Remove from saved') : f.t('lg.party.save', 'Save for next time')}
            title={starred ? f.t('lg.party.unsave', 'Remove from saved') : f.t('lg.party.save', 'Save for next time')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors"
          >
            <Star className={cn('h-3.5 w-3.5', starred && 'fill-amber-400 text-amber-500 dark:text-amber-400')} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setTyped(false); setOpen((o) => !o); inputRef.current?.focus(); }}
          aria-label={f.t('lg.party.showAll', 'Show saved and recent')}
          className="inline-flex h-7 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </div>

      {createPortal(
        <AnimatePresence>
          {showList && anchor && (
            <motion.ul
              ref={listRef}
              role="listbox"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={POPOVER}
              style={anchor}
              dir={f.isRtl ? 'rtl' : 'ltr'}
              className="fixed z-[300] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1 shadow-xl origin-top"
            >
              {matches.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <div
                    onMouseEnter={() => setActive(i)}
                    className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-xs', i === active ? 'bg-zinc-100 dark:bg-zinc-900' : '')}
                  >
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} className="flex min-w-0 flex-1 items-center gap-2 text-start">
                      <span className="truncate text-zinc-900 dark:text-zinc-100">{p.name}</span>
                      {p.hint && <span className="shrink-0 truncate text-[10.5px] text-zinc-400 dark:text-zinc-500">{p.hint}</span>}
                    </button>
                    {onToggleSave && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onToggleSave(p)}
                        aria-pressed={Boolean(p.saved)}
                        aria-label={p.saved ? f.t('lg.party.unsave', 'Remove from saved') : f.t('lg.party.save', 'Save for next time')}
                        className="shrink-0 rounded p-0.5 text-zinc-300 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        <Star className={cn('h-3 w-3', p.saved && 'fill-amber-400 text-amber-500 dark:text-amber-400')} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {typed && q && (
                <li className="px-2 pb-1 pt-1.5 text-[10.5px] text-zinc-400 dark:text-zinc-500">{f.t('lg.party.tabHint', 'Tab or Enter fills the highlighted name')}</li>
              )}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

/**
 * The people a combobox offers, for some party kinds: saved first, then by when they were last on a job.
 * Placeholder people from the upgrade and the sample data are left out.
 */
export function usePartyChoices(ctx, partyById, kinds, f) {
  return useMemo(() => {
    if (!ctx) return [];
    const last = new Map();
    const bump = (id, iso) => {
      const t = Date.parse(iso) || 0;
      if (id && t > (last.get(id) || 0)) last.set(id, t);
    };
    for (const o of ctx.orders) {
      bump(o.payerId, o.dateTime);
    }
    for (const s of ctx.shares) bump(s.partyId, ctx.orderById.get(s.orderId)?.dateTime);
    return [...partyById.values()]
      .filter((p) => kinds.includes(p.kind) && !p.archived && p.id !== UNASSIGNED_PARTY_ID && p.id !== UNKNOWN_PAYER_ID && !p.id.startsWith('demo_') && p.name?.trim())
      .map((p) => ({ id: p.id, name: p.name, saved: Boolean(p.settings?.saved), kind: p.kind, hint: p.kind === 'platform' ? f.t('lg.party.platform', 'platform') : '' }))
      .sort((a, b) => Number(b.saved) - Number(a.saved) || (last.get(b.id) || 0) - (last.get(a.id) || 0) || a.name.localeCompare(b.name));
  }, [ctx, partyById, kinds.join(','), f]); // eslint-disable-line react-hooks/exhaustive-deps
}
