import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatMoney } from '../lib/currencies';
import { ChevronDown, BarChart3, PieChart } from 'lucide-react';
import { Kbd } from './ui/Tooltip';

// Register ChartJS elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export function AnalyticsDrawer({
  isOpen,
  onToggle,
  entries = [],
  globalCurrency = 'USD',
}) {
  const chartData = useMemo(() => {
    // 1. Monthly Velocity (Last 6 months)
    const monthMap = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      monthMap[key] = 0;
    }

    const catMap = {};
    const gameMap = {};
    let totalIncome = 0;
    let totalHours = 0;

    entries.forEach((e) => {
      const inc = parseFloat(e.income) || 0;
      totalIncome += inc;
      if (e.hours) totalHours += parseFloat(e.hours);

      const dt = new Date(e.dateTime);
      if (!isNaN(dt)) {
        const key = dt.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        if (monthMap[key] !== undefined) {
          monthMap[key] += inc;
        }
      }

      const cat = e.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + inc;

      const gm = e.game || 'Uncategorized';
      gameMap[gm] = (gameMap[gm] || 0) + inc;
    });

    const monthlyData = {
      labels: Object.keys(monthMap),
      datasets: [
        {
          label: 'Earnings',
          data: Object.values(monthMap),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          hoverBackgroundColor: 'rgba(59, 130, 246, 0.95)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };

    const catLabels = Object.keys(catMap);
    const categoryData = {
      labels: catLabels,
      datasets: [
        {
          data: Object.values(catMap),
          backgroundColor: [
            '#3b82f6',
            '#10b981',
            '#f59e0b',
            '#8b5cf6',
            '#06b6d4',
            '#f43f5e',
            '#ec4899',
            '#6366f1',
            '#14b8a6',
            '#64748b',
          ],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };

    const sortedGames = Object.entries(gameMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const gameData = {
      labels: sortedGames.map((g) => g[0]),
      datasets: [
        {
          label: 'Revenue',
          data: sortedGames.map((g) => g[1]),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          hoverBackgroundColor: 'rgba(16, 185, 129, 0.95)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };

    return {
      monthlyData,
      categoryData,
      gameData,
      totalIncome,
      totalHours,
      gameCount: Object.keys(gameMap).length,
    };
  }, [entries]);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#a1a1aa',
    font: {
      family: "'Inter', sans-serif",
      size: 10,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#09090b',
        titleColor: '#ffffff',
        bodyColor: '#e4e4e7',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 8,
        displayColors: false,
        callbacks: {
          label: (ctx) => ` ${formatMoney(ctx.raw, globalCurrency)}`,
        },
      },
    },
  };

  const monthlyOptions = {
    ...baseOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#71717a', font: { size: 10 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#71717a',
          font: { size: 9.5 },
          callback: (val) => formatMoney(val, globalCurrency),
        },
      },
    },
  };

  const gameOptions = {
    ...baseOptions,
    indexAxis: 'y',
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#71717a',
          font: { size: 9.5 },
          callback: (val) => formatMoney(val, globalCurrency),
        },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#71717a', font: { size: 10 } },
      },
    },
  };

  const categoryOptions = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: {
        display: true,
        position: 'right',
        labels: {
          color: '#a1a1aa',
          boxWidth: 8,
          boxHeight: 8,
          padding: 8,
          font: { size: 9.5 },
        },
      },
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${formatMoney(ctx.raw, globalCurrency)}`,
        },
      },
    },
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-2">
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-all">
        {/* Toggle Header Bar */}
        <div
          onClick={onToggle}
          className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.03] select-none transition-colors"
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isOpen ? 0 : -90 }}
              transition={{ duration: 0.2 }}
              className="text-zinc-400"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-zinc-300 uppercase flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
                Analytics & Breakdowns
              </span>
              <Kbd className="hidden sm:inline-flex">A</Kbd>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
            <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-300">
              💰 {formatMoney(chartData.totalIncome, globalCurrency)}
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-300">
              🎮 {chartData.gameCount} Games
            </span>
            <span className="hidden md:inline-block px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-300">
              ⏱️ {chartData.totalHours.toFixed(1)}h
            </span>
          </div>
        </div>

        {/* Collapsible Content */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                {/* 1. Monthly Velocity */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-zinc-300 tracking-wide uppercase">
                      Monthly Velocity
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">Last 6 Mos</span>
                  </div>
                  <div className="h-44 w-full relative">
                    <Bar data={chartData.monthlyData} options={monthlyOptions} />
                  </div>
                </div>

                {/* 2. Revenue by Category */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5">
                      <PieChart className="w-3 h-3 text-zinc-400" />
                      By Category
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">All Time</span>
                  </div>
                  <div className="h-44 w-full relative">
                    {chartData.categoryData.labels.length > 0 ? (
                      <Doughnut data={chartData.categoryData} options={categoryOptions} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                        No category data yet
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Top Games Breakdown */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-zinc-300 tracking-wide uppercase">
                      Top Games / Clients
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">Top 5</span>
                  </div>
                  <div className="h-44 w-full relative">
                    {chartData.gameData.labels.length > 0 ? (
                      <Bar data={chartData.gameData} options={gameOptions} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                        No game data yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
