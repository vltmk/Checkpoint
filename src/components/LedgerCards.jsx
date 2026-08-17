import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatMoney, convertToFiat } from '../lib/currencies';
import { StatusBadge } from './ui/Badge';
import {
  Receipt,
  Edit3,
  Copy,
  Trash2,
  Clock,
  Sparkles,
} from 'lucide-react';

export function LedgerCards({
  entries = [],
  globalCurrency = 'USD',
  goldRate = 0.035,
  goldCurrency = 'USD',
  isConversionEnabled = true,
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
          <h3 className="text-base font-semibold text-white mb-1">No work entries found</h3>
          <p className="text-xs text-zinc-400 max-w-md mb-6">
            Log your freelance jobs, boosts, GDKP runs, and paste screenshot proof.
          </p>
          <button
            type="button"
            onClick={() => onOpenWorkModal?.()}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <AnimatePresence mode="popLayout">
          {entries.map((entry, idx) => {
            const dt = new Date(entry.dateTime);
            const dateStr = !isNaN(dt)
              ? dt.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '--';

            const entryCurrency =
              entry.currency && entry.currency !== 'DEFAULT'
                ? entry.currency
                : globalCurrency;

            const formattedIncome = formatMoney(entry.income, entryCurrency);

            const isWoWGold = entryCurrency === 'WOW_GOLD';
            const showConverted =
              isWoWGold &&
              isConversionEnabled &&
              Number(goldRate) > 0;

            const convertedFiatVal = showConverted
              ? convertToFiat(entry.income, goldRate, goldCurrency)
              : 0;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                className="group relative bg-white/[0.025] hover:bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] hover:border-white/[0.14] rounded-xl p-4 flex flex-col justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.6)] transition-all duration-200"
              >
                {/* Card Top: Game, Date, and Income */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        {entry.game || 'World of Warcraft'}
                      </span>
                      <div className="text-[10px] text-zinc-400 font-mono">{dateStr}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white font-mono">{formattedIncome}</div>
                      {showConverted && (
                        <div className="text-[10px] text-amber-400/90 font-mono font-medium">
                          ≈ {formatMoney(convertedFiatVal, goldCurrency)}
                        </div>
                      )}
                      {entry.hours && (
                        <div className="text-[10px] text-zinc-400 font-medium flex items-center justify-end gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{entry.hours} hrs</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-white transition-colors leading-snug">
                      {entry.title}
                    </h4>
                  </div>

                  {/* Notes snippet */}
                  {entry.notes && (
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
                      {entry.notes}
                    </p>
                  )}

                  {/* Attached Proof Thumbnails */}
                  {entry.proofs && entry.proofs.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-3 overflow-x-auto py-1">
                      {entry.proofs.map((proof, pIdx) => (
                        <img
                          key={proof.id || pIdx}
                          src={proof.dataUrl}
                          alt={proof.name || 'Screenshot Proof'}
                          title={`${proof.name || 'Proof'} (Click to enlarge)`}
                          onClick={() =>
                            onOpenLightbox(
                              proof.dataUrl,
                              `${entry.game} - ${proof.name || 'Proof'}`
                            )
                          }
                          className="h-10 w-14 rounded-md object-cover border border-white/20 hover:border-white hover:scale-105 transition-all cursor-pointer shrink-0 shadow"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Status & Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.06] mt-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge
                      status={entry.status}
                      interactive={true}
                      onClick={() => onFlipStatus(entry.id, entry.status)}
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenReceipt(entry)}
                      title="Receipt Slip"
                      className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditEntry(entry)}
                      title="Edit"
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateEntry(entry.id)}
                      title="Duplicate"
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      title="Delete"
                      className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default LedgerCards;
