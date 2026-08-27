import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import checkpointLogo from '../assets/checkpoint.svg';
import { copyTextNative, copyImageNative, downloadImageBlob } from '../lib/desktop';
import { toBlob } from 'html-to-image';
import { incrementLocalReceiptCount } from '../lib/telemetry';
import { useLanguage, formatShamsiDate, formatShamsiDateTime } from '../lib/i18n';
import { cn } from '../lib/utils';

export function ReceiptModal({
  isOpen,
  onClose,
  entry = null,
  globalCurrency = 'TOMAN',
  onOpenLightbox,
  onFilterTeammate,
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();
  const receiptCardRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copiedState, setCopiedState] = useState(false);
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [receiptLang, setReceiptLang] = useState(language);

  useEffect(() => {
    setReceiptLang(language);
  }, [language, isOpen]);

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
    const text = isReceiptFa
      ? `=== رسید کار چک‌پوینت ===
شناسه رسید: ${receiptId}
تاریخ: ${dateStr} ${timeStr}
بازی: ${safeEntry.game || 'World of Warcraft'}
عنوان کار: ${safeEntry.title || 'کار ثبت‌شده'}
مشتری / سورس: ${safeEntry.source || 'مشتری مستقیم'}${
          isTeamWork
            ? `\nپات تیمی: ${formattedPot} (${formatNumber(totalShares)} سهم)\nسهم شما: ${formattedIncome}\nسهم هم‌تیمی‌ها: ${teamCutsBreakdown}`
            : `\nمبلغ درآمد: ${formattedIncome}`
        }
نرخ تبدیل: ${formatMoney(effectiveRate, 'TOMAN', false, true)} / ${rateUnitText}
وضعیت: ${t(`status.${safeEntry.status || 'Paid'}`)}
یادداشت: ${safeEntry.notes || 'ندارد'}
==============================`
      : `=== CHECKPOINT WORK RECEIPT ===
Receipt ID: ${receiptId}
Date: ${dateStr} ${timeStr}
Game: ${safeEntry.game || 'World of Warcraft'}
Work Title: ${safeEntry.title || 'Work Record'}
Job Source: ${safeEntry.source || 'Direct Client'}${
          isTeamWork
            ? `\nPot: ${formattedPot} (${totalShares} Shares)\nYour Share: ${formattedIncome}\nTeam Cuts: ${teamCutsBreakdown}`
            : `\nAmount: ${formattedIncome}`
        }
Exchange Rate: ${effectiveRate.toLocaleString()} Toman / ${rateUnitText}
Status: ${safeEntry.status || 'Paid'}
Notes: ${safeEntry.notes || 'None'}
==============================`;

    await copyTextNative(text);
    incrementLocalReceiptCount();
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1800);
  }, [
    entry,
    isReceiptFa,
    receiptId,
    dateStr,
    timeStr,
    safeEntry,
    isTeamWork,
    formattedPot,
    totalShares,
    formattedIncome,
    teamCutsBreakdown,
    effectiveRate,
    rateUnitText,
    t,
    formatNumber,
  ]);

  // Copy Discord Markdown
  const handleCopyDiscordMarkdown = useCallback(async () => {
    if (!entry) return;
    const md = isReceiptFa
      ? `\`\`\`ini
[ رسید اثبات کار چک‌پوینت ]
شناسه      = ${receiptId}
تاریخ      = ${dateStr}
بازی       = ${safeEntry.game || 'World of Warcraft'}
عنوان      = ${safeEntry.title || 'کار ثبت‌شده'}
سورس       = ${safeEntry.source || 'مشتری مستقیم'}${
          isTeamWork
            ? `\nپات تیمی   = ${formattedPot} (${formatNumber(totalShares)} سهم)\nسهم شما    = ${formattedIncome}\nسهم تیم    = ${teamCutsBreakdown}`
            : `\nمبلغ       = ${formattedIncome}`
        }
نرخ تبدیل  = ${formatMoney(effectiveRate, 'TOMAN', false, true)} / ${rateDiscordText}
وضعیت      = ${t(`status.${safeEntry.status || 'Paid'}`)}
یادداشت    = ${safeEntry.notes || 'ندارد'}
\`\`\``
      : `\`\`\`ini
[ CHECKPOINT - PROOF OF WORK RECEIPT ]
ID         = ${receiptId}
Date       = ${dateStr}
Game       = ${safeEntry.game || 'World of Warcraft'}
Title      = ${safeEntry.title || 'Work Record'}
Source     = ${safeEntry.source || 'Direct Client'}${
          isTeamWork
            ? `\nPot        = ${formattedPot} (${totalShares} Shares)\nYour Share = ${formattedIncome}\nTeam Cuts  = ${teamCutsBreakdown}`
            : `\nAmount     = ${formattedIncome}`
        }
Rate       = ${effectiveRate.toLocaleString()} Toman / ${rateDiscordText}
Status     = ${safeEntry.status || 'Paid'}
Notes      = ${safeEntry.notes || 'None'}
\`\`\``;

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
  ]);

  // Screenshot & Copy Image to Clipboard
  const handleScreenshotCopy = useCallback(async () => {
    if (!receiptCardRef.current || isCapturing || !entry) return;
    try {
      setIsCapturing(true);

      // Ensure all custom fonts (IRANYekanRd, IoskeleyMono, Inter) are loaded
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      await new Promise((resolve) => setTimeout(resolve, 60));

      const node = receiptCardRef.current;
      const blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: '#09090b',
        cacheBust: true,
        style: {
          padding: '24px',
          backgroundColor: '#09090b',
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
        <div className="flex items-center justify-between w-full pr-6">
          <div className="flex items-center gap-2">
            <DialogTitle className={cn(isRtl && 'font-farsi')}>{t('receipt.title')}</DialogTitle>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> VERIFIED
            </span>
          </div>

          {/* Receipt Language Switcher */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-md text-[10px]">
            <button
              type="button"
              onClick={() => setReceiptLang('fa')}
              className={cn(
                'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                receiptLang === 'fa'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
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
                  ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              EN
            </button>
          </div>
        </div>
      </DialogHeader>

      <DialogContent className="p-6 space-y-5">
        {/* Flat Subtle Receipt Card Container (No harsh drop shadows) */}
        <div
          ref={receiptCardRef}
          dir={isReceiptFa ? 'rtl' : 'ltr'}
          className={cn(
            'print-receipt-container rounded-xl bg-zinc-900/40 border border-zinc-800/80 p-5 sm:p-6 space-y-5 relative',
            isReceiptFa && 'font-farsi'
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <img
                src={checkpointLogo}
                alt="CHECKPOINT"
                className="w-7 h-7 object-contain"
              />
              <div>
                <h4 className="text-sm font-bold tracking-wider text-zinc-100 uppercase">
                  CHECKPOINT
                </h4>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {isReceiptFa ? 'دفتر ثبت درآمد دیجیتال و گیمینگ' : 'Freelance & Gaming Ledger'}
                </p>
              </div>
            </div>
            <div className={cn(isReceiptFa ? 'text-left' : 'text-right')}>
              <div className="text-[10px] font-mono text-zinc-500">ID: {receiptId}</div>
              <div className="text-[11px] text-zinc-400 font-medium">{dateStr}</div>
            </div>
          </div>

          {/* Core Info */}
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">
                {isReceiptFa ? 'عنوان کار' : 'Work Title'}
              </span>
              <span className="text-sm font-semibold text-zinc-100 block">
                {safeEntry.title || (isReceiptFa ? 'بدون عنوان' : 'Untitled Work')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  {isReceiptFa ? 'بازی / پلتفرم' : 'Game / Platform'}
                </span>
                <span className="text-zinc-200 flex items-center gap-1.5 mt-0.5 font-medium">
                  <GameIcon game={safeEntry.game} className="w-3.5 h-3.5" />
                  <span>{safeEntry.game || 'World of Warcraft'}</span>
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  {isReceiptFa ? 'سورس / سفارش‌دهنده' : 'Job Source / Seller'}
                </span>
                <span className="text-zinc-300 font-mono mt-0.5 block">
                  {safeEntry.source || (isReceiptFa ? 'مشتری مستقیم' : 'Direct Client')}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  {isReceiptFa ? 'وضعیت' : 'Status'}
                </span>
                <div className="mt-1">
                  <StatusBadge status={safeEntry.status || 'Paid'} />
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  {isTeamWork ? (isReceiptFa ? 'سهم شما' : 'Your Share') : (isReceiptFa ? 'مبلغ درآمد' : 'Amount Earned')}
                </span>
                <div className="text-sm font-bold text-zinc-100 font-mono mt-0.5">
                  <MoneyDisplay amount={safeEntry.income || 0} currency={entryCurrency} />
                </div>
              </div>

              {isTeamWork && (
                <div className="col-span-2 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase font-semibold text-zinc-500">
                    {isReceiptFa ? `پات تیمی (${formatNumber(totalShares)} سهم)` : `Pot (${totalShares} Shares)`}
                  </span>
                  <strong className="font-mono text-amber-300 font-bold">
                    <MoneyDisplay amount={totalPot} currency={entryCurrency} />
                  </strong>
                </div>
              )}

              <div className="col-span-2 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-xs">
                <span className="text-[10px] uppercase font-semibold text-zinc-500">
                  {isReceiptFa ? 'نرخ تبدیل' : 'Conversion Rate'}
                </span>
                <span className="text-zinc-300 font-medium">
                  {formatMoney(effectiveRate, 'TOMAN', false, isReceiptFa)} / {rateUnitText}
                </span>
              </div>

              {/* Interactive Teammate Badges with Individual Cuts */}
              {hasTeammates && (
                <div className="col-span-2 pt-2.5 border-t border-zinc-800/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-zinc-500">
                      {isReceiptFa ? 'هم‌تیمی‌ها و سهم' : 'Teammates & Cuts'}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono hide-in-screenshot">
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
                          className="px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <Users className="w-3 h-3 text-zinc-400" />
                          <span>{tm}</span>
                          <span className="text-zinc-400 text-[10px] inline-flex items-baseline">(<MoneyDisplay amount={cut} currency={entryCurrency} />)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {safeEntry.notes && (
              <div className="pt-2.5 border-t border-zinc-800/80">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  {isReceiptFa ? 'یادداشت' : 'Client Notes'}
                </span>
                <p className="text-xs text-zinc-300 italic">
                  "{safeEntry.notes}"
                </p>
              </div>
            )}
          </div>

          {/* Proof Screenshot Preview */}
          {safeEntry.proofs && safeEntry.proofs.length > 0 && (
            <div className="pt-3.5 border-t border-zinc-800 space-y-2">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                {isReceiptFa ? `مدارک پیوست شده (${formatNumber(safeEntry.proofs.length)})` : `Attached Proofs (${safeEntry.proofs.length})`}
              </span>
              <div className="flex gap-2 flex-wrap">
                {safeEntry.proofs.map((p, idx) => (
                  <img
                    key={idx}
                    src={p.data}
                    alt="Proof"
                    onClick={() => onOpenLightbox?.(p.data, `Proof for ${safeEntry.title}`)}
                    className="h-16 w-24 rounded-lg object-cover border border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Discrete Verification Footer in Screenshot */}
          <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[9px] font-mono text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 inline-block" />
              <span>CHECKPOINT PROOF OF WORK</span>
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
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded-lg transition-colors"
          >
            {isCapturing ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                {copiedState ? (
                  <motion.span
                    key="copied-camera"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="default-camera"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
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
              onClick={handleCopyDiscordMarkdown}
              className={cn(isRtl && 'font-farsi')}
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedDiscord ? (
                  <motion.span
                    key="copied-discord"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="default-discord"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
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
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="default-text"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
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
