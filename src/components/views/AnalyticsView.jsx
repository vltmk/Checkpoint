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
  Store,
  Users,
  Flame,
  Wallet,
  Receipt,
  ArrowDownRight,
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
import { useTheme } from 'next-themes';

// Configure Chart.js global defaults to prioritize IRANYekanRd for Persian text (تومان)
ChartJS.defaults.font.family = "'Inter', 'IRANYekanRd', 'IranYekanRd', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function AnalyticsView({
  entries = [],
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
  usdRateTOMAN = 95000,
  eurRateUSD = 1.08,
  activeProfileId = 'booster',
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const isAdvertiser = activeProfileId === 'advertiser';

  const [timeframe, setTimeframe] = useState(() => {
    const saved = localStorage.getItem('checkpoint_analytics_timeframe') || localStorage.getItem('vault_analytics_timeframe');
    if (saved && ['daily', 'weekly', 'monthly', 'all'].includes(saved)) return saved;
    return 'monthly';
  });

  const [breakdownView, setBreakdownView] = useState('game'); // 'game' | 'source'

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
    () => ({ goldRateTOMAN, usdRateTOMAN, eurRateUSD }),
    [goldRateTOMAN, usdRateTOMAN, eurRateUSD]
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
    let grossIncome = 0;
    let totalExpenses = 0;
    let paidCount = 0;
    let failedCount = 0;
    let lostRevenue = 0;

    // Advertiser specific aggregations
    let totalClientVolume = 0;
    let totalBoosterPayouts = 0;
    let pendingInflow = 0;
    let pendingOutflow = 0;

    const gameMap = {};
    const sourceMap = {};
    const teammateMap = {};
    const dayOfWeekMap = new Array(7).fill(0); // 0: Sun ... 6: Sat

    filteredEntries.forEach((e) => {
      const inc = convertEntryCurrency(e, globalCurrency, rates);
      const grossAmount = e.pot ? convertCurrency(e.pot, e.currency, globalCurrency, rates) : inc;
      const boosterPayout = Math.max(0, grossAmount - inc);

      if (e.status === 'Paid') {
        paidCount++;
      } else if (e.status === 'Failed') {
        failedCount++;
        lostRevenue += Math.abs(inc);
      }

      if (e.status !== 'Failed') {
        totalClientVolume += grossAmount;
        totalBoosterPayouts += boosterPayout;

        if (!e.sourcePaid) {
          pendingInflow += inc;
        }
        if (!e.boosterPaid) {
          pendingOutflow += boosterPayout;
        }

        if (inc < 0) {
          totalExpenses += Math.abs(inc);
        } else {
          grossIncome += inc;
        }

        // Game breakdown
        const g = e.game || 'Other';
        gameMap[g] = (gameMap[g] || 0) + (isAdvertiser ? grossAmount : inc);

        // Source breakdown
        const src = e.source?.trim() || (language === 'fa' ? 'مستقیم / نامشخص' : 'Direct / Other');
        sourceMap[src] = (sourceMap[src] || 0) + (isAdvertiser ? grossAmount : inc);

        // Day of week rhythm
        if (e.dateTime) {
          const d = new Date(e.dateTime);
          if (!isNaN(d.getTime())) {
            const dayIdx = d.getDay(); // 0 = Sunday
            dayOfWeekMap[dayIdx] += Math.max(0, inc);
          }
        }

        // Teammate breakdown
        if (Array.isArray(e.teammates)) {
          e.teammates.forEach((tm) => {
            if (tm && typeof tm === 'string') {
              const cleanTm = tm.trim();
              if (cleanTm) {
                if (!teammateMap[cleanTm]) {
                  teammateMap[cleanTm] = { name: cleanTm, jobsCount: 0, sharedVolume: 0, boosterPayout: 0 };
                }
                teammateMap[cleanTm].jobsCount += 1;
                teammateMap[cleanTm].sharedVolume += Math.max(0, inc);
                teammateMap[cleanTm].boosterPayout += boosterPayout;
              }
            }
          });
        }
      }
    });

    const netProfit = grossIncome - totalExpenses;
    const payableJobsCount = filteredEntries.length - failedCount;
    const avgPerJob = payableJobsCount > 0 ? netProfit / payableJobsCount : 0;
    const completionRate =
      filteredEntries.length > 0 ? Math.round((paidCount / filteredEntries.length) * 100) : 0;
    const marginPercentage = totalClientVolume > 0 ? Math.round((netProfit / totalClientVolume) * 100) : 0;

    const sortedGames = Object.entries(gameMap)
      .map(([game, revenue]) => ({
        game,
        revenue,
        percentage: (isAdvertiser ? totalClientVolume : grossIncome) > 0 ? Math.round((revenue / (isAdvertiser ? totalClientVolume : grossIncome)) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const sortedSources = Object.entries(sourceMap)
      .map(([src, revenue]) => ({
        source: src,
        revenue,
        percentage: (isAdvertiser ? totalClientVolume : grossIncome) > 0 ? Math.round((revenue / (isAdvertiser ? totalClientVolume : grossIncome)) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const sortedTeammates = Object.values(teammateMap)
      .sort((a, b) => b.jobsCount - a.jobsCount || (isAdvertiser ? b.boosterPayout - a.boosterPayout : b.sharedVolume - a.sharedVolume))
      .slice(0, 6);

    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNamesFa = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    let maxDayIdx = 0;
    let maxDayVal = 0;
    dayOfWeekMap.forEach((val, idx) => {
      if (val > maxDayVal) {
        maxDayVal = val;
        maxDayIdx = idx;
      }
    });
    const peakDayName = maxDayVal > 0 ? (language === 'fa' ? dayNamesFa[maxDayIdx] : dayNamesEn[maxDayIdx]) : '--';

    return {
      grossIncome,
      totalExpenses,
      netProfit,
      totalIncome: netProfit, // preserve compatibility
      paidCount,
      failedCount,
      lostRevenue,
      completionRate,
      avgPerJob,
      totalClientVolume,
      totalBoosterPayouts,
      pendingInflow,
      pendingOutflow,
      marginPercentage,
      sortedGames,
      sortedSources,
      sortedTeammates,
      dayOfWeekMap,
      peakDayName,
      maxDayVal,
    };
  }, [filteredEntries, globalCurrency, rates, language, isAdvertiser]);

  // Velocity dynamic chart data
  const velocityChartData = useMemo(() => {
    const now = new Date();

    if (timeframe === 'daily') {
      const dayMap = new Map();
      filteredEntries.forEach((e) => {
        if (e.dateTime && e.status !== 'Failed') {
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
        if (e.status === 'Failed') return;
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
        if (e.dateTime && e.status !== 'Failed') {
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
      if (e.status === 'Failed') return;
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
          backgroundColor: isLight ? '#18181b' : '#fafafa',
          hoverBackgroundColor: isLight ? '#27272a' : '#e4e4e7',
          borderRadius: 4,
          maxBarThickness: 32,
        },
      ],
    };
  }, [velocityChartData, globalCurrency, t, isLight]);

  // Velocity Activity Check
  const hasVelocityData = useMemo(() => {
    return velocityChartData?.data?.some((val) => Number(val) > 0);
  }, [velocityChartData]);

  // Game or Source Distribution Donut Data
  const donutChartData = useMemo(() => {
    const isSource = breakdownView === 'source';
    const list = isSource ? stats.sortedSources : stats.sortedGames;
    const labels = list.map((item) => (isSource ? item.source : item.game));
    const data = list.map((item) => item.revenue);

    const monochromaticPalette = isLight
      ? ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7']
      : ['#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#3f3f46', '#27272a'];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: monochromaticPalette.slice(0, Math.max(labels.length, 1)),
          borderColor: isLight ? '#ffffff' : '#09090b',
          borderWidth: 2.5,
        },
      ],
    };
  }, [breakdownView, stats.sortedGames, stats.sortedSources, isLight]);

  // Day of Week Rhythm Bar Chart Data
  const dayOfWeekChartData = useMemo(() => {
    const isFa = language === 'fa';
    const dayOrder = isFa ? [6, 0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 0];
    const dayLabelsFa = {
      6: 'شنبه',
      0: 'یکشنبه',
      1: 'دوشنبه',
      2: 'سه‌شنبه',
      3: 'چهارشنبه',
      4: 'پنج‌شنبه',
      5: 'جمعه',
    };
    const dayLabelsEn = {
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
      5: 'Fri',
      6: 'Sat',
      0: 'Sun',
    };

    const labels = dayOrder.map((idx) => (isFa ? dayLabelsFa[idx] : dayLabelsEn[idx]));
    const data = dayOrder.map((idx) => stats.dayOfWeekMap[idx]);

    let maxIdx = -1;
    let maxVal = 0;
    data.forEach((val, i) => {
      if (val > maxVal) {
        maxVal = val;
        maxIdx = i;
      }
    });

    const bgColors = data.map((_, i) => {
      if (i === maxIdx && maxVal > 0) {
        return isLight ? '#18181b' : '#fafafa';
      }
      return isLight ? '#a1a1aa' : '#52525b';
    });

    return {
      labels,
      datasets: [
        {
          label: `${t('analytics.weeklyRhythm')} (${globalCurrency})`,
          data,
          backgroundColor: bgColors,
          borderRadius: 4,
          maxBarThickness: 24,
        },
      ],
    };
  }, [language, stats.dayOfWeekMap, isLight, globalCurrency, t]);

  const barChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isLight ? '#f4f4f5' : '#18181b',
        titleColor: isLight ? '#27272a' : '#e4e4e7',
        bodyColor: isLight ? '#52525b' : '#a1a1aa',
        borderColor: isLight ? '#e4e4e7' : '#27272a',
        borderWidth: 1,
        padding: 8,
        cornerRadius: 6,
        titleFont: {
          family: "'Inter', 'IRANYekanRd', 'IranYekanRd', sans-serif",
          size: 11,
          weight: '600',
        },
        bodyFont: {
          family: "'Inter', 'IRANYekanRd', 'IranYekanRd', sans-serif",
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
        grid: { color: isLight ? 'rgba(39, 39, 42, 0.06)' : 'rgba(228, 228, 231, 0.05)' },
        ticks: {
          color: '#71717a',
          font: { size: 10, family: "'Inter', 'IRANYekanRd', 'IranYekanRd', sans-serif" },
          callback: (value) => formatMoney(value, globalCurrency, true, language === 'fa'),
        },
        border: { display: false },
      },
    },
  }), [isLight, globalCurrency, language]);

  const donutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isLight ? '#f4f4f5' : '#18181b',
        titleColor: isLight ? '#27272a' : '#e4e4e7',
        bodyColor: isLight ? '#52525b' : '#a1a1aa',
        borderColor: isLight ? '#e4e4e7' : '#27272a',
        borderWidth: 1,
        padding: 8,
        cornerRadius: 6,
        titleFont: {
          family: "'Inter', 'IRANYekanRd', 'IranYekanRd', sans-serif",
          size: 11,
          weight: '600',
        },
        bodyFont: {
          family: "'Inter', 'IRANYekanRd', 'IranYekanRd', sans-serif",
          size: 11,
        },
        callbacks: {
          label: (context) => ` ${formatMoney(context.parsed, globalCurrency, false, language === 'fa')}`,
        },
      },
    },
  }), [isLight, globalCurrency, language]);

  const currentTfObj = TIMEFRAMES.find((tf) => tf.id === timeframe) || TIMEFRAMES[2];

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Row: Title & Segmented Timeframe Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800/80">
        <div>
          <h2 className="text-base font-medium tracking-tight text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <span className={cn(isRtl && 'font-farsi')}>{t('analytics.title')}</span>
          </h2>
          <p className={cn('text-xs text-zinc-500 mt-0.5', isRtl && 'font-farsi')}>
            {currentTfObj.windowText}
          </p>
        </div>

        {/* Monochromatic Segmented Pill Control */}
        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 text-xs self-start sm:self-auto">
          {TIMEFRAMES.map((tf) => {
            const isSelected = timeframe === tf.id;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => handleTimeframeChange(tf.id)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-colors select-none border',
                  isRtl && 'font-farsi',
                  isSelected
                    ? 'bg-white text-zinc-800 shadow-sm border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700/60 font-medium'
                    : 'border-transparent text-zinc-600 hover:text-zinc-800 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/40'
                )}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. KPIs Row */}
      {isAdvertiser ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Gross Client Volume */}
          <div className="rounded-xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                <span className={cn('leading-normal', isRtl && 'font-farsi')}>{language === 'fa' ? 'حجم کل مبادلات' : 'Gross Volume'}</span>
              </div>
            </div>
            <div className="text-xl font-medium text-zinc-800 dark:text-zinc-200 truncate flex items-center">
              <MoneyDisplay amount={stats.totalClientVolume} currency={globalCurrency} compact={true} />
            </div>
            <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1 pt-0.5">
              <span>{language === 'fa' ? 'کل سفارشات دریافتی' : 'Total Client Turnover'}</span>
            </div>
          </div>

          {/* Net Profit & Margin */}
          <div className="rounded-xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className={cn('leading-normal', isRtl && 'font-farsi')}>{language === 'fa' ? 'سود خالص شما' : 'Net Commission'}</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                {stats.marginPercentage}% {language === 'fa' ? 'مارجین' : 'margin'}
              </span>
            </div>
            <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 truncate flex items-center">
              <MoneyDisplay amount={stats.netProfit} currency={globalCurrency} compact={true} />
            </div>
            <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1 pt-0.5">
              <span>{language === 'fa' ? 'درآمد قطعی پس از کسر سهم بوسترها' : 'Net earnings after booster cuts'}</span>
            </div>
          </div>

          {/* Booster Payouts */}
          <div className="rounded-xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-500" />
                <span className={cn('leading-normal', isRtl && 'font-farsi')}>{language === 'fa' ? 'سهم بوسترها' : 'Booster Payouts'}</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                {stats.totalClientVolume > 0 ? Math.round((stats.totalBoosterPayouts / stats.totalClientVolume) * 100) : 0}%
              </span>
            </div>
            <div className="text-xl font-medium text-zinc-800 dark:text-zinc-200 truncate flex items-center">
              <MoneyDisplay amount={stats.totalBoosterPayouts} currency={globalCurrency} compact={true} />
            </div>
            <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1 pt-0.5">
              <span>{language === 'fa' ? 'کل مبالغ تعلق‌گرفته به بوسترها' : 'Total payout allocated to boosters'}</span>
            </div>
          </div>

          {/* Orders Done */}
          <div className="rounded-xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between gap-1 text-zinc-500 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80" />
                <span className={cn('leading-normal', isRtl && 'font-farsi')}>{language === 'fa' ? 'سفارشات تحویل شده' : 'Orders Done'}</span>
              </div>
              <span className="text-[10px] text-zinc-500">
                {formatNumber(stats.completionRate)}%
              </span>
            </div>
            <div className="text-xl font-medium text-zinc-800 dark:text-zinc-200">
              {formatNumber(stats.paidCount)} <span className="text-xs text-zinc-500 font-normal">/ {formatNumber(filteredEntries.length)}</span>
            </div>
            <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1 pt-0.5">
              <span>{language === 'fa' ? 'سفارشات تسویه‌شده با بوستر' : 'Orders settled with boosters'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Net Profit & Revenue/Expense Breakdown */}
          <div className="rounded-xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                <span className={cn('leading-normal', isRtl && 'font-farsi')}>{t('analytics.netProfit')}</span>
              </div>
              {stats.totalExpenses > 0 && (
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono">
                  -{formatMoney(stats.totalExpenses, globalCurrency, true, language === 'fa')}
                </span>
              )}
            </div>
            <div className="text-xl font-medium text-zinc-800 dark:text-zinc-200 truncate flex items-center">
              <MoneyDisplay amount={stats.netProfit} currency={globalCurrency} compact={true} />
            </div>
            {stats.totalExpenses > 0 && (
              <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1 pt-0.5">
                <span>{t('analytics.grossRevenue')}:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  +{formatMoney(stats.grossIncome, globalCurrency, true, language === 'fa')}
                </span>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
              <Trophy className="w-3.5 h-3.5 text-zinc-400" />
              <span className={cn('leading-normal', isRtl && 'font-farsi')}>{t('analytics.averageJob')}</span>
            </div>
            <div className="text-xl font-medium text-zinc-800 dark:text-zinc-200 truncate flex items-center">
              <MoneyDisplay amount={stats.avgPerJob} currency={globalCurrency} compact={true} />
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80" />
              <span className={cn('leading-normal', isRtl && 'font-farsi')}>{t('analytics.jobsDone')}</span>
            </div>
            <div className="text-xl font-medium text-zinc-800 dark:text-zinc-200">
              {formatNumber(stats.paidCount)} <span className="text-xs text-zinc-500 font-normal">/ {formatNumber(filteredEntries.length)}</span>
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between gap-1 text-zinc-500 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500/80" />
                <span className={cn('leading-normal', isRtl && 'font-farsi')}>{t('analytics.completionRate')}</span>
              </div>
              {stats.failedCount > 0 && (
                <span className={cn('text-[10px] text-rose-600 dark:text-rose-400 font-normal leading-normal', isRtl && 'font-farsi')}>
                  {formatNumber(stats.failedCount)} {t('status.Failed')}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="text-xl font-medium text-zinc-800 dark:text-zinc-200">
                {formatNumber(stats.completionRate)}%
              </div>
              {stats.lostRevenue > 0 && (
                <div
                  title={`${t('analytics.lostRevenue')}: ${formatMoney(stats.lostRevenue, globalCurrency, false, language === 'fa')}`}
                  className={cn('text-[11px] font-medium text-rose-600/80 dark:text-rose-400/80 truncate leading-normal inline-flex items-center', isRtl && 'font-farsi')}
                >
                  -<MoneyDisplay amount={stats.lostRevenue} currency={globalCurrency} compact={true} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1.5. Advertiser Settlement & Cashflow Balance Card */}
      {isAdvertiser && (
        <div className="rounded-2xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <h3 className={cn('text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400', isRtl && 'font-farsi')}>
                {language === 'fa' ? 'تراز تسویه و جریان نقدینگی' : 'Settlement & Cashflow Balance'}
              </h3>
            </div>
            <span className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
              {language === 'fa' ? 'در انتظار وصول / تسویه' : 'Pending Inflow vs Outflow'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Pending Inflow from Source/Clients */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                <span className={cn(isRtl && 'font-farsi')}>{language === 'fa' ? 'در انتظار دریافت از مبدا' : 'Pending Client Inflow'}</span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <div className="text-lg font-medium text-amber-600 dark:text-amber-400">
                <MoneyDisplay amount={stats.pendingInflow} currency={globalCurrency} />
              </div>
              <p className={cn('text-[10px] text-zinc-400 dark:text-zinc-500', isRtl && 'font-farsi')}>
                {language === 'fa' ? 'سفارشاتی که وجه آن‌ها از سایت یا مشتری دریافت نشده' : 'Unsettled orders from client platforms'}
              </p>
            </div>

            {/* Pending Outflow to Boosters */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                <span className={cn(isRtl && 'font-farsi')}>{language === 'fa' ? 'بدهی جاری به بوسترها' : 'Pending Booster Payouts'}</span>
                <span className="w-2 h-2 rounded-full bg-rose-500/80" />
              </div>
              <div className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
                <MoneyDisplay amount={stats.pendingOutflow} currency={globalCurrency} />
              </div>
              <p className={cn('text-[10px] text-zinc-400 dark:text-zinc-500', isRtl && 'font-farsi')}>
                {language === 'fa' ? 'سهم بوسترها برای کارهای در حال انجام یا پرداخت‌نشده' : 'Outstanding cuts owed to boosters'}
              </p>
            </div>

            {/* Expected Net Float */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                <span className={cn(isRtl && 'font-farsi')}>{language === 'fa' ? 'مازاد خالص انتظاری' : 'Net Expected Float'}</span>
                <span className={cn(
                  'text-[10px] font-mono font-medium',
                  stats.pendingInflow >= stats.pendingOutflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}>
                  {stats.pendingInflow >= stats.pendingOutflow ? '+' : ''}
                  {formatMoney(stats.pendingInflow - stats.pendingOutflow, globalCurrency, true, language === 'fa')}
                </span>
              </div>
              <div className={cn(
                'text-lg font-medium',
                stats.pendingInflow >= stats.pendingOutflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}>
                <MoneyDisplay amount={Math.abs(stats.pendingInflow - stats.pendingOutflow)} currency={globalCurrency} />
              </div>
              <p className={cn('text-[10px] text-zinc-400 dark:text-zinc-500', isRtl && 'font-farsi')}>
                {language === 'fa' ? 'سود نهایی شما پس از تسویه تمام ورودی‌ها و خروجی‌ها' : 'Remaining net profit once all pending legs clear'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Velocity Bar Chart */}
      <div className="rounded-2xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className={cn(isRtl && 'font-farsi')}>{velocityChartData.title}</span>
          </h3>
          <span className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
            {currentTfObj.windowText}
          </span>
        </div>
        <div className="h-48 w-full">
          {hasVelocityData ? (
            <Bar data={barChartData} options={barChartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className={cn('text-xs text-zinc-500', isRtl && 'font-farsi')}>
                {t('analytics.noDataPeriod')}
              </p>
            </div>
          )}
        </div>
        <table className="sr-only">
          <caption>{velocityChartData.title}</caption>
          <thead>
            <tr>
              <th scope="col">{language === 'fa' ? 'بازه زمانی' : 'Period'}</th>
              <th scope="col">{language === 'fa' ? 'درآمد' : 'Earnings'}</th>
            </tr>
          </thead>
          <tbody>
            {velocityChartData.labels.map((label, idx) => (
              <tr key={idx}>
                <td>{label}</td>
                <td>{velocityChartData.data[idx]} {globalCurrency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Distribution & Ranking (By Game / By Source) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <h3 className={cn('text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400', isRtl && 'font-farsi')}>
              {breakdownView === 'source' ? t('analytics.revenueBySource') : t('analytics.revenueByGame')}
            </h3>
          </div>

          {/* Segmented Pill Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setBreakdownView('game')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 select-none border',
                isRtl && 'font-farsi',
                breakdownView === 'game'
                  ? 'bg-white text-zinc-900 shadow-xs border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/60'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              )}
            >
              <Layers className="w-3 h-3" />
              <span>{t('analytics.byGame')}</span>
            </button>
            <button
              type="button"
              onClick={() => setBreakdownView('source')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 select-none border',
                isRtl && 'font-farsi',
                breakdownView === 'source'
                  ? 'bg-white text-zinc-900 shadow-xs border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/60'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              )}
            >
              <Store className="w-3 h-3" />
              <span>{t('analytics.bySource')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Donut Chart */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className={cn('text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400', isRtl && 'font-farsi')}>
                {breakdownView === 'source' ? t('analytics.revenueBySource') : t('analytics.revenueByGame')}
              </h4>
              <span className={cn('text-[10px] text-zinc-500', isRtl && 'font-farsi')}>
                {breakdownView === 'source'
                  ? `${formatNumber(stats.sortedSources.length)} ${stats.sortedSources.length === 1 ? t('analytics.sourceCount') : t('analytics.sourcesCount')}`
                  : `${formatNumber(stats.sortedGames.length)} ${stats.sortedGames.length === 1 ? t('analytics.gameCount') : t('analytics.gamesCount')}`}
              </span>
            </div>

            <div className="h-40 relative flex items-center justify-center">
              {(breakdownView === 'source' ? stats.sortedSources.length : stats.sortedGames.length) > 0 ? (
                <>
                  <Doughnut data={donutChartData} options={donutOptions} />
                  <table className="sr-only">
                    <caption>
                      {breakdownView === 'source' ? t('analytics.revenueBySource') : t('analytics.revenueByGame')}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{breakdownView === 'source' ? t('analytics.source') : t('analytics.game')}</th>
                        <th scope="col">{language === 'fa' ? 'درآمد' : 'Revenue'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donutChartData.labels.map((label, idx) => (
                        <tr key={idx}>
                          <td>{label}</td>
                          <td>{donutChartData.datasets[0]?.data?.[idx]} {globalCurrency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className={cn('text-xs text-zinc-500', isRtl && 'font-farsi')}>{t('analytics.noDataPeriod')}</p>
              )}
            </div>
          </div>

          {/* Breakdown Ranking List */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={cn('text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400', isRtl && 'font-farsi')}>
                {breakdownView === 'source' ? t('analytics.topSourcesBreakdown') : t('analytics.topGamesBreakdown')}
              </h4>
              <span className={cn('text-[10px] text-zinc-500', isRtl && 'font-farsi')}>{t('analytics.periodShare')}</span>
            </div>

            <div className="space-y-3">
              {breakdownView === 'game' ? (
                stats.sortedGames.length > 0 ? (
                  stats.sortedGames.map((item) => (
                    <div key={item.game} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-800 dark:text-zinc-300 font-medium truncate flex items-center gap-1.5">
                          <GameIcon game={item.game} className="w-3.5 h-3.5" />
                          <span>{item.game}</span>
                        </span>
                        <span className="text-zinc-800 dark:text-zinc-300 font-medium inline-flex items-center">
                          <MoneyDisplay amount={item.revenue} currency={globalCurrency} />
                        </span>
                      </div>
                      <div dir="ltr" className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full transition-all duration-300"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={cn('text-xs text-zinc-500 py-6 text-center', isRtl && 'font-farsi')}>{t('analytics.noDataPeriod')}</p>
                )
              ) : (
                stats.sortedSources.length > 0 ? (
                  stats.sortedSources.map((item) => (
                    <div key={item.source} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-800 dark:text-zinc-300 font-medium truncate flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{item.source}</span>
                        </span>
                        <span className="text-zinc-800 dark:text-zinc-300 font-medium inline-flex items-center">
                          <MoneyDisplay amount={item.revenue} currency={globalCurrency} />
                        </span>
                      </div>
                      <div dir="ltr" className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full transition-all duration-300"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={cn('text-xs text-zinc-500 py-6 text-center', isRtl && 'font-farsi')}>{t('analytics.noDataPeriod')}</p>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Day of Week Rhythm & Crew / Teammates Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Day of Week Rhythm Bar Chart */}
        <div className="rounded-2xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <h3 className={cn('text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400', isRtl && 'font-farsi')}>
                {t('analytics.weeklyRhythm')}
              </h3>
            </div>
            {stats.maxDayVal > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                <span className={cn(isRtl && 'font-farsi')}>
                  {t('analytics.peakDay')}: {stats.peakDayName}
                </span>
              </div>
            )}
          </div>
          <div className="h-40 w-full">
            <Bar data={dayOfWeekChartData} options={barChartOptions} />
          </div>
        </div>

        {/* Crew & Teammates Insights Card */}
        <div className="rounded-2xl bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <h3 className={cn('text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400', isRtl && 'font-farsi')}>
                {isAdvertiser ? (language === 'fa' ? 'عملکرد بوسترها' : 'Top Boosters') : t('analytics.teammatesCrewInsights')}
              </h3>
            </div>
            <span className={cn('text-[10px] text-zinc-500', isRtl && 'font-farsi')}>
              {formatNumber(stats.sortedTeammates.length)} {isAdvertiser ? (language === 'fa' ? 'بوستر' : 'boosters') : (language === 'fa' ? 'همکار' : 'teammates')}
            </span>
          </div>

          <div className="space-y-3">
            {stats.sortedTeammates.length > 0 ? (
              stats.sortedTeammates.map((tm, index) => {
                const maxJobs = stats.sortedTeammates[0]?.jobsCount || 1;
                const percent = Math.round((tm.jobsCount / maxJobs) * 100);
                return (
                  <div key={tm.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 w-4 text-center shrink-0">
                          #{index + 1}
                        </span>
                        <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">
                          {tm.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          ({formatNumber(tm.jobsCount)} {isAdvertiser ? (language === 'fa' ? 'سفارش' : 'orders') : t('analytics.jobsTogether')})
                        </span>
                      </div>
                      <span className="text-zinc-800 dark:text-zinc-300 font-medium inline-flex items-center shrink-0">
                        <MoneyDisplay amount={isAdvertiser ? tm.boosterPayout : tm.sharedVolume} currency={globalCurrency} />
                      </span>
                    </div>
                    <div dir="ltr" className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
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
