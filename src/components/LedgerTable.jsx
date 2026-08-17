import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatMoney } from '../lib/currencies';
import { StatusBadge, CategoryBadge, TagBadge } from './ui/Badge';
import {
  ExternalLink,
  Receipt,
  Edit3,
  Copy,
  Trash2,
  Image as ImageIcon,
  Clock,
  Sparkles,
} from 'lucide-react';

export function LedgerTable({
  entries = [],
  globalCurrency = 'USD',
  onEditEntry,
  onDuplicateEntry,
  onDeleteEntry,
  onFlipStatus,
  onOpenReceipt,
  onOpenLightbox,
  onOpenWorkModal,
}) {
  if (entries.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-12">
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl mb-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
            🎮
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No gaming work entries found</h3>
          <p className="text-xs text-zinc-400 max-w-md mb-6">
            Log your freelance jobs, bounties, coaching sessions, 3D assets, and paste screenshot proof.
          </p>
          <button
            type="button"
            onClick={() => onOpenWorkModal()}
            className="inline-flex items-center gap-2 bg-white text-black font-semibold text-xs px-4 py-2 rounded-lg hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Log Your First Job</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 pb-12">
      <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.015] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_32px_0_rgba(0,0,0,0.8)]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none">
              <th className="py-3 px-3.5 w-[125px]">DATE & TIME</th>
              <th className="py-3 px-3.5 w-[150px]">GAME / CLIENT</th>
              <th className="py-3 px-3.5">WORK TITLE & DELIVERABLE</th>
              <th className="py-3 px-3.5 w-[120px]">CATEGORY</th>
              <th className="py-3 px-3.5 w-[100px]">PROOF</th>
              <th className="py-3 px-3.5 w-[120px]">STATUS (FLIP)</th>
              <th className="py-3 px-3.5 w-[125px] text-right">INCOME</th>
              <th className="py-3 px-3.5 w-[130px] text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            <AnimatePresence mode="popLayout">
              {entries.map((entry, idx) => {
                const dt = new Date(entry.dateTime);
                const dateStr = !isNaN(dt)
                  ? dt.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: '2-digit',
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

                return (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                    className="group hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Date & Time */}
                    <td className="py-2.5 px-3.5 align-top whitespace-nowrap">
                      <div className="font-medium text-zinc-200">{dateStr}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">{timeStr}</div>
                    </td>

                    {/* Game & Platform */}
                    <td className="py-2.5 px-3.5 align-top">
                      <div className="font-semibold text-white truncate max-w-[140px]" title={entry.game}>
                        {entry.game || 'Untitled Game'}
                      </div>
                      {entry.platform && (
                        <div className="text-[10px] text-zinc-400 font-medium truncate max-w-[140px]">
                          {entry.platform}
                        </div>
                      )}
                    </td>

                    {/* Work Title, URL, Tags, Notes */}
                    <td className="py-2.5 px-3.5 align-top">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="font-medium text-zinc-100 group-hover:text-white transition-colors">
                          {entry.title}
                        </span>
                        {entry.deliverableUrl && (
                          <a
                            href={entry.deliverableUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-zinc-400 hover:text-blue-400 transition-colors p-0.5"
                            title={`Open deliverable: ${entry.deliverableUrl}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {entry.notes && (
                        <p className="text-[11px] text-zinc-400 line-clamp-1 mb-1 font-normal">
                          {entry.notes}
                        </p>
                      )}

                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {entry.tags.map((tag) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3.5 align-top">
                      <CategoryBadge category={entry.category} />
                    </td>

                    {/* Proof Thumbnails */}
                    <td className="py-2.5 px-3.5 align-top">
                      {entry.proofs && entry.proofs.length > 0 ? (
                        <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                          {entry.proofs.slice(0, 3).map((proof, pIdx) => (
                            <img
                              key={proof.id || pIdx}
                              src={proof.dataUrl}
                              alt={proof.name || 'Screenshot Proof'}
                              title={`${proof.name || 'Proof'} (Click to enlarge)`}
                              onClick={() =>
                                onOpenLightbox(proof.dataUrl, `${entry.game} - ${proof.name || 'Proof'}`)
                              }
                              className="inline-block h-7 w-7 rounded-md object-cover border border-white/20 hover:scale-110 hover:z-10 hover:border-white transition-all cursor-pointer shadow-md"
                            />
                          ))}
                          {entry.proofs.length > 3 && (
                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-white/[0.08] text-[9px] font-mono font-bold text-zinc-300 border border-white/20">
                              +{entry.proofs.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-mono">--</span>
                      )}
                    </td>

                    {/* Status Badge (1-Click Flip!) */}
                    <td className="py-2.5 px-3.5 align-top">
                      <StatusBadge
                        status={entry.status}
                        interactive={true}
                        onClick={() => onFlipStatus(entry.id, entry.status)}
                      />
                    </td>

                    {/* Income Amount & Hours */}
                    <td className="py-2.5 px-3.5 align-top text-right whitespace-nowrap">
                      <div className="font-bold text-white font-mono text-[13px]">
                        {formattedIncome}
                      </div>
                      {entry.hours ? (
                        <div className="text-[10px] text-zinc-400 font-medium flex items-center justify-end gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{entry.hours} hrs</span>
                        </div>
                      ) : null}
                    </td>

                    {/* Row Action Buttons */}
                    <td className="py-2.5 px-3.5 align-top text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {/* Receipt Slip Button */}
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(entry)}
                          title="Generate Proof Receipt Slip"
                          className="p-1 rounded-md text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => onEditEntry(entry)}
                          title="Edit Entry"
                          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Duplicate Button */}
                        <button
                          type="button"
                          onClick={() => onDuplicateEntry(entry.id)}
                          title="Duplicate Entry"
                          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => onDeleteEntry(entry.id)}
                          title="Delete Entry"
                          className="p-1 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
