import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { formatMoney, convertToFiat } from '../lib/currencies';
import { CheckCircle2, Clock, DollarSign, TrendingUp, Trophy } from 'lucide-react';

export function MetricStrip({
  entries = [],
  globalCurrency = 'USD',
  goldRate = 0.035,
  goldCurrency = 'USD',
  isConversionEnabled = true,
  visibleElements = { avgRate: false, topGame: false },
}) {
  const displayCurrency = isConversionEnabled ? (goldCurrency || globalCurrency) : globalCurrency;

  const metrics = useMemo(() => {
    let totalPaid = 0;
    let paidCount = 0;
    let paidGold = 0;

    let totalPending = 0;
    let pendingCount = 0;
    let pendingGold = 0;

    let totalValue = 0;
    let totalHours = 0;
    const gameRevMap = {};

    entries.forEach((e) => {
      const inc = parseFloat(e.income) || 0;
      const isGold = e.currency === 'WOW_GOLD';

      let convertedInc = inc;
      if (isGold && isConversionEnabled && Number(goldRate) > 0) {
        convertedInc = convertToFiat(inc, goldRate, displayCurrency);
      }

      totalValue += convertedInc;

      if (e.hours) {
        totalHours += parseFloat(e.hours);
      }

      if (e.status === 'Paid') {
        totalPaid += convertedInc;
        paidCount++;
        if (isGold) paidGold += inc;
      } else if (
        e.status === 'Pending' ||
        e.status === 'Working' ||
        e.status === 'On Hold' ||
        e.status === 'Escrow' ||
        e.status === 'Invoiced' ||
        e.status === 'In Progress'
      ) {
        totalPending += convertedInc;
        pendingCount++;
        if (isGold) pendingGold += inc;
      }

      const g = e.game || 'Uncategorized';
      gameRevMap[g] = (gameRevMap[g] || 0) + convertedInc;
    });

    const avgRate = entries.length > 0 ? totalValue / entries.length : 0;
    const avgHourly = totalHours > 0 ? totalValue / totalHours : 0;

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
      paidGold,
      totalPending,
      pendingCount,
      pendingGold,
      totalValue,
      avgRate,
      avgHourly,
      totalHours,
      topGame,
      topGameRev,
    };
  }, [entries, displayCurrency, goldRate, isConversionEnabled]);

  const allCards = [
    {
      id: 'totalEarned',
      label: 'Total Earned',
      value: formatMoney(metrics.totalPaid, displayCurrency),
      subtext: `${metrics.paidCount} job${metrics.paidCount === 1 ? '' : 's'} completed${
        metrics.paidGold > 0 && isConversionEnabled
          ? ` (${formatMoney(metrics.paidGold, 'WOW_GOLD')} conv.)`
          : ''
      }`,
      icon: CheckCircle2,
      accentClass: 'text-emerald-400',
      borderGlow: 'hover:border-emerald-500/30',
      dotGlow: 'bg-emerald-500/20 text-emerald-400',
    },
    {
      id: 'pendingPayment',
      label: 'Pending Payment',
      value: formatMoney(metrics.totalPending, displayCurrency),
      subtext: `${metrics.pendingCount} job${metrics.pendingCount === 1 ? '' : 's'} pending / working`,
      icon: Clock,
      accentClass: 'text-amber-400',
      borderGlow: 'hover:border-amber-500/30',
      dotGlow: 'bg-amber-500/20 text-amber-400',
    },
    {
      id: 'totalValue',
      label: 'Total Work Value',
      value: formatMoney(metrics.totalValue, displayCurrency),
      subtext: `${entries.length} total logged jobs`,
      icon: DollarSign,
      accentClass: 'text-zinc-100',
      borderGlow: 'hover:border-white/20',
      dotGlow: 'bg-white/10 text-zinc-300',
    },
    {
      id: 'avgRate',
      label: 'Average Rate',
      value: formatMoney(metrics.avgRate, displayCurrency),
      unit: '/ job',
      subtext:
        metrics.totalHours > 0
          ? `${formatMoney(metrics.avgHourly, displayCurrency)}/hr (${metrics.totalHours.toFixed(1)}h)`
          : '--/hr (no hours logged)',
      icon: TrendingUp,
      accentClass: 'text-blue-400',
      borderGlow: 'hover:border-blue-500/30',
      dotGlow: 'bg-blue-500/20 text-blue-400',
    },
    {
      id: 'topGame',
      label: 'Top Client',
      value: metrics.topGame,
      isTextValue: true,
      subtext:
        metrics.topGame !== 'None'
          ? `${formatMoney(metrics.topGameRev, displayCurrency)} total revenue`
          : 'No data yet',
      icon: Trophy,
      accentClass: 'text-purple-400',
      borderGlow: 'hover:border-purple-500/30',
      dotGlow: 'bg-purple-500/20 text-purple-400',
    },
  ];

  const visibleCards = allCards.filter((card) => {
    if (card.id === 'avgRate') return Boolean(visibleElements?.avgRate);
    if (card.id === 'topGame') return Boolean(visibleElements?.topGame);
    return true;
  });

  const getGridColsClass = (count) => {
    switch (count) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-1 sm:grid-cols-2';
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 4:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
      case 5:
      default:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5';
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 lg:px-8 pt-4 pb-2">
      <div className={`grid gap-3 ${getGridColsClass(visibleCards.length)}`}>
        {visibleCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.id}
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

export default MetricStrip;
