import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatMoney } from '../lib/currencies';
import { StatusBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { GameIcon } from './ui/GameIcon';
import { MoneyDisplay } from './ui/MoneyDisplay';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import {
  Camera,
  Check,
  Loader2,
  Copy,
  ShieldCheck,
  MessageSquare,
  Users,
  Store,
} from 'lucide-react';
import { CheckpointLogo, DiscordIcon } from './ui/Icons';
import { copyTextNative, copyImageNative, downloadImageBlob } from '../lib/desktop';
import { toBlob } from 'html-to-image';
import { incrementLocalReceiptCount } from '../lib/telemetry';
import { useLanguage, formatShamsiDate, formatShamsiDateTime } from '../lib/i18n';
import { cn } from '../lib/utils';

function FormattedDescription({ text }) {
  const [copiedTag, setCopiedTag] = useState(null);

  const handleCopyTag = (e, tag) => {
    e.stopPropagation();
    copyTextNative(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1600);
  };

  const tokens = useMemo(() => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/((?:^|(?<=[^\w]))@[a-zA-Z0-9_]{2,32}\b(?!\.[a-zA-Z]{2,}\b)|(?:^|(?<=[^\w]))#[a-zA-Z0-9_-]{1,32}\b)/g);
  }, [text]);

  return (
    <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed flex flex-wrap items-center gap-1">
      <span className="italic">"</span>
      {tokens.map((token, i) => {
        if (!token) return null;
        if (token.startsWith('@')) {
          const isCopied = copiedTag === token;
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => handleCopyTag(e, token)}
              title={`Click to copy ${token}`}
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer select-none active:scale-[0.96]',
                isCopied
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80'
                  : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800/60 dark:hover:bg-sky-900/40'
              )}
            >
              <span>{token}</span>
              {isCopied && <span className="text-[9px] font-bold">✓</span>}
            </button>
          );
        }
        if (token.startsWith('#')) {
          const isCopied = copiedTag === token;
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => handleCopyTag(e, token)}
              title={`Click to copy ${token}`}
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer select-none active:scale-[0.96]',
                isCopied
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80'
                  : 'bg-zinc-100 text-zinc-700 border border-zinc-200 hover:bg-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-300 dark:border-zinc-700/80 dark:hover:bg-zinc-700/80'
              )}
            >
              <span>{token}</span>
              {isCopied && <span className="text-[9px] font-bold">✓</span>}
            </button>
          );
        }
        return <span key={i} className="italic">{token}</span>;
      })}
      <span className="italic">"</span>
    </div>
  );
}

