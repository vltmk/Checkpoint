import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { formatMoney, convertToFiat, WOW_PRESETS, CURRENCIES } from '../../lib/currencies';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import {
  Coins,
  TrendingUp,
  BarChart2,
  Clock,
  Briefcase,
  Zap,
  Calculator,
  RotateCcw,
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, ChartLegend);

export function StatsRatesScreen({
  entries = [],
  globalCurrency = 'USD',
  goldRate = 0.035,
  onGoldRateChange,
  goldCurrency = 'USD',
  onGoldCurrencyChange,
  isConversionEnabled = true,
  onToggleConversion,
}) {
  const [customGoldInput, setCustomGoldInput] = useState('100000'); // 100k gold calculator
  const displayCurrency = isConversionEnabled ? (goldCurrency || globalCurrency) : globalCurrency;

  // Monthly Earnings (last 6 months)
  const monthlyData = useMemo(() => {
    const monthMap = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('en-US', { month: 'short' });
      monthMap[key] = 0;
    }

    entries.forEach((e) => {
      const inc = parseFloat(e.income) || 0;
      let convertedInc = inc;
      if (e.currency === 'WOW_GOLD' && isConversionEnabled && Number(goldRate) > 0) {
        convertedInc = convertToFiat(inc, goldRate, displayCurrency);
      }

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
          data: Object.values(monthMap),
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          hoverBackgroundColor: 'rgba(59, 130, 246, 0.95)',
          borderRadius: 8,
          borderWidth: 0,
        },
      ],
    };
  }, [entries, displayCurrency, goldRate, isConversionEnabled]);

  // Overall Performance KPIs
  const kpis = useMemo(() => {
    let totalIncome = 0;
    let totalHours = 0;
    let totalGoldTransacted = 0;

    entries.forEach((e) => {
      const inc = parseFloat(e.income) || 0;
      if (e.currency === 'WOW_GOLD') {
        totalGoldTransacted += inc;
      }

      let converted = inc;
      if (e.currency === 'WOW_GOLD' && isConversionEnabled && Number(goldRate) > 0) {
        converted = convertToFiat(inc, goldRate, displayCurrency);
      }

      totalIncome += converted;
      if (e.hours) totalHours += parseFloat(e.hours);
    });

    const avgRatePerJob = entries.length > 0 ? totalIncome / entries.length : 0;
    const avgHourlyRate = totalHours > 0 ? totalIncome / totalHours : 0;

    return {
      totalIncome,
      totalHours,
      totalGoldTransacted,
      avgRatePerJob,
      avgHourlyRate,
    };
  }, [entries, displayCurrency, goldRate, isConversionEnabled]);

  // Calculate live gold conversion for custom input
  const calculatedFiat = useMemo(() => {
    const amount = parseFloat(customGoldInput) || 0;
    if (amount <= 0 || !goldRate) return 0;
    return convertToFiat(amount, goldRate, displayCurrency);
  }, [customGoldInput, goldRate, displayCurrency]);

  return (
    <div className="flex-1 px-4 py-5 space-y-4 pb-28">
      {/* 1. WOW GOLD & FIAT RATE CONVERTER CARD */}
      <div className="glass-card-vision p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-tight text-white block">
                WoW Gold Exchange Rate
              </span>
              <span className="text-[10px] text-zinc-400">
                Auto-convert gold to {displayCurrency} across app
              </span>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            onClick={() => onToggleConversion?.(!isConversionEnabled)}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 border ${
              isConversionEnabled
                ? 'bg-emerald-500 border-emerald-400'
                : 'bg-zinc-800 border-zinc-700'
            }`}
          >
            <motion.div
              layout
              className={`w-4 h-4 rounded-full bg-white shadow-md ${
                isConversionEnabled ? 'ml-5' : 'ml-0'
              }`}
            />
          </button>
        </div>

        {/* Rate Input Form */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-semibold">1,000 WoW Gold =</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="any"
                value={goldRate}
                onChange={(e) => onGoldRateChange?.(parseFloat(e.target.value) || 0)}
                className="w-24 h-8 px-2.5 rounded-xl bg-white/[0.06] border border-white/[0.12] text-xs font-mono font-bold text-white text-right focus:outline-none focus:border-white/30"
              />
              <span className="text-xs font-mono text-zinc-400">{displayCurrency}</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              Quick Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {WOW_PRESETS.slice(0, 4).map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    onGoldRateChange?.(p.rate);
                    onGoldCurrencyChange?.(p.currency);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-[11px] text-zinc-300 hover:text-white flex items-center justify-between transition-all"
                >
                  <span className="truncate">{p.label}</span>
                  <span className="font-mono font-semibold text-amber-300 text-[10px]">
                    {p.rate}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mini Gold Calculator Widget */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
            <span className="flex items-center gap-1">
              <Calculator className="w-3 h-3 text-zinc-400" />
              Quick Gold Calculator
            </span>
            <span className="font-mono text-amber-300">
              ≈ {formatMoney(calculatedFiat, displayCurrency)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={customGoldInput}
              onChange={(e) => setCustomGoldInput(e.target.value)}
              placeholder="e.g. 500000"
              className="flex-1 h-8 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-white/20"
            />
            <span className="text-xs text-zinc-400 font-mono">Gold</span>
          </div>
        </div>
      </div>

      {/* 2. MONTHLY EARNINGS VELOCITY BAR CHART */}
      <div className="glass-card-vision p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
            MONTHLY VELOCITY
          </span>
          <span className="text-[10px] font-mono text-zinc-500">Last 6 Months</span>
        </div>

        <div className="h-36 w-full">
          <Bar
            data={monthlyData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (item) => ` ${formatMoney(item.raw, displayCurrency)}`,
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { color: '#71717a', font: { size: 10 } },
                },
                y: {
                  grid: { color: 'rgba(255, 255, 255, 0.05)' },
                  ticks: { color: '#71717a', font: { size: 9 } },
                },
              },
            }}
          />
        </div>
      </div>

      {/* 3. PERFORMANCE KPIS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Avg Per Job */}
        <div className="glass-card-vision p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Avg / Job</span>
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white">
              {formatMoney(kpis.avgRatePerJob, displayCurrency)}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              {entries.length} total jobs logged
            </div>
          </div>
        </div>

        {/* Avg Hourly Rate */}
        <div className="glass-card-vision p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Hourly Rate</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white">
              {kpis.avgHourlyRate > 0 ? formatMoney(kpis.avgHourlyRate, displayCurrency) : '—'}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              {kpis.totalHours > 0 ? `${kpis.totalHours} hrs tracked` : 'No hours logged'}
            </div>
          </div>
        </div>

        {/* Gold Transacted */}
        <div className="glass-card-vision p-4 col-span-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Total In-Game Gold Volume
              </span>
              <span className="text-base font-bold font-mono text-amber-300">
                {formatMoney(kpis.totalGoldTransacted, 'WOW_GOLD')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsRatesScreen;
