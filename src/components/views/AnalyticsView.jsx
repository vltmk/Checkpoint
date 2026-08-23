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
      const cutoff = new Date(now.getTime() - 8 * 7 * 86400000);
      return entries.filter((e) => new Date(e.dateTime) >= cutoff);
    }

    if (timeframe === 'monthly') {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return entries.filter((e) => new Date(e.dateTime) >= cutoff);
    }

    return entries;
  }, [entries, timeframe]);

  // Aggregate Key Statistics
  const stats = useMemo(() => {
    let totalIncome = 0;
    let paidCount = 0;
    const gameMap = {};

    filteredEntries.forEach((e) => {
      const inc = convertEntryCurrency(e, globalCurrency, rates);
      totalIncome += inc;

      if (e.status === 'Paid') {
        paidCount++;
      }

      const g = e.game || 'Other';
      gameMap[g] = (gameMap[g] || 0) + inc;
    });

    const completionRate =
      filteredEntries.length > 0 ? Math.round((paidCount / filteredEntries.length) * 100) : 0;
    const avgPerJob = filteredEntries.length > 0 ? totalIncome / filteredEntries.length : 0;

    const sortedGames = Object.entries(gameMap)
      .map(([game, revenue]) => ({
        game,
        revenue,
        percentage: totalIncome > 0 ? Math.round((revenue / totalIncome) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalIncome,
      paidCount,
      completionRate,
      avgPerJob,
      sortedGames,
    };
  }, [filteredEntries, globalCurrency, rates]);

  // Velocity dynamic chart data
  const velocityChartData = useMemo(() => {
    const now = new Date();

    if (timeframe === 'daily') {
      const days = [];
      const data = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        days.push(label);

        const sum = filteredEntries.reduce((acc, e) => {
          if (e.dateTime && e.dateTime.startsWith(dayStr)) {
            return acc + convertEntryCurrency(e, globalCurrency, rates);
          }
          return acc;
        }, 0);
        data.push(sum);
      }
      return {
        title: 'Daily Earnings Velocity (14-Day)',
        labels: days,
        data,
      };
    }

    if (timeframe === 'weekly') {
      const weeks = [];
      const data = [];
      for (let i = 7; i >= 0; i--) {
        const start = new Date(now.getTime() - (i + 1) * 7 * 86400000);
        const end = new Date(now.getTime() - i * 7 * 86400000);
        const label = `Wk ${8 - i}`;
        weeks.push(label);

        const sum = filteredEntries.reduce((acc, e) => {
          const dt = new Date(e.dateTime);
          if (dt >= start && dt < end) {
            return acc + convertEntryCurrency(e, globalCurrency, rates);
          }
          return acc;
        }, 0);
        data.push(sum);
      }
      return {
        title: 'Weekly Earnings Velocity (8-Week)',
        labels: weeks,
        data,
      };
    }

    if (timeframe === 'monthly') {
      const months = [];
      const data = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = d.toLocaleString('en-US', { month: 'short' });
        months.push(monthKey);

        const sum = filteredEntries.reduce((acc, e) => {
          const dt = new Date(e.dateTime);
          if (
            dt.getFullYear() === d.getFullYear() &&
            dt.getMonth() === d.getMonth()
          ) {
            return acc + convertEntryCurrency(e, globalCurrency, rates);
          }
          return acc;
        }, 0);
        data.push(sum);
      }
      return {
        title: 'Monthly Earnings Velocity (6-Month)',
        labels: months,
        data,
      };
    }

    // All-time monthly buckets
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
          borderColor: '#000000',
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
        backgroundColor: '#09090b',
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
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#09090b',
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
        <div className="inline-flex items-center p-1 rounded-xl bg-transparent border border-zinc-800/80 text-xs self-start sm:self-auto">
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
        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <Coins className="w-3.5 h-3.5 text-zinc-400" />
            <span>Total Earned</span>
          </div>
          <div className="text-xl font-bold text-zinc-200 truncate">
            <MoneyDisplay amount={stats.totalIncome} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <Trophy className="w-3.5 h-3.5 text-zinc-400" />
            <span>Average Job</span>
          </div>
          <div className="text-xl font-bold text-zinc-200 truncate">
            <MoneyDisplay amount={stats.avgPerJob} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>Paid Jobs</span>
          </div>
          <div className="text-xl font-bold text-zinc-200">
            {stats.paidCount} <span className="text-xs text-zinc-600 font-normal">/ {filteredEntries.length}</span>
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>Completion Rate</span>
          </div>
          <div className="text-xl font-bold text-zinc-200">
            {stats.completionRate}%
          </div>
        </div>
      </div>

      {/* 2. Velocity Bar Chart */}
      <div className="rounded-2xl bg-transparent border border-zinc-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-zinc-400" />
            <span>{velocityChartData.title}</span>
          </h3>
          <span className="text-[11px] text-zinc-500">
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
        <div className="rounded-2xl bg-transparent border border-zinc-800/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-zinc-400" />
              <span>Revenue by Game</span>
            </h3>
            <span className="text-[10px] text-zinc-500">
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
        <div className="rounded-2xl bg-transparent border border-zinc-800/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Top Games Breakdown
            </h3>
            <span className="text-[10px] text-zinc-500">Period Share</span>
          </div>

          <div className="space-y-3">
            {stats.sortedGames.length > 0 ? (
              stats.sortedGames.map((item) => (
                <div key={item.game} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium truncate flex items-center gap-1.5">
                      <GameIcon game={item.game} className="w-3.5 h-3.5" />
                      <span>{item.game}</span>
                    </span>
                    <span className="text-zinc-300 font-medium">
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