export function ReceiptModal({
  isOpen,
  onClose,
  entry = null,
  globalCurrency = 'TOMAN',
  onOpenLightbox,
  onFilterTeammate,
  onFilterSource,
  activeProfileId = 'booster',
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();
  const receiptCardRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copiedState, setCopiedState] = useState(false);
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedBoosterSlip, setCopiedBoosterSlip] = useState(null);
  const [receiptLang, setReceiptLang] = useState(language);
  const isAdvertiser = activeProfileId === 'advertiser';
  const [receiptMode, setReceiptMode] = useState('client'); // 'client' | 'booster'

  useEffect(() => {
    setReceiptLang(language);
  }, [language, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setReceiptMode('client');
    }
  }, [isOpen, entry?.id]);

  // Safe fallback entry object to prevent runtime errors
  const safeEntry = entry || {};
  const dt = safeEntry.dateTime ? new Date(safeEntry.dateTime) : null;
  const isReceiptFa = receiptLang === 'fa';

  const dateStr = dt && !isNaN(dt.getTime())
    ? isReceiptFa
      ? formatShamsiDate(dt, { month: 'long', day: 'numeric', year: 'numeric' })
      : dt.toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
    : '--';
  const timeStr = dt && !isNaN(dt.getTime())
    ? isReceiptFa
      ? formatShamsiDateTime(dt, { hour: '2-digit', minute: '2-digit' })
      : dt.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })
    : '';

  const entryCurrency =
    safeEntry.currency && safeEntry.currency !== 'DEFAULT'
      ? safeEntry.currency
      : globalCurrency;

  const formattedIncome = formatMoney(safeEntry.income || 0, entryCurrency, false, isReceiptFa);
  const receiptId = (safeEntry.id || 'JOB').toUpperCase();

  const isClassic = safeEntry.rateUnit === '1' || safeEntry.game === 'World of Warcraft Classic';
  const effectiveRate = Number(safeEntry.exchangeRate) || (isClassic ? 7000 : 3200);
  const rateUnitText = isClassic
    ? (isReceiptFa ? '۱ گلد' : '1 Gold')
    : (isReceiptFa ? '۱،۰۰۰ گلد' : '1,000 Gold');
  const rateDiscordText = isClassic ? '1 Gold' : '1k Gold';
  const hasTeammates = Array.isArray(safeEntry.teammates) && safeEntry.teammates.length > 0;
  const totalShares = 1 + (hasTeammates ? safeEntry.teammates.length : 0);
  const isTeamWork = Boolean(safeEntry.teamMode || hasTeammates);
  const totalPot = safeEntry.pot !== undefined && safeEntry.pot !== null
    ? safeEntry.pot
    : (safeEntry.income ? safeEntry.income * totalShares : 0);
  const formattedPot = formatMoney(totalPot, entryCurrency, false, isReceiptFa);

  const teamCutsBreakdown = hasTeammates
    ? safeEntry.teammates
        .map((tm) => {
          const cut = safeEntry.teammateCuts?.[tm] || safeEntry.income;
          return `${tm}: ${formatMoney(cut, entryCurrency, false, isReceiptFa)}`;
        })
        .join(' | ')
    : '';

  // Copy Plain Text Receipt
  const handleCopyText = useCallback(async () => {
    if (!entry) return;

    let text = '';
    if (isAdvertiser) {
      if (receiptMode === 'client') {
        const orderPrice = safeEntry.pot || safeEntry.income || 0;
        const formattedClientPrice = formatMoney(orderPrice, entryCurrency, false, isReceiptFa);
        text = isReceiptFa
          ? `=== رسید سفارش مشتری چک‌پوینت ===
شناسه رسید: ${receiptId}${safeEntry.orderId ? `\nشناسه سفارش: #${safeEntry.orderId}` : ''}
تاریخ: ${dateStr} ${timeStr}
بازی: ${safeEntry.game || 'World of Warcraft'}
عنوان سفارش: ${safeEntry.title || 'سفارش ثبت‌شده'}
سورس / پلتفرم: ${safeEntry.source || '-'}
مبلغ کل سفارش: ${formattedClientPrice}
وضعیت: ${t(`status.${safeEntry.status || 'Paid'}`)}
توضیحات: ${safeEntry.notes || 'ندارد'}
==============================`
          : `=== CHECKPOINT CLIENT RECEIPT ===
Receipt ID: ${receiptId}${safeEntry.orderId ? `\nOrder ID: #${safeEntry.orderId}` : ''}
Date: ${dateStr} ${timeStr}
Game: ${safeEntry.game || 'World of Warcraft'}
Work Title: ${safeEntry.title || 'Work Record'}
Platform / Source: ${safeEntry.source || '-'}
Order Price: ${formattedClientPrice}
Status: ${safeEntry.status || 'Paid'}
Description: ${safeEntry.notes || 'None'}
==============================`;
      } else {
        const boosterPayoutVal = Math.max(0, (safeEntry.pot || safeEntry.income || 0) - (safeEntry.income || 0));
        const finalPayout = boosterPayoutVal > 0 ? boosterPayoutVal : (safeEntry.income || 0);
        const formattedBoosterPayout = formatMoney(finalPayout, entryCurrency, false, isReceiptFa);
        const boosterNames = hasTeammates ? safeEntry.teammates.join(', ') : '-';
        text = isReceiptFa
          ? `=== فیش تسویه بوستر چک‌پوینت ===
شناسه رسید: ${receiptId}${safeEntry.orderId ? `\nشناسه سفارش: #${safeEntry.orderId}` : ''}
تاریخ: ${dateStr} ${timeStr}
بازی: ${safeEntry.game || 'World of Warcraft'}
عنوان سفارش: ${safeEntry.title || 'سفارش ثبت‌شده'}
سورس / مرجع: ${safeEntry.source || '-'}
بوسترهای انجام‌دهنده: ${boosterNames}
مبلغ تسویه بوستر: ${formattedBoosterPayout}${teamCutsBreakdown ? `\nجزئیات سهم: ${teamCutsBreakdown}` : ''}
وضعیت: ${t(`status.${safeEntry.status || 'Paid'}`)}
توضیحات: ${safeEntry.notes || 'ندارد'}
==============================`
          : `=== CHECKPOINT BOOSTER PAYOUT SLIP ===
Receipt ID: ${receiptId}${safeEntry.orderId ? `\nOrder ID: #${safeEntry.orderId}` : ''}
Date: ${dateStr} ${timeStr}
Game: ${safeEntry.game || 'World of Warcraft'}
Work Title: ${safeEntry.title || 'Work Record'}
Platform / Source: ${safeEntry.source || '-'}
Assigned Booster(s): ${boosterNames}
Booster Payout: ${formattedBoosterPayout}${teamCutsBreakdown ? `\nPayout Breakdown: ${teamCutsBreakdown}` : ''}
Status: ${safeEntry.status || 'Paid'}
Description: ${safeEntry.notes || 'None'}
==============================`;
      }
    } else {
      text = isReceiptFa
        ? `=== رسید کار چک‌پوینت ===
شناسه رسید: ${receiptId}
تاریخ: ${dateStr} ${timeStr}
بازی: ${safeEntry.game || 'World of Warcraft'}
عنوان کار: ${safeEntry.title || 'کار ثبت‌شده'}
مشتری / سورس: ${safeEntry.source || '-'}${
            isTeamWork
              ? `\nپات تیمی: ${formattedPot} (${formatNumber(totalShares)} سهم)\nسهم شما: ${formattedIncome}\nسهم هم‌تیمی‌ها: ${teamCutsBreakdown}`
              : `\n${safeEntry.status === 'Failed' ? 'مبلغ سفارش (پرداخت‌نشده)' : 'مبلغ درآمد'}: ${formattedIncome}`
          }
نرخ تبدیل: ${formatMoney(effectiveRate, 'TOMAN', false, true)} / ${rateUnitText}
وضعیت: ${t(`status.${safeEntry.status || 'Paid'}`)}
توضیحات کار: ${safeEntry.notes || 'ندارد'}
==============================`
        : `=== CHECKPOINT WORK RECEIPT ===
Receipt ID: ${receiptId}
Date: ${dateStr} ${timeStr}
Game: ${safeEntry.game || 'World of Warcraft'}
Work Title: ${safeEntry.title || 'Work Record'}
Job Source: ${safeEntry.source || '-'}${
            isTeamWork
              ? `\nPot: ${formattedPot} (${totalShares} Shares)\nYour Share: ${formattedIncome}\nTeam Cuts: ${teamCutsBreakdown}`
              : `\n${safeEntry.status === 'Failed' ? 'Order Value (Unpaid)' : 'Amount'}: ${formattedIncome}`
          }
Exchange Rate: ${effectiveRate.toLocaleString()} Toman / ${rateUnitText}
Status: ${safeEntry.status || 'Paid'}
Work Description: ${safeEntry.notes || 'None'}
==============================`;
    }

    await copyTextNative(text);
    incrementLocalReceiptCount();
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1800);
  }, [
    entry,
    isReceiptFa,
    effectiveRate,
    rateUnitText,
    isTeamWork,
    formattedIncome,
    formattedPot,
    teamCutsBreakdown,
    receiptId,
    dateStr,
    timeStr,
    totalShares,
    t,
    formatNumber,
    isAdvertiser,
    receiptMode,
    safeEntry,
    entryCurrency,
    hasTeammates,
  ]);

  // Handle Copy Discord Markdown
  const handleCopyDiscord = useCallback(async () => {
    if (!entry) return;

    let md = '';
    if (isAdvertiser) {
      if (receiptMode === 'client') {
        const orderPrice = safeEntry.pot || safeEntry.income || 0;
        const formattedClientPrice = formatMoney(orderPrice, entryCurrency, false, isReceiptFa);
        md = isReceiptFa
          ? `\`\`\`ini
[ رسید سفارش مشتری CHECKPOINT ]
شناسه      = ${receiptId}${safeEntry.orderId ? `\nشماره سفارش = #${safeEntry.orderId}` : ''}
تاریخ      = ${dateStr}
بازی       = ${safeEntry.game || 'World of Warcraft'}
عنوان      = ${safeEntry.title || 'سفارش ثبت‌شده'}
سورس       = ${safeEntry.source || 'مشتری مستقیم'}
مبلغ سفارش = ${formattedClientPrice}
وضعیت      = ${t(`status.${safeEntry.status || 'Paid'}`)}
توضیحات    = ${safeEntry.notes || 'ندارد'}
\`\`\``
          : `\`\`\`ini
[ CHECKPOINT - CLIENT ORDER RECEIPT ]
ID         = ${receiptId}${safeEntry.orderId ? `\nOrder ID   = #${safeEntry.orderId}` : ''}
Date       = ${dateStr}
Game       = ${safeEntry.game || 'World of Warcraft'}
Title      = ${safeEntry.title || 'Work Record'}
Source     = ${safeEntry.source || '-'}
Order Price= ${formattedClientPrice}
Status     = ${safeEntry.status || 'Paid'}
Description= ${safeEntry.notes || 'None'}
\`\`\``;
      } else {
        const boosterPayoutVal = Math.max(0, (safeEntry.pot || safeEntry.income || 0) - (safeEntry.income || 0));
        const finalPayout = boosterPayoutVal > 0 ? boosterPayoutVal : (safeEntry.income || 0);
        const formattedBoosterPayout = formatMoney(finalPayout, entryCurrency, false, isReceiptFa);
        const boosterNames = hasTeammates ? safeEntry.teammates.join(', ') : '-';
        md = isReceiptFa
          ? `\`\`\`ini
[ فیش تسویه بوستر CHECKPOINT ]
شناسه      = ${receiptId}${safeEntry.orderId ? `\nشماره سفارش = #${safeEntry.orderId}` : ''}
تاریخ      = ${dateStr}
بازی       = ${safeEntry.game || 'World of Warcraft'}
عنوان      = ${safeEntry.title || 'سفارش ثبت‌شده'}
سورس       = ${safeEntry.source || 'مشتری مستقیم'}
بوسترها    = ${boosterNames}
تسویه بوستر= ${formattedBoosterPayout}${teamCutsBreakdown ? `\nجزئیات سهم = ${teamCutsBreakdown}` : ''}
وضعیت      = ${t(`status.${safeEntry.status || 'Paid'}`)}
توضیحات    = ${safeEntry.notes || 'ندارد'}
\`\`\``
          : `\`\`\`ini
[ CHECKPOINT - BOOSTER PAYOUT SLIP ]
ID         = ${receiptId}${safeEntry.orderId ? `\nOrder ID   = #${safeEntry.orderId}` : ''}
Date       = ${dateStr}
Game       = ${safeEntry.game || 'World of Warcraft'}
Title      = ${safeEntry.title || 'Work Record'}
Source     = ${safeEntry.source || '-'}
Booster(s) = ${boosterNames}
Payout     = ${formattedBoosterPayout}${teamCutsBreakdown ? `\nBreakdown  = ${teamCutsBreakdown}` : ''}
Status     = ${safeEntry.status || 'Paid'}
Description= ${safeEntry.notes || 'None'}
\`\`\``;
      }
    } else {
      const currentSafeEntry = {
        ...entry,
        income: entry.income || 0,
      };

      md = isReceiptFa
        ? `\`\`\`ini
[ رسید ثبت کار CHECKPOINT ]
شناسه      = ${receiptId}
تاریخ      = ${dateStr}
بازی       = ${currentSafeEntry.game || 'World of Warcraft'}
عنوان      = ${currentSafeEntry.title || 'کار ثبت‌شده'}
سورس       = ${currentSafeEntry.source || 'مشتری مستقیم'}${
            isTeamWork
              ? `\nپات تیمی   = ${formattedPot} (${formatNumber(totalShares)} سهم)\nسهم شما    = ${formattedIncome}\nسهم تیم    = ${teamCutsBreakdown}`
              : `\nمبلغ       = ${formattedIncome}`
          }
نرخ تبدیل  = ${formatMoney(effectiveRate, 'TOMAN', false, true)} / ${rateDiscordText}
وضعیت      = ${t(`status.${currentSafeEntry.status || 'Paid'}`)}
توضیحات    = ${currentSafeEntry.notes || 'ندارد'}
\`\`\``
        : `\`\`\`ini
[ CHECKPOINT - PROOF OF WORK RECEIPT ]
ID         = ${receiptId}
Date       = ${dateStr}
Game       = ${currentSafeEntry.game || 'World of Warcraft'}
Title      = ${currentSafeEntry.title || 'Work Record'}
Source     = ${currentSafeEntry.source || '-'}${
            isTeamWork
              ? `\nPot        = ${formattedPot} (${totalShares} Shares)\nYour Share = ${formattedIncome}\nTeam Cuts  = ${teamCutsBreakdown}`
              : `\n${currentSafeEntry.status === 'Failed' ? 'Amount (Unpaid)' : 'Amount     '} = ${formattedIncome}`
          }
Rate       = ${effectiveRate.toLocaleString()} Toman / ${rateDiscordText}
Status     = ${currentSafeEntry.status || 'Paid'}
Work Description = ${currentSafeEntry.notes || 'None'}
\`\`\``;
    }

    await copyTextNative(md);
    incrementLocalReceiptCount();
    setCopiedDiscord(true);
    setTimeout(() => setCopiedDiscord(false), 1800);
  }, [
    entry,
    isReceiptFa,
    receiptId,
    dateStr,
    safeEntry,
    isTeamWork,
    formattedPot,
    totalShares,
    formattedIncome,
    teamCutsBreakdown,
    effectiveRate,
    rateDiscordText,
    t,
    formatNumber,
    isAdvertiser,
    receiptMode,
    entryCurrency,
    hasTeammates,
  ]);

  const handleCopyDiscordMarkdown = handleCopyDiscord;

  const handleCopySingleBoosterDiscord = useCallback(async (e, tm) => {
    e.stopPropagation();
    if (!entry) return;
    const cut = safeEntry.teammateCuts?.[tm] || safeEntry.income || 0;
    const formattedCut = formatMoney(cut, entryCurrency, false, isReceiptFa);
    const boosterNote = safeEntry.teammateNotes?.[tm]?.trim();
    const md = isReceiptFa
      ? `\`\`\`ini
[ فیش تسویه بوستر CHECKPOINT ]
شناسه      = ${receiptId}${safeEntry.orderId ? `\nشماره سفارش = #${safeEntry.orderId}` : ''}
تاریخ      = ${dateStr}
بازی       = ${safeEntry.game || 'World of Warcraft'}
عنوان      = ${safeEntry.title || 'سفارش ثبت‌شده'}
سورس       = ${safeEntry.source || 'سورس مستقیم'}
بوستر      = @${tm}
مبلغ تسویه = ${formattedCut}
وضعیت      = ${t(`status.${safeEntry.status || 'Paid'}`)}${boosterNote ? `\nیادداشت    = ${boosterNote}` : ''}
\`\`\``
      : `\`\`\`ini
[ CHECKPOINT - BOOSTER PAYOUT SLIP ]
ID         = ${receiptId}${safeEntry.orderId ? `\nOrder ID   = #${safeEntry.orderId}` : ''}
Date       = ${dateStr}
Game       = ${safeEntry.game || 'World of Warcraft'}
Title      = ${safeEntry.title || 'Work Record'}
Source     = ${safeEntry.source || '-'}
Booster    = @${tm}
Payout     = ${formattedCut}
Status     = ${safeEntry.status || 'Paid'}${boosterNote ? `\nNote       = ${boosterNote}` : ''}
\`\`\``;
    await copyTextNative(md);
    setCopiedBoosterSlip(tm);
    setTimeout(() => setCopiedBoosterSlip(null), 1800);
  }, [entry, safeEntry, entryCurrency, isReceiptFa, receiptId, dateStr, t]);

  // Screenshot & Copy Image to Clipboard
  const handleScreenshotCopy = useCallback(async () => {
    if (!receiptCardRef.current || isCapturing || !entry) return;
    try {
      setIsCapturing(true);

      // Ensure all custom fonts (IRANYekanRd, Inter) are loaded
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      await new Promise((resolve) => setTimeout(resolve, 60));

      const isDark = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
      const bgColor = isDark ? '#09090b' : '#ffffff';
      const node = receiptCardRef.current;
      const blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
        style: {
          padding: '24px',
          backgroundColor: bgColor,
          margin: '0',
        },
        filter: (domNode) => {
          if (domNode.classList && domNode.classList.contains('hide-in-screenshot')) {
            return false;
          }
          return true;
        },
      });

      if (!blob) {
        throw new Error('Failed to generate image blob');
      }

      const copied = await copyImageNative({ blob });
      incrementLocalReceiptCount();
      if (copied) {
        setCopiedState(true);
        setTimeout(() => setCopiedState(false), 1800);
      } else {
        // Web fallback download if clipboard write fails
        downloadImageBlob(blob, `checkpoint_receipt_${receiptId.toLowerCase()}.png`);
      }
    } catch (err) {
      console.error('Screenshot capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  }, [receiptCardRef, isCapturing, entry, receiptId]);

  // Keyboard Shortcuts (C or S to take screenshot copy)
  useEffect(() => {
    if (!isOpen || !entry) return;

    const handleKeyDown = (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      if ((e.code === 'KeyC' || e.code === 'KeyS' || e.key === 'c' || e.key === 'C' || e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleScreenshotCopy();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, entry, handleScreenshotCopy]);

  return (
    <Dialog open={Boolean(isOpen && entry)} onClose={onClose} maxWidth="max-w-lg">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center justify-between w-full pe-6">
          <div className="flex items-center gap-2">
            <DialogTitle className={cn(isRtl && 'font-farsi')}>
              {isAdvertiser
                ? (receiptMode === 'client' ? t('receipt.clientReceiptTitle') : t('receipt.boosterSlipTitle'))
                : t('receipt.title')}
            </DialogTitle>
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> {isAdvertiser && receiptMode === 'client' ? 'CLIENT ORDER' : (isAdvertiser ? 'PAYOUT SLIP' : 'VERIFIED')}
            </span>
          </div>

          {/* Receipt Language Switcher */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-md text-[10px]">
            <button
              type="button"
              onClick={() => setReceiptLang('fa')}
              className={cn(
                'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                receiptLang === 'fa'
                  ? 'bg-white text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 font-medium shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              )}
            >
              فارسی
            </button>
            <button
              type="button"
              onClick={() => setReceiptLang('en')}
              className={cn(
                'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                receiptLang === 'en'
                  ? 'bg-white text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 font-medium shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              )}
            >
              EN
            </button>
          </div>
        </div>
      </DialogHeader>

      <DialogContent className="p-6 space-y-4">
        {/* Segmented Control for Advertiser Profile */}
        {isAdvertiser && (
          <div className="flex items-center justify-center pb-1 hide-in-screenshot">
            <div className="flex items-center p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-300/80 dark:border-zinc-800 text-xs select-none shadow-inner">
              <button
                type="button"
                onClick={() => setReceiptMode('client')}
                className={cn(
                  'relative px-3.5 py-1 rounded-lg font-medium transition-all cursor-pointer text-xs flex items-center gap-1.5',
                  receiptMode === 'client'
                    ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                )}
              >
                {receiptMode === 'client' && (
                  <motion.div
                    layoutId="advertiserReceiptSegment"
                    className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Store className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{isReceiptFa ? 'رسید مشتری' : 'Client Receipt'}</span>
              </button>

              <button
                type="button"
                onClick={() => setReceiptMode('booster')}
                className={cn(
                  'relative px-3.5 py-1 rounded-lg font-medium transition-all cursor-pointer text-xs flex items-center gap-1.5',
                  receiptMode === 'booster'
                    ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                )}
              >
                {receiptMode === 'booster' && (
                  <motion.div
                    layoutId="advertiserReceiptSegment"
                    className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Users className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{isReceiptFa ? 'فیش تسویه بوستر' : 'Booster Payout Slip'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Flat Subtle Receipt Card Container (No harsh drop shadows) */}
        <div
          ref={receiptCardRef}
          dir={isReceiptFa ? 'rtl' : 'ltr'}
          className={cn(
            'print-receipt-container rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-5 sm:p-6 space-y-5 relative select-text cursor-auto',
            isReceiptFa && 'font-farsi'
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <CheckpointLogo className="w-7 h-7 text-zinc-800 dark:text-zinc-200 shrink-0" />
              <div>
                <h4 className="text-sm font-black tracking-wider text-zinc-800 dark:text-zinc-200 uppercase">
                  CHECKPOINT
                </h4>
                <p className={cn('text-[10px] text-zinc-500 leading-normal', isReceiptFa && 'font-farsi')}>
                  {isAdvertiser
                    ? (receiptMode === 'client'
                        ? (isReceiptFa ? 'رسید رسمی سفارش مشتری' : 'Official Client Order Receipt')
                        : (isReceiptFa ? 'فیش تسویه‌حساب و پرداخت بوستر' : 'Booster Payout & Settlement Slip'))
                    : (isReceiptFa ? 'دفتر ثبت درآمد دیجیتال و گیمینگ' : 'Freelance & Gaming Ledger')}
                </p>
              </div>
            </div>
            <div className={cn(isReceiptFa ? 'text-left' : 'text-right')}>
              <div className="text-[10px] font-medium text-zinc-500">ID: {receiptId}</div>
              {safeEntry.orderId && (
                <div className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  Order #{safeEntry.orderId}
                </div>
              )}
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">{dateStr}</div>
            </div>
          </div>

          {/* Core Info */}
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase font-medium text-zinc-500 block mb-1">
                {isReceiptFa ? 'عنوان کار' : 'Work Title'}
              </span>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 block">
                {safeEntry.title || (isReceiptFa ? 'بدون عنوان' : 'Untitled Work')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-medium text-zinc-500 block mb-0.5">
                  {isReceiptFa ? 'بازی / پلتفرم' : 'Game / Platform'}
                </span>
                <span className="text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 mt-0.5 font-medium">
                  <GameIcon game={safeEntry.game} className="w-3.5 h-3.5" />
                  <span>{safeEntry.game || 'World of Warcraft'}</span>
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-medium text-zinc-500 block mb-0.5">
                  {isReceiptFa ? 'سورس / سفارش‌دهنده' : 'Job Source / Seller'}
                </span>
                {safeEntry.source ? (
                  <button
                    type="button"
                    onClick={() => {
                      onFilterSource?.(safeEntry.source);
                      onClose?.();
                    }}
                    title={isReceiptFa ? `فیلتر کردن کارها بر اساس ${safeEntry.source}` : `Filter jobs from ${safeEntry.source}`}
                    className="px-2 py-0.5 mt-0.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-700 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Store className="w-3 h-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
                    <span>{safeEntry.source}</span>
                  </button>
                ) : (
                  <span className={cn('text-zinc-700 dark:text-zinc-300 font-medium mt-0.5 block leading-normal', isReceiptFa && 'font-farsi')}>
                    -
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] uppercase font-medium text-zinc-500 block mb-0.5">
                  {isReceiptFa ? 'وضعیت' : 'Status'}
                </span>
                <div className="mt-1">
                  <StatusBadge status={safeEntry.status || 'Paid'} variant="solid" />
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-medium text-zinc-500 block mb-0.5">
                  {isAdvertiser
                    ? (receiptMode === 'client'
                        ? (isReceiptFa ? 'مبلغ سفارش' : 'Order Price')
                        : (isReceiptFa ? 'مبلغ تسویه بوستر' : 'Booster Payout'))
                    : (safeEntry.status === 'Failed'
                        ? (isReceiptFa ? t('receipt.orderValueFailed') : 'Order Value (Unpaid)')
                        : isTeamWork
                        ? (isReceiptFa ? 'سهم شما' : 'Your Share')
                        : (isReceiptFa ? 'مبلغ درآمد' : 'Amount Earned'))}
                </span>
                <div
                  className={cn(
                    'text-sm font-medium mt-0.5 inline-flex items-center',
                    safeEntry.status === 'Failed'
                      ? 'text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-400 dark:decoration-zinc-600'
                      : (isAdvertiser && receiptMode === 'booster')
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-zinc-800 dark:text-zinc-200'
                  )}
                >
                  <MoneyDisplay
                    amount={
                      isAdvertiser
                        ? (receiptMode === 'client'
                            ? (safeEntry.pot || safeEntry.income || 0)
                            : (Math.max(0, (safeEntry.pot || safeEntry.income || 0) - (safeEntry.income || 0)) || safeEntry.income || 0))
                        : (safeEntry.income || 0)
                    }
                    currency={entryCurrency}
                  />
                </div>
              </div>

              {/* Standard Booster Profile: Pot */}
              {!isAdvertiser && isTeamWork && (
                <div className="col-span-2 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/70 flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase font-medium text-zinc-500">
                    {isReceiptFa ? `پات تیمی (${formatNumber(totalShares)} سهم)` : `Pot (${totalShares} Shares)`}
                  </span>
                  <strong
                    className={cn(
                      'font-medium inline-flex items-center',
                      safeEntry.status === 'Failed'
                        ? 'text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-400 dark:decoration-zinc-600'
                        : 'text-amber-600 dark:text-amber-300'
                    )}
                  >
                    <MoneyDisplay amount={totalPot} currency={entryCurrency} />
                  </strong>
                </div>
              )}

              {/* Standard Booster Profile: Conversion Rate */}
              {!isAdvertiser && (
                <div className="col-span-2 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/70 flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase font-medium text-zinc-500">
                    {isReceiptFa ? 'نرخ تبدیل' : 'Conversion Rate'}
                  </span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                    {formatMoney(effectiveRate, 'TOMAN', false, isReceiptFa)} / {rateUnitText}
                  </span>
                </div>
              )}

              {/* Standard Booster Profile: Interactive Teammate Badges */}
              {!isAdvertiser && hasTeammates && (
                <div className="col-span-2 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-medium text-zinc-500">
                      {isReceiptFa ? 'هم‌تیمی‌ها و سهم' : 'Teammates & Cuts'}
                    </span>
                    <span className={cn('text-[9px] text-zinc-500 leading-normal hide-in-screenshot', isReceiptFa && 'font-farsi')}>
                      {isReceiptFa ? 'کلیک برای فیلتر در دفتر' : 'Click to filter in ledger'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {safeEntry.teammates.map((tm) => {
                      const cut = safeEntry.teammateCuts?.[tm] || safeEntry.income;
                      return (
                        <button
                          key={tm}
                          type="button"
                          onClick={() => {
                            onFilterTeammate?.(tm);
                            onClose?.();
                          }}
                          title={`Filter ledger for ${tm} (Cut: ${formatMoney(cut, entryCurrency, false, isReceiptFa)})`}
                          className="px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Users className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                          <span>{tm}</span>
                          <span className="text-zinc-500 dark:text-zinc-400 text-[10px] inline-flex items-center">(<MoneyDisplay amount={cut} currency={entryCurrency} />)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Advertiser Profile: Booster Slip - Assigned Boosters & Cuts */}
              {isAdvertiser && receiptMode === 'booster' && hasTeammates && (
                <div className="col-span-2 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-medium text-zinc-500">
                      {isReceiptFa ? 'بوسترهای انجام‌دهنده و سهم' : 'Assigned Boosters & Cuts'}
                    </span>
                    <span className={cn('text-[9px] text-zinc-500 leading-normal hide-in-screenshot', isReceiptFa && 'font-farsi')}>
                      {isReceiptFa ? 'کلیک برای فیلتر در دفتر' : 'Click to filter in ledger'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {safeEntry.teammates.map((tm) => {
                      const cut = safeEntry.teammateCuts?.[tm] || (safeEntry.pot ? safeEntry.pot - safeEntry.income : safeEntry.income);
                      const isSlipCopied = copiedBoosterSlip === tm;
                      return (
                        <div key={tm} className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-md p-0.5 border border-zinc-200 dark:border-zinc-700">
                          <button
                            type="button"
                            onClick={() => {
                              onFilterTeammate?.(tm);
                              onClose?.();
                            }}
                            title={`Filter ledger for ${tm} (Payout: ${formatMoney(cut, entryCurrency, false, isReceiptFa)})`}
                            className="px-1.5 py-0.5 rounded text-xs font-medium text-zinc-800 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Users className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                            <span>{tm}</span>
                            <span className="text-zinc-500 dark:text-zinc-400 text-[10px] inline-flex items-center">(<MoneyDisplay amount={cut} currency={entryCurrency} />)</span>
                            {safeEntry.teammateNotes?.[tm] && (
                              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 italic max-w-[120px] truncate" title={safeEntry.teammateNotes[tm]}>
                                • {safeEntry.teammateNotes[tm]}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopySingleBoosterDiscord(e, tm)}
                            title={isReceiptFa ? `کپی فیش دیسکورد برای ${tm}` : `Copy Discord slip for ${tm}`}
                            className={cn(
                              "p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer",
                              isSlipCopied && "text-emerald-500 dark:text-emerald-400"
                            )}
                          >
                            {isSlipCopied ? <Check className="w-3 h-3 stroke-[3]" /> : <DiscordIcon className="w-3 h-3" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {safeEntry.notes && (
              <div className="pt-2.5 border-t border-zinc-200 dark:border-zinc-800/80">
                <span className="text-[10px] uppercase font-medium text-zinc-500 block mb-1">
                  {isReceiptFa ? 'توضیحات کار' : 'Work Description'}
                </span>
                <FormattedDescription text={safeEntry.notes} />
              </div>
            )}
          </div>

          {/* Proof Screenshot Preview */}
          {safeEntry.proofs && safeEntry.proofs.length > 0 && (
            <div className="pt-3.5 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <span className="text-[10px] uppercase font-medium text-zinc-500 block">
                {isReceiptFa ? `مدارک پیوست شده (${formatNumber(safeEntry.proofs.length)})` : `Attached Proofs (${safeEntry.proofs.length})`}
              </span>
              <div className="flex gap-2 flex-wrap">
                {safeEntry.proofs.map((p, idx) => (
                  <img
                    key={idx}
                    src={p.data}
                    alt="Proof"
                    onClick={() => onOpenLightbox?.(p.data, `Proof for ${safeEntry.title}`)}
                    className="h-16 w-24 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Discrete Verification Footer in Screenshot */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between text-[9px] font-medium text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 inline-block" />
              <span>
                {isAdvertiser
                  ? (receiptMode === 'client' ? 'CHECKPOINT CLIENT ORDER' : 'CHECKPOINT BOOSTER PAYOUT')
                  : 'CHECKPOINT PROOF OF WORK'}
              </span>
            </span>
            <span>{receiptId} • {timeStr || dateStr}</span>
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <div className="flex items-center justify-between w-full">
          {/* Ghost Icon-Only Screenshot Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScreenshotCopy}
            disabled={isCapturing}
            title={t('receipt.screenshotTitle', 'Copy receipt screenshot to clipboard (Press C or S)')}
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-lg transition-colors"
          >
            {isCapturing ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                {copiedState ? (
                  <motion.span
                    key="copied-camera"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="default-camera"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    className="flex items-center justify-center"
                  >
                    <Camera className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
                  </motion.span>
                )}
              </AnimatePresence>
            )}
          </Button>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyDiscord}
              className={cn(isRtl && 'font-farsi')}
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedDiscord ? (
                  <motion.span
                    key="copied-discord"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="default-discord"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    className="flex items-center justify-center"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span>{t('receipt.copyDiscord')}</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleCopyText}
              className={cn(isRtl && 'font-farsi')}
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedText ? (
                  <motion.span
                    key="copied-text"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="default-text"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    className="flex items-center justify-center"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span>{t('receipt.copyText')}</span>
            </Button>
          </div>
        </div>
      </DialogFooter>
    </Dialog>
  );
}

export default ReceiptModal;
