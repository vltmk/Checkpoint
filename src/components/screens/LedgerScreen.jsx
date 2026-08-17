import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatMoney, convertToFiat, STATUS_CONFIG } from '../../lib/currencies';
import {
  Search,
  X,
  Filter,
  MoreVertical,
  Receipt,
  Edit2,
  Copy,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

const GAME_EMOJIS = {
  'World of Warcraft': '⚔️',
  'WoW Classic': '🛡️',
  'Cataclysm Classic': '🐉',
  'Season of Discovery': '✨',
  'Mythic+ Boosting': '🗝️',
  'Raid Leading': '👑',
  'Addon Development': '💻',
  'Coaching': '🎯',
  'Arena & PvP': '⚔️',
  'Gold Farming': '🪙',
};

export function LedgerScreen({
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedEntryForActions, setSelectedEntryForActions] = useState(null);

  const displayCurrency = isConversionEnabled ? (goldCurrency || globalCurrency) : globalCurrency;

  const filterTabs = [
    { id: 'ALL', label: 'All' },
    { id: 'Paid', label: 'Paid' },
    { id: 'Pending', label: 'Pending' },
    { id: 'Working', label: 'Working' },
    { id: 'PROOF', label: 'With Proof' },
  ];

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchGame = (e.game || '').toLowerCase().includes(q);
        const matchNotes = (e.notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchGame && !matchNotes) return false;
      }

      // Status / Proof filter
      if (statusFilter === 'PROOF') {
        return e.proofs && e.proofs.length > 0;
      } else if (statusFilter !== 'ALL') {
        return e.status === statusFilter;
      }

      return true;
    });
  }, [entries, searchQuery, statusFilter]);

  // Group by relative date (Today, Yesterday, This Week, Earlier)
  const groupedEntries = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Earlier: [],
    };

    filteredEntries.forEach((e) => {
      const entryDate = new Date(e.dateTime);
      if (isNaN(entryDate)) {
        groups.Earlier.push(e);
        return;
      }

      const itemDate = new Date(entryDate);
      itemDate.setHours(0, 0, 0, 0);

      if (itemDate.getTime() === today.getTime()) {
        groups.Today.push(e);
      } else if (itemDate.getTime() === yesterday.getTime()) {
        groups.Yesterday.push(e);
      } else if (itemDate.getTime() >= thisWeek.getTime()) {
        groups['This Week'].push(e);
      } else {
        groups.Earlier.push(e);
      }
    });

    return groups;
  }, [filteredEntries]);

  return (
    <div className="flex-1 px-4 py-4 space-y-4 pb-28">
      {/* 1. STICKY SEARCH & FILTER BAR */}
      <div className="space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobs, games, notes..."
            className="w-full h-10 pl-10 pr-9 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/25 focus:bg-white/[0.08] transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {filterTabs.map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-white text-black shadow-[0_2px_8px_rgba(255,255,255,0.25)]'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. GROUPED JOB CARDS LIST */}
      {filteredEntries.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400">
            <Filter className="w-5 h-5" />
          </div>
          <div className="text-xs font-semibold text-white">No entries match your search</div>
          <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
            Try adjusting your search terms or filter chips.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedEntries).map(([groupName, items]) => {
            if (items.length === 0) return null;

            return (
              <div key={groupName} className="space-y-2">
                {/* Group Heading */}
                <div className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase px-1 flex items-center justify-between">
                  <span>{groupName}</span>
                  <span className="font-mono text-[10px] text-zinc-400 font-normal">
                    {items.length} job{items.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Job Cards */}
                <div className="space-y-2.5">
                  {items.map((e) => {
                    const statusCfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.Paid;
                    const hasProofs = e.proofs && e.proofs.length > 0;
                    const isGold = e.currency === 'WOW_GOLD';

                    let fiatConverted = null;
                    if (isGold && isConversionEnabled && Number(goldRate) > 0) {
                      fiatConverted = convertToFiat(e.income, goldRate, displayCurrency);
                    }

                    const dt = new Date(e.dateTime);
                    const timeStr = !isNaN(dt)
                      ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <div
                        key={e.id}
                        onClick={() => setSelectedEntryForActions(e)}
                        className="glass-card-vision p-4 flex flex-col gap-2.5 cursor-pointer active:scale-[0.99] transition-transform group"
                      >
                        {/* Top: Game Emoji, Tag & Time */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{GAME_EMOJIS[e.game] || '🎮'}</span>
                            <span className="text-[11px] font-semibold text-zinc-300">
                              {e.game || 'Freelance'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                            <span>{timeStr}</span>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setSelectedEntryForActions(e);
                              }}
                              className="p-1 rounded-md text-zinc-400 hover:text-white"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Middle: Title & Notes */}
                        <div className="space-y-0.5">
                          <div className="text-sm font-bold text-white tracking-tight leading-snug">
                            {e.title}
                          </div>
                          {e.notes && (
                            <p className="text-xs text-zinc-400 line-clamp-1">
                              {e.notes}
                            </p>
                          )}
                        </div>

                        {/* Bottom: Income, Status Flip, and Proof indicator */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                          {/* Income Amount */}
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono font-extrabold text-sm text-white">
                              {formatMoney(e.income, e.currency || globalCurrency)}
                            </span>
                            {fiatConverted !== null && (
                              <span className="text-[10px] text-amber-300 font-mono">
                                ≈ {formatMoney(fiatConverted, displayCurrency)}
                              </span>
                            )}
                          </div>

                          {/* Status Pill & Proof Badge */}
                          <div className="flex items-center gap-1.5">
                            {hasProofs && (
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  onOpenLightbox?.(e.proofs[0], e.title);
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold hover:bg-blue-500/20 transition-colors"
                              >
                                <ImageIcon className="w-2.5 h-2.5" />
                                <span>Proof</span>
                              </button>
                            )}

                            {/* 1-Tap Status Flip */}
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onFlipStatus?.(e.id, e.status);
                              }}
                              title="Tap to change status"
                              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-all active:scale-95 shadow-sm ${statusCfg.badge}`}
                            >
                              {statusCfg.label}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. NATIVE JOB ACTIONS BOTTOM-SHEET */}
      <AnimatePresence>
        {selectedEntryForActions && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEntryForActions(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative z-10 w-full max-w-[440px] bg-[#0c0c0f] border-t sm:border border-white/15 rounded-t-[32px] sm:rounded-[32px] shadow-2xl p-5 flex flex-col gap-4"
            >
              {/* Sheet Drag Handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto sm:hidden -mt-1 mb-1" />

              {/* Title & Meta */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white truncate max-w-[280px]">
                    {selectedEntryForActions.title}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedEntryForActions.game} • {formatMoney(selectedEntryForActions.income, selectedEntryForActions.currency || globalCurrency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntryForActions(null)}
                  className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5 pt-1">
                {/* Generate Receipt */}
                <button
                  type="button"
                  onClick={() => {
                    const entry = selectedEntryForActions;
                    setSelectedEntryForActions(null);
                    onOpenReceipt?.(entry);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-white transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <div>Generate Client Receipt Slip</div>
                    <div className="text-[10px] text-zinc-400 font-normal">Formatted proof slip for Discord / Telegram</div>
                  </div>
                </button>

                {/* Edit Entry */}
                <button
                  type="button"
                  onClick={() => {
                    const entry = selectedEntryForActions;
                    setSelectedEntryForActions(null);
                    onEditEntry?.(entry);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-white transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div>Edit Work Details</div>
                    <div className="text-[10px] text-zinc-400 font-normal">Change title, income, hours, or proof screenshots</div>
                  </div>
                </button>

                {/* Duplicate Entry */}
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedEntryForActions.id;
                    setSelectedEntryForActions(null);
                    onDuplicateEntry?.(id);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-white transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Copy className="w-4 h-4" />
                  </div>
                  <div>
                    <div>Duplicate Job (Fast Template)</div>
                    <div className="text-[10px] text-zinc-400 font-normal">Clone this entry with today's timestamp</div>
                  </div>
                </button>

                {/* Delete Entry */}
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedEntryForActions.id;
                    setSelectedEntryForActions(null);
                    onDeleteEntry?.(id);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-rose-500/[0.06] hover:bg-rose-500/[0.12] border border-rose-500/20 text-xs font-semibold text-rose-300 transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div>Delete Entry</div>
                    <div className="text-[10px] text-rose-400/80 font-normal">Remove permanently from database</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LedgerScreen;
