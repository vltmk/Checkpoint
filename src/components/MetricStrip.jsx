import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { formatMoney } from '../lib/currencies';
import { CheckCircle2, Clock, DollarSign, TrendingUp, Trophy } from 'lucide-react';

export function MetricStrip({ entries = [], globalCurrency = 'USD' }) {
  const metrics = useMemo(() => {
    let totalPaid = 0;
    let paidCount = 0;
    let totalPending = 0;
    let pendingCount = 0;
    let totalLogged = 0;
    let totalHours = 0;
    const gameRevMap = {};

    entries.forEach((e) => {
      const inc = parseFloat(e.income) || 0;
      totalLogged += inc;

      if (e.status === 'Paid') {
        totalPaid += inc;
        paidCount++;
      } else if (
        e.status === 'Escrow' ||
        e.status === 'Invoiced' ||
        e.status === 'Pending' ||
        e.status === 'In Progress'
      ) {
        totalPending += inc;
        pendingCount++;
      }

      if (e.hours) {
        totalHours += parseFloat(e.hours);
      }

      const g = e.game || 'Uncategorized';
      gameRevMap[g] = (gameRevMap[g] || 0) + inc;
    });

    const avgRate = entries.length > 0 ? totalLogged / entries.length : 0;
    const avgHourly = totalHours > 0 ? totalLogged / totalHours : 0;

    let topGame = 'None';
    let topGameRev = 0;
    for (const [game, rev] of Object.entries(gameRevMap)) {
      if (rev > topGameRev) {
        topGameRev = rev;
        topGame = game;
      }
    }

    return {
      totalPaid,
      paidCount,
      totalPending,
      pendingCount,
      totalLogged,
      totalCount: entries.length,
      avgRate,
      avgHourly,
      totalHours,
      topGame,
      topGameRev,
    };
  }, [entries]);

  const cards = [
    {
      label: 'TOTAL EARNED (PAID)',
      value: formatMoney(metrics.totalPaid, globalCurrency),
      subtext: `${metrics.paidCount} payout${metrics.paidCount === 1 ? '' : 's'} completed`,
      icon: CheckCircle2,
      accentClass: 'text-emerald-400',
      borderGlow: 'hover:border-emerald-500/30',
      dotGlow: 'bg-emerald-500/20 text-emerald-400',
    },
    {
      label: 'PENDING / ESCROW',
      value: formatMoney(metrics.totalPending, globalCurrency),
      subtext: `${metrics.pendingCount} active in escrow / milestone`,
      icon: Clock,
      accentClass: 'text-blue-400',
      borderGlow: 'hover:border-blue-500/30',
      dotGlow: 'bg-blue-500/20 text-blue-400',
    },
    {
      label: 'TOTAL LOGGED INCOME',
      value: formatMoney(metrics.totalLogged, globalCurrency),
      subtext: `${metrics.totalCount} total logged jobs`,
      icon: DollarSign,
      accentClass: 'text-zinc-100',
      borderGlow: 'hover:border-white/20',
      dotGlow: 'bg-white/10 text-zinc-300',
    },
    {
      label: 'AVG REALIZATION / RATE',
      value: formatMoney(metrics.avgRate, globalCurrency),
      unit: '/ job',
      subtext:
        metrics.totalHours > 0
          ? `${formatMoney(metrics.avgHourly, globalCurrency)}/hr (${metrics.totalHours.toFixed(1)}h logged)`
          : '--/hr (no hours logged)',
      icon: TrendingUp,
      accentClass: 'text-amber-400',
      borderGlow: 'hover:border-amber-500/30',
      dotGlow: 'bg-amber-500/20 text-amber-400',
    },
    {
      label: 'TOP GAME / CLIENT',
      value: metrics.topGame,
      subtext: `${formatMoney(metrics.topGameRev, globalCurrency)} total revenue`,
      icon: Trophy,
      accentClass: 'text-purple-400',
      borderGlow: 'hover:border-purple-500/30',
      dotGlow: 'bg-purple-500/20 text-purple-400',
      isTextValue: true,
    },
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 lg:px-8 pt-4 pb-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className={`group relative bg-white/[0.025] hover:bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] ${card.borderGlow} rounded-xl p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-200`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                  {card.label}
                </span>
                <div className={`p-1 rounded-md ${card.dotGlow}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="flex items-baseline gap-1 mb-1">
                <span
                  className={`text-lg font-bold tracking-tight ${card.accentClass} ${
                    card.isTextValue ? 'truncate max-w-full' : 'font-mono'
                  }`}
                >
                  {card.value}
                </span>
                {card.unit && (
                  <span className="text-[11px] font-normal text-zinc-400">{card.unit}</span>
                )}
              </div>

              <div className="text-[11px] text-zinc-400 font-medium truncate">
                {card.subtext}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
