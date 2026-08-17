import React from 'react';
import { Search, X, Table as TableIcon, LayoutGrid } from 'lucide-react';
import { Select } from './ui/Select';
import { Kbd } from './ui/Tooltip';

const GAME_FILTER_OPTIONS = [
  { value: '', label: 'All Games' },
  { value: 'World of Warcraft', label: 'World of Warcraft' },
  { value: 'World of Warcraft Classic', label: 'World of Warcraft Classic' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Working', label: 'Working' },
  { value: 'On Hold', label: 'On Hold' },
];

const PROOF_FILTER_OPTIONS = [
  { value: '', label: 'All Proof' },
  { value: 'has_proof', label: 'With Proof' },
  { value: 'no_proof', label: 'No Proof' },
];

const SORT_FILTER_OPTIONS = [
  { value: 'date_desc', label: 'Newest' },
  { value: 'date_asc', label: 'Oldest' },
  { value: 'income_desc', label: 'Highest Income' },
  { value: 'income_asc', label: 'Lowest Income' },
  { value: 'title_asc', label: 'Title A-Z' },
];

export function Toolbar({
  searchQuery,
  onSearchChange,
  gameFilter = '',
  onGameFilterChange,
  categoryFilter, // backwards-compatible alias
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  proofFilter,
  onProofFilterChange,
  sortOption,
  onSortOptionChange,
  viewMode,
  onViewModeChange,
  visibleCount = 0,
  totalCount = 0,
  searchInputRef,
}) {
  const currentCategoryOrGame = gameFilter !== undefined ? gameFilter : categoryFilter;
  const handleGameChange = onGameFilterChange || onCategoryFilterChange;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-3">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.07] p-2 rounded-xl backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search jobs, notes, clients... (/)"
            className="w-full bg-white/[0.04] border border-white/[0.08] hover:border-white/20 focus:border-white/30 focus:bg-white/[0.06] text-xs text-white placeholder:text-zinc-400 pl-9 pr-14 py-2 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Kbd className="hidden sm:inline-flex text-[10px] text-zinc-400">
                /
              </Kbd>
            )}
          </div>
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Game Filter */}
          <div className="min-w-[140px]">
            <Select
              value={currentCategoryOrGame}
              onChange={(val) => handleGameChange?.(val)}
              options={GAME_FILTER_OPTIONS}
              placeholder="All Games"
            />
          </div>

          {/* Status Filter */}
          <div className="min-w-[125px]">
            <Select
              value={statusFilter}
              onChange={(val) => onStatusFilterChange(val)}
              options={STATUS_FILTER_OPTIONS}
              placeholder="All Statuses"
            />
          </div>

          {/* Proof Filter */}
          <div className="min-w-[115px]">
            <Select
              value={proofFilter}
              onChange={(val) => onProofFilterChange(val)}
              options={PROOF_FILTER_OPTIONS}
              placeholder="All Proof"
            />
          </div>

          {/* Sort Select */}
          <div className="min-w-[130px]">
            <Select
              value={sortOption}
              onChange={(val) => onSortOptionChange(val)}
              options={SORT_FILTER_OPTIONS}
              placeholder="Sort by"
            />
          </div>

          {/* View Switcher (Dense Table vs Cards) */}
          <div className="flex items-center bg-black/40 border border-white/[0.08] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange('dense')}
              title="Dense Table View (V)"
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'dense'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              title="Compact Cards View (V)"
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'cards'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Counter bar */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 px-1">
        <span>
          Showing <strong className="text-zinc-200">{visibleCount}</strong> of{' '}
          <strong className="text-zinc-200">{totalCount}</strong> jobs
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px]">
          <span className="text-emerald-400">💡</span> Press <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> in modal to attach screenshot proof
        </span>
      </div>
    </div>
  );
}

export default Toolbar;
