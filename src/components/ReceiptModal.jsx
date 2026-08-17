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
} from 'lucide-react';
import nodraLogo from '../../nodra-vault.svg';

export function ReceiptModal({
  isOpen,
  onClose,
  entry = null,
  globalCurrency = 'TOMAN',
  onOpenLightbox,
  onToast,
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

  const effectiveRate = Number(entry.exchangeRate) || 3200;

  const handleCopyText = () => {
    const text = `=== NODRA VAULT WORK RECEIPT ===
Receipt ID: ${receiptId}
Date: ${dateStr} ${timeStr}
Game: ${entry.game || 'World of Warcraft'}
Work Title: ${entry.title}
Job Source: ${entry.source || 'Direct Client'}
Exchange Rate: ${effectiveRate.toLocaleString()} Toman / 1,000 Gold
Status: ${entry.status || 'Paid'}
Amount: ${formattedIncome}
Notes: ${entry.notes || 'None'}
==============================`;

    navigator.clipboard.writeText(text);
    onToast?.('📋 Plain receipt copied to clipboard!');
  };

  const handleCopyDiscordMarkdown = () => {
    const md = `\`\`\`ini
[ NODRA VAULT - PROOF OF WORK RECEIPT ]
ID      = ${receiptId}
Date    = ${dateStr}
Game    = ${entry.game || 'World of Warcraft'}
Title   = ${entry.title}
Source  = ${entry.source || 'Direct Client'}
Rate    = ${effectiveRate.toLocaleString()} Toman / 1k Gold
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

      <DialogContent className="space-y-4">
        {/* Printable Receipt Card */}
        <div className="print-receipt-container rounded-xl bg-zinc-900/50 border border-zinc-800 p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <img
                src={nodraLogo}
                alt="Nodra Vault"
                className="w-6 h-6 object-contain"
              />
              <div>
                <h4 className="text-sm font-bold tracking-tight text-zinc-100">
                  Vault
                </h4>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Nodra Freelance Ledger
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-zinc-500">ID: {receiptId}</div>
              <div className="text-[11px] text-zinc-400 font-medium">{dateStr}</div>
            </div>
          </div>

          {/* Core Info */}
          <div className="space-y-3">
            <div>
              <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                Work Title
              </span>
              <span className="text-sm font-semibold text-zinc-100">
                {entry.title}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                  Game / Platform
                </span>
                <span className="text-zinc-200 flex items-center gap-1.5 mt-0.5">
                  <GameIcon game={entry.game} className="w-3.5 h-3.5" />
                  <span>{entry.game}</span>
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                  Job Source / Seller
                </span>
                <span className="text-zinc-300 font-mono mt-0.5 block">
                  {entry.source || 'Direct Client'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                  Status
                </span>
                <div className="mt-0.5">
                  <StatusBadge status={entry.status} />
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                  Amount Earned
                </span>
                <div className="text-sm font-bold text-zinc-100 font-mono">
                  <MoneyDisplay amount={entry.income} currency={entryCurrency} />
                </div>
              </div>

              <div className="col-span-2 pt-1 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="text-zinc-500 uppercase font-sans font-semibold">Locked Rate</span>
                <span>{effectiveRate.toLocaleString()} Toman / 1,000 Gold</span>
              </div>
            </div>

            {entry.notes && (
              <div className="pt-2 border-t border-zinc-800/80">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                  Client Notes
                </span>
                <p className="text-xs text-zinc-300 italic mt-0.5">
                  "{entry.notes}"
                </p>
              </div>
            )}
          </div>

          {/* Proof Screenshot Preview */}
          {entry.proofs && entry.proofs.length > 0 && (
            <div className="pt-3 border-t border-zinc-800 space-y-2">
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
                    className="h-14 w-20 rounded-lg object-cover border border-zinc-700 cursor-pointer hover:opacity-80"
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

