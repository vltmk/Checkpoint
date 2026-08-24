import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import nodraLogo from '../../nodra-vault.svg';
import { copyTextNative, copyImageNative, downloadImageBlob } from '../lib/desktop';
import { toBlob } from 'html-to-image';

export function ReceiptModal({
  isOpen,
  onClose,
  entry = null,
  globalCurrency = 'TOMAN',
  onOpenLightbox,
  onToast,
  onFilterTeammate,
}) {
  const receiptCardRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copiedState, setCopiedState] = useState(false);

  // Safe fallback entry object to prevent runtime errors
  const safeEntry = entry || {};
  const dt = safeEntry.dateTime ? new Date(safeEntry.dateTime) : null;
  const dateStr = dt && !isNaN(dt.getTime())
    ? dt.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '--';
  const timeStr = dt && !isNaN(dt.getTime())
    ? dt.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const entryCurrency =
    safeEntry.currency && safeEntry.currency !== 'DEFAULT'
      ? safeEntry.currency
      : globalCurrency;

  const formattedIncome = formatMoney(safeEntry.income || 0, entryCurrency);
  const receiptId = (safeEntry.id || 'JOB').toUpperCase();

  const isClassic = safeEntry.rateUnit === '1' || safeEntry.game === 'World of Warcraft Classic';
  const effectiveRate = Number(safeEntry.exchangeRate) || (isClassic ? 7000 : 3200);
  const rateUnitText = isClassic ? '1 Gold' : '1,000 Gold';
  const rateDiscordText = isClassic ? '1 Gold' : '1k Gold';
  const hasTeammates = Array.isArray(safeEntry.teammates) && safeEntry.teammates.length > 0;
  const teammatesStr = hasTeammates ? safeEntry.teammates.join(', ') : '';

  // Copy Plain Text Receipt
  const handleCopyText = useCallback(async () => {
    if (!entry) return;
    const text = `=== CHECKPOINT WORK RECEIPT ===
Receipt ID: ${receiptId}
Date: ${dateStr} ${timeStr}
Game: ${safeEntry.game || 'World of Warcraft'}
Work Title: ${safeEntry.title || 'Work Record'}
Job Source: ${safeEntry.source || 'Direct Client'}${hasTeammates ? `\nTeammates: ${teammatesStr}` : ''}
Exchange Rate: ${effectiveRate.toLocaleString()} Toman / ${rateUnitText}
Status: ${safeEntry.status || 'Paid'}
Amount: ${formattedIncome}
Notes: ${safeEntry.notes || 'None'}
==============================`;

    await copyTextNative(text);
    onToast?.('📋 Plain receipt copied to clipboard!');
  }, [entry, receiptId, dateStr, timeStr, safeEntry, hasTeammates, teammatesStr, effectiveRate, rateUnitText, formattedIncome, onToast]);

  // Copy Discord Markdown
  const handleCopyDiscordMarkdown = useCallback(async () => {
    if (!entry) return;
    const md = `\`\`\`ini
[ CHECKPOINT - PROOF OF WORK RECEIPT ]
ID      = ${receiptId}
Date    = ${dateStr}
Game    = ${safeEntry.game || 'World of Warcraft'}
Title   = ${safeEntry.title || 'Work Record'}
Source  = ${safeEntry.source || 'Direct Client'}${hasTeammates ? `\nTeam    = ${teammatesStr}` : ''}
Rate    = ${effectiveRate.toLocaleString()} Toman / ${rateDiscordText}
Status  = ${safeEntry.status || 'Paid'}
Amount  = ${formattedIncome}
Notes   = ${safeEntry.notes || 'None'}
\`\`\``;

    await copyTextNative(md);
    onToast?.('🎮 Discord markdown copied to clipboard!');
  }, [entry, receiptId, dateStr, safeEntry, hasTeammates, teammatesStr, effectiveRate, rateDiscordText, formattedIncome, onToast]);

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
      if (copied) {
        setCopiedState(true);
        setTimeout(() => setCopiedState(false), 2000);
      } else {
        // Web fallback download if clipboard write fails
        downloadImageBlob(blob, `checkpoint_receipt_${receiptId.toLowerCase()}.png`);
      }
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      onToast?.('Failed to capture receipt screenshot', { variant: 'destructive' });
    } finally {
      setIsCapturing(false);
    }
  }, [receiptCardRef, isCapturing, entry, receiptId, onToast]);

  // Keyboard Shortcuts (C or S to take screenshot copy)
  useEffect(() => {
    if (!isOpen || !entry) return;

    const handleKeyDown = (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      if ((e.key === 'c' || e.key === 'C' || e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
        <div className="flex items-center gap-2">
          <DialogTitle>Proof of Work Receipt</DialogTitle>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> VERIFIED
          </span>
        </div>
      </DialogHeader>

      <DialogContent className="p-6 space-y-5">
        {/* Flat Subtle Receipt Card Container (No harsh drop shadows) */}
        <div
          ref={receiptCardRef}
          className="print-receipt-container rounded-xl bg-zinc-900/40 border border-zinc-800/80 p-5 sm:p-6 space-y-5 relative"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <img
                src={nodraLogo}
                alt="CHECKPOINT"
                className="w-7 h-7 object-contain"
              />
              <div>
                <h4 className="text-sm font-bold tracking-wider text-zinc-100 uppercase">
                  CHECKPOINT
                </h4>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Freelance & Gaming Ledger
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-zinc-500">ID: {receiptId}</div>
              <div className="text-[11px] text-zinc-400 font-medium">{dateStr}</div>
            </div>
          </div>

          {/* Core Info */}
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">
                Work Title
              </span>
              <span className="text-sm font-semibold text-zinc-100 block">
                {safeEntry.title || 'Untitled Work'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Game / Platform
                </span>
                <span className="text-zinc-200 flex items-center gap-1.5 mt-0.5 font-medium">
                  <GameIcon game={safeEntry.game} className="w-3.5 h-3.5" />
                  <span>{safeEntry.game || 'World of Warcraft'}</span>
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Job Source / Seller
                </span>
                <span className="text-zinc-300 font-mono mt-0.5 block">
                  {safeEntry.source || 'Direct Client'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Status
                </span>
                <div className="mt-1">
                  <StatusBadge status={safeEntry.status || 'Paid'} />
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Amount Earned
                </span>
                <div className="text-sm font-bold text-zinc-100 font-mono mt-0.5">
                  <MoneyDisplay amount={safeEntry.income || 0} currency={entryCurrency} />
                </div>
              </div>

              <div className="col-span-2 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-xs">
                <span className="text-[10px] uppercase font-semibold text-zinc-500">
                  Conversion Rate
                </span>
                <span className="text-zinc-300 font-medium">
                  {effectiveRate.toLocaleString()} Toman / {rateUnitText}
                </span>
              </div>

              {/* Interactive Teammate Badges with Click-to-Filter */}
              {hasTeammates && (
                <div className="col-span-2 pt-2.5 border-t border-zinc-800/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-zinc-500">
                      Teammates / Crew
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono hide-in-screenshot">
                      Click to filter in ledger
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {safeEntry.teammates.map((tm) => (
                      <button
                        key={tm}
                        type="button"
                        onClick={() => {
                          onFilterTeammate?.(tm);
                          onClose?.();
                        }}
                        title={`Filter ledger for ${tm}`}
                        className="px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                      >
                        <Users className="w-3 h-3 text-zinc-400" />
                        <span>{tm}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {safeEntry.notes && (
              <div className="pt-2.5 border-t border-zinc-800/80">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Client Notes
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
                Attached Proofs ({safeEntry.proofs.length})
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
          {/* Ghost Icon-Only Screenshot Button (No container, no border, highlights on hover) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScreenshotCopy}
            disabled={isCapturing}
            title="Copy receipt screenshot to clipboard (Press C or S)"
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded-lg transition-colors"
          >
            {isCapturing ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
            ) : copiedState ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Camera className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
            )}
          </Button>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopyDiscordMarkdown}>
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Discord MD</span>
            </Button>

            <Button variant="primary" size="sm" onClick={handleCopyText}>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Text</span>
            </Button>
          </div>
        </div>
      </DialogFooter>
    </Dialog>
  );
}

export default ReceiptModal;
