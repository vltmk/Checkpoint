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
  Check,
  TrendingUp,
  Clock,
  Coins,
  Banknote,
  Users,
  CheckSquare,
  Square,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { StatusBadge } from '../ui/Badge';
import { GameIcon } from '../ui/GameIcon';
import { MoneyDisplay, ConvertedSecondaryDisplay } from '../ui/MoneyDisplay';
import { Kbd } from '../ui/Tooltip';
import { cn } from '../../lib/utils';
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
  onBulkDelete,
  onBulkUpdateStatus,
  onBulkExportCsv,
  searchInputRef,
  externalTeammateFilter = '',
  onClearExternalTeammateFilter,
  onToast,
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
  const [selectedDayKeys, setSelectedDayKeys] = useState(new Set());
  const [isSumCopied, setIsSumCopied] = useState(false);

  // Bulk Actions & Single Delete In-Line Confirmation States
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState(null);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const rates = useMemo(
    () => ({ goldRateTOMAN }),
    [goldRateTOMAN]
  );

  // Sync external teammate filter from receipt or other views
  useEffect(() => {
    if (externalTeammateFilter) {
      setTeammateFilter(externalTeammateFilter);
      onClearExternalTeammateFilter?.();
    }
  }, [externalTeammateFilter, onClearExternalTeammateFilter]);

  // Reset page & selections when filter criteria changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedDayKeys(new Set());
    setSelectedEntryIds(new Set());
    setConfirmDeleteEntryId(null);
    setIsBulkDeleting(false);
    setIsStatusDropdownOpen(false);
  }, [searchQuery, statusFilter, currencyFilter, gameFilter, hasProofFilter, teammateFilter, sortOption]);

  // Close action menus & status dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      if (activeActionMenuId) setActiveActionMenuId(null);
      if (isStatusDropdownOpen) setIsStatusDropdownOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeActionMenuId, isStatusDropdownOpen]);

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
      totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : (filteredEntries.length > 0 ? Math.round((paidCount / filteredEntries.length) * 100) : 0);
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

  // Bulk Selection Metrics & Breakdown
  const selectedEntriesList = useMemo(() => {
    if (selectedEntryIds.size === 0) return [];
    return entries.filter((e) => selectedEntryIds.has(e.id));
  }, [entries, selectedEntryIds]);

  const bulkMetrics = useMemo(() => {
    if (selectedEntriesList.length === 0) {
      return { totalSum: 0, paid: 0, pending: 0, working: 0, cancelled: 0 };
    }

    let totalSum = 0;
    let paid = 0;
    let pending = 0;
    let working = 0;
    let cancelled = 0;

    selectedEntriesList.forEach((e) => {
      totalSum += convertEntryCurrency(e, globalCurrency, rates);
      if (e.status === 'Paid') paid++;
      else if (e.status === 'Working') working++;
      else if (e.status === 'Cancelled') cancelled++;
      else pending++;
    });

    return { totalSum, paid, pending, working, cancelled };
  }, [selectedEntriesList, globalCurrency, rates]);

  // Keyboard Shortcuts Listener (Esc to clear, S to toggle select mode, Ctrl+A in select mode)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape key clears active confirmations and selections
      if (e.key === 'Escape') {
        if (confirmDeleteEntryId) {
          setConfirmDeleteEntryId(null);
          return;
        }
        if (isBulkDeleting) {
          setIsBulkDeleting(false);
          return;
        }
        if (isStatusDropdownOpen) {
          setIsStatusDropdownOpen(false);
          return;
        }
        if (selectedEntryIds.size > 0 || isSelectMode) {
          setSelectedEntryIds(new Set());
          setIsSelectMode(false);
          setLastSelectedId(null);
          return;
        }
        if (activeActionMenuId) {
          setActiveActionMenuId(null);
          return;
        }
      }

      // Do not trigger selection hotkeys when typing in inputs/textareas
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      // 'S' key toggles select mode
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setIsSelectMode((prev) => {
          const next = !prev;
          if (!next) {
            setSelectedEntryIds(new Set());
            setIsBulkDeleting(false);
            setLastSelectedId(null);
          }
          return next;
        });
        return;
      }

      // Ctrl + A / Cmd + A: Select all jobs visible on current page (and activate select mode)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setIsSelectMode(true);
        const pageIds = paginatedEntries.map((entry) => entry.id);
        setSelectedEntryIds(new Set(pageIds));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    confirmDeleteEntryId,
    isBulkDeleting,
    isStatusDropdownOpen,
    selectedEntryIds,
    isSelectMode,
    activeActionMenuId,
    paginatedEntries,
  ]);

  // Shift + Click Range Selection & Direct Toggle Handler
  const handleToggleEntrySelection = (entryId, event) => {
    if (event?.shiftKey && lastSelectedId && lastSelectedId !== entryId) {
      const idx1 = paginatedEntries.findIndex((e) => e.id === lastSelectedId);
      const idx2 = paginatedEntries.findIndex((e) => e.id === entryId);

      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        const rangeEntries = paginatedEntries.slice(start, end + 1);

        setSelectedEntryIds((prev) => {
          const next = new Set(prev);
          rangeEntries.forEach((e) => next.add(e.id));
          return next;
        });
        setLastSelectedId(entryId);
        return;
      }
    }

    // Standard toggle
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
    setLastSelectedId(entryId);
  };

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

  // Multi-day calculation summary
  const selectedDaysSummary = useMemo(() => {
    if (selectedDayKeys.size === 0) return null;

    let totalIncome = 0;
    let totalJobs = 0;

    dateGroups.forEach(({ groupTitle, groupItems, dayTotal }) => {
      if (selectedDayKeys.has(groupTitle)) {
        totalIncome += dayTotal;
        totalJobs += groupItems.length;
      }
    });

    return {
      daysCount: selectedDayKeys.size,
      totalIncome,
      totalJobs,
    };
  }, [selectedDayKeys, dateGroups]);

  const handleToggleDaySelection = (dayKey) => {
    setSelectedDayKeys((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }
      return next;
    });
  };

  const handlePageChange = (pageNum) => {
    setCurrentPage(pageNum);
    setSelectedDayKeys(new Set());
    setSelectedEntryIds(new Set());
    setConfirmDeleteEntryId(null);
    setIsBulkDeleting(false);
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
    setSelectedDayKeys(new Set());
    setSelectedEntryIds(new Set());
    setConfirmDeleteEntryId(null);
    setIsBulkDeleting(false);
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
    <div className="space-y-5 pb-20 md:pb-6 relative">
      {/* 1. Compact Total Earned Summary Card (Transparent & Dark Palette) */}
      <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Total Earned
            </span>
            {filteredEntries.length !== entries.length && (
              <button
                type="button"
                onClick={handleClearFilters}
                title="Click to clear all active filters"
                className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-transparent hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800/80 transition-colors"
              >
                <span>Filtered ({filteredEntries.length}/{entries.length})</span>
                <X className="w-2.5 h-2.5 text-zinc-500" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              {metrics.completionRate}% Paid
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-300">
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
              className="bg-zinc-400 h-full transition-all duration-300"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPaid / metrics.totalValue) * 100 : 0}%`,
              }}
            />
            <div
              className="bg-zinc-700 h-full transition-all duration-300"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPending / metrics.totalValue) * 100 : 0}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <span>Paid:</span>
              <strong className="text-zinc-400 font-medium">
                <MoneyDisplay amount={metrics.totalPaid} currency={globalCurrency} />
              </strong>
              <span>({metrics.paidCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <span>Pending:</span>
              <strong className="text-zinc-400 font-medium">
                <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} />
              </strong>
              <span>({metrics.pendingCount})</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Quick Stat Tiles (Transparent Borders & Dimmed Numbers) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>Jobs Done</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-zinc-400">
            {metrics.paidCount} <span className="text-xs text-zinc-600 font-normal">/ {filteredEntries.length}</span>
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-500/80" />
            <span>Pending Payout</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-zinc-400 truncate">
            <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
            <span>Average Rate</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-zinc-400 truncate">
            <MoneyDisplay amount={metrics.avgRate} currency={globalCurrency} compact={true} />
          </div>
        </div>
      </div>

      {/* Subtle Gradient Fade Separator Line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700/60 to-transparent" />

      {/* 3. Compact / Collapsible Search & Filter Bar (Dimmed & Low-Contrast) */}
      <div className="relative z-30 space-y-2.5">
        {/* Quick Filter Bar (Status Chips + Currency Chips + Team Chip + Expanding Search Drawer Toggle) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          {/* Filter Chips group */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {/* Status Chips */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className={`h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center justify-center transition-colors whitespace-nowrap leading-none ${
                  statusFilter === ''
                    ? 'bg-zinc-900 text-zinc-200 border border-zinc-700/80 font-medium shadow-sm'
                    : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-zinc-800/70 hover:border-zinc-700/70'
                }`}
              >
                All ({entries.length})
              </button>

              {STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === st ? '' : st)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center justify-center transition-colors whitespace-nowrap leading-none ${
                    statusFilter === st
                      ? 'bg-zinc-900 text-zinc-200 border border-zinc-700/80 font-medium shadow-sm'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-zinc-800/70 hover:border-zinc-700/70'
                  }`}
                >
                  {st}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setHasProofFilter((prev) => !prev)}
                className={`h-7 px-2 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap leading-none ${
                  hasProofFilter
                    ? 'bg-emerald-950/25 text-emerald-400/90 border border-emerald-800/60 font-medium'
                    : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-zinc-800/70 hover:border-zinc-700/70'
                }`}
              >
                <FileImage className="w-3 h-3 text-zinc-500" />
                <span>Proof</span>
              </button>
            </div>

            <div className="h-4 w-px bg-zinc-800/80 shrink-0 hidden sm:block" />

            {/* Currency Payment Type Chips */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrencyFilter(currencyFilter === 'GOLD' ? '' : 'GOLD')}
                className={`h-7 px-2 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap leading-none ${
                  currencyFilter === 'GOLD'
                    ? 'bg-amber-950/25 text-amber-400/90 border border-amber-800/60 font-medium shadow-sm'
                    : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-zinc-800/70 hover:border-zinc-700/70'
                }`}
              >
                <Coins className="w-3 h-3 text-amber-400/80" />
                <span>Gold</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrencyFilter(currencyFilter === 'TOMAN' ? '' : 'TOMAN')}
                className={`h-7 px-2 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap leading-none ${
                  currencyFilter === 'TOMAN'
                    ? 'bg-zinc-900 text-zinc-200 border border-zinc-700/80 font-medium shadow-sm'
                    : 'bg-transparent text-zinc-500 hover:text-zinc-300 border border-zinc-800/70 hover:border-zinc-700/70'
                }`}
              >
                <Banknote className="w-3 h-3 text-zinc-500" />
                <span className="font-farsi font-medium">تومان</span>
              </button>
            </div>

            {/* Active Team Filter Chip */}
            {teammateFilter && (
              <button
                type="button"
                onClick={() => setTeammateFilter('')}
                className="h-7 px-2 rounded-md text-[11px] font-medium bg-zinc-900 text-zinc-300 border border-zinc-700/80 flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm leading-none"
              >
                <Users className="w-3 h-3 text-zinc-500" />
                <span>Team: {teammateFilter}</span>
                <X className="w-3 h-3 text-zinc-500 hover:text-zinc-200" />
              </button>
            )}
          </div>

          {/* Right Action Buttons: Select Mode Toggle & Search Drawer Toggle */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto ml-auto">
            {/* Dedicated Multi-Select Mode Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setIsSelectMode((prev) => {
                  const next = !prev;
                  if (!next) {
                    setSelectedEntryIds(new Set());
                    setIsBulkDeleting(false);
                    setLastSelectedId(null);
                  }
                  return next;
                });
              }}
              title="Toggle Selection Mode (Press S, Ctrl+A on page)"
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center justify-center gap-1.5 border transition-colors shrink-0 leading-none ${
                isSelectMode || selectedEntryIds.size > 0
                  ? 'bg-zinc-900 text-zinc-100 border-zinc-700/90 font-medium shadow-sm'
                  : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800/70 hover:border-zinc-700/70'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Select</span>
              {selectedEntryIds.size > 0 ? (
                <span className="inline-flex items-center justify-center min-w-[17px] h-4 px-1 rounded-full bg-zinc-100 text-zinc-950 font-semibold font-mono text-[10px] leading-none shrink-0 shadow-sm">
                  {selectedEntryIds.size}
                </span>
              ) : (
                <Kbd className="text-[9px] bg-black border-zinc-800 text-zinc-500 hidden sm:inline-flex shrink-0">S</Kbd>
              )}
            </button>

            {/* Toggle Search & Advanced Filters Drawer */}
            <button
              type="button"
              onClick={() => {
                setIsSearchExpanded((prev) => !prev);
                if (!isSearchExpanded) {
                  setTimeout(() => searchInputRef?.current?.focus(), 80);
                }
              }}
              title="Toggle Search, Games & Sort (Press / to search)"
              className={`flex-1 sm:flex-initial h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center justify-between sm:justify-center gap-2 border transition-colors leading-none ${
                isSearchExpanded || hasAdvancedFilters
                  ? 'bg-zinc-900 text-zinc-200 border-zinc-700/80 font-medium shadow-sm'
                  : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800/70 hover:border-zinc-700/70'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">Search & Filters</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Kbd className="text-[9px] bg-black border-zinc-800 text-zinc-500 px-1 py-0">/</Kbd>
                {hasAdvancedFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 ml-0.5" />
                )}
              </div>
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
              className="space-y-2"
            >
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 shadow-2xl space-y-2">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search jobs, games, seller source, teammates, notes... (Press / to focus)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-7 h-8 text-xs bg-black border-zinc-800/80 text-zinc-300 placeholder:text-zinc-600"
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
                      className="h-8 text-xs bg-black border-zinc-800/80 text-zinc-400"
                    />
                  </div>

                  <div className="w-full sm:w-36">
                    <Select
                      value={sortOption}
                      onChange={setSortOption}
                      options={sortOptions}
                      className="h-8 text-xs bg-black border-zinc-800/80 text-zinc-400"
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
        <div className="rounded-2xl border border-dashed border-zinc-800/80 p-12 text-center space-y-3">
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
        <div className="space-y-6 relative z-10">
          {dateGroups.map(({ groupTitle, groupItems, dayTotal }) => {
            if (groupItems.length === 0) return null;
            const isDaySelected = selectedDayKeys.has(groupTitle);

            return (
              <div key={groupTitle} className="space-y-2">
                {/* Daily Group Header */}
                <div className="flex items-center justify-between px-1 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      {groupTitle}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      ({groupItems.length} {groupItems.length === 1 ? 'job' : 'jobs'})
                    </span>
                  </div>

                  {/* Dimmed Low-Contrast Day Total Income Badge */}
                  <button
                    type="button"
                    onClick={() => handleToggleDaySelection(groupTitle)}
                    title={`Click to ${isDaySelected ? 'deselect' : 'select and sum'} ${groupTitle}'s earnings`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] transition-all select-none border ${
                      isDaySelected
                        ? 'bg-zinc-900 text-zinc-200 font-medium border-zinc-700/80 shadow-sm'
                        : 'bg-transparent border-zinc-800/60 text-zinc-500 hover:border-zinc-700/70 hover:text-zinc-400'
                    }`}
                  >
                    <span className={`text-[9px] uppercase font-medium ${isDaySelected ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Day Total:
                    </span>
                    <strong className={isDaySelected ? 'text-zinc-200 font-medium' : 'text-zinc-400 font-normal'}>
                      <MoneyDisplay amount={dayTotal} currency={globalCurrency} />
                    </strong>
                    {isDaySelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 ml-0.5 shrink-0" />
                    )}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {groupItems.map((entry, idx) => {
                      const isActionOpen = activeActionMenuId === entry.id;
                      const isProofPrompting = promptProofEntryId === entry.id;
                      const isConfirmDeleting = confirmDeleteEntryId === entry.id;
                      const isSelected = selectedEntryIds.has(entry.id);
                      const isNearBottom = idx >= groupItems.length - 2 && groupItems.length > 3;

                      return (
                        <motion.div
                          layout
                          key={entry.id}
                          initial={{ opacity: 0, height: 0, scale: 0.98 }}
                          animate={{ opacity: 1, height: 'auto', scale: 1 }}
                          exit={{ opacity: 0, height: 0, scale: 0.96, transition: { duration: 0.2, ease: 'easeInOut' } }}
                          className={cn('space-y-1 relative job-row-item', isActionOpen && 'z-40')}
                        >
                          {/* 1. In-Line Morphing Delete Confirmation Strip */}
                          {isConfirmDeleting ? (
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                  <p className="text-zinc-200 font-medium truncate">
                                    Delete <span className="text-white font-semibold">"{entry.title}"</span>?
                                  </p>
                                  <p className="text-[10px] text-zinc-400">
                                    This work record and any attached screenshot proof will be permanently removed.
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setConfirmDeleteEntryId(null)}
                                  className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="danger"
                                  size="xs"
                                  onClick={() => {
                                    onDeleteEntry?.(entry.id);
                                    setConfirmDeleteEntryId(null);
                                    setSelectedEntryIds((prev) => {
                                      const next = new Set(prev);
                                      next.delete(entry.id);
                                      return next;
                                    });
                                  }}
                                  className="h-7 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-sm gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete Record</span>
                                </Button>
                              </div>
                            </motion.div>
                          ) : (
                            /* 2. Standard Work Record Card */
                            <div
                              onClick={(e) => {
                                if (e.target.closest('button, input, select, textarea, [data-no-row-click]')) {
                                  return;
                                }
                                if (isSelectMode || e.shiftKey) {
                                  handleToggleEntrySelection(entry.id, e);
                                } else {
                                  onOpenReceipt?.(entry);
                                }
                              }}
                              className={cn(
                                'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3 rounded-xl transition-all cursor-pointer border',
                                isSelected
                                  ? 'bg-zinc-900/60 border-zinc-500/70 shadow-sm'
                                  : 'bg-zinc-950 hover:bg-zinc-900/50 border-zinc-800/60'
                              )}
                            >
                              {/* Multi-Selection Square Checkbox Hovering Over Top-Left Border Corner */}
                              <button
                                type="button"
                                data-no-row-click="true"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleEntrySelection(entry.id, e);
                                }}
                                title={isSelected ? 'Deselect (or Shift+Click for range)' : 'Select (or Shift+Click for range)'}
                                className={cn(
                                  'absolute -top-1.5 -left-1.5 z-20 w-4.5 h-4.5 rounded-[2.5px] border flex items-center justify-center transition-all shadow-md',
                                  isSelected
                                    ? 'bg-zinc-100 border-zinc-100 text-zinc-950 scale-100 opacity-100'
                                    : isSelectMode
                                    ? 'bg-zinc-950 border-zinc-700 text-transparent opacity-100 hover:border-zinc-400 hover:scale-105'
                                    : 'bg-zinc-950 border-zinc-700/80 text-transparent opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 hover:scale-105'
                                )}
                              >
                                <Check className={cn('w-3 h-3 stroke-[3]', isSelected ? 'opacity-100 text-zinc-950' : 'opacity-0 hover:opacity-50 text-zinc-400')} />
                              </button>

                              {/* Left: Thumbnail / Emblem & Details (Full Space Restored) */}
                              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                {entry.proofs && entry.proofs.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => onOpenLightbox?.(entry.proofs[0].data, entry.title)}
                                    title="View screenshot proof"
                                    className="w-9 h-9 rounded-lg bg-transparent border border-zinc-800/80 flex items-center justify-center text-emerald-400/80 hover:text-white shrink-0 group relative overflow-hidden mt-0.5 sm:mt-0"
                                  >
                                    <img
                                      src={entry.proofs[0].data}
                                      alt="Proof"
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                    />
                                  </button>
                                ) : (
                                  <div className="w-9 h-9 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                                    <GameIcon game={entry.game} className="w-6.5 h-6.5 sm:w-7 sm:h-7 object-contain opacity-85 hover:opacity-100 transition-opacity" />
                                  </div>
                                )}

                                <div className="min-w-0 flex-1 space-y-0.5">
                                  {/* Line 1: Title & Transparent Seller Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium text-zinc-300 truncate">
                                      {entry.title}
                                    </span>
                                    {entry.source && (
                                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-transparent text-zinc-500 border border-zinc-800/80">
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
                                        <span>Team:</span>
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
                                                ? 'bg-zinc-900 text-zinc-300 border-zinc-700/80 shadow-sm'
                                                : 'bg-transparent hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800/80'
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
                              <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0">
                                <div className="text-left sm:text-right">
                                  <div className="text-xs font-medium text-zinc-300">
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
                                  <div className="relative flex items-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveActionMenuId(isActionOpen ? null : entry.id);
                                      }}
                                      className="w-[26px] h-[26px] flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors shrink-0"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5 shrink-0" />
                                    </button>

                                    {isActionOpen && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className={cn(
                                          'absolute right-0 w-36 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 shadow-2xl rounded-lg p-1 space-y-0.5 z-[80] text-xs',
                                          isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'
                                        )}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onOpenReceipt?.(entry);
                                            setActiveActionMenuId(null);
                                          }}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-300 hover:bg-zinc-900/80 hover:text-white"
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
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-300 hover:bg-zinc-900/80 hover:text-white"
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
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-300 hover:bg-zinc-900/80 hover:text-white"
                                        >
                                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                          <span>Duplicate</span>
                                        </button>

                                        <div className="border-t border-zinc-800 my-0.5" />

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveActionMenuId(null);
                                            setConfirmDeleteEntryId(entry.id);
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
                          )}

                          {/* In-Row Animated Proof Prompt Overlay */}
                          <AnimatePresence>
                            {isProofPrompting && (
                              <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                transition={{ duration: 0.15 }}
                                className="p-2.5 rounded-xl bg-zinc-950/90 backdrop-blur-md border border-emerald-900/60 shadow-xl flex items-center justify-between gap-3 text-xs"
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
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
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
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className="h-8 px-2.5 rounded-md bg-transparent hover:bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
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
                      onClick={() => handlePageChange(pageNum)}
                      className={`h-8 w-8 rounded-md text-xs font-mono font-medium transition-colors border ${
                        currentPage === pageNum
                          ? 'bg-zinc-100 text-zinc-950 font-semibold border-zinc-200 shadow-sm'
                          : 'bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  className="h-8 px-2.5 rounded-md bg-transparent hover:bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Multi-Day Income Calculator Floating Bottom Bar (Hidden when items are selected) */}
      <AnimatePresence>
        {selectedDaysSummary && selectedDaysSummary.daysCount > 0 && selectedEntryIds.size === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 28, x: '-50%', scale: 0.96 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 28, x: '-50%', scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-20 md:bottom-8 left-1/2 z-[90] bg-zinc-950/75 backdrop-blur-2xl border border-zinc-800/90 shadow-2xl ring-1 ring-zinc-800/50 rounded-2xl px-4 sm:px-5 py-3 flex items-center gap-3.5 sm:gap-5 max-w-[95vw] sm:max-w-xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-zinc-900/90 text-zinc-200 border border-zinc-700/80 shrink-0">
                {selectedDaysSummary.daysCount} {selectedDaysSummary.daysCount === 1 ? 'Day' : 'Days'}
              </span>

              <div className="flex items-baseline gap-2 min-w-0 truncate">
                <span className="text-zinc-400 text-xs hidden sm:inline">Sum:</span>
                <strong className="text-zinc-100 font-bold text-base sm:text-lg tracking-tight">
                  <MoneyDisplay amount={selectedDaysSummary.totalIncome} currency={globalCurrency} />
                </strong>
                <span className="text-[11px] text-zinc-500 shrink-0">
                  ({selectedDaysSummary.totalJobs} {selectedDaysSummary.totalJobs === 1 ? 'job' : 'jobs'})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-3 border-l border-zinc-800/80">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  const formatted = formatMoney(selectedDaysSummary.totalIncome, globalCurrency);
                  navigator.clipboard.writeText(formatted);
                  setIsSumCopied(true);
                  setTimeout(() => setIsSumCopied(false), 2000);
                  onToast?.(`📋 Copied selected days sum (${formatted}) to clipboard!`);
                }}
                title="Copy sum to clipboard"
                className={`h-8 px-2.5 text-xs gap-1.5 border transition-all duration-200 ${
                  isSumCopied
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border-transparent hover:border-zinc-700'
                }`}
              >
                {isSumCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in-50 duration-150" />
                    <span className="hidden sm:inline font-medium text-emerald-300">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSelectedDayKeys(new Set());
                  setIsSumCopied(false);
                }}
                title="Clear day selection"
                className="h-8 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 gap-1 border border-transparent hover:border-zinc-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Comprehensive Floating Bulk Actions Bar */}
      <AnimatePresence>
        {selectedEntryIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 28, x: '-50%', scale: 0.96 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 28, x: '-50%', scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-20 md:bottom-8 left-1/2 z-[95] bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/90 shadow-2xl ring-1 ring-zinc-800/50 rounded-2xl px-3 sm:px-4 py-2.5 flex items-center gap-2.5 sm:gap-4 max-w-[96vw] sm:max-w-2xl"
          >
            {/* Left: Count Badge & Live Converted Total Income Sum */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-200 border border-zinc-700/80 shrink-0">
                {selectedEntryIds.size} Selected
              </span>

              <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                <span className="text-zinc-400 text-xs hidden sm:inline">Sum:</span>
                <strong className="text-zinc-100 font-bold text-xs sm:text-sm tracking-tight truncate">
                  <MoneyDisplay amount={bulkMetrics.totalSum} currency={globalCurrency} />
                </strong>
                {globalCurrency !== 'GOLD' ? (
                  <span className="hidden md:inline text-[10px] text-amber-400/80 font-mono shrink-0">
                    (~{Math.round(bulkMetrics.totalSum / (goldRateTOMAN / 1000)).toLocaleString()} G)
                  </span>
                ) : (
                  <span className="hidden md:inline text-[10px] text-zinc-400 font-mono shrink-0">
                    (~{Math.round(bulkMetrics.totalSum * (goldRateTOMAN / 1000)).toLocaleString()} تومان)
                  </span>
                )}
              </div>
            </div>

            {/* Middle: Mixed Status Breakdown Pill (Tablet/Desktop) */}
            <div className="hidden lg:flex items-center gap-1 text-[10px] text-zinc-400 px-2 py-0.5 rounded bg-zinc-900/60 border border-zinc-800/60 shrink-0">
              {bulkMetrics.paid > 0 && <span className="text-emerald-400 font-medium">{bulkMetrics.paid} Paid</span>}
              {bulkMetrics.paid > 0 && (bulkMetrics.pending > 0 || bulkMetrics.working > 0 || bulkMetrics.cancelled > 0) && <span className="text-zinc-600">•</span>}
              {bulkMetrics.pending > 0 && <span className="text-amber-400 font-medium">{bulkMetrics.pending} Pending</span>}
              {bulkMetrics.pending > 0 && (bulkMetrics.working > 0 || bulkMetrics.cancelled > 0) && <span className="text-zinc-600">•</span>}
              {bulkMetrics.working > 0 && <span className="text-cyan-400 font-medium">{bulkMetrics.working} Working</span>}
              {bulkMetrics.working > 0 && bulkMetrics.cancelled > 0 && <span className="text-zinc-600">•</span>}
              {bulkMetrics.cancelled > 0 && <span className="text-zinc-500 font-medium">{bulkMetrics.cancelled} Cancelled</span>}
            </div>

            {/* Right: Actions (Status Changer Popover + CSV Export + In-Line Morphing Delete + Deselect) */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-2 border-l border-zinc-800/80">
              {/* 1. Bulk Status Changer Dropdown */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsStatusDropdownOpen((prev) => !prev);
                  }}
                  className="h-7 px-2 text-[11px] gap-1 text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-zinc-800/80 shadow-sm"
                >
                  <span>Status</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </Button>

                {isStatusDropdownOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full mb-1.5 left-0 w-36 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 shadow-2xl rounded-lg p-1 space-y-0.5 z-[110] text-xs animate-in fade-in zoom-in-95 duration-100"
                  >
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          onBulkUpdateStatus?.(Array.from(selectedEntryIds), st);
                          setIsStatusDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded text-zinc-300 hover:bg-zinc-900 hover:text-white text-left transition-colors"
                      >
                        <span>{st}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            st === 'Paid'
                              ? 'bg-emerald-400'
                              : st === 'Working'
                              ? 'bg-cyan-400'
                              : st === 'Pending'
                              ? 'bg-amber-400'
                              : 'bg-zinc-500'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Bulk CSV Export Button */}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onBulkExportCsv?.(Array.from(selectedEntryIds))}
                title="Export selected records to CSV"
                className="h-7 px-2 text-[11px] gap-1 text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-zinc-800/80 shadow-sm hidden sm:flex"
              >
                <Download className="w-3 h-3 text-zinc-400" />
                <span>CSV</span>
              </Button>

              {/* 3. In-Line Morphing Delete (N) Confirmation */}
              {!isBulkDeleting ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsBulkDeleting(true)}
                  className="h-7 px-2 text-[11px] gap-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </Button>
              ) : (
                <div className="flex items-center gap-1 p-0.5 bg-rose-950/60 border border-rose-900/90 rounded-md animate-in fade-in zoom-in-95 duration-150">
                  <span className="text-[10px] font-medium text-rose-300 px-1">
                    Delete {selectedEntryIds.size}?
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsBulkDeleting(false)}
                    className="px-1.5 py-0.5 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onBulkDelete?.(Array.from(selectedEntryIds));
                      setSelectedEntryIds(new Set());
                      setIsBulkDeleting(false);
                      setIsSelectMode(false);
                      setLastSelectedId(null);
                    }}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-sm"
                  >
                    Confirm
                  </button>
                </div>
              )}

              {/* 4. Clear / Deselect Button */}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSelectedEntryIds(new Set());
                  setIsBulkDeleting(false);
                  setIsStatusDropdownOpen(false);
                  setIsSelectMode(false);
                  setLastSelectedId(null);
                }}
                title="Clear selection (Esc)"
                className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LedgerView;
