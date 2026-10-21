import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Select } from '../ui/Select';
import { GameIcon } from '../ui/GameIcon';
import { useLedgerFormat } from './format';

const ADD_VALUE = '__add_category__';
const NONE_VALUE = '';

/**
 * The game of an order, chosen from the user's categories (their icon and colour show next to the name).
 * The last entry opens the category editor, so a new game can be created without leaving the form.
 * A game that is on the order but not in the categories (an import, a renamed category) stays selectable.
 */
export function GameField({ value, onChange, categories = [], onAdd, label, className }) {
  const f = useLedgerFormat();

  const options = useMemo(() => {
    const opts = [{ value: NONE_VALUE, label: f.t('lg.game.none', 'No game') }];
    for (const cat of categories) {
      opts.push({
        value: cat.name,
        label: cat.name,
        icon: (
          <span className="flex items-center gap-1.5 shrink-0">
            <GameIcon game={cat.name} customIcon={cat.icon} className="w-3.5 h-3.5" />
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#71717A' }} />
          </span>
        ),
      });
    }
    const current = (value || '').trim();
    if (current && !opts.some((o) => String(o.value).toLowerCase() === current.toLowerCase())) {
      opts.push({ value: current, label: current, icon: <GameIcon game={current} className="w-3.5 h-3.5" /> });
    }
    if (onAdd) opts.push({ value: ADD_VALUE, label: f.t('lg.game.add', 'Add a game or category…'), icon: <Plus className="w-3.5 h-3.5" /> });
    return opts;
  }, [categories, value, onAdd, f]);

  // match the stored name to the option regardless of case, so a saved "world of warcraft" still shows as selected
  const selected = options.find((o) => o.value !== ADD_VALUE && String(o.value).toLowerCase() === (value || '').trim().toLowerCase())?.value ?? NONE_VALUE;

  return (
    <div className={className}>
      {label && <span className="text-xs text-zinc-500">{label}</span>}
      <Select
        value={selected}
        onChange={(v) => (v === ADD_VALUE ? onAdd?.() : onChange(v))}
        options={options}
        ariaLabel={label || f.t('lg.order.game', 'Game')}
        prefixIcon={<GameIcon game={value} categories={categories} className="w-4 h-4" />}
        className={label ? 'mt-1' : undefined}
      />
    </div>
  );
}
