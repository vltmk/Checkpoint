import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  formatMoney,
  convertCurrency,
  convertEntryCurrency,
  formatConvertedSecondary,
} from '../../lib/currencies';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { GameIcon } from '../ui/GameIcon';
import { MoneyDisplay, ConvertedSecondaryDisplay } from '../ui/MoneyDisplay';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  Coins,
  Receipt,
  FileImage,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  Legend
);

export function OverviewView({
  entries = [],
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
  onOpenWorkModal,
  onOpenReceipt,
  onOpenLightbox,
  onFlipStatus,
  onNavigateToLedger,
  onNavigateToExchange,
}) {
  const rates = useMemo(
    () => ({ goldRateTOMAN }),
    [goldRateTOMAN]
  );

  // Aggregate metrics with accurate entry-level historical conversion
  const metrics = useMemo(() => {
    let totalPaid = 0;
    let paidCount = 0;
    let totalPending = 0;
    let pendingCount = 0;
    let totalValue = 0;

    entries.forEach((e) => {
      const convertedInc = convertEntryCurrency(e, globalCurrency, rates);

      totalValue += convertedInc;

      if (e.status === 'Paid') {
        totalPaid += convertedInc;
        paidCount++;
      } else {
        totalPending += convertedInc;
        pendingCount++;
      }
    });

    const completionRate =
      entries.length > 0 ? Math.round((paidCount / entries.length) * 100) : 0;
    const avgRate = entries.length > 0 ? totalValue / entries.length : 0;

    return {
      totalPaid,
      paidCount,
      totalPending,
      pendingCount,
      totalValue,
      completionRate,
      avgRate,
    };
  }, [entries, globalCurrency, rates]);

  // Monthly Earnings Velocity Chart Data (Last 6 Months)
  const monthlyChartData = useMemo(() => {
    const monthMap = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('en-US', { month: 'short' });
      monthMap[key] = 0;
    }

    entries.forEach((e) => {
      const convertedInc = convertEntryCurrency(e, globalCurrency, rates);
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
          borderSkipped: false,
          maxBarThickness: 32,
        },
      ],
    };
  }, [entries, globalCurrency, rates]);

  const chartOptions = {
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

  const recentEntries = entries.slice(0, 4);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* 1. Hero Balance Card */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Total Earned
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">
              {metrics.completionRate}% Paid
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100 font-mono">
            <MoneyDisplay amount={metrics.totalPaid} currency={globalCurrency} />
          </div>
          {globalCurrency !== 'GOLD' && (
            <ConvertedSecondaryDisplay
              amount={metrics.totalPaid}
              fromCurrency={globalCurrency}
              targetCurrency="GOLD"
              rates={rates}
            />
          )}
        </div>

        {/* Dual Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-zinc-800/80 rounded-full overflow-hidden flex">
            <div
              className="bg-zinc-100 h-full transition-all duration-300"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPaid / metrics.totalValue) * 100 : 0}%`,
              }}
            />
            <div
              className="bg-zinc-600 h-full transition-all duration-300"
              style={{
                width: `${metrics.totalValue > 0 ? (metrics.totalPending / metrics.totalValue) * 100 : 0}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
            <span className="flex items-center gap-1">
              <span>Paid:</span>
              <strong className="text-zinc-200"><MoneyDisplay amount={metrics.totalPaid} currency={globalCurrency} /></strong>
              <span>({metrics.paidCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <span>Pending:</span>
              <strong className="text-zinc-300"><MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} /></strong>
              <span>({metrics.pendingCount})</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Quick Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Jobs Done</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono">
            {metrics.paidCount} <span className="text-xs text-zinc-500 font-normal">/ {entries.length}</span>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Pending Payout</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono truncate">
            <MoneyDisplay amount={metrics.totalPending} currency={globalCurrency} compact={true} />
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/60 p-3.5 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-300" />
            <span>Average Rate</span>
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono truncate">
            <MoneyDisplay amount={metrics.avgRate} currency={globalCurrency} compact={true} />
          </div>
        </div>
      </div>

      {/* 3. Monthly Income Chart */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Monthly Earnings
          </h3>
          <span className="text-[11px] font-mono text-zinc-500">Last 6 Months</span>
        </div>
        <div className="h-44 w-full">
          <Bar data={monthlyChartData} options={chartOptions} />
        </div>
      </div>

      {/* 4. Recent Activity Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent Work
          </h3>
          <button
            type="button"
            onClick={onNavigateToLedger}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center space-y-3">
            <p className="text-xs text-zinc-500">No work records logged yet.</p>
            <Button variant="primary" size="sm" onClick={() => onOpenWorkModal?.()}>
              <Plus className="w-3.5 h-3.5" />
              <span>Add Work</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentEntries.map((entry) => {
              const secondary = formatConvertedSecondary(
                entry.income,
                entry.currency,
                globalCurrency,
                rates
              );

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Proof Icon or Game Emblem */}
                    {entry.proofs && entry.proofs.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => onOpenLightbox?.(entry.proofs[0]?.data || entry.id, entry.title)}
                        title="View attached screenshot proof"
                        className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white shrink-0 overflow-hidden"
                      >
                        {entry.proofs[0]?.data ? (
                          <img
                            src={entry.proofs[0].data}
                            alt="Proof"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileImage className="w-4 h-4 text-cyan-400" />
                        )}
                      </button>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 p-1.5">
                        <GameIcon game={entry.game} className="w-full h-full" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200 truncate">
                          {entry.title}
                        </span>
                        {entry.source && (
                          <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800/80">
                            {entry.source}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-0.5">
                        <span>{entry.game}</span>
                        <span>•</span>
                        <span>{new Date(entry.dateTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-zinc-100 font-mono">
                        <MoneyDisplay amount={entry.income} currency={entry.currency} />
                      </div>
                      {entry.currency !== globalCurrency && (
                        <ConvertedSecondaryDisplay
                          amount={entry.income}
                          fromCurrency={entry.currency}
                          targetCurrency={globalCurrency}
                          rates={rates}
                          customRate={entry.exchangeRate}
                          isPerOneGold={entry.rateUnit === '1' || entry.game === 'World of Warcraft Classic'}
                          showRateLabel={true}
                        />
                      )}
                    </div>

                    <StatusBadge status={entry.status} interactive={false} />
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

export default OverviewView;

