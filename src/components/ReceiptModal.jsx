import React from 'react';
import { formatMoney } from '../lib/currencies';
import { StatusBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { GameIcon } from './ui/GameIcon';
import { MoneyDisplay } from './ui/MoneyDisplay';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import {
  Printer,
  Copy,
  Download,
  ShieldCheck,
  Calendar,
  Clock,
  Coins,
  MessageSquare,
  Users,
} from 'lucide-react';
import nodraLogo from '../../nodra-vault.svg';

export function ReceiptModal({
  isOpen,
  onClose,
  entry = null,
  globalCurrency = 'TOMAN',
  onOpenLightbox,
  onToast,
  onFilterTeammate,
}) {
  if (!entry) return null;

  const dt = new Date(entry.dateTime);
  const dateStr = !isNaN(dt)
    ? dt.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '--';
  const timeStr = !isNaN(dt)
    ? dt.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const entryCurrency =
    entry.currency && entry.currency !== 'DEFAULT'
      ? entry.currency
      : globalCurrency;

  const formattedIncome = formatMoney(entry.income, entryCurrency);
  const receiptId = (entry.id || 'JOB').toUpperCase();

  const handlePrint = () => {
    window.print();
  };

  const isClassic = entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic';
  const effectiveRate = Number(entry.exchangeRate) || (isClassic ? 7000 : 3200);
  const rateUnitText = isClassic ? '1 Gold' : '1,000 Gold';
  const rateDiscordText = isClassic ? '1 Gold' : '1k Gold';
  const hasTeammates = Array.isArray(entry.teammates) && entry.teammates.length > 0;
  const teammatesStr = hasTeammates ? entry.teammates.join(', ') : '';

  const handleCopyText = () => {
    const text = `=== CHECKPOINT WORK RECEIPT ===
Receipt ID: ${receiptId}
Date: ${dateStr} ${timeStr}
Game: ${entry.game || 'World of Warcraft'}
Work Title: ${entry.title}
Job Source: ${entry.source || 'Direct Client'}${hasTeammates ? `\nTeammates: ${teammatesStr}` : ''}
Exchange Rate: ${effectiveRate.toLocaleString()} Toman / ${rateUnitText}
Status: ${entry.status || 'Paid'}
Amount: ${formattedIncome}
Notes: ${entry.notes || 'None'}
==============================`;

    navigator.clipboard.writeText(text);
    onToast?.('📋 Plain receipt copied to clipboard!');
  };

  const handleCopyDiscordMarkdown = () => {
    const md = `\`\`\`ini
[ CHECKPOINT - PROOF OF WORK RECEIPT ]
ID      = ${receiptId}
Date    = ${dateStr}
Game    = ${entry.game || 'World of Warcraft'}
Title   = ${entry.title}
Source  = ${entry.source || 'Direct Client'}${hasTeammates ? `\nTeam    = ${teammatesStr}` : ''}
Rate    = ${effectiveRate.toLocaleString()} Toman / ${rateDiscordText}
Status  = ${entry.status || 'Paid'}
Amount  = ${formattedIncome}
Notes   = ${entry.notes || 'None'}
\`\`\``;

    navigator.clipboard.writeText(md);
    onToast?.('🎮 Discord markdown copied to clipboard!');
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-lg">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <DialogTitle>Proof of Work Receipt</DialogTitle>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> VERIFIED
          </span>
        </div>
      </DialogHeader>

      <DialogContent className="p-6 space-y-5">
        {/* Printable Receipt Card with Generous Spacing */}
        <div className="print-receipt-container rounded-2xl bg-zinc-900/40 border border-zinc-800/90 p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <img
                src={nodraLogo}
                alt="Checkpoint"
                className="w-7 h-7 object-contain"
              />
              <div>
                <h4 className="text-sm font-bold tracking-tight text-zinc-100">
                  Checkpoint
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
                {entry.title}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Game / Platform
                </span>
                <span className="text-zinc-200 flex items-center gap-1.5 mt-0.5 font-medium">
                  <GameIcon game={entry.game} className="w-3.5 h-3.5" />
                  <span>{entry.game}</span>
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Job Source / Seller
                </span>
                <span className="text-zinc-300 font-mono mt-0.5 block">
                  {entry.source || 'Direct Client'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Status
                </span>
                <div className="mt-1">
                  <StatusBadge status={entry.status} />
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Amount Earned
                </span>
                <div className="text-sm font-bold text-zinc-100 font-mono mt-0.5">
                  <MoneyDisplay amount={entry.income} currency={entryCurrency} />
                </div>
              </div>

              <div className="col-span-2 pt-2 border-t border-zinc-800/70 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="text-zinc-500 uppercase font-sans font-semibold">Locked Rate</span>
                <span>{effectiveRate.toLocaleString()} Toman / {rateUnitText}</span>
              </div>

              {/* Interactive Teammate Badges with Click-to-Filter */}
              {hasTeammates && (
                <div className="col-span-2 pt-2.5 border-t border-zinc-800/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-zinc-500">
                      Teammates / Crew
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      Click to filter in ledger
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {entry.teammates.map((tm) => (
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

            {entry.notes && (
              <div className="pt-2.5 border-t border-zinc-800/80">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                  Client Notes
                </span>
                <p className="text-xs text-zinc-300 italic">
                  "{entry.notes}"
                </p>
              </div>
            )}
          </div>

          {/* Proof Screenshot Preview */}
          {entry.proofs && entry.proofs.length > 0 && (
            <div className="pt-3.5 border-t border-zinc-800 space-y-2">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                Attached Proofs ({entry.proofs.length})
              </span>
              <div className="flex gap-2 flex-wrap">
                {entry.proofs.map((p, idx) => (
                  <img
                    key={idx}
                    src={p.data}
                    alt="Proof"
                    onClick={() => onOpenLightbox?.(p.data, `Proof for ${entry.title}`)}
                    className="h-16 w-24 rounded-lg object-cover border border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <div className="flex items-center justify-between w-full flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </Button>

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
