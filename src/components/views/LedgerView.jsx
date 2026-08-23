import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  UploadCloud,
  X,
  CheckCircle2,
  TrendingUp,
  Clock,
  Coins,
  Banknote,
  Users,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { StatusBadge } from '../ui/Badge';
import { GameIcon } from '../ui/GameIcon';
import { MoneyDisplay, ConvertedSecondaryDisplay } from '../ui/MoneyDisplay';
import { Kbd } from '../ui/Tooltip';
import { motion, AnimatePresence } from 'motion/react';
import {
  formatMoney,
  convertCurrency,
  convertEntryCurrency,
  formatConvertedSecondary,
  STATUSES,
  GAMES,
} from '../../lib/currencies';

const ITEMS_PER_PAGE = 15;

export function LedgerView({
  entries = [],
  globalCurrency = 'TOMAN',
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
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [hasProofFilter, setHasProofFilter] = useState(false);
  const [teammateFilter, setTeammateFilter] = useState('');
  const [sortOption, setSortOption] = useState('date_desc');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
  const [promptProofEntryId, setPromptProofEntryId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const rates = useMemo(
    () => ({ goldRateTOMAN }),
    [goldRateTOMAN]
  );

  // Reset page when any filter criteria changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, currencyFilter, gameFilter, hasProofFilter, teammateFilter, sortOption]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let list = [...entries];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.game && e.game.toLowerCase().includes(q)) ||
          (e.source && e.source.toLowerCase().includes(q)) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          (e.status && e.status.toLowerCase().includes(q)) ||
          (e.teammates && Array.isArray(e.teammates) && e.teammates.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (statusFilter) {
      list = list.filter((e) => e.status === statusFilter);
    }

    if (currencyFilter) {
      list = list.filter((e) => e.currency === currencyFilter);
    }

    if (gameFilter) {
      list = list.filter((e) => e.game === gameFilter);
    }

    if (hasProofFilter) {
      list = list.filter((e) => e.proofs && e.proofs.length > 0);
    }

    if (teammateFilter) {
      const tf = teammateFilter.toLowerCase();
      list = list.filter(
        (e) => e.teammates && Array.isArray(e.teammates) && e.teammates.some((t) => t.toLowerCase() === tf)
      );
    }

    list.sort((a, b) => {
      if (sortOption === 'date_desc') return new Date(b.dateTime || 0) - new Date(a.dateTime || 0);
      if (sortOption === 'date_asc') return new Date(a.dateTime || 0) - new Date(b.dateTime || 0);
      if (sortOption === 'income_desc') {
        const valA = convertEntryCurrency(a, globalCurrency, rates);
        const valB = convertEntryCurrency(b, globalCurrency, rates);
        return valB - valA;
      }
      if (sortOption === 'income_asc') {
        const valA = convertEntryCurrency(a, globalCurrency, rates);
        const valB = convertEntryCurrency(b, globalCurrency, rates);
        return valA - valB;
      }
      return 0;
    });

    return list;
  }, [entries, searchQuery, statusFilter, currencyFilter, gameFilter, hasProofFilter, teammateFilter, sortOption, globalCurrency, rates]);

  // Aggregate metrics for compact balance summary
  const metrics = useMemo(() => {
    let totalPaid = 0;
    let paidCount = 0;
    let totalPending = 0;
    let pendingCount = 0;
    let totalValue = 0;

    filteredEntries.forEach((e) => {
      const convertedInc = convertEntryCurrency(e, globalCurrency, rates);

      totalValue += convertedInc;

      if (e.status === 'Paid') {
        totalPaid += convertedInc;
        paidCount++;
      } else {
        totalPending += convertedInc;
        pendingCount++;
      }
    });

    const completionRate =
      filteredEntries.length > 0 ? Math.round((paidCount / filteredEntries.length) * 100) : 0;
    const avgRate = filteredEntries.length > 0 ? totalValue / filteredEntries.length : 0;

    return {
      totalPaid,
      paidCount,
      totalPending,
      pendingCount,
      totalValue,
      completionRate,
      avgRate,
    };
  }, [filteredEntries, globalCurrency, rates]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ITEMS_PER_PAGE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEntries.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEntries, currentPage]);

  // Daily Date Grouping with Day Subtotals
  const dateGroups = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = yesterday.toDateString();

    const groupsMap = new Map();

    paginatedEntries.forEach((entry) => {
      const d = new Date(entry.dateTime);
      let groupTitle = 'Earlier';
      if (!isNaN(d.getTime())) {
        const dStr = d.toDateString();
        if (dStr === todayStr) {
          groupTitle = 'Today';
        } else if (dStr === yesterdayStr) {
          groupTitle = 'Yesterday';
        } else {
          groupTitle = d.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
        }
      }

      if (!groupsMap.has(groupTitle)) {
        groupsMap.set(groupTitle, []);
      }
      groupsMap.get(groupTitle).push(entry);
    });

    return Array.from(groupsMap.entries()).map(([groupTitle, groupItems]) => {
      const dayTotal = groupItems.reduce(
        (sum, item) => sum + convertEntryCurrency(item, globalCurrency, rates),
        0
      );
      return { groupTitle, groupItems, dayTotal };
    });
  }, [paginatedEntries, globalCurrency, rates]);

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

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setCurrencyFilter('');
    setGameFilter('');
    setTeammateFilter('');
    setHasProofFilter(false);
    setSortOption('date_desc');
  };

  const hasAdvancedFilters = Boolean(searchQuery.trim() || gameFilter || sortOption !== 'date_desc');

  const handleStatusSelect = (entry, nextStatus) => {
    onFlipStatus?.(entry.id, entry.status, nextStatus);
    if (nextStatus === 'Paid' && (!entry.proofs || entry.proofs.length === 0)) {
      setPromptProofEntryId(entry.id);
    } else if (promptProofEntryId === entry.id) {
      setPromptProofEntryId(null);
    }
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* 1. Compact Total Earned Summary Card */}
      <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/80 p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Total Earned
            </span>
            {filteredEntries.length !== entries.length && (
              <button
                type="button"
                onClick={handleClearFilters}
                title="Click to clear all active filters"
                className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
              >
                <span>Filtered ({filteredEntries.length}/{entries.length})</span>
                <X className="w-2.5 h-2.5 text-zinc-500" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">
              {metrics.completionRate}% Paid
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
            <MoneyDisplay amount={metrics.totalPaid} currency={globalCurrency} />
          </div>
          {globalCurrency !== 'GOLD' && (
            <ConvertedSecondaryDisplay
              amount={metrics.totalPaid}
              fromCurrency={globalCurrency}
              targetCurrency="GOLD"
              rates={rates}
            />
          )}
        </div>

        {/* Dual Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden flex">
            <div
              className="bg-zinc-100 h-full transition-all duration-300"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPaid / metrics.totalValue) * 100 : 0}%`,
              }}
            />
            <div
              className="bg-zinc-600 h-full transition-all duration-300"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPending / metrics.totalValue) * 100 : 0}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-400 font-mono">
            <span className="flex items-center gap-1">
              <span>Paid:</span>
              <strong className="text-zinc-200">
                <MoneyDisplay amount={metrics.totalPaid} currency={globalCurrency} />
              </strong>
              <span>({metrics.paidCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <span>Pending:</span>
              <strong className="text-zinc-300">
                <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} />
              </strong>
              <span>({metrics.pendingCount})</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Quick Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Jobs Done</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-zinc-100 font-mono">
            {metrics.paidCount} <span className="text-xs text-zinc-500 font-normal">/ {filteredEntries.length}</span>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Pending Payout</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-zinc-100 font-mono truncate">
            <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-300" />
            <span>Average Rate</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-zinc-100 font-mono truncate">
            <MoneyDisplay amount={metrics.avgRate} currency={globalCurrency} compact={true} />
          </div>
        </div>
      </div>

      {/* 3. Compact / Collapsible Search & Filter Bar */}
      <div className="space-y-2.5">
        {/* Quick Filter Bar (Status Chips + Currency Chips + Teammate Chip + Search Drawer Toggle) */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            {/* Status Chips */}
            <div className="flex items-center gap-1">
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
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                  hasProofFilter
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <FileImage className="w-3 h-3" />
                <span>Proof</span>
              </button>
            </div>

            <div className="h-4 w-px bg-zinc-800 shrink-0 hidden sm:block" />

            {/* Currency Payment Type Chips */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrencyFilter(currencyFilter === 'GOLD' ? '' : 'GOLD')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currencyFilter === 'GOLD'
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-800 font-semibold shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <Coins className="w-3 h-3 text-amber-400" />
                <span>Gold</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrencyFilter(currencyFilter === 'TOMAN' ? '' : 'TOMAN')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currencyFilter === 'TOMAN'
                    ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <Banknote className="w-3 h-3" />
                <span className="font-sans">تومان</span>
              </button>
            </div>

            {/* Active Teammate Filter Chip */}
            {teammateFilter && (
              <button
                type="button"
                onClick={() => setTeammateFilter('')}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-800 text-zinc-100 border border-zinc-700 flex items-center gap-1.5 whitespace-nowrap shadow-sm"
              >
                <Users className="w-3 h-3 text-zinc-400" />
                <span>Crew: {teammateFilter}</span>
                <X className="w-3 h-3 text-zinc-400 hover:text-zinc-100" />
              </button>
            )}
          </div>

          {/* Toggle Search & Advanced Filters Drawer */}
          <div className="shrink-0 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsSearchExpanded((prev) => !prev);
                if (!isSearchExpanded) {
                  setTimeout(() => searchInputRef?.current?.focus(), 80);
                }
              }}
              title="Toggle Search, Games & Sort (Press / to search)"
              className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                isSearchExpanded || hasAdvancedFilters
                  ? 'bg-zinc-800 text-zinc-100 border-zinc-700 font-semibold'
                  : 'bg-zinc-900/80 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search & Filters</span>
              <Kbd className="text-[9px] bg-zinc-900/80 border-zinc-700 text-zinc-400 px-1 py-0">/</Kbd>
              {hasAdvancedFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Search, Game & Sort Drawer */}
        <AnimatePresence>
          {(isSearchExpanded || hasAdvancedFilters) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search jobs, games, seller source, teammates, notes... (Press / to focus)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-7 h-8 text-xs bg-zinc-900 border-zinc-800"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="w-full sm:w-36">
                    <Select
                      value={gameFilter}
                      onChange={setGameFilter}
                      options={gameOptions}
                      className="h-8 text-xs bg-zinc-900 border-zinc-800"
                    />
                  </div>

                  <div className="w-full sm:w-36">
                    <Select
                      value={sortOption}
                      onChange={setSortOption}
                      options={sortOptions}
                      className="h-8 text-xs bg-zinc-900 border-zinc-800"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Grouped Job Feed */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center space-y-3">
          <p className="text-xs text-zinc-500">
            {searchQuery || statusFilter || gameFilter || hasProofFilter || teammateFilter
              ? 'No jobs match the selected filters.'
              : 'No work records logged yet.'}
          </p>
          <Button variant="primary" size="sm" onClick={() => onOpenWorkModal?.()}>
            <Plus className="w-3.5 h-3.5" />
            <span>Add Work</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {dateGroups.map(({ groupTitle, groupItems, dayTotal }) => {
            if (groupItems.length === 0) return null;

            return (
              <div key={groupTitle} className="space-y-2">
                {/* Daily Group Header with Day Total Income Badge */}
                <div className="flex items-center justify-between px-1 py-1 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      {groupTitle}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      ({groupItems.length} {groupItems.length === 1 ? 'job' : 'jobs'})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900/90 border border-zinc-800/90 text-[11px] font-mono text-zinc-300 shadow-sm">
                    <span className="text-zinc-500 text-[9px] uppercase font-sans font-semibold">Day Total:</span>
                    <strong className="text-zinc-100 font-semibold">
                      <MoneyDisplay amount={dayTotal} currency={globalCurrency} />
                    </strong>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {groupItems.map((entry) => {
                    const isActionOpen = activeActionMenuId === entry.id;
                    const isProofPrompting = promptProofEntryId === entry.id;

                    return (
                      <div key={entry.id} className="space-y-1">
                        <div
                          className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3 rounded-xl bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/60 transition-colors"
                        >
                          {/* Left: Thumbnail / Emblem & Details */}
                          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            {entry.proofs && entry.proofs.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => onOpenLightbox?.(entry.proofs[0].data, entry.title)}
                                title="View screenshot proof"
                                className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 hover:text-white shrink-0 group relative overflow-hidden mt-0.5 sm:mt-0"
                              >
                                <img
                                  src={entry.proofs[0].data}
                                  alt="Proof"
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                              </button>
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 p-1.5 mt-0.5 sm:mt-0">
                                <GameIcon game={entry.game} className="w-full h-full" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1 space-y-0.5">
                              {/* Line 1: Title & Seller Badge */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-zinc-200 truncate">
                                  {entry.title}
                                </span>
                                {entry.source && (
                                  <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800/80">
                                    {entry.source}
                                  </span>
                                )}
                              </div>

                              {/* Line 2: Game & Notes */}
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 truncate">
                                <span>{entry.game}</span>
                                {entry.notes && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-[180px] text-zinc-500 italic">
                                      "{entry.notes}"
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Line 3: Interactive Teammate Badges */}
                              {entry.teammates && entry.teammates.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px]">
                                  <span className="text-zinc-500 flex items-center gap-1">
                                    <Users className="w-3 h-3 text-zinc-500" />
                                    <span>Crew:</span>
                                  </span>
                                  {entry.teammates.map((tm) => {
                                    const isMatch = teammateFilter.toLowerCase() === tm.toLowerCase();
                                    return (
                                      <button
                                        key={tm}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTeammateFilter(isMatch ? '' : tm);
                                        }}
                                        title={`Click to filter jobs with ${tm}`}
                                        className={`px-1.5 py-0.2 rounded text-[10px] font-medium transition-colors border ${
                                          isMatch
                                            ? 'bg-zinc-100 text-zinc-950 font-semibold border-zinc-200 shadow-sm'
                                            : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800/80'
                                        }`}
                                      >
                                        {tm}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Income, Status, Menu */}
                          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-zinc-800/60">
                            <div className="text-left sm:text-right">
                              <div className="text-xs font-semibold text-zinc-100 font-mono">
                                <MoneyDisplay amount={entry.income} currency={entry.currency} />
                              </div>
                              {entry.currency !== globalCurrency && (
                                <ConvertedSecondaryDisplay
                                  amount={entry.income}
                                  fromCurrency={entry.currency}
                                  targetCurrency={globalCurrency}
                                  rates={rates}
                                  customRate={entry.exchangeRate}
                                  isPerOneGold={entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic'}
                                  showRateLabel={true}
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusBadge
                                status={entry.status}
                                interactive={true}
                                onSelectStatus={(st) => handleStatusSelect(entry, st)}
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
                        </div>

                        {/* In-Row Animated Proof Prompt Overlay */}
                        <AnimatePresence>
                          {isProofPrompting && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="p-2.5 rounded-xl bg-zinc-900 border border-emerald-900/60 shadow-lg flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="text-zinc-200 font-medium truncate">
                                  Marked as Paid! Would you like to attach screenshot proof?
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  variant="primary"
                                  size="xs"
                                  onClick={() => {
                                    onOpenWorkModal?.(entry);
                                    setPromptProofEntryId(null);
                                  }}
                                  className="h-7 text-xs gap-1"
                                >
                                  <UploadCloud className="w-3 h-3" />
                                  <span>Attach Proof</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setPromptProofEntryId(null)}
                                  className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
                                >
                                  <span>Dismiss</span>
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 5. Numbered Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800/80 text-xs text-zinc-400">
              <span className="text-zinc-500 font-mono text-[11px]">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredEntries.length)} of {filteredEntries.length} jobs
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="h-8 px-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  if (
                    totalPages > 7 &&
                    pageNum !== 1 &&
                    pageNum !== totalPages &&
                    Math.abs(pageNum - currentPage) > 1
                  ) {
                    if (pageNum === 2 || pageNum === totalPages - 1) {
                      return (
                        <span key={pageNum} className="px-1 text-zinc-600 font-mono">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => {
                        setCurrentPage(pageNum);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`h-8 w-8 rounded-md text-xs font-mono font-medium transition-colors border ${
                        currentPage === pageNum
                          ? 'bg-zinc-100 text-zinc-950 font-semibold border-zinc-200 shadow-sm'
                          : 'bg-zinc-900/80 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="h-8 px-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LedgerView;
