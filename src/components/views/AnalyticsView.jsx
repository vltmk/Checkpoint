import React, { useState, useMemo, useEffect } from 'react';
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

import { useLanguage, formatShamsiDate } from '../../lib/i18n';
import { trackerDB } from '../../lib/db';

// Configure Chart.js global defaults to prioritize IRANYekanRd for Persian text (تومان)
ChartJS.defaults.font.family = "'Inter', 'IRANYekanRd', 'IranYekanRd', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function AnalyticsView({
  entries = [],
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();
  const [timeframe, setTimeframe] = useState(() => {
    const saved = localStorage.getItem('checkpoint_analytics_timeframe') || localStorage.getItem('vault_analytics_timeframe');
    if (saved && ['daily', 'weekly', 'monthly', 'all'].includes(saved)) return saved;
    return 'monthly';
  });

  // Hydrate timeframe from SQLite trackerDB
  useEffect(() => {
    trackerDB.getSetting('checkpoint_analytics_timeframe', null).then((saved) => {
      if (saved && ['daily', 'weekly', 'monthly', 'all'].includes(saved) && saved !== timeframe) {
        setTimeframe(saved);
        try {
          localStorage.setItem('checkpoint_analytics_timeframe', saved);
        } catch (e) {}
      }
    }).catch(() => {});
  }, []);

  const TIMEFRAMES = [
    { id: 'daily', label: t('analytics.daily'), windowText: t('analytics.last14Days') },
    { id: 'weekly', label: t('analytics.weekly'), windowText: t('analytics.last8Weeks') },
    { id: 'monthly', label: t('analytics.monthly'), windowText: t('analytics.last6Months') },
    { id: 'all', label: t('analytics.allTime'), windowText: t('analytics.allRecordedData') },
  ];

  const handleTimeframeChange = (tf) => {
    const validTf = ['daily', 'weekly', 'monthly', 'all'].includes(tf) ? tf : 'monthly';
    setTimeframe(validTf);
    try {
      localStorage.setItem('checkpoint_analytics_timeframe', validTf);
      trackerDB.setSetting('checkpoint_analytics_timeframe', validTf).catch(() => {});
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
      const dayMap = new Map();
      filteredEntries.forEach((e) => {
        if (e.dateTime) {
          const dayKey = e.dateTime.slice(0, 10);
          const inc = convertEntryCurrency(e, globalCurrency, rates);
          dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + inc);
        }
      });

      const days = [];
      const data = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        const label = language === 'fa'
          ? formatShamsiDate(d, { month: 'numeric', day: 'numeric' })
          : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        days.push(label);
        data.push(dayMap.get(dayStr) || 0);
      }
      return {
        title: language === 'fa' ? 'روند درآمد روزانه (۱۴ روز)' : 'Daily Earnings Velocity (14-Day)',
        labels: days,
        data,
      };
    }

    if (timeframe === 'weekly') {
      const weekBuckets = new Array(8).fill(0);
      const nowMs = now.getTime();
      const ONE_WEEK_MS = 7 * 86400000;

      filteredEntries.forEach((e) => {
        const dt = e.dateTime ? new Date(e.dateTime) : null;
        if (dt && !isNaN(dt.getTime())) {
          const diffMs = nowMs - dt.getTime();
          if (diffMs >= 0) {
            const weekIndex = Math.floor(diffMs / ONE_WEEK_MS);
            if (weekIndex >= 0 && weekIndex < 8) {
              const reverseIdx = 7 - weekIndex;
              weekBuckets[reverseIdx] += convertEntryCurrency(e, globalCurrency, rates);
            }
          }
        }
      });

      const weeks = [];
      for (let i = 7; i >= 0; i--) {
        const label = language === 'fa' ? `هفته ${formatNumber(8 - i)}` : `Wk ${8 - i}`;
        weeks.push(label);
      }

      return {
        title: language === 'fa' ? 'روند درآمد هفتگی (۸ هفته)' : 'Weekly Earnings Velocity (8-Week)',
        labels: weeks,
        data: weekBuckets,
      };
    }

    if (timeframe === 'monthly') {
      const monthBuckets = new Map();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = language === 'fa'
          ? formatShamsiDate(d, { month: 'short' })
          : d.toLocaleString('en-US', { month: 'short' });
        months.push({ key, label: monthLabel });
        monthBuckets.set(key, 0);
      }

      filteredEntries.forEach((e) => {
        if (e.dateTime) {
          const key = e.dateTime.slice(0, 7);
          if (monthBuckets.has(key)) {
            monthBuckets.set(key, monthBuckets.get(key) + convertEntryCurrency(e, globalCurrency, rates));
          }
        }
      });

      return {
        title: language === 'fa' ? 'روند درآمد ماهانه (۶ ماه)' : 'Monthly Earnings Velocity (6-Month)',
        labels: months.map((m) => m.label),
        data: months.map((m) => monthBuckets.get(m.key) || 0),
      };
    }

    // All-time monthly buckets
    const monthMap = {};
    entries.forEach((e) => {
      const dt = new Date(e.dateTime);
      if (!isNaN(dt)) {
        const key = language === 'fa'
          ? formatShamsiDate(dt, { month: 'short', year: '2-digit' })
          : dt.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        monthMap[key] = (monthMap[key] || 0) + convertEntryCurrency(e, globalCurrency, rates);
      }
    });

    const labels = Object.keys(monthMap);
    if (labels.length === 0) {
      const nowLabel = language === 'fa'
        ? formatShamsiDate(now, { month: 'short', year: '2-digit' })
        : now.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      labels.push(nowLabel);
      monthMap[labels[0]] = 0;
    }

    return {
      title: language === 'fa' ? 'روند کل درآمد' : 'All-Time Earnings Velocity',
      labels,
      data: labels.map((l) => monthMap[l] || 0),
    };
  }, [filteredEntries, entries, timeframe, globalCurrency, rates, language, formatNumber]);

  // ChartJS Datasets
  const barChartData = useMemo(() => {
    return {
      labels: velocityChartData.labels,
      datasets: [
        {
          label: `${t('analytics.totalEarned')} (${globalCurrency})`,
          data: velocityChartData.data,
          backgroundColor: '#fafafa',
          hoverBackgroundColor: '#e4e4e7',
          borderRadius: 4,
          maxBarThickness: 32,
        },
      ],
    };
  }, [velocityChartData, globalCurrency, t]);

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
        titleFont: {
          family: "'Inter', 'IRANYekanRd', 'IranYekanRd', sans-serif",
          size: 11,
          weight: '600',
        },
        bodyFont: {
          family: "'IoskeleyMono', 'IRANYekanRd', 'IranYekanRd', monospace",
          size: 11,
        },
        callbacks: {
          label: (context) => ` ${formatMoney(context.parsed.y, globalCurrency, false, language === 'fa')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#71717a',
          font: { size: 11, family: "'Inter', 'IRANYekanRd', 'IranYekanRd', sans-serif" },
        },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#71717a',
          font: { size: 10, family: "'IoskeleyMono', 'IRANYekanRd', 'IranYekanRd', monospace" },
          callback: (value) => formatMoney(value, globalCurrency, true, language === 'fa'),
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
        titleFont: {
          family: "'Inter', 'IRANYekanRd', 'IranYekanRd', sans-serif",
          size: 11,
          weight: '600',
        },
        bodyFont: {
          family: "'IoskeleyMono', 'IRANYekanRd', 'IranYekanRd', monospace",
          size: 11,
        },
        callbacks: {
          label: (context) => ` ${formatMoney(context.parsed, globalCurrency, false, language === 'fa')}`,
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
            <span className={cn(isRtl && 'font-farsi')}>{t('analytics.title')}</span>
          </h2>
          <p className={cn('text-xs text-zinc-500 mt-0.5', isRtl && 'font-farsi')}>
            {currentTfObj.windowText}
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
                  isRtl && 'font-farsi',
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
            <span className={cn(isRtl && 'font-farsi')}>{t('analytics.totalEarned')}</span>
          </div>
          <div className="text-xl font-bold text-zinc-200 truncate">
            <MoneyDisplay amount={stats.totalIncome} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <Trophy className="w-3.5 h-3.5 text-zinc-400" />
            <span className={cn(isRtl && 'font-farsi')}>{t('analytics.averageJob')}</span>
          </div>
          <div className="text-xl font-bold text-zinc-200 truncate">
            <MoneyDisplay amount={stats.avgPerJob} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80" />
            <span className={cn(isRtl && 'font-farsi')}>{t('analytics.jobsDone')}</span>
          </div>
          <div className="text-xl font-bold text-zinc-200">
            {formatNumber(stats.paidCount)} <span className="text-xs text-zinc-600 font-normal">/ {formatNumber(filteredEntries.length)}</span>
          </div>
        </div>

        <div className="rounded-xl bg-transparent border border-zinc-800/80 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500/80" />
            <span className={cn(isRtl && 'font-farsi')}>{t('analytics.completionRate')}</span>
          </div>
          <div className="text-xl font-bold text-zinc-200">
            {formatNumber(stats.completionRate)}%
          </div>
        </div>
      </div>

      {/* 2. Velocity Bar Chart */}
      <div className="rounded-2xl bg-transparent border border-zinc-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-zinc-400" />
            <span className={cn(isRtl && 'font-farsi')}>{velocityChartData.title}</span>
          </h3>
          <span className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
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
              <span className={cn(isRtl && 'font-farsi')}>{t('analytics.revenueByGame')}</span>
            </h3>
            <span className={cn('text-[10px] text-zinc-500', isRtl && 'font-farsi')}>
              {formatNumber(stats.sortedGames.length)} {stats.sortedGames.length === 1 ? t('analytics.gameCount') : t('analytics.gamesCount')}
            </span>
          </div>

          <div className="h-40 relative flex items-center justify-center">
            {stats.sortedGames.length > 0 ? (
              <Doughnut data={donutChartData} options={donutOptions} />
            ) : (
              <p className={cn('text-xs text-zinc-500', isRtl && 'font-farsi')}>{t('analytics.noDataPeriod')}</p>
            )}
          </div>
        </div>

        {/* Breakdown Ranking List */}
        <div className="rounded-2xl bg-transparent border border-zinc-800/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={cn('text-xs font-medium uppercase tracking-wider text-zinc-400', isRtl && 'font-farsi')}>
              {t('analytics.topGamesBreakdown')}
            </h3>
            <span className={cn('text-[10px] text-zinc-500', isRtl && 'font-farsi')}>{t('analytics.periodShare')}</span>
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
                  <div dir="ltr" className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-100 rounded-full transition-all duration-300"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className={cn('text-xs text-zinc-500 py-6 text-center', isRtl && 'font-farsi')}>{t('analytics.noDataPeriod')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsView;
