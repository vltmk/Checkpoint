import React, { useMemo } from 'react';
import { Select } from './ui/Select';
import { formatMoney, convertToFiat } from '../lib/currencies';
import { ArrowRightLeft, Sparkles, Coins, Check } from 'lucide-react';

const FIAT_CURRENCIES = [
  { value: 'USD', label: 'USD ($)', flag: '🇺🇸' },
  { value: 'TOMAN', label: 'Toman (تومان)', flag: '🇮🇷' },
  { value: 'EUR', label: 'EUR (€)', flag: '🇪🇺' },
  { value: 'GBP', label: 'GBP (£)', flag: '🇬🇧' },
  { value: 'USDT', label: 'USDT (₮)', flag: '🌐' },
];

export function GoldConversionBar({
  goldRate = 0.035,
  onGoldRateChange,
  goldCurrency = 'USD',
  onGoldCurrencyChange,
  isConversionEnabled = true,
  onToggleConversion,
  entries = [],
}) {
  // Calculate total WoW gold across entries
  const { totalGold, totalConverted } = useMemo(() => {
    let gold = 0;
    entries.forEach((e) => {
      if (e.currency === 'WOW_GOLD') {
        gold += parseFloat(e.income) || 0;
      }
    });
    const converted = convertToFiat(gold, goldRate, goldCurrency);
    return { totalGold: gold, totalConverted: converted };
  }, [entries, goldRate, goldCurrency]);

  const handleCurrencyChange = (newCurr) => {
    onGoldCurrencyChange?.(newCurr);
    // If switching to Toman and rate is around USD defaults, auto-adjust suggested rate
    if (newCurr === 'TOMAN' && goldRate < 10) {
      onGoldRateChange?.(2500);
    } else if (newCurr === 'USD' && goldRate > 100) {
      onGoldRateChange?.(0.035);
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-2">
      <div className="bg-white/[0.025] hover:bg-white/[0.035] border border-amber-500/20 rounded-xl p-3 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(245,158,11,0.1),0_4px_20px_rgba(0,0,0,0.5)] transition-all flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Conversion Status & Switch */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                  WoW Gold Rate Converter
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                    isConversionEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                  }`}
                >
                  {isConversionEnabled ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Converts in-game gold to real-world fiat across totals and charts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleConversion?.(!isConversionEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isConversionEnabled ? 'bg-amber-500' : 'bg-white/10'
            }`}
            title="Toggle WoW Gold Conversion"
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                isConversionEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Right: Rate Input, Target Currency & Live Preview */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Rate per 1k input */}
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs">
            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
              Rate / 1k:
            </span>
            <input
              type="number"
              step="any"
              min="0"
              value={goldRate}
              onChange={(e) => onGoldRateChange?.(parseFloat(e.target.value) || 0)}
              className="w-16 bg-transparent text-xs font-mono font-bold text-amber-300 focus:outline-none text-right"
              placeholder="0.035"
            />
          </div>

          {/* Target Currency Select */}
          <div className="min-w-[120px]">
            <Select
              value={goldCurrency}
              onChange={handleCurrencyChange}
              options={FIAT_CURRENCIES}
              className="py-1"
            />
          </div>

          {/* Live Preview pill */}
          {totalGold > 0 && isConversionEnabled && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-mono">
              <span className="text-[10px] text-zinc-400">{formatMoney(totalGold, 'WOW_GOLD')}</span>
              <ArrowRightLeft className="w-3 h-3 text-amber-400/70" />
              <span className="font-bold text-white">
                {formatMoney(totalConverted, goldCurrency)}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default GoldConversionBar;
