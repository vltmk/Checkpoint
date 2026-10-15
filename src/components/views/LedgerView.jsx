import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Gamepad2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { StatusBadge, STATUS_STYLES } from '../ui/Badge';
import { GameIcon } from '../ui/GameIcon';
import { MoneyDisplay, ConvertedSecondaryDisplay } from '../ui/MoneyDisplay';
import { Tooltip, Kbd } from '../ui/Tooltip';
import { cn } from '../../lib/utils';
import { openExternalUrl, openAppAwareUrl, copyTextNative } from '../../lib/desktop';
import { detectAppLink } from '../../lib/appLinks';
import { DiscordIcon, TelegramIcon, SteamIcon, GoogleSheetsIcon, GithubIcon, TomanIcon } from '../ui/Icons';
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

const TIME_FORMATTER_LTR = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const TIME_FORMATTER_RTL = new Intl.DateTimeFormat('fa-IR', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function FormattedInlineNotes({ text }) {
  const [copiedTag, setCopiedTag] = useState(null);

  const handleCopyTag = (e, tag) => {
    e.stopPropagation();
    copyTextNative(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1600);
  };

  const mentionsAndTags = useMemo(() => {
    if (!text || typeof text !== 'string') return [];
    const regex = /(?:^|(?<=[^\w]))(@[a-zA-Z0-9_]{2,32}\b(?!\.[a-zA-Z]{2,}\b)|#[a-zA-Z0-9_-]{1,32}\b)/g;
    const matches = [...text.matchAll(regex)].map((m) => m[1]);
    return matches;
  }, [text]);

  if (!text) return null;

  // When mentions or tags exist, display ONLY the pills in the ledger work row (per UX rule)
  if (mentionsAndTags.length > 0) {
    return (
      <Tooltip content={text} side="top">
        <span className="inline-flex items-center gap-1 flex-wrap max-w-[280px]">
          {mentionsAndTags.map((token, i) => {
            const isCopied = copiedTag === token;
            if (token.startsWith('@')) {
              return (
                <button
                  key={i}
                  type="button"
                  data-no-row-click="true"
                  onClick={(e) => handleCopyTag(e, token)}
                  title={`Click to copy ${token}`}
                  className={cn(
                    'inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium transition-all select-none active:scale-[0.96] cursor-pointer',
                    isCopied
                      ? 'bg-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                      : 'bg-zinc-200/80 text-zinc-800 hover:bg-zinc-300/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                  )}
                >
                  <span>{token}</span>
                  {isCopied && <span className="text-[8px] font-bold">✓</span>}
                </button>
              );
            }
            return (
              <button
                key={i}
                type="button"
                data-no-row-click="true"
                onClick={(e) => handleCopyTag(e, token)}
                title={`Click to copy ${token}`}
                className={cn(
                  'inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium transition-all select-none active:scale-[0.96] cursor-pointer',
                  isCopied
                    ? 'bg-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-700/80'
                )}
              >
                <span>{token}</span>
                {isCopied && <span className="text-[8px] font-bold">✓</span>}
              </button>
            );
          })}
        </span>
      </Tooltip>
    );
  }

  // Fallback: If no mentions or tags exist, display the truncated description in quotes
  return (
    <Tooltip content={text} side="top">
      <span className="truncate max-w-[180px] text-zinc-500 italic leading-normal cursor-default">
        "{text}"
      </span>
    </Tooltip>
  );
}

const LedgerRow = React.memo(function LedgerRow({
  entry,
  isConfirmDeleting,
  isSelected,
  isSelectMode,
  contextMenuTargetId,
  categories,
  globalCurrency,
  rates,
  sourceFilter,
  teammateFilter,
  language,
  isRtl,
  t,
  formatRowTime,
  onOpenWorkModal,
  onOpenReceipt,
  onOpenLightbox,
  handleToggleEntrySelection,
  onDeleteEntry,
  setConfirmDeleteEntryId,
  setSelectedEntryIds,
  setSourceFilter,
  setTeammateFilter,
  handleOpenExternalLink,
  handleStatusSelect,
  onOpenEntryContextMenu,
  activeProfileId = 'booster',
  onUpdateSourcePaid,
  onUpdateBoosterPaid,
}) {
  const [isCopiedOrderId, setIsCopiedOrderId] = useState(false);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [isStatusPickerOpen, setIsStatusPickerOpen] = useState(false);
  const statusPickerRef = useRef(null);

  useEffect(() => {
    if (!isStatusPickerOpen) return;
    const handleOutside = (e) => {
      if (statusPickerRef.current && !statusPickerRef.current.contains(e.target)) {
        setIsStatusPickerOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsStatusPickerOpen(false);
      }
    };
    const handleScroll = () => {
      setIsStatusPickerOpen(false);
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [isStatusPickerOpen]);

  const isAdvertiser = activeProfileId === 'advertiser';
  const formattedTime = formatRowTime(entry.dateTime);
  const entryCat = getCategoryByName(entry.game, categories);
  const accentColor = entryCat?.color || '#C68A4C';

  return (
    <div className="space-y-1 relative job-row-item">
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
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.target.closest('button, input, select, textarea, [data-no-row-click]')) {
                return;
              }
              if (e.ctrlKey || e.metaKey || e.altKey) {
                return;
              }
              if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
                e.preventDefault();
                const rows = Array.from(document.querySelectorAll('[data-entry-id]'));
                const currentIndex = rows.indexOf(e.currentTarget);
                if (currentIndex >= 0 && currentIndex < rows.length - 1) {
                  rows[currentIndex + 1].focus();
                }
              } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                const rows = Array.from(document.querySelectorAll('[data-entry-id]'));
                const currentIndex = rows.indexOf(e.currentTarget);
                if (currentIndex > 0) {
                  rows[currentIndex - 1].focus();
                }
              } else if (e.key === 'Home') {
                e.preventDefault();
                const rows = document.querySelectorAll('[data-entry-id]');
                if (rows.length > 0) rows[0].focus();
              } else if (e.key === 'End') {
                e.preventDefault();
                const rows = document.querySelectorAll('[data-entry-id]');
                if (rows.length > 0) rows[rows.length - 1].focus();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                onOpenWorkModal?.(entry);
              } else if (e.key === ' ') {
                e.preventDefault();
                handleToggleEntrySelection(entry.id, e);
              } else if (e.key === 'Delete') {
                e.preventDefault();
                const rows = Array.from(document.querySelectorAll('[data-entry-id]'));
                const currentIndex = rows.indexOf(e.currentTarget);
                const nextToFocus = rows[currentIndex + 1] || rows[currentIndex - 1];
                onDeleteEntry?.(entry.id);
                setSelectedEntryIds((prev) => {
                  const next = new Set(prev);
                  next.delete(entry.id);
                  return next;
                });
                if (nextToFocus && nextToFocus !== e.currentTarget) {
                  nextToFocus.focus();
                }
              }
            }}
            onContextMenu={(e) => {
              if (e.target.closest('button, input, select, textarea, [data-no-row-click]')) {
                return;
              }
              e.preventDefault();
              onOpenEntryContextMenu?.(entry, { x: e.clientX, y: e.clientY });
            }}
            onClick={(e) => {
              if (e.target.closest('button, input, select, textarea, [data-no-row-click]')) {
                return;
              }
              if (isSelectMode || e.shiftKey) {
                handleToggleEntrySelection(entry.id, e);
              } else {
                onOpenWorkModal?.(entry);
              }
            }}
            className={cn(
              'group group/row relative flex items-stretch rounded-lg transition-colors duration-100 cursor-pointer outline-none overflow-visible scroll-mt-20 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-950',
              contextMenuTargetId === entry.id
                ? 'bg-zinc-200 dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-600 shadow-sm'
                : isSelected
                ? 'bg-zinc-200/90 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700'
                : 'bg-zinc-100/70 dark:bg-zinc-900/60 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-zinc-300/60 dark:hover:border-zinc-700/60'
            )}
          >
            {/* Left border vertical faded glow */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg pointer-events-none transition-opacity duration-150 group-hover:opacity-100 opacity-70"
              style={{
                background: `linear-gradient(to bottom, transparent, ${accentColor} 20%, ${accentColor} 80%, transparent)`,
                boxShadow: `2px 0 10px ${accentColor}40, 1px 0 3px ${accentColor}25`,
              }}
            />

            {/* Subtle 135° category accent indicator line (preserves test assertion) */}
            <div
              className="absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-150 group-hover:opacity-75 opacity-40"
              style={{
                padding: '1px',
                background: `linear-gradient(135deg, ${accentColor}44 0%, ${accentColor}12 28%, transparent 68%)`,
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />

            {/* Multi-Selection Checkbox: revealed on hover or persistent when selected */}
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
                'absolute -top-1 -left-1 z-20 w-4 h-4 rounded-[2.5px] border flex items-center justify-center transition-all duration-100 shadow-xs after:absolute after:-inset-2.5 after:content-[\'\']',
                isSelected
                  ? 'bg-zinc-900 border-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 scale-100 opacity-100'
                  : isSelectMode
                  ? 'bg-white border-zinc-400 text-transparent opacity-100 hover:border-zinc-600 hover:scale-105 dark:bg-zinc-950 dark:border-zinc-700 dark:hover:border-zinc-400'
                  : 'bg-white border-zinc-300 text-transparent opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 hover:scale-105 dark:bg-zinc-950 dark:border-zinc-700/80 dark:hover:border-zinc-400'
              )}
            >
              <Check className={cn('w-2.5 h-2.5 stroke-[3]', isSelected ? 'opacity-100 text-zinc-100 dark:text-zinc-900' : 'opacity-0 hover:opacity-50 text-zinc-400 dark:text-zinc-400')} />
            </button>

            {/* Narrow vertical category column anchored to the left */}
            <div
              className="flex items-center justify-center shrink-0 w-5 sm:w-6 border-r border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/40 select-none py-2 rounded-l-lg"
              title={entry.game}
            >
              <span
                className="text-[8px] sm:text-[8.5px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors whitespace-nowrap truncate max-h-[60px]"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                }}
              >
                {entry.game}
              </span>
            </div>

            {/* Main Row Content */}
            <div className="flex-1 min-w-0 p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              {/* Left: Game Emblem & Details */}
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                {/* Interactive Status & Emblem Trigger */}
                <div className="relative shrink-0" ref={statusPickerRef}>
                  <button
                    type="button"
                    data-no-row-click="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsStatusPickerOpen((prev) => !prev);
                    }}
                    title={language === 'fa' ? `تغییر وضعیت (${STATUS_CONFIG[entry.status]?.label || entry.status})` : `Change status (${STATUS_CONFIG[entry.status]?.label || entry.status})`}
                    aria-label={language === 'fa' ? `تغییر وضعیت (${STATUS_CONFIG[entry.status]?.label || entry.status})` : `Change status (${STATUS_CONFIG[entry.status]?.label || entry.status})`}
                    aria-haspopup="menu"
                    aria-expanded={isStatusPickerOpen}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors relative cursor-pointer group/status-btn mt-0.5 sm:mt-0"
                  >
                    <GameIcon
                      game={entry.game}
                      categories={categories}
                      className="w-6.5 h-6.5 sm:w-7 sm:h-7 object-contain opacity-85 group-hover/status-btn:opacity-100 transition-opacity"
                    />
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 transition-transform group-hover/status-btn:scale-110 shadow-xs',
                        STATUS_STYLES[entry.status]?.dotClass || 'bg-zinc-400'
                      )}
                    />
                  </button>

                  {/* Floating Change Status Dropdown Menu with Pop-in and FlipUp Detection */}
                  <AnimatePresence>
                    {isStatusPickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.1, ease: [0.23, 1, 0.32, 1] }}
                        data-no-row-click="true"
                        dir={isRtl ? 'rtl' : 'ltr'}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute z-50 min-w-[136px] p-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-0.5",
                          (() => {
                            if (typeof window !== 'undefined' && statusPickerRef.current) {
                              const rect = statusPickerRef.current.getBoundingClientRect();
                              if (rect.bottom + 180 > window.innerHeight) {
                                return 'bottom-full mb-1.5 origin-bottom-left';
                              }
                            }
                            return 'top-full mt-1.5 origin-top-left';
                          })()
                        )}
                      >
                        <div className="px-2 py-1 text-[9px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800/80 mb-0.5 select-none">
                          {language === 'fa' ? 'تغییر وضعیت' : 'Change Status'}
                        </div>
                        {STATUSES.map((st) => {
                          const isCurrent = entry.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusSelect?.(entry, st);
                                setIsStatusPickerOpen(false);
                              }}
                              className={cn(
                                'w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors cursor-pointer',
                                isCurrent
                                  ? 'bg-zinc-100 dark:bg-zinc-800/80 font-medium text-zinc-900 dark:text-zinc-100'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_STYLES[st]?.dotClass || 'bg-zinc-400')} />
                                <span>{language === 'fa' ? (STATUS_LABELS.fa[st] || st) : (STATUS_LABELS.en[st] || st)}</span>
                              </div>
                              {isCurrent && <Check className="w-3 h-3 text-zinc-800 dark:text-zinc-200" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  {/* Line 1: Title, Proof Indicator, Seller Badge & Timestamp */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-300 truncate leading-normal">
                      {entry.title}
                    </span>
                    {entry.proofs && entry.proofs.length > 0 && (
                      <Tooltip content={t('ledger.viewScreenshotProof', 'View screenshot proof')} side="top">
                        <button
                          type="button"
                          data-no-row-click="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenLightbox?.(entry.proofs[0]?.data || entry.id, entry.title);
                          }}
                          className="p-1 rounded text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors shrink-0 flex items-center gap-0.5 cursor-pointer"
                          title={t('ledger.viewScreenshotProof', 'View screenshot proof')}
                        >
                          <FileImage className="w-3.5 h-3.5" />
                          {entry.proofs.length > 1 && (
                            <span className="text-[9px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                              +{entry.proofs.length - 1}
                            </span>
                          )}
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
                          <span className="truncate leading-normal">{entry.source}</span>
                        </button>
                      );
                    })()}

                    {/* Order ID Badge (Clickable with Copy Feedback) */}
                    {entry.orderId && (
                      <Tooltip
                        content={isCopiedOrderId ? (language === 'fa' ? 'کپی شد!' : 'Copied!') : (language === 'fa' ? `کپی شناسه سفارش #${entry.orderId}` : `Click to copy #${entry.orderId}`)}
                        side="top"
                      >
                        <button
                          type="button"
                          data-no-row-click="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyTextNative(entry.orderId);
                            setIsCopiedOrderId(true);
                            setTimeout(() => setIsCopiedOrderId(false), 1600);
                          }}
                          className={cn(
                            'text-[9px] font-mono px-1.5 py-0.5 rounded transition-all border flex items-center gap-1 active:scale-[0.96] cursor-pointer max-w-[130px]',
                            isCopiedOrderId
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-white/70 hover:bg-white border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-900 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/80 dark:border-zinc-700/60 dark:hover:border-zinc-600 dark:text-zinc-300 dark:hover:text-zinc-100 shadow-2xs'
                          )}
                        >
                          <span className="text-zinc-400 dark:text-zinc-500 font-semibold">#</span>
                          <span className="truncate">{entry.orderId}</span>
                          {isCopiedOrderId ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 opacity-50 shrink-0" />
                          )}
                        </button>
                      </Tooltip>
                    )}
                    {formattedTime && (
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1 select-none">
                        <Clock className="w-2.5 h-2.5 text-zinc-500 dark:text-zinc-600 shrink-0" />
                        <span>{formattedTime}</span>
                      </span>
                    )}
                  </div>

                  {/* Line 2: Notes only (Category is displayed on the left vertical column) */}
                  {entry.notes && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 min-w-0 leading-normal">
                      <FormattedInlineNotes text={entry.notes} />
                    </div>
                  )}

                {/* Line 3: Interactive Settlement Pills, Payouts & Teammate Badges in Advertiser Mode */}
                {isAdvertiser ? (
                  <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[10px]">
                    {/* Dual 1-Click Settlement Status Pills (Paired Container) */}
                    <div className="inline-flex items-center rounded-md border border-zinc-200/80 dark:border-zinc-800/80 p-0.5 gap-0.5 bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0">
                      {/* 1. Client Paid (Inflow) */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(entry.sourcePaid)}
                        data-no-row-click="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateSourcePaid?.(entry.id, !entry.sourcePaid);
                        }}
                        title={
                          entry.sourcePaid
                            ? (language === 'fa' ? 'وجه سورس دریافت شد (کلیک برای لغو)' : 'Source paid (Click to mark unpaid)')
                            : (language === 'fa' ? 'در انتظار پرداخت سورس (کلیک برای تایید دریافت)' : 'Source unpaid (Click to mark paid)')
                        }
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-medium border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none',
                          entry.sourcePaid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        )}
                      >
                        <span
                          className={cn(
                            'w-3 h-3 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors',
                            entry.sourcePaid
                              ? 'bg-emerald-500 border-emerald-600 text-white dark:bg-emerald-600 dark:border-emerald-500'
                              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950'
                          )}
                        >
                          {entry.sourcePaid && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </span>
                        <span>{language === 'fa' ? (entry.sourcePaid ? 'سورس: تسویه' : 'سورس: دریافت') : (entry.sourcePaid ? 'Source Paid' : 'Source Payout')}</span>
                      </button>

                      {/* 2. Booster Paid (Outflow) */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(entry.boosterPaid)}
                        data-no-row-click="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateBoosterPaid?.(entry.id, !entry.boosterPaid);
                        }}
                        title={
                          entry.boosterPaid
                            ? (language === 'fa' ? 'سهم بوستر پرداخت شد (کلیک برای لغو)' : 'Booster settled (Click to mark unpaid)')
                            : (language === 'fa' ? 'بدهی جاری به بوستر (کلیک برای تسویه با بوستر)' : 'Booster unpaid (Click to mark settled)')
                        }
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-medium border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none',
                          entry.boosterPaid
                            ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        )}
                      >
                        <span
                          className={cn(
                            'w-3 h-3 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors',
                            entry.boosterPaid
                              ? 'bg-blue-500 border-blue-600 text-white dark:bg-blue-600 dark:border-blue-500'
                              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950'
                          )}
                        >
                          {entry.boosterPaid && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </span>
                        <span>{language === 'fa' ? (entry.boosterPaid ? 'بوستر: تسویه' : 'بوستر: پرداخت') : (entry.boosterPaid ? 'Booster Paid' : 'Booster Payout')}</span>
                      </button>
                    </div>

                    {entry.pot && entry.pot > entry.income && (
                      <span className="text-zinc-400 dark:text-zinc-600">•</span>
                    )}

                    {entry.pot && entry.pot > entry.income && (
                      <span className="text-zinc-500 flex items-center gap-1">
                        <span>{language === 'fa' ? 'قیمت سورس:' : 'Source:'}</span>
                        <strong className="text-zinc-700 dark:text-zinc-300 font-medium">
                          <MoneyDisplay amount={entry.pot} currency={entry.currency} />
                        </strong>
                      </span>
                    )}
                    {entry.pot && entry.pot > entry.income && (
                      <span className="text-zinc-400 dark:text-zinc-600">•</span>
                    )}
                    {entry.pot && entry.pot > entry.income && (
                      <span className="text-zinc-500 flex items-center gap-1">
                        <span>{language === 'fa' ? 'سهم بوستر:' : 'Booster:'}</span>
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                          <MoneyDisplay amount={entry.pot - entry.income} currency={entry.currency} />
                        </span>
                      </span>
                    )}
                    {entry.teammates && entry.teammates.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-zinc-500 flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                          <span>{language === 'fa' ? 'بوستر:' : 'Assigned:'}</span>
                        </span>
                        {entry.teammates.map((tm) => {
                          const isMatch = teammateFilter.toLowerCase() === tm.toLowerCase();
                          return (
                            <button
                              key={tm}
                              type="button"
                              data-no-row-click="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTeammateFilter(isMatch ? '' : tm);
                              }}
                              title={`Click to filter jobs with ${tm}`}
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border flex items-center gap-1 active:scale-[0.97] cursor-pointer',
                                isMatch
                                  ? 'bg-zinc-200 text-zinc-800 font-medium border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 shadow-sm'
                                  : 'bg-zinc-100/80 hover:bg-zinc-200/80 border-zinc-300 text-zinc-700 hover:text-zinc-900 dark:bg-transparent dark:hover:bg-zinc-900 dark:border-zinc-800/80 dark:text-zinc-400 dark:hover:text-zinc-300'
                              )}
                            >
                              <span>{tm}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  entry.teammates && entry.teammates.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px]">
                      <span className="text-zinc-500 flex items-center gap-1">
                        <Users className="w-3 h-3 text-zinc-500" />
                        <span>Team:</span>
                      </span>

                      {entry.pot && (
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] border ring-1 ring-inset inline-flex items-baseline gap-1',
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
                                'text-[9px] inline-flex items-baseline',
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
                  )
                )}
              </div>
            </div>

            {/* Right: Income (Your Cut / Net Profit), External Link, Status, Menu */}
            <div className="flex items-center justify-between sm:grid sm:grid-cols-[120px_58px] sm:justify-end gap-2 sm:gap-2.5 shrink-0 pt-1 sm:pt-0">
              <div className="text-start sm:text-end sm:w-[120px] min-w-0">
                {isAdvertiser ? (
                  <div className={cn('text-[9px] text-zinc-500 uppercase tracking-wider', isRtl && 'font-farsi')}>
                    {language === 'fa' ? 'سود خالص' : 'Net Profit'}
                  </div>
                ) : (
                  entry.teamMode && (
                    <div className={cn('text-[9px] text-zinc-500 uppercase tracking-wider', isRtl && 'font-farsi')}>
                      {t('ledger.yourShare', 'Your Share')}
                    </div>
                  )
                )}
                {entry.income < 0 && (
                  <div className={cn('text-[9px] text-rose-600 dark:text-rose-400 uppercase tracking-wider font-medium', isRtl && 'font-farsi')}>
                    {t('work.expenseMode', 'Expense')}
                  </div>
                )}
                <div className={cn(
                  'text-xs font-semibold tabular-nums font-mono inline-flex items-center justify-start sm:justify-end',
                  entry.status === 'Failed'
                    ? 'text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-400 dark:decoration-zinc-600'
                    : entry.income < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : isAdvertiser
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-800 dark:text-zinc-200'
                )}>
                  <MoneyDisplay amount={entry.income} currency={entry.currency} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 sm:w-[58px] shrink-0">
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
                          <div className={cn("font-medium", isCopiedLink ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-800 dark:text-zinc-200")}>
                            {isCopiedLink ? t('ledger.copiedLink', 'Copied link to clipboard!') : tooltipLabel}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{entry.link}</div>
                          {!isCopiedLink && (
                            <div className="text-[9px] text-zinc-400 dark:text-zinc-500 font-normal">
                              {t('ledger.openLinkHint', 'Left-click to open • Right-click to copy')}
                            </div>
                          )}
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
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          copyTextNative(entry.link);
                          setIsCopiedLink(true);
                          setTimeout(() => setIsCopiedLink(false), 1200);
                        }}
                        title={isCopiedLink ? t('ledger.copiedLink', 'Copied link to clipboard!') : tooltipLabel}
                        className={cn(
                          'w-8 h-8 sm:w-[26px] sm:h-[26px] flex items-center justify-center rounded-md transition-all border shrink-0',
                          isCopiedLink
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 bg-white/70 hover:bg-white dark:bg-zinc-800/60 dark:hover:bg-zinc-700/80 border-zinc-200/80 dark:border-zinc-700/70 hover:border-zinc-300 dark:hover:border-zinc-600 shadow-2xs active:scale-[0.95]'
                        )}
                      >
                        {isCopiedLink ? (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <IconComponent className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </Tooltip>
                  );
                })()}

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
                    'w-8 h-8 sm:w-[26px] sm:h-[26px] flex items-center justify-center rounded-md border transition-all duration-100 shrink-0 active:scale-[0.95]',
                    contextMenuTargetId === entry.id
                      ? 'text-zinc-900 bg-zinc-300/80 dark:text-zinc-100 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-600 ring-1 ring-zinc-400 dark:ring-zinc-600 opacity-100'
                      : 'text-zinc-500 hover:text-zinc-950 bg-white/70 hover:bg-white dark:text-zinc-400 dark:hover:text-zinc-100 dark:bg-zinc-800/60 dark:hover:bg-zinc-700/80 border-zinc-200/80 dark:border-zinc-700/70 hover:border-zinc-300 dark:hover:border-zinc-600 shadow-2xs sm:opacity-40 sm:group-hover:opacity-100 sm:group-focus-within/row:opacity-100 sm:focus-visible:opacity-100'
                  )}
                >
                  <MoreVertical className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

