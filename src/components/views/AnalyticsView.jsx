import React, { useMemo } from 'react';
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
} from '../../lib/currencies';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Trophy,
  PieChart,
  BarChart2,
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

export function AnalyticsView({
  entries = [],
  globalCurrency = 'USD',
  goldRateUSD = 0.035,
  goldRateTOMAN = 3200,
}) {
  const rates = useMemo(
    () => ({ goldRateUSD, goldRateTOMAN }),
    [goldRateUSD, goldRateTOMAN]
  );

  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalHours = 0;
    let paidCount = 0;
    const gameMap = {};

    entries.forEach((e) => {
      const inc = parseFloat(e.income) || 0;
      const convertedInc = convertCurrency(inc, e.currency, globalCurrency, rates);

      totalIncome += convertedInc;
      if (e.hours) totalHours += parseFloat(e.hours);
      if (e.status === 'Paid') paidCount++;

      const g = e.game || 'Uncategorized';
      gameMap[g] = (gameMap[g] || 0) + convertedInc;
    });

    const avgHourly = totalHours > 0 ? totalIncome / totalHours : 0;
    const avgPerJob = entries.length > 0 ? totalIncome / entries.length : 0;
    const completionRate = entries.length > 0 ? Math.round((paidCount / entries.length) * 100) : 0;

    const sortedGames = Object.entries(gameMap)
      .map(([game, rev]) => ({
        game,
        revenue: rev,
        percentage: totalIncome > 0 ? Math.round((rev / totalIncome) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalIncome,
      totalHours,
      paidCount,
      avgHourly,
      avgPerJob,
      completionRate,
      sortedGames,
    };
  }, [entries, globalCurrency, rates]);

  // Monthly Earnings Velocity (Last 6 months)
  const monthlyChartData = useMemo(() => {
    const monthMap = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('en-US', { month: 'short' });
      monthMap[key] = 0;
    }

    entries.forEach((e) => {
      const inc = parseFloat(e.income) || 0;
      const convertedInc = convertCurrency(inc, e.currency, globalCurrency, rates);
      const dt = new Date(e.dateTime);
      if (!isNaN(dt)) {
        const key = dt.toLocaleString('en-US', { month: 'short' });
        if (monthMap[key] !== undefined) {
          monthMap[key] += convertedInc;
        }
      }
    });

    return {
      labels: Object.keys(monthMap),
      datasets: [
        {
          label: `Earnings (${globalCurrency})`,
          data: Object.values(monthMap),
          backgroundColor: '#fafafa',
          hoverBackgroundColor: '#e4e4e7',
          borderRadius: 4,
          maxBarThickness: 32,
        },
      ],
    };
  }, [entries, globalCurrency, rates]);

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

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* 1. KPIs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-zinc-300" />
            <span>Total Hours</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono">
            {stats.totalHours.toFixed(1)}h
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hourly Rate</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono truncate">
            {formatMoney(stats.avgHourly, globalCurrency, true)}
            <span className="text-xs text-zinc-500 font-normal">/h</span>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <Trophy className="w-3.5 h-3.5 text-zinc-300" />
            <span>Average Job</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono truncate">
            {formatMoney(stats.avgPerJob, globalCurrency, true)}
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Completion</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono">
            {stats.completionRate}%
          </div>
        </div>
      </div>

      {/* 2. Monthly Trend Chart */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-zinc-300" />
            <span>Monthly Velocity</span>
          </h3>
          <span className="text-[11px] font-mono text-zinc-500">Last 6 Months</span>
        </div>
        <div className="h-48 w-full">
          <Bar data={monthlyChartData} options={barChartOptions} />
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
          </div>

          <div className="h-40 relative flex items-center justify-center">
            {stats.sortedGames.length > 0 ? (
              <Doughnut data={donutChartData} options={donutOptions} />
            ) : (
              <p className="text-xs text-zinc-500">No data</p>
            )}
          </div>
        </div>

        {/* Breakdown Ranking List */}
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Top Games Breakdown
          </h3>

          <div className="space-y-3">
            {stats.sortedGames.map((item, idx) => (
              <div key={item.game} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-200 font-medium truncate">
                    {item.game}
                  </span>
                  <span className="text-zinc-100 font-mono font-semibold">
                    {formatMoney(item.revenue, globalCurrency)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-100 rounded-full transition-all duration-300"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsView;
