import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  formatMoney,
  convertCurrency,
  convertEntryCurrency,
} from '../../lib/currencies';
import { GameIcon } from '../ui/GameIcon';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import { cn } from '../../lib/utils';
import {
  TrendingUp,
  Coins,
  CheckCircle2,
  Trophy,
  PieChart,
  BarChart2,
  Calendar,
  Layers,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

const TIMEFRAMES = [
  { id: 'daily', label: 'Daily', windowText: 'Last 14 Days' },
  { id: 'weekly', label: 'Weekly', windowText: 'Last 8 Weeks' },
  { id: 'monthly', label: 'Monthly', windowText: 'Last 6 Months' },
  { id: 'all', label: 'All-Time', windowText: 'All Recorded Data' },
];

export function AnalyticsView({
  entries = [],
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
}) {
  const [timeframe, setTimeframe] = useState(() => {
    return localStorage.getItem('vault_analytics_timeframe') || 'monthly';
  });

  const handleTimeframeChange = (tf) => {
    setTimeframe(tf);
    try {
      localStorage.setItem('vault_analytics_timeframe', tf);
    } catch (e) {
      // Ignore quota errors
    }
  };

  const rates = useMemo(
    () => ({ goldRateTOMAN }),
    [goldRateTOMAN]
  );

  // Filter entries according to active timeframe window
  const filteredEntries = useMemo(() => {
    if (timeframe === 'all') return entries;

    const now = new Date();

    if (timeframe === 'daily') {
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
      cutoff.setHours(0, 0, 0, 0);
      return entries.filter((e) => new Date(e.dateTime) >= cutoff);
    }

    if (timeframe === 'weekly') {
      const dayOfWeek = now.getDay();
      const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      startOfThisWeek.setHours(0, 0, 0, 0);
      const cutoff = new Date(startOfThisWeek.getTime() - 7 * 7 * 86400000);
      return entries.filter((e) => new Date(e.dateTime) >= cutoff);
    }

    if (timeframe === 'monthly') {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      cutoff.setHours(0, 0, 0, 0);
      return entries.filter((e) => new Date(e.dateTime) >= cutoff);
    }

    return entries;
  }, [entries, timeframe]);

  // Aggregate stats strictly for the filtered timeframe
  const stats = useMemo(() => {
    let totalIncome = 0;
    let paidCount = 0;
    let pendingCount = 0;
    const gameMap = {};
    const sourceMap = {};

    filteredEntries.forEach((e) => {
      const convertedInc = convertEntryCurrency(e, globalCurrency, rates);

      totalIncome += convertedInc;
      if (e.status === 'Paid') paidCount++;
      else pendingCount++;

      const g = e.game || 'Uncategorized';
      gameMap[g] = (gameMap[g] || 0) + convertedInc;

      const s = e.source || 'Direct Client';
      sourceMap[s] = (sourceMap[s] || 0) + convertedInc;
    });

    const avgPerJob = filteredEntries.length > 0 ? totalIncome / filteredEntries.length : 0;
    const completionRate = filteredEntries.length > 0 ? Math.round((paidCount / filteredEntries.length) * 100) : 0;

    const sortedGames = Object.entries(gameMap)
      .map(([game, rev]) => ({
        game,
        revenue: rev,
        percentage: totalIncome > 0 ? Math.round((rev / totalIncome) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const sortedSources = Object.entries(sourceMap)
      .map(([source, rev]) => ({
        source,
        revenue: rev,
        percentage: totalIncome > 0 ? Math.round((rev / totalIncome) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalIncome,
      paidCount,
      pendingCount,
      avgPerJob,
      completionRate,
      sortedGames,
      sortedSources,
    };
  }, [filteredEntries, globalCurrency, rates]);

  // Dynamic Velocity Bar Chart Data (Daily / Weekly / Monthly / All-Time)
  const velocityChartData = useMemo(() => {
    const now = new Date();

    // 1. Daily (Last 14 Days)
    if (timeframe === 'daily') {
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = i === 0 ? 'Today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        days.push({ key, label, total: 0 });
      }

      filteredEntries.forEach((e) => {
        const dt = new Date(e.dateTime);
        if (!isNaN(dt)) {
          const key = dt.toISOString().slice(0, 10);
          const found = days.find((d) => d.key === key);
          if (found) {
            found.total += convertEntryCurrency(e, globalCurrency, rates);
          }
        }
      });

      return {
        title: 'Daily Velocity (Last 14 Days)',
        labels: days.map((d) => d.label),
        data: days.map((d) => d.total),
      };
    }

    // 2. Weekly (Last 8 Weeks)
    if (timeframe === 'weekly') {
      const weeks = [];
      const dayOfWeek = now.getDay();
      const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      startOfThisWeek.setHours(0, 0, 0, 0);

      for (let i = 7; i >= 0; i--) {
        const start = new Date(startOfThisWeek.getTime() - i * 7 * 86400000);
        const end = new Date(start.getTime() + 7 * 86400000);
        const label = i === 0 ? 'This Wk' : start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        weeks.push({ start, end, label, total: 0 });
      }

      filteredEntries.forEach((e) => {
        const dt = new Date(e.dateTime);
        if (!isNaN(dt)) {
          const found = weeks.find((w) => dt >= w.start && dt < w.end);
          if (found) {
            found.total += convertEntryCurrency(e, globalCurrency, rates);
          }
        }
      });

      return {
        title: 'Weekly Velocity (Last 8 Weeks)',
        labels: weeks.map((w) => w.label),
        data: weeks.map((w) => w.total),
      };
    }

    // 3. Monthly (Last 6 Months)
    if (timeframe === 'monthly') {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const label = d.toLocaleString('en-US', { month: 'short' });
        months.push({ year, month, label, total: 0 });
      }

      filteredEntries.forEach((e) => {
        const dt = new Date(e.dateTime);
        if (!isNaN(dt)) {
          const year = dt.getFullYear();
          const month = dt.getMonth();
          const found = months.find((m) => m.year === year && m.month === month);
          if (found) {
            found.total += convertEntryCurrency(e, globalCurrency, rates);
          }
        }
      });

      return {
        title: 'Monthly Velocity (Last 6 Months)',
        labels: months.map((m) => m.label),
        data: months.map((m) => m.total),
      };
    }

    // 4. All-Time (All Months Active)
    const monthMap = {};
    entries.forEach((e) => {
      const dt = new Date(e.dateTime);
      if (!isNaN(dt)) {
        const key = dt.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        monthMap[key] = (monthMap[key] || 0) + convertEntryCurrency(e, globalCurrency, rates);
      }
    });

    const labels = Object.keys(monthMap);
    if (labels.length === 0) {
      labels.push(now.toLocaleString('en-US', { month: 'short', year: '2-digit' }));
      monthMap[labels[0]] = 0;
    }

    return {
      title: 'All-Time Earnings Velocity',
      labels,
      data: labels.map((l) => monthMap[l] || 0),
    };
  }, [filteredEntries, entries, timeframe, globalCurrency, rates]);

  // ChartJS Datasets
  const barChartData = useMemo(() => {
    return {
      labels: velocityChartData.labels,
      datasets: [
        {
          label: `Earnings (${globalCurrency})`,
          data: velocityChartData.data,
          backgroundColor: '#fafafa',
          hoverBackgroundColor: '#e4e4e7',
          borderRadius: 4,
          maxBarThickness: 32,
        },
      ],
    };
  }, [velocityChartData, globalCurrency]);

  // Game Distribution Donut Data
  const donutChartData = useMemo(() => {
    const labels = stats.sortedGames.map((g) => g.game);
    const data = stats.sortedGames.map((g) => g.revenue);

    const monochromaticPalette = [
      '#ffffff',
      '#d4d4d8',
      '#a1a1aa',
      '#71717a',
      '#3f3f46',
      '#27272a',
    ];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: monochromaticPalette.slice(0, Math.max(labels.length, 1)),
          borderColor: '#18181b',
          borderWidth: 2,
        },
      ],
    };
  }, [stats.sortedGames]);

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#fafafa',
        bodyColor: '#a1a1aa',
        borderColor: '#27272a',
        borderWidth: 1,
        padding: 8,
        cornerRadius: 6,
        callbacks: {
          label: (context) => ` ${formatMoney(context.parsed.y, globalCurrency)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#71717a', font: { size: 11, family: 'Inter' } },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#71717a',
          font: { size: 10, family: 'IoskeleyMono' },
          callback: (value) => formatMoney(value, globalCurrency, true),
        },
        border: { display: false },
      },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#fafafa',
        bodyColor: '#a1a1aa',
        borderColor: '#27272a',
        borderWidth: 1,
        padding: 8,
        cornerRadius: 6,
        callbacks: {
          label: (context) => ` ${formatMoney(context.parsed, globalCurrency)}`,
        },
      },
    },
  };

  const currentTfObj = TIMEFRAMES.find((tf) => tf.id === timeframe) || TIMEFRAMES[2];

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Row: Title & Segmented Timeframe Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-800/80">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-zinc-300" />
            <span>Analytics & Performance</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {currentTfObj.windowText} • Realized Historical Valuation
          </p>
        </div>

        {/* Monochromatic Segmented Pill Control */}
        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs self-start sm:self-auto">
          {TIMEFRAMES.map((tf) => {
            const isSelected = timeframe === tf.id;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => handleTimeframeChange(tf.id)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all select-none',
                  isSelected
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                )}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. KPIs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <Coins className="w-3.5 h-3.5 text-zinc-300" />
            <span>Total Earned</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono truncate">
            <MoneyDisplay amount={stats.totalIncome} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <Trophy className="w-3.5 h-3.5 text-zinc-300" />
            <span>Average Job</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono truncate">
            <MoneyDisplay amount={stats.avgPerJob} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Paid Jobs</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono">
            {stats.paidCount} <span className="text-xs text-zinc-500 font-normal">/ {filteredEntries.length}</span>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Completion Rate</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono">
            {stats.completionRate}%
          </div>
        </div>
      </div>

      {/* 2. Velocity Bar Chart */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-zinc-300" />
            <span>{velocityChartData.title}</span>
          </h3>
          <span className="text-[11px] font-mono text-zinc-500">
            {currentTfObj.windowText}
          </span>
        </div>
        <div className="h-48 w-full">
          <Bar data={barChartData} options={barChartOptions} />
        </div>
      </div>

      {/* 3. Game Distribution & Ranking */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Donut Chart */}
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-zinc-300" />
              <span>Revenue by Game</span>
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">
              {stats.sortedGames.length} {stats.sortedGames.length === 1 ? 'game' : 'games'}
            </span>
          </div>

          <div className="h-40 relative flex items-center justify-center">
            {stats.sortedGames.length > 0 ? (
              <Doughnut data={donutChartData} options={donutOptions} />
            ) : (
              <p className="text-xs text-zinc-500">No data in this period</p>
            )}
          </div>
        </div>

        {/* Breakdown Ranking List */}
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Top Games Breakdown
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">Period Share</span>
          </div>

          <div className="space-y-3">
            {stats.sortedGames.length > 0 ? (
              stats.sortedGames.map((item) => (
                <div key={item.game} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-200 font-medium truncate flex items-center gap-1.5">
                      <GameIcon game={item.game} className="w-3.5 h-3.5" />
                      <span>{item.game}</span>
                    </span>
                    <span className="text-zinc-100 font-mono font-semibold">
                      <MoneyDisplay amount={item.revenue} currency={globalCurrency} />
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-100 rounded-full transition-all duration-300"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500 py-6 text-center">No recorded jobs in this timeframe</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsView;


