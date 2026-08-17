import React from 'react';
import { CATEGORIES, STATUSES } from '../lib/currencies';
import { Search, X, Table as TableIcon, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { Kbd } from './ui/Tooltip';

export function Toolbar({
  searchQuery,
  onSearchChange,
  categoryFilter,
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
  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-3">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.07] p-2 rounded-xl backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks, games, tags, client, deliverable URL... (/)"
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
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] hover:border-white/20 focus:border-white/30 text-xs text-zinc-300 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-[#0c0c0e]">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-[#0c0c0e]">
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] hover:border-white/20 focus:border-white/30 text-xs text-zinc-300 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-[#0c0c0e]">All Statuses</option>
            {STATUSES.map((st) => (
              <option key={st} value={st} className="bg-[#0c0c0e]">
                {st}
              </option>
            ))}
          </select>

          {/* Proof Filter */}
          <select
            value={proofFilter}
            onChange={(e) => onProofFilterChange(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] hover:border-white/20 focus:border-white/30 text-xs text-zinc-300 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-[#0c0c0e]">All Proof</option>
            <option value="has_proof" className="bg-[#0c0c0e]">📸 With Screenshot Proof</option>
            <option value="no_proof" className="bg-[#0c0c0e]">No Proof</option>
          </select>

          {/* Sort Select */}
          <select
            value={sortOption}
            onChange={(e) => onSortOptionChange(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] hover:border-white/20 focus:border-white/30 text-xs text-zinc-300 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer font-medium"
          >
            <option value="date_desc" className="bg-[#0c0c0e]">Newest First</option>
            <option value="date_asc" className="bg-[#0c0c0e]">Oldest First</option>
            <option value="income_desc" className="bg-[#0c0c0e]">Highest Income</option>
            <option value="income_asc" className="bg-[#0c0c0e]">Lowest Income</option>
            <option value="title_asc" className="bg-[#0c0c0e]">Title (A-Z)</option>
          </select>

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
          <strong className="text-zinc-200">{totalCount}</strong> entries
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px]">
          <span className="text-emerald-400">💡</span> Press <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> anywhere in modal to attach screenshot
        </span>
      </div>
    </div>
  );
}
