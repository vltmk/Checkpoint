import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { StatusBadge } from '../ui/Badge';
import { GameIcon } from '../ui/GameIcon';
import { MoneyDisplay, ConvertedSecondaryDisplay } from '../ui/MoneyDisplay';
import { Tooltip, Kbd } from '../ui/Tooltip';
import { CockpitFluid } from '../ui/fluid/CockpitFluid';
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
        <span className="inline-flex items-center gap-1 flex-wrap truncate max-w-[280px]">
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
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50'
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
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
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
    <span className="truncate max-w-[180px] text-zinc-500 italic leading-normal">
      "{text}"
    </span>
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
}) {
  const [isCopiedOrderId, setIsCopiedOrderId] = useState(false);
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
              'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3 rounded-xl transition-[background-color,border-color,box-shadow] duration-150 cursor-pointer border',
              contextMenuTargetId === entry.id
                ? 'bg-zinc-100/90 dark:bg-zinc-900/40 border-zinc-400 dark:border-zinc-500 ring-1 ring-zinc-400/80 dark:ring-zinc-400/80 shadow-md shadow-zinc-950/5 dark:shadow-lg dark:shadow-black/30'
                : isSelected
                ? 'bg-zinc-100/90 dark:bg-zinc-900/30 border-zinc-300 dark:border-zinc-600/50 shadow-xs'
                : 'bg-transparent hover:bg-zinc-100/40 dark:hover:bg-zinc-900/20 border-zinc-200/50 dark:border-zinc-800/40 hover:border-zinc-300/60 dark:hover:border-zinc-700/50'
            )}
          >
            {/* Subtle 135° category accent gradient border */}
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
                className="absolute -top-12 -left-12 w-28 h-28 rounded-full blur-xl pointer-events-none"
                style={{ backgroundColor: `${accentColor}10` }}
              />
            </div>

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

            {/* Left: Game Emblem & Details */}
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 relative">
                {isAdvertiser ? (
                  <>
                    {/* Normal GameIcon (with subtle emerald checkmark badge if already paid) */}
                    <div className={cn(
                      'w-full h-full flex items-center justify-center transition-opacity duration-150',
                      'group-hover:opacity-0 group-hover:pointer-events-none'
                    )}>
                      <div className="relative flex items-center justify-center">
                        <GameIcon
                          game={entry.game}
                          categories={categories}
                          className="w-6.5 h-6.5 sm:w-7 sm:h-7 object-contain opacity-85"
                        />
                        {entry.sourcePaid && (
                          <span
                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-1.5 ring-white dark:ring-zinc-950 shadow-xs"
                            title={language === 'fa' ? 'تسویه شده' : 'Paid'}
                          >
                            <Check className="w-2 h-2 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Check icon (CheckCircle2) replacing GameIcon upon row hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <Tooltip
                        content={
                          entry.sourcePaid
                            ? (language === 'fa' ? 'وجه دریافت شد (کلیک برای تغییر به در انتظار)' : 'Payment received (Click to mark pending)')
                            : (language === 'fa' ? 'در انتظار دریافت وجه (کلیک برای تایید دریافت)' : 'Awaiting payment (Click to mark received)')
                        }
                        side="top"
                      >
                        <button
                          type="button"
                          data-no-row-click="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateSourcePaid?.(entry.id, !entry.sourcePaid);
                          }}
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer border',
                            entry.sourcePaid
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 shadow-xs'
                              : 'bg-zinc-100/90 hover:bg-zinc-200/90 text-zinc-400 hover:text-zinc-700 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 dark:border-zinc-800 shadow-xs'
                          )}
                          aria-label={entry.sourcePaid ? 'Mark pending' : 'Mark received'}
                        >
                          <CheckCircle2
                            className={cn(
                              'w-4 h-4 transition-colors',
                              entry.sourcePaid
                                ? 'text-emerald-600 dark:text-emerald-400 fill-emerald-500/20'
                                : 'text-zinc-400 hover:text-emerald-500 dark:text-zinc-500 dark:hover:text-emerald-400'
                            )}
                          />
                        </button>
                      </Tooltip>
                    </div>
                  </>
                ) : (
                  <GameIcon
                    game={entry.game}
                    categories={categories}
                    className="w-6.5 h-6.5 sm:w-7 sm:h-7 object-contain opacity-85 hover:opacity-100 transition-opacity"
                  />
                )}
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
                            : 'bg-zinc-100/80 hover:bg-zinc-200/80 border-zinc-200 hover:border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:bg-transparent dark:hover:bg-zinc-900 dark:border-zinc-800/80 dark:text-zinc-400 dark:hover:text-zinc-300'
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

                {/* Line 2: Game & Notes */}
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 truncate leading-normal">
                  <span>{entry.game}</span>
                  {entry.notes && (
                    <>
                      <span>•</span>
                      <FormattedInlineNotes text={entry.notes} />
                    </>
                  )}
                </div>

                {/* Line 3: Interactive Teammate Badges & Team Pot (or Assigned Boosters & Payouts in Advertiser Mode) */}
                {isAdvertiser ? (
                  ((entry.pot && entry.pot > entry.income) || (entry.teammates && entry.teammates.length > 0)) && (
                    <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[10px]">
                      {entry.pot && entry.pot > entry.income && (
                        <span className="text-zinc-500 flex items-center gap-1">
                          <span>{language === 'fa' ? 'قیمت مشتری:' : 'Client:'}</span>
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
                  )
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
            <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0">
              <div className="text-left sm:text-right">
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
                  'text-xs font-medium inline-flex items-center justify-start sm:justify-end',
                  entry.status === 'Failed'
                    ? 'text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-400 dark:decoration-zinc-600'
                    : entry.income < 0
                    ? 'text-rose-600 dark:text-rose-400 font-semibold'
                    : isAdvertiser
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-zinc-800 dark:text-zinc-200'
                )}>
                  <MoneyDisplay amount={entry.income} currency={entry.currency} />
                </div>
                {entry.currency !== globalCurrency && (
                  <div className={cn(
                    entry.status === 'Failed' && 'opacity-60 line-through decoration-zinc-400 dark:decoration-zinc-600',
                    entry.income < 0 && 'text-rose-600/80 dark:text-rose-400/80',
                    isAdvertiser && 'text-emerald-600/80 dark:text-emerald-400/80'
                  )}>
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
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{entry.link}</div>
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
    </div>
  );
});

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
  cockpitFluidEnabled = true,
  activeProfileId = 'booster',
  onUpdateSourcePaid,
}) {
  const { t, language, isRtl, formatNumber, formatDate } = useLanguage();
  const isAdvertiser = activeProfileId === 'advertiser';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [hasProofFilter, setHasProofFilter] = useState(false);
  const [teammateFilter, setTeammateFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('');
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

  // Reset page & selections when filter criteria changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedDayKeys(new Set());
    setSelectedEntryIds(new Set());
    setConfirmDeleteEntryId(null);
    setIsBulkDeleting(false);
    setIsStatusDropdownOpen(false);
  }, [searchQuery, statusFilter, currencyFilter, gameFilter, hasProofFilter, teammateFilter, sourceFilter, settlementFilter, sortOption]);

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

    if (isAdvertiser && settlementFilter) {
      if (settlementFilter === 'received') {
        list = list.filter((e) => Boolean(e.sourcePaid));
      } else if (settlementFilter === 'pending') {
        list = list.filter((e) => !e.sourcePaid);
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
  }, [entries, searchQuery, statusFilter, currencyFilter, gameFilter, hasProofFilter, teammateFilter, sourceFilter, isAdvertiser, settlementFilter, sortOption, globalCurrency, rates]);

  // Aggregate metrics for compact balance summary
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

    filteredEntries.forEach((e) => {
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
      grossVolume,
      pendingInflow,
      boosterPayouts,
    };
  }, [filteredEntries, globalCurrency, rates]);

  // Cockpit scroll detection: appears once the entire cockpit hero card has fully exited the user's viewport
  const [showStickyBar, setShowStickyBar] = useState(false);
  const cockpitHeroRef = useRef(null);

  useEffect(() => {
    const scrollContainer = cockpitHeroRef.current?.closest('main') || document.querySelector('main') || window;
    const handleScroll = () => {
      const hero = cockpitHeroRef.current;
      if (!hero) return;

      const containerTop = scrollContainer === window ? 0 : scrollContainer.getBoundingClientRect().top;
      const heroBottom = hero.getBoundingClientRect().bottom;

      // Fully exits: bottom of the cockpit hero card has scrolled past the top of the scroll container
      const isExited = heroBottom <= containerTop + 2;
      // Re-enter threshold with hysteresis buffer: dismisses when scrolling back up and hero re-enters by 35px
      const isReEntering = heroBottom > containerTop + 35;

      setShowStickyBar((prev) => {
        if (!prev && isExited) return true;
        if (prev && isReEntering) return false;
        return prev;
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

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
    <div className="space-y-4 pb-20 md:pb-6 relative">
      {/* 1. Independent Floating Sticky Island (zero-height in document flow so it never shifts layout or causes infinite scroll jitter) */}
      <div className="sticky top-[calc(-1rem+6px)] sm:top-[calc(-1.5rem+6px)] lg:top-[calc(-2rem+6px)] z-40 h-0 pointer-events-none -mx-1 sm:mx-0">
        <AnimatePresence>
          {showStickyBar && (
            <motion.div
              key="cockpit-sticky-island"
              initial={{ opacity: 0, y: -4, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.99 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-auto w-full"
            >
              <div
                onClick={(e) => {
                  if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
                  const scrollContainer = cockpitHeroRef.current?.closest('main') || document.querySelector('main') || window;
                  scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="relative group rounded-xl bg-white/95 dark:bg-zinc-950/95 border border-zinc-200/90 dark:border-zinc-800 shadow-xl shadow-black/10 dark:shadow-black/50 backdrop-blur-md px-3.5 sm:px-4 py-2 cursor-pointer overflow-hidden transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap" dir={isRtl ? 'rtl' : 'ltr'}>
                  {/* Left: Total Earned + Currency Switcher + Filtered Chip */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0', isRtl && 'font-farsi')}>
                      {isAdvertiser ? (language === 'fa' ? 'سود خالص' : 'Net Profit') : t('ledger.totalEarned')}:
                    </span>
                    <div className="text-base sm:text-lg font-medium tracking-tight text-zinc-800 dark:text-zinc-200 shrink-0">
                      <MoneyDisplay amount={metrics.totalPaid} currency={globalCurrency} />
                    </div>

                    {/* Currency Switcher Pill */}
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-inner shrink-0">
                      <button
                        type="button"
                        onClick={() => onCurrencyChange?.('TOMAN')}
                        title="Display in Toman"
                        className={`relative isolate flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] transition-colors ${
                          globalCurrency === 'TOMAN'
                            ? 'text-zinc-800 dark:text-zinc-200 font-medium'
                            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        {globalCurrency === 'TOMAN' && (
                          <motion.div
                            layoutId="stickyCurrencyPill"
                            className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-200 dark:border-zinc-700/80"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          />
                        )}
                        <TomanIcon className="w-[22px] h-[22px] min-w-[22px] min-h-[22px] text-emerald-500 dark:text-emerald-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCurrencyChange?.('GOLD')}
                        title="Display in Gold"
                        className="relative isolate flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] transition-colors"
                      >
                        {globalCurrency === 'GOLD' && (
                          <motion.div
                            layoutId="stickyCurrencyPill"
                            className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-200 dark:border-zinc-700/80"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          />
                        )}
                        <span className="font-semibold tracking-wider text-[10px] text-amber-600 dark:text-amber-400">GOLD</span>
                      </button>
                    </div>

                    {filteredEntries.length !== entries.length && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        title={t('ledger.clearFilters')}
                        className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-800/80 transition-colors shrink-0"
                      >
                        <span className={cn(isRtl && 'font-farsi')}>{t('ledger.filtered')} ({formatNumber(filteredEntries.length)}/{formatNumber(entries.length)})</span>
                        <X className="w-2.5 h-2.5 text-zinc-500" />
                      </button>
                    )}
                  </div>

                  {/* Right: Progress completion text + Quick Search Jump */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className={cn('font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                        {formatNumber(metrics.completionRate)}%
                      </span>
                      <span className={cn('text-[11px]', isRtl && 'font-farsi')}>
                        {t('status.Paid')}
                      </span>
                      {metrics.failedCount > 0 && (
                        <span className={cn('text-[10px] text-rose-600 dark:text-rose-400', isRtl && 'font-farsi')}>
                          • {formatNumber(metrics.failedCount)} {t('status.Failed')}
                        </span>
                      )}
                    </div>

                    {/* Quick Filter Search Jump Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        searchInputRef?.current?.focus();
                        const scrollContainer = cockpitHeroRef.current?.closest('main') || document.querySelector('main') || window;
                        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      title={language === 'fa' ? 'جستجو (فشردن /)' : 'Search jobs (Press /)'}
                      className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs transition-colors active:scale-95"
                    >
                      <Search className="w-3.5 h-3.5 text-zinc-500" />
                      <span className={cn('hidden sm:inline text-[11px]', isRtl && 'font-farsi')}>{t('common.search', 'Search')}</span>
                      <Kbd>/</Kbd>
                    </button>
                  </div>
                </div>

                {/* Segmented Progress Bar as Bottom Border (Hover expands 2.5px -> 4px) */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] group-hover:h-[4px] transition-[height] duration-200 bg-zinc-200/80 dark:bg-zinc-800/80 flex overflow-hidden"
                  title={`${t('status.Paid')}: ${metrics.totalValue > 0 ? Math.round((metrics.totalPaid / metrics.totalValue) * 100) : 0}% | ${t('status.Pending')}: ${metrics.totalValue > 0 ? Math.round((metrics.totalPending / metrics.totalValue) * 100) : 0}%${metrics.totalFailed > 0 ? ` | ${t('status.Failed')}: ${Math.round((metrics.totalFailed / metrics.totalValue) * 100)}%` : ''}`}
                >
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{
                      width: `${metrics.totalValue > 0 ? (metrics.totalPaid / metrics.totalValue) * 100 : (metrics.paidCount > 0 ? 100 : 0)}%`,
                    }}
                  />
                  <div
                    className="bg-amber-500/90 h-full transition-all duration-300"
                    style={{
                      width: `${metrics.totalValue > 0 ? (metrics.totalPending / metrics.totalValue) * 100 : 0}%`,
                    }}
                  />
                  {metrics.totalFailed > 0 && (
                    <div
                      className="bg-rose-500/90 h-full transition-all duration-300"
                      style={{
                        width: `${metrics.totalValue > 0 ? (metrics.totalFailed / metrics.totalValue) * 100 : 0}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Spacious Hero Cockpit Card (Persistent in document flow, never shrinks or jumps) */}
      <div
        ref={cockpitHeroRef}
        className="relative overflow-hidden rounded-2xl bg-zinc-50/70 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-7 shadow-xs mb-6 min-h-[290px]"
      >
        {/* WebGPU Interactive Fluid Background */}
        <CockpitFluid isRtl={isRtl} containerRef={cockpitHeroRef} enabled={cockpitFluidEnabled} />

        {/* Optical Text Scrim: Soft vertical gradient for high legibility over vibrant fluid dyes */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/65 via-white/20 to-white/70 dark:from-zinc-950/70 dark:via-zinc-950/25 dark:to-zinc-950/85 pointer-events-none rounded-[inherit]" />

        <div className="relative z-10 space-y-4 sm:space-y-5" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                {isAdvertiser ? (language === 'fa' ? 'سود خالص کل' : 'Total Net Profit') : t('ledger.totalEarned')}
              </span>

              {/* Currency Switcher Pill */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-inner">
                <button
                  type="button"
                  onClick={() => onCurrencyChange?.('TOMAN')}
                  title="Display in Toman (Press T to toggle)"
                  className={`relative isolate flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] transition-colors ${
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
                  <TomanIcon className="w-[26px] h-[26px] min-w-[26px] min-h-[26px] text-emerald-500 dark:text-emerald-400" />
                </button>
                <button
                  type="button"
                  onClick={() => onCurrencyChange?.('GOLD')}
                  title="Display in Gold (Press T to toggle)"
                  className="relative isolate flex items-center justify-center px-2.5 py-0.5 rounded-md text-[11px] transition-colors"
                >
                  {globalCurrency === 'GOLD' && (
                    <motion.div
                      layoutId="totalEarnedCurrencyPill"
                      className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-200 dark:border-zinc-700/80"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="font-semibold tracking-wider text-[11px] text-amber-600 dark:text-amber-400">GOLD</span>
                </button>
              </div>

              {filteredEntries.length !== entries.length && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  title={t('ledger.clearFilters')}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-800/80 transition-colors"
                >
                  <span className={cn(isRtl && 'font-farsi')}>{t('ledger.filtered')} ({formatNumber(filteredEntries.length)}/{formatNumber(entries.length)})</span>
                  <X className="w-2.5 h-2.5 text-zinc-500" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs text-zinc-500', isRtl && 'font-farsi')}>
                {formatNumber(metrics.completionRate)}% {t('status.Paid')}
              </span>
              {metrics.failedCount > 0 && (
                <span className={cn('text-[11px] text-rose-600 dark:text-rose-400', isRtl && 'font-farsi')}>
                  • {formatNumber(metrics.failedCount)} {t('status.Failed')}
                </span>
              )}
            </div>
          </div>

          {/* Spacious Hero Balance */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-1">
            <div className="text-3xl sm:text-4xl font-medium tracking-tight text-zinc-800 dark:text-zinc-200 leading-tight">
              <MoneyDisplay amount={metrics.totalPaid} currency={globalCurrency} iconSize="0.9em" />
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

          {/* Spacious Segmented Progress Bar */}
          <div className="pt-1 pb-1">
            <div className="h-3 w-full bg-zinc-100/90 dark:bg-zinc-950/90 rounded-full p-0.5 border border-zinc-200 dark:border-zinc-800/80 shadow-inner flex overflow-hidden">
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

          {/* Spacious Cockpit Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {isAdvertiser ? (
              <>
                <div className="rounded-xl bg-zinc-50/90 dark:bg-black/85 border border-zinc-200/80 dark:border-white/[0.07] ring-1 ring-inset ring-black/5 dark:ring-white/[0.04] shadow-xs p-3 sm:p-3.5 space-y-1 transition-colors backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className={cn(isRtl && 'font-farsi')}>{language === 'fa' ? 'سفارشات تکمیل شده' : 'Orders Completed'}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-medium text-zinc-800 dark:text-zinc-200">
                    {formatNumber(metrics.paidCount)} <span className="text-xs text-zinc-500 font-normal">/ {formatNumber(filteredEntries.length)}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-50/90 dark:bg-black/85 border border-zinc-200/80 dark:border-white/[0.07] ring-1 ring-inset ring-black/5 dark:ring-white/[0.04] shadow-xs p-3 sm:p-3.5 space-y-1 transition-colors backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                    <span className={cn(isRtl && 'font-farsi')}>{language === 'fa' ? 'در انتظار دریافت' : 'Pending Inflow'}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-medium text-zinc-800 dark:text-zinc-200 truncate flex items-center">
                    <MoneyDisplay amount={metrics.pendingInflow} currency={globalCurrency} compact={true} iconSize={26} />
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-50/90 dark:bg-black/80 border border-zinc-200/80 dark:border-white/[0.07] ring-1 ring-inset ring-black/5 dark:ring-white/[0.04] shadow-xs p-3 sm:p-3.5 space-y-1 col-span-2 sm:col-span-1 transition-colors backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium tracking-wider">
                    <Users className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className={cn(isRtl && 'font-farsi')}>{language === 'fa' ? 'سهم بوسترها' : 'Booster Payouts'}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-medium text-zinc-800 dark:text-zinc-200 truncate flex items-center">
                    <MoneyDisplay amount={metrics.boosterPayouts} currency={globalCurrency} compact={true} iconSize={26} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-zinc-50/90 dark:bg-black/85 border border-zinc-200/80 dark:border-white/[0.07] ring-1 ring-inset ring-black/5 dark:ring-white/[0.04] shadow-xs p-3 sm:p-3.5 space-y-1 transition-colors backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className={cn(isRtl && 'font-farsi')}>{t('ledger.jobsDone')}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-medium text-zinc-800 dark:text-zinc-200">
                    {formatNumber(metrics.paidCount)} <span className="text-xs text-zinc-500 font-normal">/ {formatNumber(filteredEntries.length)}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-50/90 dark:bg-black/85 border border-zinc-200/80 dark:border-white/[0.07] ring-1 ring-inset ring-black/5 dark:ring-white/[0.04] shadow-xs p-3 sm:p-3.5 space-y-1 transition-colors backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className={cn(isRtl && 'font-farsi')}>{t('ledger.pendingPayout')}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-medium text-zinc-800 dark:text-zinc-200 truncate flex items-center">
                    <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} compact={true} iconSize={26} />
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-50/90 dark:bg-black/80 border border-zinc-200/80 dark:border-white/[0.07] ring-1 ring-inset ring-black/5 dark:ring-white/[0.04] shadow-xs p-3 sm:p-3.5 space-y-1 col-span-2 sm:col-span-1 transition-colors backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-medium tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className={cn(isRtl && 'font-farsi')}>{t('ledger.averageRate')}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-medium text-zinc-800 dark:text-zinc-200 truncate flex items-center">
                    <MoneyDisplay amount={metrics.avgRate} currency={globalCurrency} compact={true} iconSize={26} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Clean Monochromatic Separator Line */}
      <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800/80" />

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
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 border-zinc-200 hover:border-zinc-300 dark:bg-[#0c0c0c] dark:text-zinc-400 dark:hover:text-zinc-200 dark:border-zinc-800/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60'
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
                      'text-[10px] px-1 rounded leading-tight',
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
          {/* Always-Accessible Search Input with Embedded Filters Icon Button */}
          <div className="relative flex-1 max-w-sm sm:max-w-md" dir={isRtl ? 'rtl' : 'ltr'}>
            <Search
              className={cn(
                'absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none',
                isRtl ? 'right-2.5' : 'left-2.5'
              )}
            />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={t('ledger.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'h-8 text-xs bg-white dark:bg-[#0c0c0c] border-zinc-200 dark:border-zinc-800/80 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-700',
                isRtl
                  ? 'font-farsi placeholder:font-farsi text-right pr-8 pl-12'
                  : 'pl-8 pr-12'
              )}
            />
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 flex items-center gap-1',
                isRtl ? 'left-2' : 'right-2'
              )}
            >
              {searchQuery && (
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
              )}

              {/* Embedded Filters Icon Button */}
              <div className="relative" ref={filtersPopoverRef}>
                <button
                  type="button"
                  onClick={() => setIsFiltersPopoverOpen((prev) => !prev)}
                  title={t('ledger.filters')}
                  className={cn(
                    'relative w-6 h-6 rounded-md flex items-center justify-center transition-all active:scale-95 border',
                    isFiltersPopoverOpen || activeSecondaryFiltersCount > 0
                      ? 'bg-zinc-200 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 shadow-xs'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  )}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {activeSecondaryFiltersCount > 0 && (
                    <span
                      className={cn(
                        'absolute -top-1 w-3.5 h-3.5 rounded-full bg-zinc-900 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900 text-[9px] font-medium flex items-center justify-center leading-none',
                        isRtl ? '-left-1' : '-right-1'
                      )}
                    >
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
                        'absolute top-full mt-2 w-72 sm:w-80 p-3 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 space-y-3 text-xs',
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

                  {/* 1.5. Source Settlement Filter (Advertiser Mode) */}
                  {isAdvertiser && (
                    <div className="space-y-1.5">
                      <label className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400 block', isRtl && 'font-farsi')}>
                        {language === 'fa' ? 'تسویه مبدا (دریافت وجه)' : 'Client Settlement'}
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setSettlementFilter('')}
                          className={cn(
                            'py-1 rounded text-[11px] font-medium transition-colors text-center active:scale-95',
                            settlementFilter === ''
                              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-xs border border-zinc-200/80 dark:border-transparent'
                              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                          )}
                        >
                          {t('status.all')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettlementFilter('received')}
                          className={cn(
                            'py-1 rounded text-[11px] font-medium transition-colors text-center active:scale-95 flex items-center justify-center gap-1',
                            settlementFilter === 'received'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                          )}
                        >
                          <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{language === 'fa' ? 'دریافت شده' : 'Received'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettlementFilter('pending')}
                          className={cn(
                            'py-1 rounded text-[11px] font-medium transition-colors text-center active:scale-95 flex items-center justify-center gap-1',
                            settlementFilter === 'pending'
                              ? 'bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                          )}
                        >
                          <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                          <span>{language === 'fa' ? 'در انتظار' : 'Pending'}</span>
                        </button>
                      </div>
                    </div>
                  )}

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
                        <TomanIcon className="w-[24px] h-[24px] min-w-[24px] min-h-[24px] text-zinc-500 dark:text-zinc-400" />
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
