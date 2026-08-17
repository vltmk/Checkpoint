import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  Filter,
  Plus,
  Receipt,
  FileImage,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { StatusBadge } from '../ui/Badge';
import { Kbd } from '../ui/Tooltip';
import {
  formatMoney,
  convertCurrency,
  formatConvertedSecondary,
  STATUSES,
  GAMES,
} from '../../lib/currencies';

export function LedgerView({
  entries = [],
  globalCurrency = 'USD',
  goldRateUSD = 0.035,
  goldRateTOMAN = 3200,
  onOpenWorkModal,
  onOpenReceipt,
  onOpenLightbox,
  onFlipStatus,
  onDuplicateEntry,
  onDeleteEntry,
  searchInputRef,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [hasProofFilter, setHasProofFilter] = useState(false);
  const [sortOption, setSortOption] = useState('date_desc');
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);

  const rates = useMemo(
    () => ({ goldRateUSD, goldRateTOMAN }),
    [goldRateUSD, goldRateTOMAN]
  );

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let list = [...entries];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.game && e.game.toLowerCase().includes(q)) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          (e.status && e.status.toLowerCase().includes(q))
      );
    }

    if (statusFilter) {
      list = list.filter((e) => e.status === statusFilter);
    }

    if (gameFilter) {
      list = list.filter((e) => e.game === gameFilter);
    }

    if (hasProofFilter) {
      list = list.filter((e) => e.proofs && e.proofs.length > 0);
    }

    list.sort((a, b) => {
      if (sortOption === 'date_desc') return new Date(b.dateTime || 0) - new Date(a.dateTime || 0);
      if (sortOption === 'date_asc') return new Date(a.dateTime || 0) - new Date(b.dateTime || 0);
      if (sortOption === 'income_desc') {
        const valA = convertCurrency(a.income, a.currency, globalCurrency, rates);
        const valB = convertCurrency(b.income, b.currency, globalCurrency, rates);
        return valB - valA;
      }
      if (sortOption === 'income_asc') {
        const valA = convertCurrency(a.income, a.currency, globalCurrency, rates);
        const valB = convertCurrency(b.income, b.currency, globalCurrency, rates);
        return valA - valB;
      }
      return 0;
    });

    return list;
  }, [entries, searchQuery, statusFilter, gameFilter, hasProofFilter, sortOption, globalCurrency, rates]);

  // Date grouping
  const dateGroups = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = yesterday.toDateString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const groups = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Earlier: [],
    };

    filteredEntries.forEach((entry) => {
      const d = new Date(entry.dateTime);
      if (isNaN(d.getTime())) {
        groups.Earlier.push(entry);
        return;
      }

      const dStr = d.toDateString();
      if (dStr === todayStr) {
        groups.Today.push(entry);
      } else if (dStr === yesterdayStr) {
        groups.Yesterday.push(entry);
      } else if (d > sevenDaysAgo) {
        groups['This Week'].push(entry);
      } else {
        groups.Earlier.push(entry);
      }
    });

    return groups;
  }, [filteredEntries]);

  const gameOptions = [
    { value: '', label: 'All Games' },
    ...GAMES.map((g) => ({ value: g, label: g })),
  ];

  const sortOptions = [
    { value: 'date_desc', label: 'Newest First' },
    { value: 'date_asc', label: 'Oldest First' },
    { value: 'income_desc', label: 'Highest Income' },
    { value: 'income_asc', label: 'Lowest Income' },
  ];

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* 1. Search & Filter Bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search jobs, games, notes... (Press / to search)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            )}
          </div>

          <div className="w-36 hidden sm:block">
            <Select
              value={gameFilter}
              onChange={setGameFilter}
              options={gameOptions}
              className="h-9 text-xs"
            />
          </div>

          <div className="w-36 hidden sm:block">
            <Select
              value={sortOption}
              onChange={setSortOption}
              options={sortOptions}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
              statusFilter === ''
                ? 'bg-zinc-100 text-zinc-950 font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            All ({entries.length})
          </button>

          {STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(statusFilter === st ? '' : st)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {st}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setHasProofFilter((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
              hasProofFilter
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <FileImage className="w-3 h-3" />
            <span>With Proof</span>
          </button>
        </div>
      </div>

      {/* 2. Grouped Job Feed */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center space-y-3">
          <p className="text-xs text-zinc-500">
            {searchQuery || statusFilter || gameFilter || hasProofFilter
              ? 'No jobs match the selected filters.'
              : 'No work records logged yet.'}
          </p>
          <Button variant="primary" size="sm" onClick={() => onOpenWorkModal?.()}>
            <Plus className="w-3.5 h-3.5" />
            <span>Log Work</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(dateGroups).map(([groupTitle, groupItems]) => {
            if (groupItems.length === 0) return null;

            return (
              <div key={groupTitle} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {groupTitle}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600">
                    {groupItems.length} {groupItems.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {groupItems.map((entry) => {
                    const secondary = formatConvertedSecondary(
                      entry.income,
                      entry.currency,
                      globalCurrency,
                      rates
                    );

                    const isActionOpen = activeActionMenuId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        className="relative flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/60 transition-colors"
                      >
                        {/* Left: Thumbnail & Details */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {entry.proofs && entry.proofs.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => onOpenLightbox?.(entry.proofs[0].data, entry.title)}
                              title="View screenshot proof"
                              className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 hover:text-white shrink-0"
                            >
                              <FileImage className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                              <Receipt className="w-4 h-4" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-zinc-200 truncate">
                                {entry.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5 truncate">
                              <span>{entry.game}</span>
                              {entry.hours && (
                                <>
                                  <span>•</span>
                                  <span>{entry.hours}h</span>
                                </>
                              )}
                              {entry.notes && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[150px] text-zinc-500 italic">
                                    "{entry.notes}"
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Income, Status, Menu */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-semibold text-zinc-100 font-mono">
                              {formatMoney(entry.income, entry.currency)}
                            </div>
                            {secondary && (
                              <div className="text-[10px] text-zinc-500 font-mono">
                                {secondary}
                              </div>
                            )}
                          </div>

                          <StatusBadge
                            status={entry.status}
                            interactive={true}
                            onClick={() => onFlipStatus?.(entry.id, entry.status)}
                          />

                          {/* 3-Dot Action Menu */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenuId(isActionOpen ? null : entry.id);
                              }}
                              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {isActionOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-36 bg-zinc-950 border border-zinc-800 shadow-xl rounded-lg p-1 space-y-0.5 z-50 text-xs"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenReceipt?.(entry);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                >
                                  <Receipt className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Client Receipt</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenWorkModal?.(entry);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Edit Record</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    onDuplicateEntry?.(entry.id);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                >
                                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Duplicate</span>
                                </button>

                                <div className="border-t border-zinc-800 my-0.5" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteEntry?.(entry.id);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LedgerView;
