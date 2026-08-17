import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { formatMoney, convertToFiat, STATUS_CONFIG } from '../../lib/currencies';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import {
  TrendingUp,
  ArrowRight,
  Sparkles,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
} from 'lucide-react';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

const CATEGORY_COLORS = [
  '#f59e0b', // Amber / Gold
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#06b6d4', // Cyan
  '#71717a', // Zinc
];

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

export function HomeScreen({
  entries = [],
  globalCurrency = 'USD',
  goldRate = 0.035,
  goldCurrency = 'USD',
  isConversionEnabled = true,
  onNavigateToLedger,
  onOpenWorkModal,
  onFlipStatus,
  onOpenReceipt,
  onOpenLightbox,
}) {
  const [period, setPeriod] = useState('all'); // 'all' | 'month'

  const displayCurrency = isConversionEnabled ? (goldCurrency || globalCurrency) : globalCurrency;

  // Filter entries based on period
  const filteredEntries = useMemo(() => {
    if (period === 'all') return entries;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return entries.filter((e) => {
      const d = new Date(e.dateTime);
      return !isNaN(d) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
  }, [entries, period]);

  // Aggregate Metrics & Category Breakdown
  const stats = useMemo(() => {
    let totalPaid = 0;
    let totalPending = 0;
    let totalValue = 0;
    let paidGold = 0;

    const gameMap = {};

    filteredEntries.forEach((e) => {
      const inc = parseFloat(e.income) || 0;
      const isGold = e.currency === 'WOW_GOLD';

      let convertedInc = inc;
      if (isGold && isConversionEnabled && Number(goldRate) > 0) {
        convertedInc = convertToFiat(inc, goldRate, displayCurrency);
      }

      totalValue += convertedInc;

      if (e.status === 'Paid') {
        totalPaid += convertedInc;
        if (isGold) paidGold += inc;
      } else {
        totalPending += convertedInc;
      }

      const gameName = e.game || 'Freelance / Other';
      gameMap[gameName] = (gameMap[gameName] || 0) + convertedInc;
    });

    const categoryList = Object.entries(gameMap)
      .map(([name, amount], index) => {
        const percent = totalValue > 0 ? Math.round((amount / totalValue) * 100) : 0;
        return {
          name,
          amount,
          percent,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
          emoji: GAME_EMOJIS[name] || '🎮',
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const paidPercent = totalValue > 0 ? Math.min(100, Math.round((totalPaid / totalValue) * 100)) : 100;

    return {
      totalPaid,
      totalPending,
      totalValue,
      paidGold,
      paidPercent,
      categoryList,
    };
  }, [filteredEntries, displayCurrency, goldRate, isConversionEnabled]);

  // ChartJS Data for Donut
  const donutData = useMemo(() => {
    if (stats.categoryList.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [
          {
            data: [1],
            backgroundColor: ['rgba(255, 255, 255, 0.08)'],
            borderWidth: 0,
          },
        ],
      };
    }

    return {
      labels: stats.categoryList.map((c) => c.name),
      datasets: [
        {
          data: stats.categoryList.map((c) => c.amount),
          backgroundColor: stats.categoryList.map((c) => c.color),
          borderWidth: 2,
          borderColor: '#09090b',
          hoverOffset: 4,
        },
      ],
    };
  }, [stats.categoryList]);

  const recentEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
      .slice(0, 3);
  }, [entries]);

  return (
    <div className="flex-1 px-4 py-5 space-y-4 pb-28">
      {/* 1. HERO BALANCE CARD (Faithful to screenshot) */}
      <div className="glass-card-vision p-5 flex flex-col gap-4">
        {/* Top bar inside card */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
            TOTAL EARNED
          </span>

          {/* Period Selector Toggle */}
          <div className="flex items-center p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                period === 'month'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                period === 'all'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Big Balance Number */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
            {formatMoney(stats.totalPaid, displayCurrency).split(' ')[0]}
          </span>
          <span className="text-sm font-semibold text-zinc-400">
            {displayCurrency === 'TOMAN' ? 'تومان' : displayCurrency}
          </span>
        </div>

        {/* Dual-Tone Horizontal Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2.5 rounded-full bg-white/[0.08] overflow-hidden flex relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.paidPercent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-emerald-400 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.5)]"
            />
            {stats.totalPending > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${100 - stats.paidPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-amber-400/80 rounded-r-full"
              />
            )}
          </div>

          {/* Sub-stats: Paid vs Total Pipeline */}
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {formatMoney(stats.totalPaid, displayCurrency)} Paid
            </span>
            <span className="text-zinc-300">
              {formatMoney(stats.totalValue, displayCurrency)} Total
            </span>
          </div>
        </div>
      </div>

      {/* 2. STATS DONUT CHART CARD (Faithful to screenshot) */}
      <div className="glass-card-vision p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
            STATS
          </span>
          <span className="text-[11px] text-zinc-300 font-medium">
            {stats.categoryList.length} Categories
          </span>
        </div>

        {stats.categoryList.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            No work logged yet. Tap <span className="text-white font-bold">➕</span> to record income.
          </div>
        ) : (
          <div className="grid grid-cols-2 items-center gap-2">
            {/* Left: Clean Legend matching screenshot */}
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {stats.categoryList.slice(0, 6).map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-zinc-200 truncate font-medium">{c.name}</span>
                  </div>
                  <span className="font-mono text-zinc-400 text-[11px] shrink-0">
                    {c.percent}%
                  </span>
                </div>
              ))}
            </div>

            {/* Right: Donut Ring Chart */}
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              <Doughnut
                data={donutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  cutout: '72%',
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (item) => ` ${formatMoney(item.raw, displayCurrency)}`,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. BY CATEGORY BREAKDOWN CARD (Faithful to screenshot) */}
      <div className="glass-card-vision p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
            BY CATEGORY
          </span>
        </div>

        {stats.categoryList.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-400">
            No categories available.
          </div>
        ) : (
          <div className="space-y-3.5">
            {stats.categoryList.slice(0, 5).map((c) => (
              <div key={c.name} className="space-y-1.5">
                {/* Title & Amount Header */}
                <div className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <span>{c.emoji}</span>
                    <span className="text-zinc-100 font-semibold">{c.name}</span>
                    <span className="text-zinc-400 font-mono text-[11px]">
                      {c.percent}%
                    </span>
                  </div>
                  <span className="font-mono font-bold text-white text-xs">
                    {formatMoney(c.amount, displayCurrency)}
                  </span>
                </div>

                {/* Progress line with category specific accent */}
                <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${c.percent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. RECENT JOBS FEED */}
      <div className="glass-card-vision p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
            RECENT ACTIVITY
          </span>
          <button
            type="button"
            onClick={onNavigateToLedger}
            className="text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentEntries.length === 0 ? (
          <div className="py-4 text-center text-xs text-zinc-400">
            No recent activity recorded.
          </div>
        ) : (
          <div className="space-y-2">
            {recentEntries.map((e) => {
              const statusCfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.Paid;
              const hasProofs = e.proofs && e.proofs.length > 0;

              return (
                <div
                  key={e.id}
                  className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-sm shrink-0">
                      {GAME_EMOJIS[e.game] || '🎮'}
                    </div>
                    <div className="truncate text-left">
                      <div className="text-xs font-semibold text-white truncate">
                        {e.title}
                      </div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                        <span>{e.game || 'Freelance'}</span>
                        {hasProofs && (
                          <span
                            onClick={() => onOpenLightbox?.(e.proofs[0], e.title)}
                            className="cursor-pointer text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                          >
                            <ImageIcon className="w-2.5 h-2.5" /> Proof
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <span className="font-mono font-bold text-xs text-white">
                      {formatMoney(e.income, e.currency || globalCurrency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onFlipStatus?.(e.id, e.status)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-transform active:scale-95 ${statusCfg.badge}`}
                    >
                      {statusCfg.label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeScreen;
