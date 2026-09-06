import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  Filter,
  Plus,
  FileImage,
  MoreVertical,
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
  Store,
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
import { CockpitDotMatrix } from '../ui/CockpitDotMatrix';
import { CockpitStatusGradient } from '../ui/CockpitStatusGradient';
import { cn } from '../../lib/utils';
import { openExternalUrl, openAppAwareUrl } from '../../lib/desktop';
import { detectAppLink } from '../../lib/appLinks';
import { DiscordIcon, TelegramIcon, SteamIcon, GoogleSheetsIcon, GithubIcon } from '../ui/Icons';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage, formatShamsiDate, normalizeDigits, toPersianDigits } from '../../lib/i18n';
import { getCategoryByName } from '../../lib/categories';
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
  categories = [],
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
  externalSourceFilter = '',
  onClearExternalSourceFilter,
  isSelectMode: controlledIsSelectMode,
  onToggleSelectMode,
  selectedEntryIds: controlledSelectedEntryIds,
  onSelectionChange,
  contextMenuTargetId = null,
  confirmDeleteEntryId: controlledConfirmDeleteEntryId,
  onConfirmDeleteChange,
  onOpenEntryContextMenu,
}) {
  const { t, language, isRtl, formatNumber, formatDate } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [hasProofFilter, setHasProofFilter] = useState(false);
  const [teammateFilter, setTeammateFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortOption, setSortOption] = useState('date_desc');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFiltersPopoverOpen, setIsFiltersPopoverOpen] = useState(false);
  const filtersPopoverRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDayKeys, setSelectedDayKeys] = useState(new Set());
  const [isSumCopied, setIsSumCopied] = useState(false);

  // Bulk Actions & Single Delete In-Line Confirmation States
  const [selectedEntryIdsLocal, setSelectedEntryIdsLocal] = useState(new Set());
  const [isSelectModeLocal, setIsSelectModeLocal] = useState(false);
  const isSelectMode = controlledIsSelectMode !== undefined ? controlledIsSelectMode : isSelectModeLocal;
  const setIsSelectMode = onToggleSelectMode || setIsSelectModeLocal;
  const selectedEntryIds = controlledSelectedEntryIds !== undefined ? controlledSelectedEntryIds : selectedEntryIdsLocal;
  const setSelectedEntryIds = onSelectionChange || setSelectedEntryIdsLocal;

  const [lastSelectedId, setLastSelectedId] = useState(null);
  const [confirmDeleteEntryIdLocal, setConfirmDeleteEntryIdLocal] = useState(null);
  const confirmDeleteEntryId = controlledConfirmDeleteEntryId !== undefined ? controlledConfirmDeleteEntryId : confirmDeleteEntryIdLocal;
  const setConfirmDeleteEntryId = onConfirmDeleteChange || setConfirmDeleteEntryIdLocal;
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const rates = useMemo(
    () => ({ goldRateTOMAN }),
    [goldRateTOMAN]
  );

  // Extract game categories with job counts (only games present in entries)
  const gameCategories = useMemo(() => {
    const counts = new Map();

    entries.forEach((e) => {
      const g = e.game || 'World of Warcraft';
      counts.set(g, (counts.get(g) || 0) + 1);
    });

    const categories = [];

    // Prioritize standard GAMES order if present, followed by custom games
    const sortedGames = Array.from(counts.keys()).sort((a, b) => {
      const idxA = GAMES.indexOf(a);
      const idxB = GAMES.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    sortedGames.forEach((game) => {
      const count = counts.get(game) || 0;
      if (count > 0) {
        categories.push({ id: game, label: game, count });
      }
    });

    if (categories.length > 0) {
      categories.unshift({ id: '', label: t('ledger.allGames'), count: entries.length });
    }

    return categories;
  }, [entries, t]);

  // Reset game filter if the selected game is no longer present in entries
  useEffect(() => {
    if (gameFilter && !entries.some((e) => (e.game || 'World of Warcraft') === gameFilter)) {
      setGameFilter('');
    }
  }, [entries, gameFilter]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = STATUSES.reduce((acc, st) => ({ ...acc, [st]: 0 }), {});
    entries.forEach((e) => {
      if (counts[e.status] !== undefined) {
        counts[e.status]++;
      }
    });
    return counts;
  }, [entries]);

  // Active filters count badge (popover filters)
  const activeSecondaryFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    if (currencyFilter) count++;
    if (hasProofFilter) count++;
    if (teammateFilter) count++;
    if (sourceFilter) count++;
    if (sortOption !== 'date_desc') count++;
    return count;
  }, [statusFilter, currencyFilter, hasProofFilter, teammateFilter, sourceFilter, sortOption]);

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
    openAppAwareUrl(url);
  };

  // Sync external teammate filter from receipt or other views
  useEffect(() => {
    if (externalTeammateFilter) {
      setTeammateFilter(externalTeammateFilter);
      onClearExternalTeammateFilter?.();
    }
  }, [externalTeammateFilter, onClearExternalTeammateFilter]);

  // Sync external source filter from receipt or other views
  useEffect(() => {
    if (externalSourceFilter) {
      setSourceFilter(externalSourceFilter);
      onClearExternalSourceFilter?.();
    }
  }, [externalSourceFilter, onClearExternalSourceFilter]);

  // Reset page & selections when filter criteria changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedDayKeys(new Set());
    setSelectedEntryIds(new Set());
    setConfirmDeleteEntryId(null);
    setIsBulkDeleting(false);
    setIsStatusDropdownOpen(false);
  }, [searchQuery, statusFilter, currencyFilter, gameFilter, hasProofFilter, teammateFilter, sourceFilter, sortOption]);

  // Close status dropdown & filters popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (isStatusDropdownOpen) setIsStatusDropdownOpen(false);
      if (filtersPopoverRef.current && !filtersPopoverRef.current.contains(e.target)) {
        setIsFiltersPopoverOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [isStatusDropdownOpen]);

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
        const statusLabel = STATUS_LABELS[e.status] || '';
        const matchStatus =
          (e.status && e.status.toLowerCase().includes(q)) ||
          (statusLabel && statusLabel.toLowerCase().includes(q));
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
      list = list.filter((e) => (e.game || 'World of Warcraft') === gameFilter);
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

    if (sourceFilter) {
      const sf = sourceFilter.toLowerCase();
      list = list.filter(
        (e) => e.source && e.source.toLowerCase() === sf
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
  }, [entries, searchQuery, statusFilter, currencyFilter, gameFilter, hasProofFilter, teammateFilter, sourceFilter, sortOption, globalCurrency, rates]);

  // Aggregate metrics for compact balance summary
  const metrics = useMemo(() => {
    let totalPaid = 0;
    let paidCount = 0;
    let totalPending = 0;
    let pendingCount = 0;
    let totalFailed = 0;
    let failedCount = 0;

    filteredEntries.forEach((e) => {
      const convertedInc = convertEntryCurrency(e, globalCurrency, rates);

      if (e.status === 'Paid') {
        totalPaid += convertedInc;
        paidCount++;
      } else if (e.status === 'Failed') {
        totalFailed += convertedInc;
        failedCount++;
      } else {
        totalPending += convertedInc;
        pendingCount++;
      }
    });

    const totalValue = totalPaid + totalPending + totalFailed;
    const completionRate =
      totalValue > 0
        ? Math.round((totalPaid / totalValue) * 100)
        : (filteredEntries.length > 0 ? Math.round((paidCount / filteredEntries.length) * 100) : 0);
    const payableJobsCount = filteredEntries.length - failedCount;
    const avgRate = payableJobsCount > 0 ? (totalPaid + totalPending) / payableJobsCount : 0;

    return {
      totalPaid,
      paidCount,
      totalPending,
      pendingCount,
      totalFailed,
      failedCount,
      totalValue,
      completionRate,
      avgRate,
    };
  }, [filteredEntries, globalCurrency, rates]);

  // Dominant status for cockpit background gradient (Dominant share by value / count)
  const dominantStatus = useMemo(() => {
    if (!filteredEntries || filteredEntries.length === 0) return 'neutral';

    const paid = metrics.totalPaid || 0;
    const pending = metrics.totalPending || 0;
    const failed = metrics.totalFailed || 0;
    const totalValue = metrics.totalValue || 0;

    if (totalValue > 0) {
      if (paid >= pending && paid >= failed && paid > 0) return 'complete';
      if (failed >= pending && failed > paid) return 'failed';
      if (pending > 0) return 'pending';
    }

    // Fallback if monetary value is 0
    if (metrics.paidCount >= metrics.pendingCount && metrics.paidCount >= metrics.failedCount && metrics.paidCount > 0) return 'complete';
    if (metrics.failedCount >= metrics.pendingCount && metrics.failedCount > metrics.paidCount) return 'failed';
    if (metrics.pendingCount > 0) return 'pending';

    return 'neutral';
  }, [filteredEntries, metrics]);

  // Status-driven Apple & Emil Kowalski visual hierarchy for the cockpit card frame
  // Provides rim lighting (ring-1 ring-inset), status-tinted borders, and language-aware directional ambient glow
  const cockpitStatusClasses = useMemo(() => {
    switch (dominantStatus) {
      case 'complete':
        return {
          border: 'border-emerald-500/40 dark:border-emerald-500/30',
          ring: 'ring-1 ring-inset ring-emerald-500/20 dark:ring-emerald-400/15',
          shadow: isRtl
            ? 'shadow-[0_2px_8px_-2px_rgba(16,185,129,0.08),-2px_2px_6px_-2px_rgba(16,185,129,0.05)] dark:shadow-[0_2px_12px_-2px_rgba(16,185,129,0.12),-3px_3px_8px_-2px_rgba(16,185,129,0.08)]'
            : 'shadow-[0_2px_8px_-2px_rgba(16,185,129,0.08),2px_2px_6px_-2px_rgba(16,185,129,0.05)] dark:shadow-[0_2px_12px_-2px_rgba(16,185,129,0.12),3px_3px_8px_-2px_rgba(16,185,129,0.08)]',
        };
      case 'pending':
        return {
          border: 'border-amber-500/40 dark:border-amber-500/30',
          ring: 'ring-1 ring-inset ring-amber-500/20 dark:ring-amber-400/15',
          shadow: isRtl
            ? 'shadow-[0_2px_8px_-2px_rgba(245,158,11,0.08),-2px_2px_6px_-2px_rgba(245,158,11,0.05)] dark:shadow-[0_2px_12px_-2px_rgba(245,158,11,0.12),-3px_3px_8px_-2px_rgba(245,158,11,0.08)]'
            : 'shadow-[0_2px_8px_-2px_rgba(245,158,11,0.08),2px_2px_6px_-2px_rgba(245,158,11,0.05)] dark:shadow-[0_2px_12px_-2px_rgba(245,158,11,0.12),3px_3px_8px_-2px_rgba(245,158,11,0.08)]',
        };
      case 'failed':
        return {
          border: 'border-rose-500/40 dark:border-rose-500/30',
          ring: 'ring-1 ring-inset ring-rose-500/20 dark:ring-rose-400/15',
          shadow: isRtl
            ? 'shadow-[0_2px_8px_-2px_rgba(244,63,94,0.08),-2px_2px_6px_-2px_rgba(244,63,94,0.05)] dark:shadow-[0_2px_12px_-2px_rgba(244,63,94,0.12),-3px_3px_8px_-2px_rgba(244,63,94,0.08)]'
            : 'shadow-[0_2px_8px_-2px_rgba(244,63,94,0.08),2px_2px_6px_-2px_rgba(244,63,94,0.05)] dark:shadow-[0_2px_12px_-2px_rgba(244,63,94,0.12),3px_3px_8px_-2px_rgba(244,63,94,0.08)]',
        };
      case 'neutral':
      default:
        return {
          border: 'border-zinc-200 dark:border-zinc-800/80',
          ring: 'ring-0 ring-transparent',
          shadow: 'shadow-sm dark:shadow-none',
        };
    }
  }, [dominantStatus, isRtl]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ITEMS_PER_PAGE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEntries.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEntries, currentPage]);

  // Auto-switch page if confirmDeleteEntryId is on a different page
  useEffect(() => {
    if (!confirmDeleteEntryId) return;
    const entryIndex = filteredEntries.findIndex((e) => e.id === confirmDeleteEntryId);
    if (entryIndex !== -1) {
      const targetPage = Math.floor(entryIndex / ITEMS_PER_PAGE) + 1;
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      }
    }
  }, [confirmDeleteEntryId, filteredEntries, currentPage]);

  // Bulk Selection Metrics & Breakdown
  const selectedEntriesList = useMemo(() => {
    if (selectedEntryIds.size === 0) return [];
    return entries.filter((e) => selectedEntryIds.has(e.id));
  }, [entries, selectedEntryIds]);

  const bulkMetrics = useMemo(() => {
    if (selectedEntriesList.length === 0) {
      return { totalSum: 0, paid: 0, pending: 0, working: 0, onHold: 0, failed: 0 };
    }

    let totalSum = 0;
    let paid = 0;
    let pending = 0;
    let working = 0;
    let onHold = 0;
    let failed = 0;

    selectedEntriesList.forEach((e) => {
      if (e.status !== 'Failed') {
        totalSum += convertEntryCurrency(e, globalCurrency, rates);
      }
      if (e.status === 'Paid') paid++;
      else if (e.status === 'Working') working++;
      else if (e.status === 'On Hold') onHold++;
      else if (e.status === 'Failed') failed++;
      else pending++;
    });

    return { totalSum, paid, pending, working, onHold, failed };
  }, [selectedEntriesList, globalCurrency, rates]);

  // Keyboard Shortcuts Listener (Esc to clear, S to toggle select mode, Ctrl+A in select mode, / for search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Hotkey: Escape to dismiss search, filters, in-line delete confirm, selection, or custom filters
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
        if (searchQuery) {
          setSearchQuery('');
          return;
        }
        if (selectedEntryIds.size > 0 || isSelectMode) {
          setSelectedEntryIds(new Set());
          setIsSelectMode(false);
          setLastSelectedId(null);
          return;
        }
        if (sourceFilter || teammateFilter) {
          setSourceFilter('');
          setTeammateFilter('');
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
    sourceFilter,
    teammateFilter,
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
        setIsSelectMode(true);
        setLastSelectedId(entryId);
        return;
      }
    }

    // Standard toggle - activating the checkbox enables select mode by default
    const isActivating = !selectedEntryIds.has(entryId);
    if (isActivating) {
      setIsSelectMode(true);
    }

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
        (sum, item) => sum + (item.status === 'Failed' ? 0 : convertEntryCurrency(item, globalCurrency, rates)),
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
    setSourceFilter('');
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
      {/* 1. Unified Ledger Cockpit Card (Optical Frosted Glass & Dark Zinc Palette) */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl bg-zinc-50/70 dark:bg-zinc-950/40 border p-3.5 sm:p-4 transition-[border-color,box-shadow] duration-500 ease-out',
          cockpitStatusClasses.border,
          cockpitStatusClasses.ring,
          cockpitStatusClasses.shadow
        )}
      >
        {/* Language-aware, theme-aware monochromatic & status gradient */}
        <CockpitStatusGradient isRtl={isRtl} status={dominantStatus} />
        {/* Monochromatic 30-degree animated dot matrix */}
        <CockpitDotMatrix isRtl={isRtl} />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
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
                    ? 'text-zinc-800 dark:text-zinc-200 font-medium'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
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
                    ? 'text-zinc-800 dark:text-zinc-200 font-medium'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
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
            {metrics.failedCount > 0 && (
              <span className={cn('text-[11px] text-rose-600 dark:text-rose-400 font-mono', isRtl && 'font-farsi')}>
                • {formatNumber(metrics.failedCount)} {t('status.Failed')}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-800 dark:text-zinc-200 leading-tight">
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
        <div className="pt-1 pb-1.5">
          <div className="h-2.5 w-full bg-zinc-100/80 dark:bg-zinc-950/80 rounded-full p-0.5 border border-zinc-200 dark:border-zinc-800/80 shadow-inner flex overflow-hidden">
            <div
              className={cn(
                'bg-emerald-500 h-full transition-all duration-300 relative group',
                metrics.totalPending === 0 && metrics.totalFailed === 0 ? 'rounded-full' : 'rounded-l-full'
              )}
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPaid / metrics.totalValue) * 100 : (metrics.paidCount > 0 ? 100 : 0)}%`,
              }}
              title={`${t('status.Paid')}: ${metrics.totalValue > 0 ? Math.round((metrics.totalPaid / metrics.totalValue) * 100) : 0}%`}
            />
            <div
              className={cn(
                'bg-amber-500/80 h-full transition-all duration-300 relative group',
                metrics.totalPaid === 0 && metrics.totalFailed === 0
                  ? 'rounded-full'
                  : metrics.totalPaid === 0
                  ? 'rounded-l-full'
                  : metrics.totalFailed === 0
                  ? 'rounded-r-full'
                  : ''
              )}
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPending / metrics.totalValue) * 100 : 0}%`,
              }}
              title={`${t('status.Pending')}: ${metrics.totalValue > 0 ? Math.round((metrics.totalPending / metrics.totalValue) * 100) : 0}%`}
            />
            {metrics.totalFailed > 0 && (
              <div
                className={cn(
                  'bg-rose-500/80 h-full transition-all duration-300 relative group',
                  metrics.totalPaid === 0 && metrics.totalPending === 0 ? 'rounded-full' : 'rounded-r-full'
                )}
                style={{
                  width: `${metrics.totalValue > 0 ? (metrics.totalFailed / metrics.totalValue) * 100 : 0}%`,
                }}
                title={`${t('status.Failed')}: ${metrics.totalValue > 0 ? Math.round((metrics.totalFailed / metrics.totalValue) * 100) : 0}%`}
              />
            )}
          </div>
        </div>

        {/* Inset Cockpit Metric Tiles with Optical Frosted Glass */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
          <div className="rounded-lg bg-white/85 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/80 dark:border-white/[0.05] ring-1 ring-inset ring-black/5 dark:ring-white/[0.04] shadow-xs p-2.5 space-y-0.5 transition-colors">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium tracking-wider">
              <CheckCircle2 className="w-3 h-3 text-emerald-500/80 shrink-0" />
              <span className={cn(isRtl && 'font-farsi')}>{t('ledger.jobsDone')}</span>
            </div>
            <div className="text-base sm:text-lg font-medium font-mono text-zinc-800 dark:text-zinc-200">
              {formatNumber(metrics.paidCount)} <span className="text-xs text-zinc-500 font-normal">/ {formatNumber(filteredEntries.length)}</span>
            </div>
          </div>

          <div className="rounded-lg bg-white/85 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/80 dark:border-white/[0.05] ring-1 ring-inset ring-black/5 dark:ring-white/[0.04] shadow-xs p-2.5 space-y-0.5 transition-colors">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium tracking-wider">
              <Clock className="w-3 h-3 text-amber-500/80 shrink-0" />
              <span className={cn(isRtl && 'font-farsi')}>{t('ledger.pendingPayout')}</span>
            </div>
            <div className="text-base sm:text-lg font-medium font-mono text-zinc-800 dark:text-zinc-200 truncate">
              <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} compact={true} />
            </div>
          </div>

          <div className="rounded-lg bg-white/85 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/80 dark:border-white/[0.05] ring-1 ring-inset ring-black/5 dark:ring-white/[0.04] shadow-xs p-2.5 space-y-0.5 col-span-2 sm:col-span-1 transition-colors">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium tracking-wider">
              <TrendingUp className="w-3 h-3 text-zinc-400 shrink-0" />
              <span className={cn(isRtl && 'font-farsi')}>{t('ledger.averageRate')}</span>
            </div>
            <div className="text-base sm:text-lg font-medium font-mono text-zinc-800 dark:text-zinc-200 truncate">
              <MoneyDisplay amount={metrics.avgRate} currency={globalCurrency} compact={true} />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Subtle Gradient Fade Separator Line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700/60 to-transparent" />

      {/* 3. Game Categories & Minimalist Unified Filter Bar */}
      <div className="relative z-30 space-y-2.5">
        {/* Top Tier: Game Categories Horizontal Segmented Track */}
        {gameCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth py-0.5 select-none">
            {gameCategories.map((cat) => {
              const isSelected = gameFilter === cat.id;
              const catMeta = cat.id ? getCategoryByName(cat.id, categories) : null;
              const accentColor = catMeta?.color;

              return (
                <button
                  key={cat.id || '__all__'}
                  type="button"
                  onClick={() => setGameFilter(isSelected && cat.id !== '' ? '' : cat.id)}
                  style={
                    isSelected && accentColor
                      ? {
                          borderColor: `${accentColor}80`,
                          boxShadow: `0 0 10px ${accentColor}20`,
                        }
                      : undefined
                  }
                  className={cn(
                    'h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 border active:scale-[0.97]',
                    isSelected
                      ? 'bg-zinc-200 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 shadow-xs font-medium'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200 dark:border-zinc-800/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60'
                  )}
                >
                  {cat.id && (
                    <GameIcon game={cat.id} categories={categories} className="w-3.5 h-3.5 object-contain shrink-0" />
                  )}
                  {isSelected && accentColor && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                  <span className={cn(isRtl && 'font-farsi')}>{cat.label}</span>
                  <span
                    className={cn(
                      'text-[10px] font-mono px-1 rounded leading-tight',
                      isSelected
                        ? 'bg-zinc-300/80 text-zinc-900 dark:bg-zinc-700/80 dark:text-zinc-200 font-medium'
                        : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400'
                    )}
                  >
                    {formatNumber(cat.count)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom Tier: Minimal Unified Desktop Toolbar */}
        <div className="flex items-center justify-between gap-3 w-full">
          {/* Left: Always-Accessible Search Input */}
          <div className="relative flex-1 max-w-sm sm:max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={t('ledger.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'pl-8 pr-8 h-8 text-xs bg-transparent dark:bg-transparent border-zinc-200 dark:border-zinc-800/80 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-700',
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
                <Kbd className="text-[9px] bg-transparent border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 px-1 py-0 select-none">
                  /
                </Kbd>
              )}
            </div>
          </div>

          {/* Right: Unified Filters Popover Trigger */}
          <div className="relative shrink-0" ref={filtersPopoverRef}>
            <button
              type="button"
              onClick={() => setIsFiltersPopoverOpen((prev) => !prev)}
              title={t('ledger.filters')}
              className={cn(
                'h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all active:scale-[0.97] shrink-0',
                isFiltersPopoverOpen || activeSecondaryFiltersCount > 0
                  ? 'bg-zinc-200 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-850 dark:text-zinc-300 dark:hover:text-zinc-100 dark:border-zinc-800 dark:hover:border-zinc-700'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className={cn(isRtl && 'font-farsi')}>{t('ledger.filters')}</span>
              {activeSecondaryFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-zinc-900 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900 font-mono text-[10px] font-medium flex items-center justify-center leading-none">
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
                    'absolute top-full mt-1.5 w-72 sm:w-80 p-3 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 space-y-3 text-xs',
                    isRtl ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
                  )}
                >
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <span className={cn('font-medium text-zinc-800 dark:text-zinc-200 text-xs', isRtl && 'font-farsi')}>
                      {t('ledger.filters')}
                    </span>
                    {activeSecondaryFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('');
                          setCurrencyFilter('');
                          setHasProofFilter(false);
                          setTeammateFilter('');
                          setSourceFilter('');
                          setSortOption('date_desc');
                        }}
                        className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* 1. Status Filter Segmented Grid */}
                  <div className="space-y-1.5">
                    <label className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 block', isRtl && 'font-farsi')}>
                      {t('ledger.status', 'Status')}
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-zinc-100 dark:bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setStatusFilter('')}
                        className={cn(
                          'py-1 px-2 rounded text-[11px] font-medium transition-colors text-center active:scale-95 flex items-center justify-between',
                          statusFilter === ''
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-xs border border-zinc-200/80 dark:border-transparent'
                            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                        )}
                      >
                        <span className={cn(isRtl && 'font-farsi')}>{t('status.all')}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{formatNumber(entries.length)}</span>
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
                              'py-1 px-2 rounded text-[11px] font-medium transition-colors text-center flex items-center justify-between active:scale-95',
                              isCurrent
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-xs border border-zinc-200/80 dark:border-transparent'
                                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            )}
                          >
                            <span className={cn(isRtl && 'font-farsi')}>{t('status.' + st, STATUS_LABELS[st] || st)}</span>
                            {count > 0 && (
                              <span className={cn('text-[10px] font-mono', isCurrent ? 'text-zinc-900 dark:text-zinc-300' : 'text-zinc-500')}>
                                {formatNumber(count)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Currency Filter */}
                  <div className="space-y-1.5">
                    <label className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 block', isRtl && 'font-farsi')}>
                      {t('ledger.filterCurrency', 'Currency')}
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setCurrencyFilter('')}
                        className={cn(
                          'py-1 rounded text-[11px] font-medium transition-colors text-center active:scale-95',
                          currencyFilter === ''
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-xs border border-zinc-200/80 dark:border-transparent'
                            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                        )}
                      >
                        {t('status.all')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrencyFilter('GOLD')}
                        className={cn(
                          'py-1 rounded text-[11px] font-medium transition-colors text-center flex items-center justify-center gap-1 active:scale-95',
                          currencyFilter === 'GOLD'
                            ? 'bg-amber-100/90 text-amber-900 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50 shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                        )}
                      >
                        <Coins className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>Gold</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrencyFilter('TOMAN')}
                        className={cn(
                          'py-1 rounded text-[11px] font-medium transition-colors text-center flex items-center justify-center gap-1 active:scale-95',
                          currencyFilter === 'TOMAN'
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-xs border border-zinc-200/80 dark:border-transparent'
                            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                        )}
                      >
                        <Banknote className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                        <span className="font-farsi">تومان</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Screenshot Proof Toggle */}
                  <div className="space-y-1.5">
                    <label className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 block', isRtl && 'font-farsi')}>
                      {t('ledger.filterProof', 'Proof Attachment')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setHasProofFilter((prev) => !prev)}
                      className={cn(
                        'w-full h-8 px-2.5 rounded-lg text-xs font-medium flex items-center justify-between border transition-all active:scale-[0.98]',
                        hasProofFilter
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 border-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-zinc-200'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <FileImage className="w-3.5 h-3.5 text-zinc-500" />
                        <span className={cn(isRtl && 'font-farsi')}>{t('ledger.withProof', 'With proof only')}</span>
                      </div>
                      {hasProofFilter && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    </button>
                  </div>

                  {/* 4. Teammate Filter (if active) */}
                  {teammateFilter && (
                    <div className="space-y-1.5">
                      <label className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 block', isRtl && 'font-farsi')}>
                        {t('ledger.team')}
                      </label>
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{teammateFilter}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTeammateFilter('')}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                          title="Clear team filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 5. Seller/Source Filter (if active) */}
                  {sourceFilter && (
                    <div className="space-y-1.5">
                      <label className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 block', isRtl && 'font-farsi')}>
                        {t('ledger.seller', 'Job Source / Seller')}
                      </label>
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <Store className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate">{sourceFilter}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSourceFilter('')}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 shrink-0"
                          title={t('ledger.clearSellerFilter', 'Clear seller filter')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 6. Sort Dropdown */}
                  <div className="space-y-1.5">
                    <label className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 block', isRtl && 'font-farsi')}>
                      {t('ledger.sortBy')}
                    </label>
                    <Select
                      value={sortOption}
                      onChange={setSortOption}
                      options={sortOptions}
                      className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 4. Grouped Job Feed */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800/80 p-12 text-center space-y-3">
          <p className={cn('text-xs text-zinc-500', isRtl && 'font-farsi')}>
            {searchQuery || statusFilter || currencyFilter || gameFilter || hasProofFilter || teammateFilter || sourceFilter
              ? t('ledger.noJobsMatch')
              : t('ledger.emptyDesc')}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button variant="primary" size="sm" onClick={() => onOpenWorkModal?.()} className={cn(isRtl && 'font-farsi')}>
              <Plus className="w-3.5 h-3.5" />
              <span>{t('nav.addWork')}</span>
            </Button>
            {Boolean(searchQuery || statusFilter || currencyFilter || gameFilter || hasProofFilter || teammateFilter || sourceFilter) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className={cn('text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800', isRtl && 'font-farsi')}
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('ledger.clearFilters', 'Clear Filters')}</span>
              </Button>
            )}
          </div>
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

                  {/* Selectable Day Total Income Badge with Square Checkbox */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDaySelected}
                    onClick={() => handleToggleDaySelection(groupTitle)}
                    title={isDaySelected ? t('ledger.deselectDayTitle') : t('ledger.selectDayTitle')}
                    className={cn(
                      'group/day-total flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] transition-all select-none border cursor-pointer',
                      isDaySelected
                        ? 'bg-zinc-900 text-zinc-100 font-medium border-zinc-900 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700/80 shadow-sm'
                        : 'bg-white hover:bg-zinc-100/80 text-zinc-600 hover:text-zinc-900 border-zinc-200 hover:border-zinc-300 dark:bg-transparent dark:border-zinc-800/60 dark:text-zinc-500 dark:hover:border-zinc-700/70 dark:hover:text-zinc-400'
                    )}
                  >
                    <span
                      className={cn(
                        'text-[9px] uppercase font-medium',
                        isDaySelected
                          ? 'text-zinc-300 dark:text-zinc-400'
                          : 'text-zinc-500 dark:text-zinc-600',
                        isRtl && 'font-farsi'
                      )}
                    >
                      {t('ledger.dayTotal')}:
                    </span>
                    <strong
                      className={
                        isDaySelected
                          ? 'text-zinc-100 dark:text-zinc-200 font-medium'
                          : 'text-zinc-800 dark:text-zinc-400 font-normal'
                      }
                    >
                      <MoneyDisplay amount={dayTotal} currency={globalCurrency} />
                    </strong>

                    {/* Square Checkbox Indicator on the other side of the badge */}
                    <span
                      className={cn(
                        'w-3.5 h-3.5 rounded-[2.5px] border flex items-center justify-center transition-all shrink-0',
                        isDaySelected
                          ? 'bg-zinc-100 border-zinc-100 text-zinc-900 dark:bg-zinc-200 dark:border-zinc-200 dark:text-zinc-900'
                          : 'bg-zinc-50 border-zinc-300 text-transparent group-hover/day-total:border-zinc-400 dark:bg-zinc-950/60 dark:border-zinc-700/80 dark:group-hover/day-total:border-zinc-500'
                      )}
                    >
                      <Check
                        className={cn(
                          'w-2.5 h-2.5 stroke-[3]',
                          isDaySelected ? 'opacity-100 text-zinc-900' : 'opacity-0'
                        )}
                      />
                    </span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {groupItems.map((entry) => {
                      const isConfirmDeleting = confirmDeleteEntryId === entry.id;
                      const isSelected = selectedEntryIds.has(entry.id);
                      const entryCat = getCategoryByName(entry.game, categories);
                      const accentColor = entryCat?.color || '#C68A4C';

                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 4, scale: 0.99 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: 'easeOut' } }}
                          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                          className="space-y-1 relative job-row-item"
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
                                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <p className={cn('text-zinc-900 dark:text-zinc-200 font-medium truncate', isRtl && 'font-farsi')}>
                                      {language === 'fa' ? (
                                        <>حذف <span className="text-zinc-900 dark:text-zinc-200 font-medium">«{entry.title}»</span>؟</>
                                      ) : (
                                        <>Delete <span className="text-zinc-900 dark:text-zinc-200 font-medium">"{entry.title}"</span>?</>
                                      )}
                                    </p>
                                    <p className={cn('text-[10px] text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                                      {t('ledger.deleteRecordWarning', 'This work record and any attached screenshot proof will be permanently removed.')}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setConfirmDeleteEntryId(null)}
                                    className={cn('h-7 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200', isRtl && 'font-farsi')}
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
                                    className={cn('h-7 text-xs bg-rose-600 hover:bg-rose-500 text-zinc-100 font-medium shadow-sm gap-1', isRtl && 'font-farsi')}
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
                                  data-entry-id={entry.id}
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
                                    'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3 rounded-xl transition-all duration-150 cursor-pointer border',
                                    contextMenuTargetId === entry.id
                                      ? 'bg-zinc-100/90 dark:bg-zinc-900/40 border-zinc-400 dark:border-zinc-500 ring-1 ring-zinc-400/80 dark:ring-zinc-400/80 shadow-md shadow-zinc-950/5 dark:shadow-lg dark:shadow-black/30'
                                      : isSelected
                                      ? 'bg-zinc-100/90 dark:bg-zinc-900/30 border-zinc-300 dark:border-zinc-600/50 shadow-xs'
                                      : 'bg-transparent hover:bg-zinc-100/40 dark:hover:bg-zinc-900/20 border-zinc-200/50 dark:border-zinc-800/40 hover:border-zinc-300/60 dark:hover:border-zinc-700/50'
                                  )}
                                >
                                  {/* 135° Minimal Mixed Gradient Border Overlays */}
                                  {!isSelected && contextMenuTargetId !== entry.id && (
                                    <>
                                      {/* Resting: subtle 135° diagonal border gradient */}
                                      <div
                                        className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-200 group-hover:opacity-0"
                                        style={{
                                          padding: '1px',
                                          background: `linear-gradient(135deg, ${accentColor}44 0%, ${accentColor}12 28%, transparent 68%)`,
                                          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                                          WebkitMaskComposite: 'xor',
                                          maskComposite: 'exclude',
                                        }}
                                      />
                                      {/* Hover: gently blooming 135° border gradient */}
                                      <div
                                        className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                                        style={{
                                          padding: '1px',
                                          background: `linear-gradient(135deg, ${accentColor}75 0%, ${accentColor}25 35%, transparent 75%)`,
                                          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                                          WebkitMaskComposite: 'xor',
                                          maskComposite: 'exclude',
                                        }}
                                      />
                                      {/* Hover: subtle ambient top-left corner glow */}
                                      <div className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-200 opacity-0 group-hover:opacity-100 overflow-hidden">
                                        <div
                                          className="absolute -top-8 -left-8 w-28 h-28 rounded-full blur-xl pointer-events-none"
                                          style={{ backgroundColor: `${accentColor}10` }}
                                        />
                                      </div>
                                    </>
                                  )}

                                  {/* Multi-Selection Square Checkbox Hovering Over Top-Left Border Corner */}
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={isSelected}
                                    data-no-row-click="true"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleEntrySelection(entry.id, e);
                                    }}
                                    title={isSelected ? 'Deselect (or Shift+Click for range)' : 'Select (or Shift+Click for range)'}
                                    className={cn(
                                      'absolute -top-1.5 -left-1.5 z-20 w-4.5 h-4.5 rounded-[2.5px] border flex items-center justify-center transition-all shadow-md',
                                      isSelected
                                        ? 'bg-zinc-900 border-zinc-900 text-zinc-100 dark:bg-zinc-200 dark:border-zinc-200 dark:text-zinc-900 scale-100 opacity-100'
                                        : isSelectMode
                                        ? 'bg-white border-zinc-400 text-transparent opacity-100 hover:border-zinc-600 hover:scale-105 dark:bg-zinc-950 dark:border-zinc-700 dark:hover:border-zinc-400'
                                        : 'bg-white border-zinc-300 text-transparent opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 hover:scale-105 dark:bg-zinc-950 dark:border-zinc-700/80 dark:hover:border-zinc-400'
                                    )}
                                  >
                                    <Check className={cn('w-3 h-3 stroke-[3]', isSelected ? 'opacity-100 text-zinc-100 dark:text-zinc-900' : 'opacity-0 hover:opacity-50 text-zinc-400 dark:text-zinc-400')} />
                                  </button>

                                  {/* Left: Game Emblem & Details (Always keep GameIcon on far left) */}
                                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                    <div className="w-9 h-9 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                                      <GameIcon game={entry.game} categories={categories} className="w-6.5 h-6.5 sm:w-7 sm:h-7 object-contain opacity-85 hover:opacity-100 transition-opacity" />
                                    </div>

                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    {/* Line 1: Title, Proof Indicator, Seller Badge & Timestamp */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-300 truncate">
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
                                      {entry.source && (() => {
                                        const isMatch = sourceFilter.toLowerCase() === entry.source.toLowerCase();
                                        return (
                                          <button
                                            type="button"
                                            data-no-row-click="true"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSourceFilter(isMatch ? '' : entry.source);
                                            }}
                                            title={isMatch ? t('ledger.clearSellerFilter', 'Clear seller filter') : `${t('ledger.filterBySeller', 'Click to filter jobs from')} ${entry.source}`}
                                            className={cn(
                                              'text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors border flex items-center gap-1 active:scale-[0.97] cursor-pointer max-w-[140px]',
                                              isMatch
                                                ? 'bg-zinc-200 text-zinc-900 font-medium border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 shadow-xs'
                                                : 'bg-zinc-100/80 hover:bg-zinc-200/80 border-zinc-200 hover:border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:bg-transparent dark:hover:bg-zinc-900 dark:border-zinc-800/80 dark:text-zinc-400 dark:hover:text-zinc-300'
                                            )}
                                          >
                                            <Store className={cn('w-2.5 h-2.5 shrink-0', isMatch ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500')} />
                                            <span className="truncate">{entry.source}</span>
                                          </button>
                                        );
                                      })()}
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
                                        <span className={cn(
                                          'px-1.5 py-0.5 rounded text-[10px] font-mono border ring-1 ring-inset backdrop-blur-md inline-flex items-baseline gap-1',
                                          entry.status === 'Failed'
                                            ? 'bg-zinc-100/60 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 ring-transparent line-through decoration-zinc-400 dark:decoration-zinc-600'
                                            : 'bg-amber-500/10 dark:bg-zinc-900/90 text-amber-700 dark:text-amber-300/90 border-amber-600/30 dark:border-amber-800/40 ring-amber-600/20'
                                        )}>
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
                                                ? 'bg-zinc-200 text-zinc-800 font-medium border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 shadow-sm'
                                                : 'bg-zinc-100/80 hover:bg-zinc-200/80 border-zinc-300 text-zinc-700 hover:text-zinc-900 dark:bg-transparent dark:hover:bg-zinc-900 dark:border-zinc-800/80 dark:text-zinc-400 dark:hover:text-zinc-300'
                                            }`}
                                          >
                                            <span>{tm}</span>
                                            {customCut && (
                                              <span className={cn(
                                                'font-mono text-[9px] inline-flex items-baseline',
                                                entry.status === 'Failed'
                                                  ? 'text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-400 dark:decoration-zinc-600'
                                                  : isMatch
                                                  ? 'text-zinc-800 dark:text-zinc-300'
                                                  : 'text-zinc-500 dark:text-zinc-400'
                                              )}>
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
                                  <div className={cn(
                                    'text-xs font-medium font-mono',
                                    entry.status === 'Failed'
                                      ? 'text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-400 dark:decoration-zinc-600'
                                      : 'text-zinc-800 dark:text-zinc-200'
                                  )}>
                                    <MoneyDisplay amount={entry.income} currency={entry.currency} />
                                  </div>
                                  {entry.currency !== globalCurrency && (
                                    <div className={cn(entry.status === 'Failed' && 'opacity-60 line-through decoration-zinc-400 dark:decoration-zinc-600')}>
                                      <ConvertedSecondaryDisplay
                                        amount={entry.income}
                                        fromCurrency={entry.currency}
                                        targetCurrency={globalCurrency}
                                        rates={rates}
                                        customRate={entry.exchangeRate}
                                        isPerOneGold={entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic'}
                                        showRateLabel={false}
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {/* App-Aware External Link Button */}
                                  {entry.link && (() => {
                                    const linkInfo = detectAppLink(entry.link);
                                    const platform = linkInfo?.platform;
                                    const isApp = linkInfo?.appLaunchable;

                                    let IconComponent = ExternalLink;
                                    if (platform === 'discord') IconComponent = DiscordIcon;
                                    else if (platform === 'telegram') IconComponent = TelegramIcon;
                                    else if (platform === 'steam') IconComponent = SteamIcon;
                                    else if (platform === 'sheets') IconComponent = GoogleSheetsIcon;
                                    else if (platform === 'github') IconComponent = GithubIcon;

                                    const tooltipLabel = linkInfo
                                      ? (isApp
                                          ? (language === 'fa' && linkInfo.labelFa ? `باز کردن در ${linkInfo.labelFa}` : `Open in ${linkInfo.label} App`)
                                          : (language === 'fa' && linkInfo.labelFa ? `باز کردن ${linkInfo.labelFa}` : `Open ${linkInfo.label}`))
                                      : t('ledger.openLink', 'Open Link');

                                    return (
                                      <Tooltip
                                        content={
                                          <div className="max-w-[260px] space-y-0.5 text-left rtl:text-right">
                                            <div className="font-medium text-zinc-800 dark:text-zinc-200">{tooltipLabel}</div>
                                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate">{entry.link}</div>
                                          </div>
                                        }
                                        side="top"
                                        align="end"
                                      >
                                        <button
                                          type="button"
                                          data-no-row-click="true"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenExternalLink(entry.link);
                                          }}
                                          title={tooltipLabel}
                                          className="w-[26px] h-[26px] flex items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 active:scale-[0.95] transition-all border border-zinc-200 dark:border-zinc-800/60 shrink-0"
                                        >
                                          <IconComponent className="w-3.5 h-3.5" />
                                        </button>
                                      </Tooltip>
                                    );
                                  })()}

                                  <StatusBadge
                                    status={entry.status}
                                    interactive={true}
                                    onSelectStatus={(st) => handleStatusSelect(entry, st)}
                                  />

                                  {/* 3-Dot More Actions Button (Triggers Unified Row Context Menu) */}
                                  <button
                                    type="button"
                                    data-no-row-click="true"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const x = isRtl ? rect.left : rect.right;
                                      const y = rect.bottom + 4;
                                      onOpenEntryContextMenu?.(entry, { x, y, rect });
                                    }}
                                    title={t('common.moreOptions', 'More options')}
                                    className={cn(
                                      'w-[26px] h-[26px] flex items-center justify-center rounded-md transition-all shrink-0 active:scale-[0.95]',
                                      contextMenuTargetId === entry.id
                                        ? 'text-zinc-900 bg-zinc-200 dark:text-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-zinc-700'
                                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
                                    )}
                                  >
                                    <MoreVertical className="w-3.5 h-3.5 shrink-0" />
                                  </button>
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
                  className={cn('h-8 px-2.5 rounded-md bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none border border-zinc-200 dark:border-zinc-800 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors', isRtl && 'font-farsi')}
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
                          ? 'bg-zinc-900 text-zinc-100 border-zinc-900 dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-300 shadow-sm font-medium'
                          : 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border-zinc-200 dark:border-zinc-800'
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
                  className={cn('h-8 px-2.5 rounded-md bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none border border-zinc-200 dark:border-zinc-800 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors', isRtl && 'font-farsi')}
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
              'fixed bottom-20 md:bottom-8 left-1/2 z-[90] bg-white/95 dark:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-200 dark:border-zinc-800/90 shadow-2xl ring-1 ring-zinc-200/80 dark:ring-zinc-800/50 rounded-2xl px-5 sm:px-6 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4 max-w-[calc(100vw-2rem)] max-w-4xl justify-between',
              isRtl && 'font-farsi'
            )}
          >
            <div className="flex items-center gap-3 min-w-0 shrink-0">
              <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-900/90 dark:text-zinc-200 dark:border-zinc-700/80 shrink-0', isRtl && 'font-farsi')}>
                {formatNumber(selectedDaysSummary.daysCount)} {selectedDaysSummary.daysCount === 1 ? t('ledger.day') : t('ledger.days')}
              </span>

              <div className="flex items-baseline gap-2 min-w-0 shrink-0">
                <span className={cn('text-zinc-500 dark:text-zinc-400 text-xs hidden sm:inline', isRtl && 'font-farsi')}>{t('ledger.sum')}:</span>
                <strong className="text-zinc-900 dark:text-zinc-200 font-medium text-base sm:text-lg tracking-tight shrink-0">
                  <MoneyDisplay amount={selectedDaysSummary.totalIncome} currency={globalCurrency} />
                </strong>
                <span className={cn('text-[11px] text-zinc-500 dark:text-zinc-500 shrink-0', isRtl && 'font-farsi')}>
                  ({formatNumber(selectedDaysSummary.totalJobs)} {selectedDaysSummary.totalJobs === 1 ? t('ledger.job') : t('ledger.jobs')})
                </span>
              </div>
            </div>

            {/* Right Group with Standalone Vertical Divider */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
              <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800/90 shrink-0" />

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
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border-transparent hover:border-zinc-200 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 dark:hover:border-zinc-700'
                  }`, isRtl && 'font-farsi')}
                >
                  {isSumCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-50 duration-150" />
                      <span className="hidden sm:inline font-medium text-emerald-700 dark:text-emerald-300">{t('ledger.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
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
                  className={cn('h-8 px-2 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 gap-1 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors', isRtl && 'font-farsi')}
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
                <strong className="text-zinc-200 font-medium text-xs sm:text-sm tracking-tight shrink-0">
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
              {bulkMetrics.paid > 0 && (bulkMetrics.pending > 0 || bulkMetrics.working > 0 || bulkMetrics.onHold > 0 || bulkMetrics.failed > 0) && <span className="text-zinc-600">•</span>}
              {bulkMetrics.pending > 0 && <span className="text-amber-400 font-medium">{formatNumber(bulkMetrics.pending)} {t('status.Pending')}</span>}
              {bulkMetrics.pending > 0 && (bulkMetrics.working > 0 || bulkMetrics.onHold > 0 || bulkMetrics.failed > 0) && <span className="text-zinc-600">•</span>}
              {bulkMetrics.working > 0 && <span className="text-cyan-400 font-medium">{formatNumber(bulkMetrics.working)} {t('status.Working')}</span>}
              {bulkMetrics.working > 0 && (bulkMetrics.onHold > 0 || bulkMetrics.failed > 0) && <span className="text-zinc-600">•</span>}
              {bulkMetrics.onHold > 0 && <span className="text-zinc-500 font-medium">{formatNumber(bulkMetrics.onHold)} {t('status.On Hold')}</span>}
              {bulkMetrics.onHold > 0 && bulkMetrics.failed > 0 && <span className="text-zinc-600">•</span>}
              {bulkMetrics.failed > 0 && <span className="text-rose-400 font-medium">{formatNumber(bulkMetrics.failed)} {t('status.Failed')}</span>}
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
                    className={cn('h-7 px-2 text-[11px] gap-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 border border-zinc-800/80 shadow-sm shrink-0 flex items-center', isRtl && 'font-farsi')}
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
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 text-start transition-colors"
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
                                : st === 'Failed'
                                ? 'bg-rose-400'
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
                  className={cn('h-7 px-2 text-[11px] gap-1 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 border border-zinc-800/80 shadow-sm flex items-center shrink-0', isRtl && 'font-farsi')}
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
                      className={cn('h-5 px-1.5 rounded text-[10px] bg-rose-600 hover:bg-rose-500 text-zinc-100 font-medium shadow-sm flex items-center', isRtl && 'font-farsi')}
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
