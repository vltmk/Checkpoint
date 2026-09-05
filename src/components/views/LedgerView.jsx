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
  X,
  Check,
  CheckCircle2,
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
import { Tooltip, Kbd } from '../ui/Tooltip';
import { cn } from '../../lib/utils';
import { openExternalUrl } from '../../lib/desktop';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage, formatShamsiDate, normalizeDigits, toPersianDigits } from '../../lib/i18n';
import {
  formatMoney,
  convertCurrency,
  convertEntryCurrency,
  STATUSES,
  STATUS_CONFIG,
  STATUS_LABELS,
  GAMES,
} from '../../lib/currencies';

const ITEMS_PER_PAGE = 15;

export function LedgerView({
  entries = [],
  globalCurrency = 'TOMAN',
  onCurrencyChange,
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
}) {
  const { t, language, isRtl, formatNumber, formatDate } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [hasProofFilter, setHasProofFilter] = useState(false);
  const [teammateFilter, setTeammateFilter] = useState('');
  const [sortOption, setSortOption] = useState('date_desc');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFiltersPopoverOpen, setIsFiltersPopoverOpen] = useState(false);
  const filtersPopoverRef = useRef(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
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

  // Extract game categories with job counts
  const gameCategories = useMemo(() => {
    const counts = new Map();
    GAMES.forEach((g) => counts.set(g, 0));

    entries.forEach((e) => {
      const g = e.game || 'World of Warcraft';
      counts.set(g, (counts.get(g) || 0) + 1);
    });

    const categories = [
      { id: '', label: t('ledger.allGames'), count: entries.length },
    ];

    counts.forEach((count, game) => {
      if (count > 0 || GAMES.includes(game)) {
        categories.push({ id: game, label: game, count });
      }
    });

    return categories;
  }, [entries, t]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { Paid: 0, Pending: 0, Working: 0, 'On Hold': 0 };
    entries.forEach((e) => {
      if (counts[e.status] !== undefined) {
        counts[e.status]++;
      }
    });
    return counts;
  }, [entries]);

  // Secondary filters count badge
  const activeSecondaryFiltersCount = useMemo(() => {
    let count = 0;
    if (currencyFilter) count++;
    if (hasProofFilter) count++;
    if (teammateFilter) count++;
    if (sortOption !== 'date_desc') count++;
    return count;
  }, [currencyFilter, hasProofFilter, teammateFilter, sortOption]);

  const formatRowTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch (e) {
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  };

  const handleOpenExternalLink = (url) => {
    if (!url || typeof url !== 'string') return;
    const trimmed = url.trim();
    const lower = trimmed.toLowerCase();
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      if (lower.startsWith('www.') || lower.includes('.')) {
        openExternalUrl('https://' + trimmed);
        return;
      }
      return;
    }
    openExternalUrl(trimmed);
  };

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
    const handleOutsideClick = (e) => {
      if (activeActionMenuId) setActiveActionMenuId(null);
      if (isStatusDropdownOpen) setIsStatusDropdownOpen(false);
      if (filtersPopoverRef.current && !filtersPopoverRef.current.contains(e.target)) {
        setIsFiltersPopoverOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeActionMenuId, isStatusDropdownOpen]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let list = [...entries];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const normQ = normalizeDigits(q);
      list = list.filter((e) => {
        const shamsiDate = e.dateTime ? formatShamsiDate(e.dateTime, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
        const matchTitle = e.title && e.title.toLowerCase().includes(q);
        const matchGame = e.game && e.game.toLowerCase().includes(q);
        const matchSource = e.source && e.source.toLowerCase().includes(q);
        const matchNotes = e.notes && e.notes.toLowerCase().includes(q);
        const matchStatus = e.status && e.status.toLowerCase().includes(q);
        const matchTeammates = e.teammates && Array.isArray(e.teammates) && e.teammates.some((t) => t.toLowerCase().includes(q));
        const matchDate = (e.dateTime && (e.dateTime.includes(q) || e.dateTime.includes(normQ))) || (shamsiDate && (shamsiDate.includes(q) || shamsiDate.includes(normQ)));
        return matchTitle || matchGame || matchSource || matchNotes || matchStatus || matchTeammates || matchDate;
      });
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

    if (sortOption === 'date_desc') {
      list.sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0));
    } else if (sortOption === 'date_asc') {
      list.sort((a, b) => new Date(a.dateTime || 0) - new Date(b.dateTime || 0));
    } else if (sortOption === 'income_desc' || sortOption === 'income_asc') {
      const incomeMap = new Map();
      for (const item of list) {
        incomeMap.set(item, convertEntryCurrency(item, globalCurrency, rates));
      }
      list.sort((a, b) => {
        const valA = incomeMap.get(a) || 0;
        const valB = incomeMap.get(b) || 0;
        return sortOption === 'income_desc' ? valB - valA : valA - valB;
      });
    }

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

  // Keyboard Shortcuts Listener (Esc to clear, S to toggle select mode, Ctrl+A in select mode, / for search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape key clears active confirmations, popovers, and selections
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
        if (isFiltersPopoverOpen) {
          setIsFiltersPopoverOpen(false);
          return;
        }
        if (document.activeElement === searchInputRef?.current) {
          if (searchQuery) {
            setSearchQuery('');
          } else {
            searchInputRef?.current?.blur();
          }
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

      // Hotkey: '/' or 'Ctrl+F' to focus search
      if ((e.code === 'Slash' || e.key === '/') && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = e.target.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select' && !e.target.isContentEditable) {
          e.preventDefault();
          searchInputRef?.current?.focus();
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F')) {
        const tag = e.target.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select' && !e.target.isContentEditable) {
          e.preventDefault();
          searchInputRef?.current?.focus();
          return;
        }
      }

      // Do not trigger selection hotkeys when typing in inputs/textareas
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      // 'T' key toggles display currency between Toman and Gold
      if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onCurrencyChange?.(globalCurrency === 'TOMAN' ? 'GOLD' : 'TOMAN');
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
    isFiltersPopoverOpen,
    searchQuery,
    selectedEntryIds,
    isSelectMode,
    activeActionMenuId,
    paginatedEntries,
    globalCurrency,
    onCurrencyChange,
    searchInputRef,
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
      let groupTitle = t('ledger.earlier');
      if (!isNaN(d.getTime())) {
        const dStr = d.toDateString();
        if (dStr === todayStr) {
          groupTitle = t('ledger.today');
        } else if (dStr === yesterdayStr) {
          groupTitle = t('ledger.yesterday');
        } else {
          groupTitle = formatDate(d, {
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
  }, [paginatedEntries, globalCurrency, rates, t, formatDate]);

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
    { value: '', label: t('ledger.allGames') },
    ...GAMES.map((g) => ({ value: g, label: g })),
  ];

  const sortOptions = [
    { value: 'date_desc', label: t('ledger.sortDateDesc') },
    { value: 'date_asc', label: t('ledger.sortDateAsc') },
    { value: 'income_desc', label: t('ledger.sortIncomeDesc') },
    { value: 'income_asc', label: t('ledger.sortIncomeAsc') },
  ];

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setCurrencyFilter('');
    setGameFilter('');
    setTeammateFilter('');
    setHasProofFilter(false);
    setSortOption('date_desc');
    setIsFiltersPopoverOpen(false);
    setSelectedDayKeys(new Set());
    setSelectedEntryIds(new Set());
    setConfirmDeleteEntryId(null);
    setIsBulkDeleting(false);
  };

  const hasAdvancedFilters = Boolean(searchQuery.trim() || gameFilter || sortOption !== 'date_desc');

  const handleStatusSelect = (entry, nextStatus) => {
    onFlipStatus?.(entry.id, entry.status, nextStatus);
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6 relative">
      {/* 1. Compact Total Earned Summary Card (Transparent & Dark Palette) */}
      <div className="relative overflow-hidden rounded-xl bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-3.5 sm:p-4 space-y-2.5">
        {/* Minimal rectangular dots radial pattern anchored at bottom-left */}
        <div
          className="absolute inset-0 pointer-events-none select-none z-0 animate-dot-breathe"
          style={{
            maskImage: 'radial-gradient(ellipse at bottom left, black 15%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at bottom left, black 15%, transparent 75%)',
          }}
        >
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="totalEarnedDots" width="10" height="10" patternUnits="userSpaceOnUse">
                <rect width="2.5" height="2.5" rx="0.5" fill="currentColor" className="text-emerald-500/50 dark:text-emerald-400/60" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#totalEarnedDots)" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
              {t('ledger.totalEarned')}
            </span>

            {/* Minimal Currency Switcher Pill Right in Front of Label */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-inner">
              <button
                type="button"
                onClick={() => onCurrencyChange?.('TOMAN')}
                title="Display in Toman (Press T to toggle)"
                className={`relative isolate flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] transition-colors ${
                  globalCurrency === 'TOMAN'
                    ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                {globalCurrency === 'TOMAN' && (
                  <motion.div
                    layoutId="totalEarnedCurrencyPill"
                    className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-200 dark:border-zinc-700/80"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Banknote className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                <span className="font-farsi font-medium">تومان</span>
              </button>
              <button
                type="button"
                onClick={() => onCurrencyChange?.('GOLD')}
                title="Display in Gold (Press T to toggle)"
                className={`relative isolate flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] transition-colors ${
                  globalCurrency === 'GOLD'
                    ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                {globalCurrency === 'GOLD' && (
                  <motion.div
                    layoutId="totalEarnedCurrencyPill"
                    className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-200 dark:border-zinc-700/80"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Coins className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                <span>Gold</span>
              </button>
            </div>

            {filteredEntries.length !== entries.length && (
              <button
                type="button"
                onClick={handleClearFilters}
                title={t('ledger.clearFilters')}
                className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-800/80 transition-colors"
              >
                <span className={cn(isRtl && 'font-farsi')}>{t('ledger.filtered')} ({formatNumber(filteredEntries.length)}/{formatNumber(entries.length)})</span>
                <X className="w-2.5 h-2.5 text-zinc-500" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs text-zinc-500 font-mono', isRtl && 'font-farsi')}>
              {formatNumber(metrics.completionRate)}% {t('status.Paid')}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
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

        {/* Enhanced High-Density Segmented Progress Bar with Accent Colors */}
        <div className="space-y-2 pt-0.5">
          <div className="h-2.5 w-full bg-zinc-100/80 dark:bg-zinc-950/80 rounded-full p-0.5 border border-zinc-200 dark:border-zinc-800/80 shadow-inner flex overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-l-full transition-all duration-300 relative group"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPaid / metrics.totalValue) * 100 : (metrics.paidCount > 0 ? 100 : 0)}%`,
              }}
              title={`${t('status.Paid')}: ${metrics.completionRate}%`}
            />
            <div
              className="bg-amber-500/80 h-full transition-all duration-300 relative group"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPending / metrics.totalValue) * 100 : 0}%`,
              }}
              title={`${t('status.Pending')}: ${100 - metrics.completionRate}%`}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px]">
            {/* Paid Accent Badge */}
            <div className="flex items-center gap-1.5 bg-zinc-100/80 dark:bg-zinc-900/50 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800/80 ring-1 ring-inset ring-emerald-600/15 dark:ring-emerald-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
              <span className={cn('text-zinc-600 dark:text-zinc-400 font-medium', isRtl && 'font-farsi')}>{t('status.Paid')} ({formatNumber(metrics.paidCount)}):</span>
              <strong className="text-zinc-900 dark:text-zinc-100 font-semibold font-mono text-xs">
                <MoneyDisplay amount={metrics.totalPaid} currency={globalCurrency} />
              </strong>
              <span className="text-zinc-500 dark:text-zinc-500 text-[10px] ml-auto sm:ml-0 font-mono">
                {formatNumber(metrics.completionRate)}%
              </span>
            </div>

            {/* Pending Accent Badge */}
            <div className="flex items-center gap-1.5 bg-zinc-100/80 dark:bg-zinc-900/50 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800/80 ring-1 ring-inset ring-amber-600/15 dark:ring-amber-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
              <span className={cn('text-zinc-600 dark:text-zinc-400 font-medium', isRtl && 'font-farsi')}>{t('status.Pending')} ({formatNumber(metrics.pendingCount)}):</span>
              <strong className="text-zinc-900 dark:text-zinc-100 font-semibold font-mono text-xs">
                <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} />
              </strong>
              <span className="text-zinc-500 dark:text-zinc-500 text-[10px] ml-auto sm:ml-0 font-mono">
                {formatNumber(metrics.totalValue > 0 ? 100 - metrics.completionRate : 0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Stat Tiles (Transparent Borders & Dimmed Numbers) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80" />
            <span className={cn(isRtl && 'font-farsi')}>{t('ledger.jobsDone')}</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-zinc-400">
            {formatNumber(metrics.paidCount)} <span className="text-xs text-zinc-600 font-normal">/ {formatNumber(filteredEntries.length)}</span>
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-500/80" />
            <span className={cn(isRtl && 'font-farsi')}>{t('ledger.pendingPayout')}</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-zinc-400 truncate">
            <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
            <span className={cn(isRtl && 'font-farsi')}>{t('ledger.averageRate')}</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-zinc-400 truncate">
            <MoneyDisplay amount={metrics.avgRate} currency={globalCurrency} compact={true} />
          </div>
        </div>
      </div>

      {/* Subtle Gradient Fade Separator Line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700/60 to-transparent" />

      {/* 3. Game Categories & Minimalist Unified Filter Bar */}
      <div className="relative z-30 space-y-2.5">
        {/* Top Tier: Game Categories Horizontal Segmented Track */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth py-0.5 select-none">
          {gameCategories.map((cat) => {
            const isSelected = gameFilter === cat.id;
            return (
              <button
                key={cat.id || '__all__'}
                type="button"
                onClick={() => setGameFilter(isSelected && cat.id !== '' ? '' : cat.id)}
                className={cn(
                  'h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 border active:scale-[0.97]',
                  isSelected
                    ? 'bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm font-semibold'
                    : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/60'
                )}
              >
                {cat.id && (
                  <GameIcon game={cat.id} className="w-3.5 h-3.5 object-contain shrink-0" />
                )}
                <span className={cn(isRtl && 'font-farsi')}>{cat.label}</span>
                <span
                  className={cn(
                    'text-[10px] font-mono px-1 rounded leading-tight',
                    isSelected
                      ? 'bg-zinc-950/10 text-zinc-900 font-bold'
                      : 'bg-zinc-900 text-zinc-500'
                  )}
                >
                  {formatNumber(cat.count)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom Tier: Minimal Unified Desktop Toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left: Always-Accessible Search Input */}
          <div className="relative flex-1 min-w-[140px] sm:min-w-[180px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={t('ledger.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'pl-8 pr-8 h-8 text-xs bg-zinc-950 border-zinc-800/80 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700',
                isRtl && 'font-farsi placeholder:font-farsi text-right'
              )}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef?.current?.focus();
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center text-xs text-zinc-500 hover:text-zinc-300 active:scale-95"
                  title="Clear search"
                >
                  ✕
                </button>
              ) : (
                <Kbd className="text-[9px] bg-black border-zinc-800 text-zinc-500 px-1 py-0 select-none">
                  /
                </Kbd>
              )}
            </div>
          </div>

          {/* Center: Primary Status Segmented Pills */}
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800/80 shrink-0 overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className={cn(
                'h-7 px-2.5 rounded-md text-[11px] font-medium transition-all shrink-0 active:scale-[0.97]',
                statusFilter === ''
                  ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <span className={cn(isRtl && 'font-farsi')}>{t('status.all')}</span>
            </button>

            {STATUSES.map((st) => {
              const isCurrent = statusFilter === st;
              const count = statusCounts[st] || 0;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(isCurrent ? '' : st)}
                  className={cn(
                    'h-7 px-2.5 rounded-md text-[11px] font-medium transition-all shrink-0 flex items-center gap-1.5 active:scale-[0.97]',
                    isCurrent
                      ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  <span className={cn(isRtl && 'font-farsi')}>{t('status.' + st, STATUS_LABELS[st] || st)}</span>
                  {count > 0 && (
                    <span className={cn('text-[10px] font-mono', isCurrent ? 'text-zinc-300' : 'text-zinc-600')}>
                      {formatNumber(count)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Secondary Filters Popover + Multi-Select Mode */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
            {/* Secondary Filters Popover Trigger */}
            <div className="relative" ref={filtersPopoverRef}>
              <button
                type="button"
                onClick={() => setIsFiltersPopoverOpen((prev) => !prev)}
                title={t('ledger.filters')}
                className={cn(
                  'h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all active:scale-[0.97]',
                  isFiltersPopoverOpen || activeSecondaryFiltersCount > 0
                    ? 'bg-zinc-900 text-zinc-100 border-zinc-700 font-semibold shadow-xs'
                    : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 hover:border-zinc-700'
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                <span className={cn(isRtl && 'font-farsi')}>{t('ledger.filters')}</span>
                {activeSecondaryFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-zinc-100 text-zinc-950 font-mono text-[10px] font-bold flex items-center justify-center leading-none">
                    {activeSecondaryFiltersCount}
                  </span>
                )}
              </button>

              {/* Origin-aware Popover Dropdown */}
              <AnimatePresence>
                {isFiltersPopoverOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -4 }}
                    transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className={cn(
                      'absolute top-full mt-1.5 w-64 p-3 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl z-50 space-y-3 text-xs',
                      isRtl ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className={cn('font-semibold text-zinc-200 text-xs', isRtl && 'font-farsi')}>
                        {t('ledger.filters')}
                      </span>
                      {activeSecondaryFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrencyFilter('');
                            setHasProofFilter(false);
                            setTeammateFilter('');
                            setSortOption('date_desc');
                          }}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Currency Filter */}
                    <div className="space-y-1.5">
                      <label className={cn('text-[10px] uppercase font-semibold text-zinc-400 block', isRtl && 'font-farsi')}>
                        {t('ledger.filterCurrency', 'Currency')}
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setCurrencyFilter('')}
                          className={cn(
                            'py-1 rounded text-[11px] font-medium transition-colors text-center active:scale-95',
                            currencyFilter === '' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          {t('status.all')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrencyFilter('GOLD')}
                          className={cn(
                            'py-1 rounded text-[11px] font-medium transition-colors text-center flex items-center justify-center gap-1 active:scale-95',
                            currencyFilter === 'GOLD' ? 'bg-amber-950/50 text-amber-300 border border-amber-800/50 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          <Coins className="w-3 h-3 text-amber-400" />
                          <span>Gold</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrencyFilter('TOMAN')}
                          className={cn(
                            'py-1 rounded text-[11px] font-medium transition-colors text-center flex items-center justify-center gap-1 active:scale-95',
                            currencyFilter === 'TOMAN' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          <Banknote className="w-3 h-3 text-zinc-400" />
                          <span className="font-farsi">تومان</span>
                        </button>
                      </div>
                    </div>

                    {/* Screenshot Proof Toggle */}
                    <div className="space-y-1.5">
                      <label className={cn('text-[10px] uppercase font-semibold text-zinc-400 block', isRtl && 'font-farsi')}>
                        {t('ledger.filterProof', 'Proof Attachment')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setHasProofFilter((prev) => !prev)}
                        className={cn(
                          'w-full h-8 px-2.5 rounded-lg text-xs font-medium flex items-center justify-between border transition-all active:scale-[0.98]',
                          hasProofFilter
                            ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/60 font-semibold'
                            : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <FileImage className="w-3.5 h-3.5 text-zinc-500" />
                          <span className={cn(isRtl && 'font-farsi')}>{t('ledger.withProof', 'With proof only')}</span>
                        </div>
                        {hasProofFilter && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    </div>

                    {/* Teammate Filter (if active) */}
                    {teammateFilter && (
                      <div className="space-y-1.5">
                        <label className={cn('text-[10px] uppercase font-semibold text-zinc-400 block', isRtl && 'font-farsi')}>
                          {t('ledger.team')}
                        </label>
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{teammateFilter}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTeammateFilter('')}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                            title="Clear team filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sort Dropdown */}
                    <div className="space-y-1.5">
                      <label className={cn('text-[10px] uppercase font-semibold text-zinc-400 block', isRtl && 'font-farsi')}>
                        {t('ledger.sortBy')}
                      </label>
                      <Select
                        value={sortOption}
                        onChange={setSortOption}
                        options={sortOptions}
                        className="h-8 text-xs bg-zinc-900/60 border-zinc-800 text-zinc-300"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Grouped Job Feed */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800/80 p-12 text-center space-y-3">
          <p className={cn('text-xs text-zinc-500', isRtl && 'font-farsi')}>
            {searchQuery || statusFilter || gameFilter || hasProofFilter || teammateFilter
              ? t('ledger.noJobsMatch')
              : t('ledger.emptyDesc')}
          </p>
          <Button variant="primary" size="sm" onClick={() => onOpenWorkModal?.()} className={cn(isRtl && 'font-farsi')}>
            <Plus className="w-3.5 h-3.5" />
            <span>{t('nav.addWork')}</span>
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
                    <span className={cn('text-[10px] text-zinc-600', isRtl && 'font-farsi')}>
                      ({formatNumber(groupItems.length)} {groupItems.length === 1 ? t('ledger.job') : t('ledger.jobs')})
                    </span>
                  </div>

                  {/* Dimmed Low-Contrast Day Total Income Badge */}
                  <button
                    type="button"
                    onClick={() => handleToggleDaySelection(groupTitle)}
                    title={isDaySelected ? t('ledger.deselectDayTitle') : t('ledger.selectDayTitle')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] transition-all select-none border ${
                      isDaySelected
                        ? 'bg-zinc-900 text-zinc-200 font-medium border-zinc-700/80 shadow-sm'
                        : 'bg-transparent border-zinc-800/60 text-zinc-500 hover:border-zinc-700/70 hover:text-zinc-400'
                    }`}
                  >
                    <span className={cn(`text-[9px] uppercase font-medium ${isDaySelected ? 'text-zinc-400' : 'text-zinc-600'}`, isRtl && 'font-farsi')}>
                      {t('ledger.dayTotal')}:
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
                      const isConfirmDeleting = confirmDeleteEntryId === entry.id;
                      const isSelected = selectedEntryIds.has(entry.id);
                      const isNearBottom = idx >= groupItems.length - 2 && groupItems.length > 3;

                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 4, scale: 0.99 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: 'easeOut' } }}
                          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                          className={cn('space-y-1 relative job-row-item', isActionOpen && 'z-40')}
                        >
                          {/* 1. In-Line Morphing Delete Confirmation Strip */}
                          <AnimatePresence mode="wait">
                            {isConfirmDeleting ? (
                              <motion.div
                                key="confirm-delete"
                                layout
                                initial={{ opacity: 0, scale: 0.98, y: -2 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98, y: 2 }}
                                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                                dir={isRtl ? 'rtl' : 'ltr'}
                                className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <p className={cn('text-zinc-200 font-medium truncate', isRtl && 'font-farsi')}>
                                      {language === 'fa' ? (
                                        <>حذف <span className="text-white font-semibold">«{entry.title}»</span>؟</>
                                      ) : (
                                        <>Delete <span className="text-white font-semibold">"{entry.title}"</span>?</>
                                      )}
                                    </p>
                                    <p className={cn('text-[10px] text-zinc-400', isRtl && 'font-farsi')}>
                                      {t('ledger.deleteRecordWarning', 'This work record and any attached screenshot proof will be permanently removed.')}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setConfirmDeleteEntryId(null)}
                                    className={cn('h-7 text-xs text-zinc-400 hover:text-zinc-200', isRtl && 'font-farsi')}
                                  >
                                    {t('common.cancel', 'Cancel')}
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
                                    className={cn('h-7 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-sm gap-1', isRtl && 'font-farsi')}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>{t('ledger.deleteRecordBtn', 'Delete Record')}</span>
                                  </Button>
                                </div>
                              </motion.div>
                            ) : (
                              /* 2. Standard Work Record Card */
                              <div
                                dir="ltr"
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
                                  'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3 rounded-xl transition-[background-color,border-color] duration-150 cursor-pointer border',
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

                                {/* Left: Game Emblem & Details (Always keep GameIcon on far left) */}
                                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                  <div className="w-9 h-9 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                                    <GameIcon game={entry.game} className="w-6.5 h-6.5 sm:w-7 sm:h-7 object-contain opacity-85 hover:opacity-100 transition-opacity" />
                                  </div>

                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    {/* Line 1: Title, Proof Indicator, Seller Badge & Timestamp */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-300 truncate">
                                        {entry.title}
                                      </span>
                                      {entry.proofs && entry.proofs.length > 0 && (
                                        <Tooltip content={t('ledger.viewScreenshotProof', 'View screenshot proof')} side="top">
                                          <button
                                            type="button"
                                            data-no-row-click="true"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onOpenLightbox?.(entry.proofs[0].data, entry.title);
                                            }}
                                            className="p-1 rounded text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors shrink-0"
                                            title={t('ledger.viewScreenshotProof', 'View screenshot proof')}
                                          >
                                            <FileImage className="w-3.5 h-3.5" />
                                          </button>
                                        </Tooltip>
                                      )}
                                    {entry.source && (
                                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-transparent text-zinc-500 border border-zinc-200 dark:border-zinc-800/80">
                                        {entry.source}
                                      </span>
                                    )}
                                    {entry.dateTime && formatRowTime(entry.dateTime) && (
                                      <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1 select-none">
                                        <Clock className="w-2.5 h-2.5 text-zinc-500 dark:text-zinc-600 shrink-0" />
                                        <span>{formatRowTime(entry.dateTime)}</span>
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

                                  {/* Line 3: Interactive Teammate Badges & Team Pot */}
                                  {entry.teammates && entry.teammates.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px]">
                                      <span className="text-zinc-500 flex items-center gap-1">
                                        <Users className="w-3 h-3 text-zinc-500" />
                                        <span>Team:</span>
                                      </span>

                                      {entry.pot && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 dark:bg-zinc-900/90 text-amber-700 dark:text-amber-300/90 border border-amber-600/30 dark:border-amber-800/40 ring-1 ring-inset ring-amber-600/20 backdrop-blur-md inline-flex items-baseline gap-1">
                                          <span>Pot:</span>
                                          <MoneyDisplay amount={entry.pot} currency={entry.currency} />
                                          <span className="text-zinc-500">({entry.teammates.length + 1} shares)</span>
                                        </span>
                                      )}

                                      {entry.teammates.map((tm) => {
                                        const isMatch = teammateFilter.toLowerCase() === tm.toLowerCase();
                                        const customCut = entry.teammateCuts && entry.teammateCuts[tm];
                                        return (
                                          <button
                                            key={tm}
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTeammateFilter(isMatch ? '' : tm);
                                            }}
                                            title={`Click to filter jobs with ${tm}${customCut ? ` (Cut: ${formatMoney(customCut, entry.currency)})` : ''}`}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border flex items-center gap-1 active:scale-[0.97] ${
                                              isMatch
                                                ? 'bg-zinc-900 text-zinc-100 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-300 shadow-sm'
                                                : 'bg-zinc-100/80 hover:bg-zinc-200/80 border-zinc-300 text-zinc-700 hover:text-zinc-900 dark:bg-transparent dark:hover:bg-zinc-900 dark:border-zinc-800/80 dark:text-zinc-400 dark:hover:text-zinc-300'
                                            }`}
                                          >
                                            <span>{tm}</span>
                                            {customCut && (
                                              <span className="font-mono text-[9px] text-zinc-500 dark:text-zinc-400 inline-flex items-baseline">
                                                (<MoneyDisplay amount={customCut} currency={entry.currency} />)
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right: Income (Your Cut), External Link, Status, Menu */}
                              <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0">
                                <div className="text-left sm:text-right">
                                  {entry.teamMode && (
                                    <div className={cn('text-[9px] font-mono text-zinc-500 uppercase tracking-wider', isRtl && 'font-farsi')}>
                                      {t('ledger.yourShare', 'Your Share')}
                                    </div>
                                  )}
                                  <div className="text-xs font-medium text-zinc-900 dark:text-zinc-300">
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
                                      showRateLabel={false}
                                    />
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {/* Icon-only external link button */}
                                  {entry.link && (
                                    <Tooltip content={entry.link} side="top">
                                      <button
                                        type="button"
                                        data-no-row-click="true"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenExternalLink(entry.link);
                                        }}
                                        title={t('ledger.openLink', 'Open Link')}
                                        className="w-[26px] h-[26px] flex items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 active:scale-[0.95] transition-all border border-zinc-200 dark:border-zinc-800/60 shrink-0"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                    </Tooltip>
                                  )}

                                  <StatusBadge
                                    status={entry.status}
                                    interactive={true}
                                    onSelectStatus={(st) => handleStatusSelect(entry, st)}
                                  />

                                  {/* 3-Dot Action Menu with origin-aware animation */}
                                  <div className="relative flex items-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveActionMenuId(isActionOpen ? null : entry.id);
                                      }}
                                      className="w-[26px] h-[26px] flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 active:scale-[0.95] transition-all shrink-0"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5 shrink-0" />
                                    </button>

                                    <AnimatePresence>
                                      {isActionOpen && (
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.95 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.95 }}
                                          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                                          onClick={(e) => e.stopPropagation()}
                                          dir={isRtl ? 'rtl' : 'ltr'}
                                          className={cn(
                                            'absolute w-36 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg p-1 space-y-0.5 z-[80] text-xs right-0',
                                            isNearBottom ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'
                                          )}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onOpenReceipt?.(entry);
                                              setActiveActionMenuId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 hover:text-zinc-950 dark:hover:text-white transition-colors"
                                          >
                                            <Receipt className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                            <span className={cn(isRtl && 'font-farsi')}>{t('ledger.clientReceipt')}</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              onOpenWorkModal?.(entry);
                                              setActiveActionMenuId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 hover:text-zinc-950 dark:hover:text-white transition-colors"
                                          >
                                            <FileImage className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                            <span className={cn(isRtl && 'font-farsi')}>{t('ledger.addScreenshot', 'Add Screenshot')}</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              onOpenWorkModal?.(entry);
                                              setActiveActionMenuId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 hover:text-zinc-950 dark:hover:text-white transition-colors"
                                          >
                                            <Edit2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                            <span className={cn(isRtl && 'font-farsi')}>{t('ledger.edit')}</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              onDuplicateEntry?.(entry.id);
                                              setActiveActionMenuId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 hover:text-zinc-950 dark:hover:text-white transition-colors"
                                          >
                                            <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                            <span className={cn(isRtl && 'font-farsi')}>{t('ledger.duplicate')}</span>
                                          </button>

                                          <div className="border-t border-zinc-200 dark:border-zinc-800 my-0.5" />

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveActionMenuId(null);
                                              setConfirmDeleteEntryId(entry.id);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:text-rose-300 transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span className={cn(isRtl && 'font-farsi')}>{t('ledger.delete')}</span>
                                          </button>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              </div>
                            </div>
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
              <span className={cn('text-zinc-500 font-mono text-[11px]', isRtl && 'font-farsi')}>
                {language === 'fa'
                  ? `نمایش ${formatNumber((currentPage - 1) * ITEMS_PER_PAGE + 1)} تا ${formatNumber(Math.min(currentPage * ITEMS_PER_PAGE, filteredEntries.length))} از ${formatNumber(filteredEntries.length)} کار`
                  : `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filteredEntries.length)} of ${filteredEntries.length} jobs`}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className={cn('h-8 px-2.5 rounded-md bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none border border-zinc-200 dark:border-zinc-800 text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors', isRtl && 'font-farsi')}
                >
                  {t('ledger.previous')}
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
                        <span key={pageNum} className="px-1 text-zinc-400 dark:text-zinc-600 font-mono">
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
                      className={cn(`h-8 w-8 rounded-md text-xs font-mono font-medium transition-colors border ${
                        currentPage === pageNum
                          ? 'bg-zinc-900 text-zinc-100 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-200 shadow-sm font-semibold'
                          : 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200 border-zinc-200 dark:border-zinc-800'
                      }`, isRtl && 'font-farsi')}
                    >
                      {formatNumber(pageNum)}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  className={cn('h-8 px-2.5 rounded-md bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none border border-zinc-200 dark:border-zinc-800 text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors', isRtl && 'font-farsi')}
                >
                  {t('ledger.next')}
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
            dir={isRtl ? 'rtl' : 'ltr'}
            className={cn(
              'fixed bottom-20 md:bottom-8 left-1/2 z-[90] bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/90 shadow-2xl ring-1 ring-zinc-800/50 rounded-2xl px-5 sm:px-6 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4 max-w-[calc(100vw-2rem)] max-w-4xl justify-between',
              isRtl && 'font-farsi'
            )}
          >
            <div className="flex items-center gap-3 min-w-0 shrink-0">
              <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-md bg-zinc-900/90 text-zinc-200 border border-zinc-700/80 shrink-0', isRtl && 'font-farsi')}>
                {formatNumber(selectedDaysSummary.daysCount)} {selectedDaysSummary.daysCount === 1 ? t('ledger.day') : t('ledger.days')}
              </span>

              <div className="flex items-baseline gap-2 min-w-0 shrink-0">
                <span className={cn('text-zinc-400 text-xs hidden sm:inline', isRtl && 'font-farsi')}>{t('ledger.sum')}:</span>
                <strong className="text-zinc-100 font-bold text-base sm:text-lg tracking-tight shrink-0">
                  <MoneyDisplay amount={selectedDaysSummary.totalIncome} currency={globalCurrency} />
                </strong>
                <span className={cn('text-[11px] text-zinc-500 shrink-0', isRtl && 'font-farsi')}>
                  ({formatNumber(selectedDaysSummary.totalJobs)} {selectedDaysSummary.totalJobs === 1 ? t('ledger.job') : t('ledger.jobs')})
                </span>
              </div>
            </div>

            {/* Right Group with Standalone Vertical Divider */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
              <div className="h-5 w-px bg-zinc-800/90 shrink-0" />

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    const formatted = formatMoney(selectedDaysSummary.totalIncome, globalCurrency);
                    navigator.clipboard.writeText(formatted);
                    setIsSumCopied(true);
                    setTimeout(() => setIsSumCopied(false), 2000);
                  }}
                  title={t('ledger.copyTooltip')}
                  className={cn(`h-8 px-2.5 text-xs gap-1.5 border transition-all duration-200 ${
                    isSumCopied
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border-transparent hover:border-zinc-700'
                  }`, isRtl && 'font-farsi')}
                >
                  {isSumCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in-50 duration-150" />
                      <span className="hidden sm:inline font-medium text-emerald-300">{t('ledger.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="hidden sm:inline">{t('ledger.copySum')}</span>
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
                  title={t('ledger.clearSelection')}
                  className={cn('h-8 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 gap-1 border border-transparent hover:border-zinc-700 transition-colors', isRtl && 'font-farsi')}
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('common.cancel')}</span>
                </Button>
              </div>
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
            dir={isRtl ? 'rtl' : 'ltr'}
            className={cn(
              'fixed bottom-20 md:bottom-8 left-1/2 z-[95] bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/90 shadow-2xl ring-1 ring-zinc-800/50 rounded-2xl px-5 sm:px-6 py-2 sm:py-2.5 flex items-center gap-3 sm:gap-4 max-w-[calc(100vw-2rem)] max-w-4xl justify-between',
              isRtl && 'font-farsi'
            )}
          >
            {/* Left: Count Badge & Live Converted Total Income Sum */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
              <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-md bg-zinc-900 text-zinc-200 border border-zinc-700/80 shrink-0', isRtl ? 'font-farsi' : 'font-mono')}>
                {formatNumber(selectedEntryIds.size)} <span className="hidden xs:inline">{t('ledger.selected')}</span>
              </span>

              <div className="flex items-baseline gap-1.5 sm:gap-2 min-w-0 shrink-0">
                <span className={cn('text-zinc-400 text-xs', isRtl && 'font-farsi')}>{t('ledger.sum')}:</span>
                <strong className="text-zinc-100 font-bold text-xs sm:text-sm tracking-tight shrink-0">
                  <MoneyDisplay amount={bulkMetrics.totalSum} currency={globalCurrency} />
                </strong>
                {globalCurrency !== 'GOLD' ? (
                  <span dir="ltr" className="text-[10px] sm:text-[11px] text-amber-400/80 font-mono shrink-0 select-none">
                    (~{Math.round(bulkMetrics.totalSum / (goldRateTOMAN / 1000)).toLocaleString()} G)
                  </span>
                ) : (
                  <span dir={isRtl ? 'rtl' : 'ltr'} className={cn('text-[10px] sm:text-[11px] text-zinc-400 font-mono shrink-0 select-none', isRtl && 'font-farsi')}>
                    (~{formatMoney(Math.round(bulkMetrics.totalSum * (goldRateTOMAN / 1000)), 'TOMAN')})
                  </span>
                )}
              </div>
            </div>

            {/* Middle: Mixed Status Breakdown Pill (XL Screens Only) */}
            <div className={cn('hidden xl:flex items-center gap-1 text-[10px] text-zinc-400 px-2 py-0.5 rounded bg-zinc-900/60 border border-zinc-800/60 shrink-0', isRtl && 'font-farsi')}>
              {bulkMetrics.paid > 0 && <span className="text-emerald-400 font-medium">{formatNumber(bulkMetrics.paid)} {t('status.Paid')}</span>}
              {bulkMetrics.paid > 0 && (bulkMetrics.pending > 0 || bulkMetrics.working > 0 || bulkMetrics.cancelled > 0) && <span className="text-zinc-600">•</span>}
              {bulkMetrics.pending > 0 && <span className="text-amber-400 font-medium">{formatNumber(bulkMetrics.pending)} {t('status.Pending')}</span>}
              {bulkMetrics.pending > 0 && (bulkMetrics.working > 0 || bulkMetrics.cancelled > 0) && <span className="text-zinc-600">•</span>}
              {bulkMetrics.working > 0 && <span className="text-cyan-400 font-medium">{formatNumber(bulkMetrics.working)} {t('status.Working')}</span>}
              {bulkMetrics.working > 0 && bulkMetrics.cancelled > 0 && <span className="text-zinc-600">•</span>}
              {bulkMetrics.cancelled > 0 && <span className="text-zinc-500 font-medium">{formatNumber(bulkMetrics.cancelled)} {t('status.On Hold')}</span>}
            </div>

            {/* Right: Actions with Standalone Clean Vertical Divider */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Standalone Vertical Divider with Safe Margins */}
              <div className="h-5 w-px bg-zinc-800/90 shrink-0" />

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* 1. Bulk Status Changer Dropdown */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsStatusDropdownOpen((prev) => !prev);
                    }}
                    title={t('ledger.bulkStatus')}
                    className={cn('h-7 px-2 text-[11px] gap-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-zinc-800/80 shadow-sm shrink-0 flex items-center', isRtl && 'font-farsi')}
                  >
                    <div className="flex items-center -space-x-1 shrink-0 rtl:space-x-reverse" aria-hidden="true">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-zinc-950" />
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 ring-1 ring-zinc-950" />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-zinc-950" />
                    </div>
                    <span>{t('ledger.bulkStatus')}</span>
                    <ChevronDown className={cn('w-3 h-3 text-zinc-400 shrink-0 transition-transform duration-150', isStatusDropdownOpen && 'rotate-180 text-zinc-200')} />
                  </Button>

                  {isStatusDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      dir={isRtl ? 'rtl' : 'ltr'}
                      className={cn(
                        'absolute bottom-full mb-1.5 w-36 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 shadow-2xl rounded-lg p-1 space-y-0.5 z-[110] text-xs animate-in fade-in zoom-in-95 duration-100',
                        isRtl ? 'right-0' : 'left-0'
                      )}
                    >
                      {STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            onBulkUpdateStatus?.(Array.from(selectedEntryIds), st);
                            setIsStatusDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded text-zinc-300 hover:bg-zinc-900 hover:text-white text-start transition-colors"
                        >
                          <span className={cn(isRtl && 'font-farsi')}>{t('status.' + st, STATUS_LABELS[st] || st)}</span>
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
                  title={t('ledger.bulkCsvTooltip', t('ledger.bulkCsv'))}
                  className={cn('h-7 px-2 text-[11px] gap-1 text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-zinc-800/80 shadow-sm flex items-center shrink-0', isRtl && 'font-farsi')}
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>{t('ledger.bulkCsv')}</span>
                </Button>

                {/* 3. In-Line Morphing Delete (N) Confirmation */}
                {!isBulkDeleting ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setIsBulkDeleting(true)}
                    title={`${t('ledger.bulkDelete')} (${formatNumber(selectedEntryIds.size)})`}
                    className={cn('h-7 px-2 text-[11px] gap-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 transition-colors shrink-0', isRtl && 'font-farsi')}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('ledger.bulkDelete')}</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-1 p-0.5 bg-rose-950/60 border border-rose-900/90 rounded-md animate-in fade-in zoom-in-95 duration-150 h-7 shrink-0">
                    <span className={cn('text-[10px] font-medium text-rose-300 px-1 whitespace-nowrap', isRtl && 'font-farsi')}>
                      {t('ledger.delete')} {formatNumber(selectedEntryIds.size)}?
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBulkDeleting(false)}
                      className={cn('h-5 px-1.5 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 flex items-center', isRtl && 'font-farsi')}
                    >
                      {t('common.cancel')}
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
                      className={cn('h-5 px-1.5 rounded text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-sm flex items-center', isRtl && 'font-farsi')}
                    >
                      {t('common.confirm')}
                    </button>
                  </div>
                )}

                {/* 4. Clear / Deselect Button */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setSelectedEntryIds(new Set());
                    setIsBulkDeleting(false);
                    setIsStatusDropdownOpen(false);
                    setIsSelectMode(false);
                    setLastSelectedId(null);
                  }}
                  title={`${t('ledger.bulkClear')} (Esc)`}
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-md shrink-0 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LedgerView;
