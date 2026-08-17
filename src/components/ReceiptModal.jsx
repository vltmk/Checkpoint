import React from 'react';
import { formatMoney } from '../lib/currencies';
import { StatusBadge, CategoryBadge, TagBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import {
  Printer,
  Copy,
  Download,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Clock,
  Coins,
  CheckCircle2,
} from 'lucide-react';

export function ReceiptModal({
  isOpen,
  onClose,
  entry = null,
  globalCurrency = 'USD',
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

  const handleCopyText = () => {
    const text = `=== NODRA PAY PROOF-OF-WORK RECEIPT ===
Receipt ID: ${receiptId}
Date: ${dateStr} ${timeStr}
Game / Client: ${entry.game || 'N/A'}
Work Title: ${entry.title}
Category: ${entry.category || 'General'}
Status: ${entry.status || 'Paid'}
Total Amount: ${formattedIncome}
Hours Spent: ${entry.hours ? `${entry.hours} hrs` : 'N/A'}
Deliverable: ${entry.deliverableUrl || 'N/A'}
Notes: ${entry.notes || 'None'}
Attached Proofs: ${entry.proofs?.length || 0} screenshots
======================================`;

    navigator.clipboard.writeText(text);
    onToast?.('📋 Receipt slip copied to clipboard!');
  };

  const handleDownloadJson = () => {
    const receiptData = {
      receiptType: 'NodraPay_ProofOfWork',
      generatedAt: new Date().toISOString(),
      receiptId: receiptId,
      entry: entry,
    };
    const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt_${receiptId.toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast?.('Receipt JSON downloaded');
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-3xl">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <DialogTitle>Proof-of-Work Receipt Slip</DialogTitle>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> VERIFIED
          </span>
        </div>
      </DialogHeader>

      <DialogContent className="space-y-4">
        {/* Printable Receipt Container */}
        <div className="print-receipt-container bg-black border border-white/[0.1] rounded-xl p-5 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          {/* Slip Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.08] border border-white/20 text-white font-mono font-black text-sm">
                NP
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight uppercase">
                  Nodra Pay // Work Slip
                </h2>
                <div className="text-[11px] text-zinc-400 font-mono">
                  ID: <span className="text-zinc-200">{receiptId}</span>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs font-semibold text-zinc-200 flex items-center sm:justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>{dateStr}</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">{timeStr}</div>
            </div>
          </div>

          {/* Job Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-white/[0.08]">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Game / Client / Studio
              </div>
              <div className="text-sm font-bold text-white">{entry.game || 'Untitled Game'}</div>
              {entry.platform && (
                <div className="text-xs text-zinc-400 font-medium">{entry.platform}</div>
              )}
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Category & Status
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={entry.status} />
                <CategoryBadge category={entry.category} />
              </div>
            </div>
          </div>

          {/* Work Title & Deliverable Link */}
          <div className="py-4 border-b border-white/[0.08]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Task Deliverable Description
            </div>
            <h3 className="text-sm font-semibold text-white mb-2 leading-relaxed">
              {entry.title}
            </h3>

            {entry.deliverableUrl && (
              <div className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline mb-2">
                <ExternalLink className="w-3.5 h-3.5" />
                <a
                  href={entry.deliverableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate"
                >
                  {entry.deliverableUrl}
                </a>
              </div>
            )}

            {entry.notes && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {entry.notes}
              </div>
            )}

            {entry.tags && entry.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-3">
                {entry.tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
              </div>
            )}
          </div>

          {/* Attached Screenshot Proof Section */}
          {entry.proofs && entry.proofs.length > 0 && (
            <div className="py-4 border-b border-white/[0.08]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Attached Proof of Completion ({entry.proofs.length})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {entry.proofs.map((proof, idx) => (
                  <div
                    key={proof.id || idx}
                    onClick={() =>
                      onOpenLightbox?.(
                        proof.dataUrl,
                        `${entry.game} - ${proof.name || 'Proof'}`
                      )
                    }
                    className="group relative rounded-lg overflow-hidden border border-white/20 bg-zinc-900 cursor-pointer shadow"
                  >
                    <img
                      src={proof.dataUrl}
                      alt={proof.name || 'Proof'}
                      className="h-28 w-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/80 px-2 py-1 text-[10px] font-mono text-zinc-300 truncate">
                      {proof.name || 'Screenshot'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial Slip Bottom */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              {entry.hours && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>
                    Logged: <strong className="text-zinc-200">{entry.hours} hrs</strong>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  Currency: <strong className="text-zinc-200">{entryCurrency}</strong>
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Total Settlement Amount
              </span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                {formattedIncome}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogFooter className="no-print">
        <Button variant="ghost" size="sm" onClick={handleCopyText} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" />
          <span>Copy Slip</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownloadJson} className="gap-1.5">
          <Download className="w-3.5 h-3.5" />
          <span>JSON</span>
        </Button>
        <Button variant="primary" size="sm" onClick={handlePrint} className="gap-1.5">
          <Printer className="w-3.5 h-3.5" />
          <span>Print / PDF</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