export function LedgerView({
  entries = [],
  categories = [],
  globalCurrency = 'TOMAN',
  onCurrencyChange,
  goldRateTOMAN = 3200,
  usdRateTOMAN = 95000,
  eurRateUSD = 1.08,
  onSaveRates,
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
  activeProfileId = 'booster',
  onUpdateSourcePaid,
  onUpdateBoosterPaid,
  ledgerDateFormat = 'relative',
  searchQuery: propSearchQuery,
  onSearchQueryChange,
  statusFilter: propStatusFilter,
  onStatusFilterChange,
}) {
  const { t, language, isRtl, formatNumber, formatDate, formatLedgerGroupDate } = useLanguage();
  const isAdvertiser = activeProfileId === 'advertiser';
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalStatusFilter, setInternalStatusFilter] = useState('');
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchQueryChange || setInternalSearchQuery;
  const statusFilter = propStatusFilter !== undefined ? propStatusFilter : internalStatusFilter;
  const setStatusFilter = onStatusFilterChange || setInternalStatusFilter;
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [hasProofFilter, setHasProofFilter] = useState(false);
  const [teammateFilter, setTeammateFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [sortOption, setSortOption] = useState('date_desc');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFiltersPopoverOpen, setIsFiltersPopoverOpen] = useState(false);
  const filtersPopoverRef = useRef(null);
  const [isGameCategoryMenuOpen, setIsGameCategoryMenuOpen] = useState(false);
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const gameCategoryMenuRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const currencyDropdownRef = useRef(null);
  const [currencyMenuPlacement, setCurrencyMenuPlacement] = useState({ align: 'left', flipUp: false });

  useLayoutEffect(() => {
    if (!isCurrencyMenuOpen || !currencyDropdownRef.current) return;
    const rect = currencyDropdownRef.current.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 170;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let align = isRtl ? 'right' : 'left';
    if (align === 'left' && rect.left + menuWidth > viewportWidth - 8) {
      align = 'right';
    } else if (align === 'right' && rect.right - menuWidth < 8) {
      align = 'left';
    }

    const flipUp = rect.bottom + menuHeight > viewportHeight - 8;
    setCurrencyMenuPlacement({ align, flipUp });
  }, [isCurrencyMenuOpen, isRtl]);

  useEffect(() => {
    if (!isCurrencyMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target)) {
        setIsCurrencyMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isCurrencyMenuOpen]);
  const [selectedDayKeys, setSelectedDayKeys] = useState(new Set());
  const [isSumCopied, setIsSumCopied] = useState(false);
  const [isDiscordBatchCopied, setIsDiscordBatchCopied] = useState(false);

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
    () => ({ goldRateTOMAN, usdRateTOMAN, eurRateUSD }),
    [goldRateTOMAN, usdRateTOMAN, eurRateUSD]
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

  // Partition game categories into visible (up to 3) and overflow games with smart active-game pinning
  const { visibleGames, overflowGames } = useMemo(() => {
    if (gameCategories.length <= 1) {
      return { visibleGames: [], overflowGames: [] };
    }
    const specific = gameCategories.slice(1);
    if (specific.length <= 3) {
      return { visibleGames: specific, overflowGames: [] };
    }

    // If an active game filter exists and is not within the first 3 games, pin it into slot 3
    if (gameFilter && !specific.slice(0, 3).some((g) => g.id === gameFilter)) {
      const activeGame = specific.find((g) => g.id === gameFilter);
      if (activeGame) {
        const top2 = specific.slice(0, 2);
        const visible = [...top2, activeGame];
        const overflow = specific.filter((g) => !visible.some((v) => v.id === g.id));
        return { visibleGames: visible, overflowGames: overflow };
      }
    }

    return {
      visibleGames: specific.slice(0, 3),
      overflowGames: specific.slice(3),
    };
  }, [gameCategories, gameFilter]);

  // Search filtered specific games for the popover menu
  const filteredSpecificGames = useMemo(() => {
    const specific = gameCategories.slice(1);
    if (!gameSearchQuery.trim()) return specific;
    const q = gameSearchQuery.toLowerCase().trim();
    return specific.filter((g) => g.label.toLowerCase().includes(q));
  }, [gameCategories, gameSearchQuery]);

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
    if (statusFilter && statusFilter !== 'ALL') count++;
    if (currencyFilter) count++;
    if (hasProofFilter) count++;
    if (teammateFilter) count++;
    if (sourceFilter) count++;
    if (isAdvertiser && settlementFilter) count++;
    if (sortOption !== 'date_desc') count++;
    return count;
  }, [statusFilter, currencyFilter, hasProofFilter, teammateFilter, sourceFilter, isAdvertiser, settlementFilter, sortOption]);

  const formatRowTime = useCallback(
    (dateTimeStr) => {
      if (!dateTimeStr) return '';
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return '';
      try {
        const formatter = isRtl ? TIME_FORMATTER_RTL : TIME_FORMATTER_LTR;
        return formatter.format(d);
      } catch (e) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    },
    [isRtl]
  );

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

  // Reset page & selections when filter criteria or active profile changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedDayKeys(new Set());
    setSelectedEntryIds(new Set());
    setConfirmDeleteEntryId(null);
    setIsBulkDeleting(false);
    setIsStatusDropdownOpen(false);
  }, [activeProfileId, searchQuery, statusFilter, currencyFilter, gameFilter, hasProofFilter, teammateFilter, sourceFilter, settlementFilter, dateRangeFilter, sortOption]);

  // Close status dropdown, game categories menu & filters popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (isStatusDropdownOpen) setIsStatusDropdownOpen(false);
      if (isFiltersPopoverOpen && filtersPopoverRef.current && !filtersPopoverRef.current.contains(e.target)) {
        setIsFiltersPopoverOpen(false);
      }
      if (isGameCategoryMenuOpen && gameCategoryMenuRef.current && !gameCategoryMenuRef.current.contains(e.target)) {
        setIsGameCategoryMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isStatusDropdownOpen, isFiltersPopoverOpen, isGameCategoryMenuOpen]);

  // Base filtered and sorted entries (all filters EXCEPT statusFilter)
  const baseFilteredEntries = useMemo(() => {
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
        const matchOrderId = e.orderId && e.orderId.toLowerCase().includes(q);
        const statusLabel = STATUS_LABELS[e.status] || '';
        const matchStatus =
          (e.status && e.status.toLowerCase().includes(q)) ||
          (statusLabel && statusLabel.toLowerCase().includes(q));
        const matchTeammates = e.teammates && Array.isArray(e.teammates) && e.teammates.some((t) => t.toLowerCase().includes(q));
        const matchDate = (e.dateTime && (e.dateTime.includes(q) || e.dateTime.includes(normQ))) || (shamsiDate && (shamsiDate.includes(q) || shamsiDate.includes(normQ)));
        return matchTitle || matchGame || matchSource || matchNotes || matchOrderId || matchStatus || matchTeammates || matchDate;
      });
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

    if (isAdvertiser && settlementFilter) {
      if (settlementFilter === 'received') {
        list = list.filter((e) => Boolean(e.sourcePaid));
      } else if (settlementFilter === 'pending') {
        list = list.filter((e) => !e.sourcePaid);
      } else if (settlementFilter === 'booster_due') {
        list = list.filter((e) => !e.boosterPaid);
      } else if (settlementFilter === 'booster_paid') {
        list = list.filter((e) => Boolean(e.boosterPaid));
      }
    }

    if (dateRangeFilter) {
      const now = new Date();
      if (dateRangeFilter === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        list = list.filter((e) => new Date(e.dateTime || 0).getTime() >= startOfToday);
      } else if (dateRangeFilter === 'yesterday') {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        list = list.filter((e) => {
          const t = new Date(e.dateTime || 0).getTime();
          return t >= startOfYesterday && t < endOfYesterday;
        });
      } else if (dateRangeFilter === 'week') {
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
        list = list.filter((e) => new Date(e.dateTime || 0).getTime() >= startOfWeek);
      } else if (dateRangeFilter === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        list = list.filter((e) => new Date(e.dateTime || 0).getTime() >= startOfMonth);
      } else if (dateRangeFilter === 'last_month') {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        list = list.filter((e) => {
          const t = new Date(e.dateTime || 0).getTime();
          return t >= startOfLastMonth && t < endOfLastMonth;
        });
      }
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
  }, [entries, searchQuery, currencyFilter, gameFilter, hasProofFilter, teammateFilter, sourceFilter, isAdvertiser, settlementFilter, dateRangeFilter, sortOption, globalCurrency, rates]);

  // Filtered and sorted entries with statusFilter applied for ledger table
  const filteredEntries = useMemo(() => {
    if (statusFilter && statusFilter !== 'ALL') {
      return baseFilteredEntries.filter((e) => e.status === statusFilter);
    }
    return baseFilteredEntries;
  }, [baseFilteredEntries, statusFilter]);

  // Aggregate metrics for compact balance summary (derived from baseFilteredEntries so HUD stays stable during status filtering)
  const metrics = useMemo(() => {
    let totalPaid = 0;
    let paidCount = 0;
    let totalPending = 0;
    let pendingCount = 0;
    let totalFailed = 0;
    let failedCount = 0;

    let grossVolume = 0;
    let pendingInflow = 0;
    let boosterPayouts = 0;

    baseFilteredEntries.forEach((e) => {
      const convertedInc = convertEntryCurrency(e, globalCurrency, rates);
      const grossAmount = e.pot ? convertCurrency(e.pot, e.currency, globalCurrency, rates) : convertedInc;
      const payoutAmount = Math.max(0, grossAmount - convertedInc);

      if (e.status !== 'Failed') {
        grossVolume += grossAmount;
        boosterPayouts += payoutAmount;
        if (!e.sourcePaid) {
          pendingInflow += convertedInc;
        }
      }

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
        : (baseFilteredEntries.length > 0 ? Math.round((paidCount / baseFilteredEntries.length) * 100) : 0);
    const payableJobsCount = baseFilteredEntries.length - failedCount;
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
      grossVolume,
      pendingInflow,
      boosterPayouts,
    };
  }, [baseFilteredEntries, globalCurrency, rates]);

  const cockpitHeroRef = useRef(null);

  const handleStatusFilterToggle = (status) => {
    setStatusFilter((prev) => (prev === status ? '' : status));
  };

  // Pagination calculation & auto-clamping
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedEntries = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredEntries.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEntries, currentPage, totalPages]);

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

  const paginatedEntriesRef = useRef(paginatedEntries);
  useEffect(() => {
    paginatedEntriesRef.current = paginatedEntries;
  }, [paginatedEntries]);

  const selectedEntryIdsRef = useRef(selectedEntryIds);
  useEffect(() => {
    selectedEntryIdsRef.current = selectedEntryIds;
  }, [selectedEntryIds]);

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
        if (isGameCategoryMenuOpen) {
          setIsGameCategoryMenuOpen(false);
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
        if (selectedEntryIdsRef.current.size > 0 || isSelectMode) {
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
        const pageIds = paginatedEntriesRef.current.map((entry) => entry.id);
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
    isSelectMode,
    sourceFilter,
    teammateFilter,
    globalCurrency,
    onCurrencyChange,
    searchInputRef,
    setConfirmDeleteEntryId,
    setIsSelectMode,
    setSelectedEntryIds,
    setSourceFilter,
    setTeammateFilter,
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
    const groupsMap = new Map();

    paginatedEntries.forEach((entry) => {
      const d = new Date(entry.dateTime);
      let groupTitle = t('ledger.earlier');
      if (!isNaN(d.getTime())) {
        groupTitle = formatLedgerGroupDate
          ? formatLedgerGroupDate(d, ledgerDateFormat)
          : formatDate(d, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
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
  }, [paginatedEntries, globalCurrency, rates, t, formatLedgerGroupDate, ledgerDateFormat, formatDate]);

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
    if (selectedEntryIds.size > 0) {
      setSelectedEntryIds(new Set());
    }
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
    setSettlementFilter('');
    setDateRangeFilter('');
    setHasProofFilter(false);
    setSortOption('date_desc');
    setIsFiltersPopoverOpen(false);
    setSelectedDayKeys(new Set());
    setSelectedEntryIds(new Set());
    setConfirmDeleteEntryId(null);
    setIsBulkDeleting(false);
  };

  const handleStatusSelect = (entry, nextStatus) => {
    onFlipStatus?.(entry.id, entry.status, nextStatus);
  };

  const handleCopyDiscordBatch = async () => {
    if (selectedEntriesList.length === 0) return;
    const isFa = language === 'fa';
    const now = new Date();
    const dateStr = isFa
      ? formatShamsiDate(now, { month: 'long', day: 'numeric', year: 'numeric' })
      : now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

    const totalSumFormatted = formatMoney(bulkMetrics.totalSum, globalCurrency, false, isFa);

    const itemsText = selectedEntriesList.map((entry, idx) => {
      const entryCur = entry.currency && entry.currency !== 'DEFAULT' ? entry.currency : globalCurrency;
      const amountStr = formatMoney(entry.income || 0, entryCur, false, isFa);
      const orderIdPart = entry.orderId ? `#${entry.orderId} | ` : '';
      const st = STATUS_CONFIG[entry.status]?.label || entry.status || 'Paid';
      const sourcePart = entry.source ? ` [${entry.source}]` : '';

      if (isAdvertiser) {
        const clientPrice = entry.pot || entry.income || 0;
        const formattedClient = formatMoney(clientPrice, entryCur, false, isFa);
        const payout = Math.max(0, (entry.pot || 0) - (entry.income || 0));
        const payoutStr = payout > 0 ? ` (Payout: ${formatMoney(payout, entryCur, false, isFa)})` : '';
        return `${idx + 1}. ${orderIdPart}${entry.title || 'Order'}${sourcePart} | ${formattedClient} | ${st}${payoutStr}`;
      }

      const teamPart = entry.teammates && entry.teammates.length > 0 ? ` (@${entry.teammates.join(', @')})` : '';
      return `${idx + 1}. ${orderIdPart}${entry.title || 'Job'}${sourcePart} | ${amountStr} | ${st}${teamPart}`;
    }).join('\n');

    let md = '';
    if (isFa) {
      md = `\`\`\`ini
[ گزارش دسته‌ای چک‌پوینت - CHECKPOINT ]
تاریخ        = ${dateStr}
تعداد کارها   = ${selectedEntriesList.length}
مجموع کل     = ${totalSumFormatted}
----------------------------------------
${itemsText}
\`\`\``;
    } else {
      md = `\`\`\`ini
[ CHECKPOINT - BATCH SUMMARY ]
Date         = ${dateStr}
Jobs Count   = ${selectedEntriesList.length}
Total Sum    = ${totalSumFormatted}
----------------------------------------
${itemsText}
\`\`\``;
    }

    await copyTextNative(md);
    setIsDiscordBatchCopied(true);
    setTimeout(() => setIsDiscordBatchCopied(false), 2000);
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6 relative">
      {/* 1. Unified 2-Tier Cockpit Deck (Executive HUD + Integrated Control Tray) */}
      <div
        ref={cockpitHeroRef}
        className="sticky top-0 z-30 rounded-xl relative shadow-xs select-none"
      >
        {/* Full-Height Background & Border Frame Layer (Clips Progress Bar to Outer 12px Radius) */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white via-zinc-50/70 to-zinc-100/80 dark:from-zinc-900/90 dark:via-zinc-900/75 dark:to-zinc-950/90 border border-zinc-200/90 dark:border-zinc-800/90 backdrop-blur-md overflow-hidden pointer-events-none">
          {/* Hairline Progress Bar along the bottom of the card - cleanly follows card curvature */}
          <div
            role="progressbar"
            aria-label="Job settlement distribution"
            aria-valuenow={metrics.totalValue > 0 ? Math.round((metrics.totalPaid / metrics.totalValue) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-zinc-200/80 dark:bg-zinc-800/80 flex"
            title={`${t('status.Paid')}: ${metrics.totalValue > 0 ? Math.round((metrics.totalPaid / metrics.totalValue) * 100) : 0}% | ${t('status.Pending')}: ${metrics.totalValue > 0 ? Math.round((metrics.totalPending / metrics.totalValue) * 100) : 0}%${metrics.totalFailed > 0 ? ` | ${t('status.Failed')}: ${Math.round((metrics.totalFailed / metrics.totalValue) * 100)}%` : ''}`}
          >
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPaid / metrics.totalValue) * 100 : (metrics.paidCount > 0 ? 100 : 0)}%`,
              }}
            />
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPending / metrics.totalValue) * 100 : 0}%`,
              }}
            />
            {metrics.totalFailed > 0 && (
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{
                  width: `${metrics.totalValue > 0 ? (metrics.totalFailed / metrics.totalValue) * 100 : 0}%`,
                }}
              />
            )}
          </div>
        </div>

        {/* Content Container (relative z-10 so popovers/dropdowns are never clipped) */}
        <div className="relative z-10 flex flex-col">
          {/* Tier 1: Executive Action HUD */}
          <div
            className="h-16 sm:h-[68px] px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Left Section: Total Net Balance + Dropdown Currency Popover */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="flex flex-col justify-center min-w-0">
                <span
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0 leading-tight',
                    isRtl && 'font-farsi'
                  )}
                >
                  {isAdvertiser ? (language === 'fa' ? 'سود خالص کل' : 'Total Net Profit') : t('ledger.totalEarned')}
                </span>
                <div className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 shrink-0 text-xl sm:text-2xl tabular-nums font-mono leading-none">
                  <MoneyDisplay amount={metrics.totalPaid} currency={globalCurrency} iconSize="0.9em" />
                </div>
              </div>

              {/* Currency Dropdown (Click-to-Open only, no onWheel) */}
              <div className="relative shrink-0" ref={currencyDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCurrencyMenuOpen((prev) => !prev)}
                  title={language === 'fa' ? 'تغییر ارز نمایشی' : 'Display Currency'}
                  className={cn(
                    'h-7 px-2 rounded-lg border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none text-xs',
                    isCurrencyMenuOpen
                      ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 shadow-xs'
                      : 'bg-white/90 dark:bg-zinc-950/70 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs'
                  )}
                >
                  {globalCurrency === 'TOMAN' && (
                    <TomanIcon className="w-[26px] h-[26px] min-w-[26px] min-h-[26px] text-emerald-500 dark:text-emerald-400" />
                  )}
                  {globalCurrency === 'GOLD' && (
                    <span className="font-semibold text-[11px] tracking-wider text-amber-600 dark:text-amber-400 leading-none">
                      GOLD
                    </span>
                  )}
                  {globalCurrency === 'USD' && (
                    <span className="font-semibold font-mono text-[11px] text-zinc-900 dark:text-zinc-100 leading-none">
                      USD
                    </span>
                  )}
                  {globalCurrency === 'EUR' && (
                    <span className="font-semibold font-mono text-[11px] text-zinc-900 dark:text-zinc-100 leading-none">
                      EUR
                    </span>
                  )}
                  <ChevronDown className={cn("w-3 h-3 text-zinc-400 transition-transform duration-150", isCurrencyMenuOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isCurrencyMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -4 }}
                      transition={{ duration: 0.1, ease: [0.23, 1, 0.32, 1] }}
                      dir={isRtl ? 'rtl' : 'ltr'}
                      className={cn(
                        'absolute w-44 p-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl z-50 text-xs space-y-0.5',
                        currencyMenuPlacement.flipUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
                        currencyMenuPlacement.align === 'right'
                          ? (currencyMenuPlacement.flipUp ? 'right-0 origin-bottom-right' : 'right-0 origin-top-right')
                          : (currencyMenuPlacement.flipUp ? 'left-0 origin-bottom-left' : 'left-0 origin-top-left')
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onCurrencyChange?.('TOMAN');
                          setIsCurrencyMenuOpen(false);
                        }}
                        className={cn(
                          'w-full px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors text-xs select-none',
                          globalCurrency === 'TOMAN'
                            ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-medium'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <TomanIcon className="w-[26px] h-[26px] min-w-[26px] min-h-[26px] text-emerald-500 dark:text-emerald-400" />
                          <span className="font-farsi">تومان</span>
                        </div>
                        {globalCurrency === 'TOMAN' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onCurrencyChange?.('GOLD');
                          setIsCurrencyMenuOpen(false);
                        }}
                        className={cn(
                          'w-full px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors text-xs select-none',
                          globalCurrency === 'GOLD'
                            ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-medium'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[11px] text-amber-600 dark:text-amber-400 w-6 text-center">G</span>
                          <span>Gold</span>
                        </div>
                        {globalCurrency === 'GOLD' && <Check className="w-3.5 h-3.5 text-amber-500" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onCurrencyChange?.('USD');
                          setIsCurrencyMenuOpen(false);
                        }}
                        className={cn(
                          'w-full px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors text-xs select-none',
                          globalCurrency === 'USD'
                            ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-medium'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-xs w-6 text-center">$</span>
                          <span>USD</span>
                        </div>
                        {globalCurrency === 'USD' && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onCurrencyChange?.('EUR');
                          setIsCurrencyMenuOpen(false);
                        }}
                        className={cn(
                          'w-full px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors text-xs select-none',
                          globalCurrency === 'EUR'
                            ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-medium'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-xs w-6 text-center">€</span>
                          <span>EUR</span>
                        </div>
                        {globalCurrency === 'EUR' && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Section: 3 Interactive Filter Pills */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Pill 1: Jobs Done / Orders (Click to toggle Paid filter) */}
              <button
                type="button"
                onClick={() => handleStatusFilterToggle('Paid')}
                title={statusFilter === 'Paid' ? (language === 'fa' ? 'لغو فیلتر سفارشات تسویه‌شده' : 'Clear Paid jobs filter') : (language === 'fa' ? 'فیلتر سفارشات تسویه‌شده' : 'Filter by Paid jobs')}
                className={cn(
                  "flex flex-col justify-center px-2.5 sm:px-3 py-1 rounded-lg w-[96px] sm:w-[118px] h-[46px] sm:h-[50px] border transition-all text-start cursor-pointer select-none active:scale-[0.97]",
                  statusFilter === 'Paid'
                    ? "bg-zinc-200/90 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-xs ring-1 ring-zinc-300 dark:ring-zinc-700"
                    : "bg-white/90 dark:bg-zinc-950/60 hover:bg-white dark:hover:bg-zinc-950/90 border-zinc-200/80 dark:border-zinc-800/80 text-zinc-500 dark:text-zinc-400 shadow-2xs"
                )}
              >
                <span className={cn('text-[9px] sm:text-[10px] uppercase font-medium truncate', isRtl && 'font-farsi')}>
                  {isAdvertiser ? (language === 'fa' ? 'سفارشات' : 'Orders') : t('ledger.jobsDone')}
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums text-xs sm:text-sm truncate">
                  {formatNumber(metrics.paidCount)}
                  <span className="text-zinc-400 font-normal text-[11px] sm:text-xs">/{formatNumber(baseFilteredEntries.length)}</span>
                </span>
              </button>

              {/* Pill 2: Pending Settlement (Click to toggle Pending filter) */}
              <button
                type="button"
                onClick={() => handleStatusFilterToggle('Pending')}
                title={statusFilter === 'Pending' ? (language === 'fa' ? 'لغو فیلتر سفارشات در انتظار' : 'Clear Pending jobs filter') : (language === 'fa' ? 'فیلتر سفارشات در انتظار' : 'Filter by Pending jobs')}
                className={cn(
                  "flex flex-col justify-center px-2.5 sm:px-3 py-1 rounded-lg w-[96px] sm:w-[118px] h-[46px] sm:h-[50px] border transition-all text-start cursor-pointer select-none active:scale-[0.97]",
                  statusFilter === 'Pending'
                    ? "bg-zinc-200/90 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-xs ring-1 ring-zinc-300 dark:ring-zinc-700"
                    : "bg-white/90 dark:bg-zinc-950/60 hover:bg-white dark:hover:bg-zinc-950/90 border-zinc-200/80 dark:border-zinc-800/80 text-zinc-500 dark:text-zinc-400 shadow-2xs"
                )}
              >
                <span className={cn('text-[9px] sm:text-[10px] uppercase font-medium truncate', isRtl && 'font-farsi')}>
                  {isAdvertiser ? (language === 'fa' ? 'در انتظار' : 'Pending') : t('ledger.pendingPayout')}
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums text-xs sm:text-sm truncate">
                  <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} compact={true} iconSize={26} />
                </span>
              </button>

              {/* Pill 3: Average Rate / Booster Cuts */}
              <div
                className="hidden sm:flex flex-col justify-center px-2.5 sm:px-3 py-1 rounded-lg w-[96px] sm:w-[118px] h-[46px] sm:h-[50px] border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 text-start select-none shadow-2xs"
              >
                <span className={cn('text-[9px] sm:text-[10px] uppercase font-medium truncate', isRtl && 'font-farsi')}>
                  {isAdvertiser ? (language === 'fa' ? 'سهم بوسترها' : 'Booster Payouts') : t('ledger.averageRate')}
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums text-xs sm:text-sm truncate">
                  {isAdvertiser ? (
                    <MoneyDisplay amount={metrics.boosterPayouts} currency={globalCurrency} compact={true} iconSize={26} />
                  ) : (
                    <MoneyDisplay amount={metrics.avgRate} currency={globalCurrency} compact={true} iconSize={26} />
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Hairline Divider between Tier 1 & Tier 2 */}
          <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70 mx-3 sm:mx-5" />

          {/* Tier 2: Integrated Control Tray (Game Categories, Quick Date Range, Discord Export, Deep Filter Trigger) */}
          <div
            className="px-3 sm:px-5 pt-2.5 pb-3.5 sm:pt-2.5 sm:pb-3.5 flex items-center justify-between gap-2 relative z-20"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Game Categories Controls */}
            {gameCategories.length > 0 ? (
              <div ref={gameCategoryMenuRef} className="relative flex items-center gap-1.5 shrink-0 z-30">
                {/* 1. "All" Filter Button */}
                <button
                  type="button"
                  onClick={() => setGameFilter('')}
                  className={cn(
                    'h-6 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all shrink-0 border active:scale-[0.98]',
                    gameFilter === ''
                      ? 'bg-zinc-200 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 shadow-xs'
                      : 'bg-white/80 dark:bg-zinc-900/60 text-zinc-500 hover:text-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 shadow-2xs'
                  )}
                >
                  <span className={cn(isRtl && 'font-farsi')}>{t('ledger.allGames', 'All')}</span>
                  <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 tabular-nums">
                    {formatNumber(entries.length)}
                  </span>
                </button>

                {/* 2. Top Icon-Only Category Buttons (Up to 3) */}
                {visibleGames.map((cat) => {
                  const isSelected = gameFilter === cat.id;
                  const catMeta = cat.id ? getCategoryByName(cat.id, categories) : null;
                  const accentColor = catMeta?.color;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setGameFilter(isSelected ? '' : cat.id)}
                      title={`${cat.label} (${formatNumber(cat.count)} ${language === 'fa' ? 'سفارش' : 'jobs'})`}
                      aria-label={cat.label}
                      style={
                        isSelected && accentColor
                          ? {
                              borderColor: `${accentColor}80`,
                              boxShadow: `0 0 8px ${accentColor}25`,
                            }
                          : undefined
                      }
                      className={cn(
                        'h-6 w-7 rounded-md text-[11px] font-medium flex items-center justify-center transition-all shrink-0 border active:scale-[0.98] relative',
                        isSelected
                          ? 'bg-zinc-200 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 shadow-xs'
                          : 'bg-white/80 dark:bg-zinc-900/60 text-zinc-500 hover:text-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 shadow-2xs'
                      )}
                    >
                      <GameIcon game={cat.id} categories={categories} className="w-3.5 h-3.5 object-contain shrink-0" />
                      {accentColor && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-white dark:ring-zinc-950 pointer-events-none"
                          style={{ backgroundColor: accentColor }}
                        />
                      )}
                    </button>
                  );
                })}

                {/* 3. Overflow Toggle Button (+N Games) */}
                {overflowGames.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsGameCategoryMenuOpen((prev) => !prev)}
                      title={language === 'fa' ? `سایر دسته‌بندی‌ها (${overflowGames.length})` : `More games (${overflowGames.length})`}
                      aria-label="More games"
                      aria-expanded={isGameCategoryMenuOpen}
                      className={cn(
                        'h-6 px-1.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition-all shrink-0 border active:scale-[0.98]',
                        isGameCategoryMenuOpen
                          ? 'bg-zinc-200 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 shadow-xs'
                          : 'bg-white/80 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 shadow-2xs'
                      )}
                    >
                      <span className="font-mono text-[10px] font-medium leading-none">+{overflowGames.length}</span>
                      <ChevronDown
                        className={cn('w-2.5 h-2.5 text-zinc-400 transition-transform duration-150', isGameCategoryMenuOpen && 'rotate-180')}
                      />
                    </button>

                    {/* Overflow Dropdown Popover */}
                    <AnimatePresence>
                      {isGameCategoryMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96, y: -4 }}
                          transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                          dir={isRtl ? 'rtl' : 'ltr'}
                          className={cn(
                            'absolute top-full mt-2 w-64 p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 text-xs space-y-1',
                            isRtl ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
                          )}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-100 dark:border-zinc-800/80 mb-1">
                            <div className="flex items-center gap-1.5">
                              <Gamepad2 className="w-3.5 h-3.5 text-zinc-400" />
                              <span className={cn('font-semibold text-zinc-800 dark:text-zinc-200 text-xs', isRtl && 'font-farsi')}>
                                {t('categories.title', 'Game Categories')}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400">
                              {formatNumber(gameCategories.length - 1)} {language === 'fa' ? 'بازی' : 'games'}
                            </span>
                          </div>

                          {/* Quick Filter Search if > 5 categories */}
                          {gameCategories.length - 1 > 5 && (
                            <div className="mb-1">
                              <div className="flex items-center gap-1.5 px-2 h-6.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                                <Search className="w-3 h-3 text-zinc-400 shrink-0" />
                                <input
                                  type="text"
                                  value={gameSearchQuery}
                                  onChange={(e) => setGameSearchQuery(e.target.value)}
                                  placeholder={t('common.search', 'Filter games...')}
                                  className="w-full bg-transparent border-0 outline-none p-0 text-[11px] text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 min-w-0"
                                />
                                {gameSearchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setGameSearchQuery('')}
                                    className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* All Games Option */}
                          <button
                            type="button"
                            onClick={() => {
                              setGameFilter('');
                              setIsGameCategoryMenuOpen(false);
                              setGameSearchQuery('');
                            }}
                            className={cn(
                              'w-full px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors',
                              gameFilter === ''
                                ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-medium'
                                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
                              <span className={cn('truncate', isRtl && 'font-farsi')}>{t('ledger.allGames', 'All Games')}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-mono text-zinc-400">{formatNumber(entries.length)}</span>
                              {gameFilter === '' && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />}
                            </div>
                          </button>

                          {/* Filtered Games List */}
                          <div className="max-h-56 overflow-y-auto no-scrollbar space-y-0.5 pt-0.5">
                            {filteredSpecificGames.map((cat) => {
                              const isSelected = gameFilter === cat.id;
                              const catMeta = cat.id ? getCategoryByName(cat.id, categories) : null;
                              const accentColor = catMeta?.color;

                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => {
                                    setGameFilter(isSelected ? '' : cat.id);
                                    setIsGameCategoryMenuOpen(false);
                                    setGameSearchQuery('');
                                  }}
                                  className={cn(
                                    'w-full px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors text-start',
                                    isSelected
                                      ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-medium'
                                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200'
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {accentColor ? (
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: accentColor }}
                                      />
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700 shrink-0" />
                                    )}
                                    <GameIcon game={cat.id} categories={categories} className="w-3.5 h-3.5 object-contain shrink-0" />
                                    <span className={cn('truncate', isRtl && 'font-farsi')}>{cat.label}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-mono text-zinc-400">{formatNumber(cat.count)}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            ) : <div />}

            {/* Date Range Presets, Discord Export & Filters Popover */}
            <div className="flex items-center gap-1 shrink-0 ms-auto">
              {/* Quick Date Range Segmented Control */}
              <div className="flex items-center gap-0.5 bg-zinc-200/60 dark:bg-zinc-950/60 p-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 text-[10px]">
                {[
                  { id: '', label: t('ledger.dateRangeAll', 'All') },
                  { id: 'today', label: t('ledger.dateRangeToday', 'Today') },
                  { id: 'yesterday', label: t('ledger.dateRangeYesterday', 'Yesterday') },
                  { id: 'week', label: t('ledger.dateRangeThisWeek', 'Week') },
                  { id: 'month', label: t('ledger.dateRangeThisMonth', 'Month') },
                  { id: 'last_month', label: t('ledger.dateRangeLastMonth', 'Last Month') },
                ].map((preset) => {
                  const isCurrent = dateRangeFilter === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDateRangeFilter(preset.id)}
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                        isCurrent
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      )}
                    >
                      <span className={cn(isRtl && 'font-farsi')}>{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Discord Batch Export button if items selected */}
              {selectedEntriesList.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyDiscordBatch}
                  title="Copy Discord Batch Summary"
                  className={cn(
                    'h-6 px-2 rounded-md text-[10px] font-medium flex items-center gap-1 border transition-colors',
                    isDiscordBatchCopied
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-white/80 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs'
                  )}
                >
                  <DiscordIcon className="w-3 h-3" />
                  <span>{isDiscordBatchCopied ? (language === 'fa' ? 'کپی شد' : 'Copied!') : 'Discord'}</span>
                </button>
              )}

              {/* Active Filter Clear Chip */}
              {filteredEntries.length !== entries.length && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  title={t('ledger.clearFilters')}
                  className="flex items-center gap-1 text-[10px] h-6 px-2 rounded-md bg-white/80 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 transition-colors shrink-0 shadow-2xs"
                >
                  <span className={cn(isRtl && 'font-farsi')}>{t('ledger.filtered')} ({formatNumber(filteredEntries.length)}/{formatNumber(entries.length)})</span>
                  <X className="w-2.5 h-2.5 text-zinc-500" />
                </button>
              )}

              {/* Deep Filters Popover Trigger */}
              <div className="relative z-50" ref={filtersPopoverRef}>
                <button
                  type="button"
                  onClick={() => setIsFiltersPopoverOpen((prev) => !prev)}
                  title={t('ledger.filters')}
                  aria-expanded={isFiltersPopoverOpen}
                  aria-haspopup="dialog"
                  className={cn(
                    'h-6 px-1.5 rounded-md flex items-center gap-1 text-[10px] font-medium transition-all active:scale-95 border cursor-pointer select-none',
                    isFiltersPopoverOpen || activeSecondaryFiltersCount > 0
                      ? 'bg-zinc-200 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 shadow-xs'
                      : 'bg-white/80 dark:bg-zinc-900/60 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs'
                  )}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  {activeSecondaryFiltersCount > 0 && (
                    <span className="w-3.5 h-3.5 rounded-full bg-zinc-900 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900 text-[9px] font-medium flex items-center justify-center leading-none">
                      {activeSecondaryFiltersCount}
                    </span>
                  )}
                </button>

                {/* Hidden fallback search input for ref preservation */}
                <input ref={searchInputRef} type="text" className="sr-only" tabIndex={-1} aria-hidden="true" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />

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
                        'absolute top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-24px)] p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 space-y-3 text-xs',
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
                              setSettlementFilter('');
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
                            <span className="text-[10px] text-zinc-500">{formatNumber(entries.length)}</span>
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
                                  <span className={cn('text-[10px]', isCurrent ? 'text-zinc-900 dark:text-zinc-300' : 'text-zinc-500')}>
                                    {formatNumber(count)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 1.5. Source & Booster Settlement Filter (Advertiser Mode) */}
                      {isAdvertiser && (
                        <div className="space-y-1.5">
                          <label className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 block', isRtl && 'font-farsi')}>
                            {language === 'fa' ? 'فیلتر وضعیت تسویه' : 'Settlement Status'}
                          </label>
                          <div className="grid grid-cols-2 gap-1 bg-zinc-100 dark:bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <button
                              type="button"
                              onClick={() => setSettlementFilter('')}
                              className={cn(
                                'py-1 px-1.5 rounded text-[11px] font-medium transition-colors text-center active:scale-95 col-span-2',
                                settlementFilter === ''
                                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-xs border border-zinc-200/80 dark:border-transparent'
                                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                              )}
                            >
                              {t('status.all')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSettlementFilter('pending')}
                              className={cn(
                                'py-1 px-1.5 rounded text-[10px] font-medium transition-colors text-center active:scale-95 flex items-center justify-center gap-1',
                                settlementFilter === 'pending'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 shadow-xs'
                                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                              )}
                            >
                              <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="truncate">{language === 'fa' ? 'طلب از سورس' : 'Source Payout'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSettlementFilter('booster_due')}
                              className={cn(
                                'py-1 px-1.5 rounded text-[10px] font-medium transition-colors text-center active:scale-95 flex items-center justify-center gap-1',
                                settlementFilter === 'booster_due'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60 shadow-xs'
                                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                              )}
                            >
                              <Clock className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 shrink-0" />
                              <span className="truncate">{language === 'fa' ? 'تسویه بوستر' : 'Booster Payout'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSettlementFilter('received')}
                              className={cn(
                                'py-1 px-1.5 rounded text-[10px] font-medium transition-colors text-center active:scale-95 flex items-center justify-center gap-1',
                                settlementFilter === 'received'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs'
                                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                              )}
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">{language === 'fa' ? 'تسویه سورس' : 'Source Paid'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSettlementFilter('booster_paid')}
                              className={cn(
                                'py-1 px-1.5 rounded text-[10px] font-medium transition-colors text-center active:scale-95 flex items-center justify-center gap-1',
                                settlementFilter === 'booster_paid'
                              ? 'bg-blue-50 text-blue-800 border border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60 shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                              )}
                            >
                              <Check className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span className="truncate">{language === 'fa' ? 'تسویه بوستر' : 'Booster Paid'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. Currency Filter */}
                      <div className="space-y-1.5">
                        <label className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 block', isRtl && 'font-farsi')}>
                          {t('ledger.filterCurrency', 'Currency')}
                        </label>
                        <div className="grid grid-cols-5 gap-1 bg-zinc-100 dark:bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
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
                            <TomanIcon className="w-[24px] h-[24px] min-w-[24px] min-h-[24px] text-zinc-500 dark:text-zinc-400" />
                            <span className="font-farsi">تومان</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrencyFilter('USD')}
                            className={cn(
                              'py-1 rounded text-[11px] font-medium transition-colors text-center flex items-center justify-center gap-1 active:scale-95',
                              currencyFilter === 'USD'
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-xs border border-zinc-200/80 dark:border-transparent'
                                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            )}
                          >
                            <span className="font-mono">USD</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrencyFilter('EUR')}
                            className={cn(
                              'py-1 rounded text-[11px] font-medium transition-colors text-center flex items-center justify-center gap-1 active:scale-95',
                              currencyFilter === 'EUR'
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-xs border border-zinc-200/80 dark:border-transparent'
                                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            )}
                          >
                            <span className="font-mono">EUR</span>
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
        </div>
      </div>

      {/* 4. Grouped Job Feed */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800/80 p-12 text-center space-y-3">
          <p className={cn('text-xs text-zinc-500', isRtl && 'font-farsi')}>
            {searchQuery || statusFilter || currencyFilter || gameFilter || hasProofFilter || teammateFilter || sourceFilter || settlementFilter
              ? t('ledger.noJobsMatch')
              : t('ledger.emptyDesc')}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button variant="primary" size="sm" onClick={() => onOpenWorkModal?.()} className={cn(isRtl && 'font-farsi')}>
              <Plus className="w-3.5 h-3.5" />
              <span>{t('nav.addWork')}</span>
            </Button>
            {Boolean(searchQuery || statusFilter || currencyFilter || gameFilter || hasProofFilter || teammateFilter || sourceFilter || settlementFilter) && (
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
              <div key={groupTitle} className="space-y-2 group/day-section relative">
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
                      !isDaySelected && 'opacity-0 group-hover/day-section:opacity-100 transition-opacity duration-150',
                      isDaySelected
                        ? 'bg-zinc-900 text-zinc-100 font-medium border-zinc-900 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700/80 shadow-sm'
                        : 'bg-white hover:bg-zinc-100/80 text-zinc-600 hover:text-zinc-900 border-zinc-200 hover:border-zinc-300 dark:bg-transparent dark:border-zinc-800/60 dark:text-zinc-500 dark:hover:border-zinc-700/70 dark:hover:text-zinc-400'
                    )}
                  >
                    <span
                      className={cn(
                        'text-[9px] uppercase font-medium inline-flex items-center',
                        isDaySelected
                          ? 'text-zinc-300 dark:text-zinc-400'
                          : 'text-zinc-500 dark:text-zinc-600',
                        isRtl && 'font-farsi'
                      )}
                    >
                      {isAdvertiser ? (language === 'fa' ? 'سود روز:' : 'Day Profit:') : `${t('ledger.dayTotal')}:`}
                    </span>
                    <strong
                      className={cn(
                        'inline-flex items-center',
                        isDaySelected
                          ? 'text-zinc-100 dark:text-zinc-200 font-medium'
                          : 'text-zinc-800 dark:text-zinc-400 font-normal'
                      )}
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
                  {groupItems.map((entry) => (
                    <LedgerRow
                      key={entry.id}
                      entry={entry}
                      isConfirmDeleting={confirmDeleteEntryId === entry.id}
                      isSelected={selectedEntryIds.has(entry.id)}
                      isSelectMode={isSelectMode}
                      contextMenuTargetId={contextMenuTargetId}
                      categories={categories}
                      globalCurrency={globalCurrency}
                      rates={rates}
                      sourceFilter={sourceFilter}
                      teammateFilter={teammateFilter}
                      language={language}
                      isRtl={isRtl}
                      t={t}
                      formatRowTime={formatRowTime}
                      onOpenWorkModal={onOpenWorkModal}
                      onOpenReceipt={onOpenReceipt}
                      onOpenLightbox={onOpenLightbox}
                      handleToggleEntrySelection={handleToggleEntrySelection}
                      onDeleteEntry={onDeleteEntry}
                      setConfirmDeleteEntryId={setConfirmDeleteEntryId}
                      setSelectedEntryIds={setSelectedEntryIds}
                      setSourceFilter={setSourceFilter}
                      setTeammateFilter={setTeammateFilter}
                      handleOpenExternalLink={handleOpenExternalLink}
                      handleStatusSelect={handleStatusSelect}
                      onOpenEntryContextMenu={onOpenEntryContextMenu}
                      activeProfileId={activeProfileId}
                      onUpdateSourcePaid={onUpdateSourcePaid}
                      onUpdateBoosterPaid={onUpdateBoosterPaid}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* 5. Numbered Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
              <span className={cn('text-zinc-500 text-[11px]', isRtl && 'font-farsi')}>
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
                        <span key={pageNum} className="px-1 text-zinc-400 dark:text-zinc-600">
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
                      className={cn(`h-8 w-8 rounded-md text-xs font-medium transition-colors border ${
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

      {/* 6. Multi-Day Income Calculator Floating Bottom Bar (Rendered into document.body to avoid parent scroll clipping) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedDaysSummary && selectedDaysSummary.daysCount > 0 && selectedEntryIds.size === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 28, x: '-50%', scale: 0.96 }}
              animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
              exit={{ opacity: 0, y: 28, x: '-50%', scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              dir={isRtl ? 'rtl' : 'ltr'}
              className={cn(
                'fixed bottom-20 md:bottom-8 left-1/2 z-[95] bg-white/95 dark:bg-zinc-950/90 backdrop-blur-2xl border border-zinc-200 dark:border-zinc-800/90 shadow-2xl ring-1 ring-zinc-200/80 dark:ring-zinc-800/50 rounded-2xl px-5 sm:px-6 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4 max-w-[calc(100vw-2rem)] max-w-4xl justify-between',
                isRtl && 'font-farsi'
              )}
            >
              <div className="flex items-center gap-3 min-w-0 shrink-0">
                <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-900/90 dark:text-zinc-200 dark:border-zinc-700/80 shrink-0', isRtl && 'font-farsi')}>
                  {formatNumber(selectedDaysSummary.daysCount)} {selectedDaysSummary.daysCount === 1 ? t('ledger.day') : t('ledger.days')}
                </span>

                <div className="flex items-center gap-2 min-w-0 shrink-0">
                  <span className={cn('text-zinc-500 dark:text-zinc-400 text-xs hidden sm:inline', isRtl && 'font-farsi')}>{t('ledger.sum')}:</span>
                  <strong className="text-zinc-900 dark:text-zinc-200 font-medium text-base sm:text-lg tracking-tight shrink-0 inline-flex items-center">
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
        </AnimatePresence>,
        document.body
      )}

      {/* 7. Comprehensive Floating Bulk Actions Bar (Rendered into document.body to avoid parent scroll clipping) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedEntryIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 28, x: '-50%', scale: 0.96 }}
              animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
              exit={{ opacity: 0, y: 28, x: '-50%', scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              dir={isRtl ? 'rtl' : 'ltr'}
              className={cn(
                'fixed bottom-20 md:bottom-8 left-1/2 z-[100] bg-white/95 dark:bg-zinc-950/95 text-zinc-900 dark:text-zinc-100 backdrop-blur-2xl border border-zinc-200 dark:border-zinc-800/90 shadow-2xl ring-1 ring-zinc-200/80 dark:ring-zinc-800/50 rounded-2xl px-5 sm:px-6 py-2 sm:py-2.5 flex items-center gap-3 sm:gap-4 max-w-[calc(100vw-2rem)] max-w-4xl justify-between',
                isRtl && 'font-farsi'
              )}
            >
              {/* Left: Count Badge & Live Converted Total Income Sum */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
                <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700/80 shrink-0', isRtl && 'font-farsi')}>
                  {formatNumber(selectedEntryIds.size)} <span className="hidden xs:inline">{t('ledger.selected')}</span>
                </span>

                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
                  <span className={cn('text-zinc-500 dark:text-zinc-400 text-xs', isRtl && 'font-farsi')}>{t('ledger.sum')}:</span>
                  <strong className="text-zinc-900 dark:text-zinc-200 font-medium text-xs sm:text-sm tracking-tight shrink-0 inline-flex items-center">
                    <MoneyDisplay amount={bulkMetrics.totalSum} currency={globalCurrency} />
                  </strong>
                  {globalCurrency !== 'GOLD' ? (
                    <span dir="ltr" className="text-[10px] sm:text-[11px] text-amber-500 dark:text-amber-400/80 shrink-0 select-none">
                      (~{Math.round(bulkMetrics.totalSum / (goldRateTOMAN / 1000)).toLocaleString()} G)
                    </span>
                  ) : (
                    <span dir={isRtl ? 'rtl' : 'ltr'} className={cn('text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 select-none', isRtl && 'font-farsi')}>
                      (~{formatMoney(Math.round(bulkMetrics.totalSum * (goldRateTOMAN / 1000)), 'TOMAN')})
                    </span>
                  )}
                </div>
              </div>

              {/* Middle: Mixed Status Breakdown Pill (XL Screens Only) */}
              <div className={cn('hidden xl:flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 shrink-0', isRtl && 'font-farsi')}>
                {bulkMetrics.paid > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatNumber(bulkMetrics.paid)} {t('status.Paid')}</span>}
                {bulkMetrics.paid > 0 && (bulkMetrics.pending > 0 || bulkMetrics.working > 0 || bulkMetrics.onHold > 0 || bulkMetrics.failed > 0) && <span className="text-zinc-400 dark:text-zinc-600">•</span>}
                {bulkMetrics.pending > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{formatNumber(bulkMetrics.pending)} {t('status.Pending')}</span>}
                {bulkMetrics.pending > 0 && (bulkMetrics.working > 0 || bulkMetrics.onHold > 0 || bulkMetrics.failed > 0) && <span className="text-zinc-400 dark:text-zinc-600">•</span>}
                {bulkMetrics.working > 0 && <span className="text-cyan-600 dark:text-cyan-400 font-medium">{formatNumber(bulkMetrics.working)} {t('status.Working')}</span>}
                {bulkMetrics.working > 0 && (bulkMetrics.onHold > 0 || bulkMetrics.failed > 0) && <span className="text-zinc-400 dark:text-zinc-600">•</span>}
                {bulkMetrics.onHold > 0 && <span className="text-zinc-500 font-medium">{formatNumber(bulkMetrics.onHold)} {t('status.On Hold')}</span>}
                {bulkMetrics.onHold > 0 && bulkMetrics.failed > 0 && <span className="text-zinc-400 dark:text-zinc-600">•</span>}
                {bulkMetrics.failed > 0 && <span className="text-rose-600 dark:text-rose-400 font-medium">{formatNumber(bulkMetrics.failed)} {t('status.Failed')}</span>}
              </div>

              {/* Right: Actions with Standalone Clean Vertical Divider */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Standalone Vertical Divider with Safe Margins */}
                <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800/90 shrink-0" />

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
                      className={cn('h-7 px-2 text-[11px] gap-1.5 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 border-zinc-200 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 dark:border-zinc-800/80 border shadow-sm shrink-0 flex items-center', isRtl && 'font-farsi')}
                    >
                      <div className="flex items-center -space-x-1 shrink-0 rtl:space-x-reverse" aria-hidden="true">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-zinc-950" />
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 ring-1 ring-white dark:ring-zinc-950" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-white dark:ring-zinc-950" />
                      </div>
                      <span>{t('ledger.bulkStatus')}</span>
                      <ChevronDown className={cn('w-3 h-3 text-zinc-400 shrink-0 transition-transform duration-150', isStatusDropdownOpen && 'rotate-180 text-zinc-600 dark:text-zinc-200')} />
                    </Button>

                    {isStatusDropdownOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        dir={isRtl ? 'rtl' : 'ltr'}
                        className={cn(
                          'absolute bottom-full mb-1.5 w-36 bg-white/95 dark:bg-zinc-950/95 text-zinc-800 dark:text-zinc-200 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg p-1 space-y-0.5 z-[110] text-xs animate-in fade-in zoom-in-95 duration-100',
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
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 text-start transition-colors"
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
                    className={cn('h-7 px-2 text-[11px] gap-1 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 border-zinc-200 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 dark:border-zinc-800/80 border shadow-sm flex items-center shrink-0', isRtl && 'font-farsi')}
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>{t('ledger.bulkCsv')}</span>
                  </Button>

                  {/* 2.5. Bulk Discord Markdown Export Button */}
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleCopyDiscordBatch}
                    title={t('ledger.bulkDiscordTooltip', 'Copy selected jobs as Discord Markdown')}
                    className={cn('h-7 px-2 text-[11px] gap-1 border shadow-sm flex items-center shrink-0 transition-colors', isDiscordBatchCopied ? 'text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80' : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 border-zinc-200 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 dark:border-zinc-800/80', isRtl && 'font-farsi')}
                  >
                    {isDiscordBatchCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{t('ledger.copied')}</span>
                      </>
                    ) : (
                      <>
                        <DiscordIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>{t('ledger.bulkDiscord', 'Discord')}</span>
                      </>
                    )}
                  </Button>

                  {/* 3. In-Line Morphing Delete (N) Confirmation */}
                  {!isBulkDeleting ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setIsBulkDeleting(true)}
                      title={`${t('ledger.bulkDelete')} (${formatNumber(selectedEntryIds.size)})`}
                      className={cn('h-7 px-2 text-[11px] gap-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/60 transition-colors shrink-0', isRtl && 'font-farsi')}
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('ledger.bulkDelete')}</span>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1 p-0.5 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:border-rose-900/90 border rounded-md animate-in fade-in zoom-in-95 duration-150 h-7 shrink-0">
                      <span className={cn('text-[10px] font-medium text-rose-700 dark:text-rose-300 px-1 whitespace-nowrap', isRtl && 'font-farsi')}>
                        {t('ledger.delete')} {formatNumber(selectedEntryIds.size)}?
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsBulkDeleting(false)}
                        className={cn('h-5 px-1.5 rounded text-[10px] text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60 flex items-center', isRtl && 'font-farsi')}
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
                        className={cn('h-5 px-1.5 rounded text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-sm flex items-center', isRtl && 'font-farsi')}
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
                    className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 rounded-md shrink-0 flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export default LedgerView;
