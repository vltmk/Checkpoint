import React, { useState, useMemo, useEffect } from 'react';
import {
  Coins,
  ArrowRightLeft,
  Sliders,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { NumberStepperInput } from '../ui/NumberStepperInput';
import { GameIcon } from '../ui/GameIcon';
import { formatMoney, convertCurrency } from '../../lib/currencies';

export function ExchangeView({
  entries = [],
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
  onGoldRateTOMANChange,
  onToast,
}) {
  // 2-Way Calculator State (defaults to 1,000 G)
  const [calcGold, setCalcGold] = useState('1000');
  const [calcTOMAN, setCalcTOMAN] = useState('3200');

  const rates = useMemo(
    () => ({ goldRateTOMAN }),
    [goldRateTOMAN]
  );

  // Total Gold in DB
  const ledgerGoldStats = useMemo(() => {
    let totalGold = 0;
    let goldCount = 0;

    entries.forEach((e) => {
      if (e.currency === 'GOLD') {
        totalGold += parseFloat(e.income) || 0;
        goldCount++;
      }
    });

    const worthTOMAN = (totalGold / 1000) * goldRateTOMAN;

    return { totalGold, goldCount, worthTOMAN };
  }, [entries, goldRateTOMAN]);

  // Handle calculator input changes
  const handleGoldChange = (val) => {
    setCalcGold(val);
    const num = parseFloat(val) || 0;
    setCalcTOMAN(num > 0 ? Math.round((num / 1000) * goldRateTOMAN).toString() : '');
  };

  const handleTOMANChange = (val) => {
    setCalcTOMAN(val);
    const num = parseFloat(val) || 0;
    if (num > 0 && goldRateTOMAN > 0) {
      const g = (num / goldRateTOMAN) * 1000;
      setCalcGold(Math.round(g).toString());
    } else {
      setCalcGold('');
    }
  };

  // Presets
  const presets = [
    { label: 'Retail WoW Token', tomanRate: 3200, game: 'World of Warcraft' },
    { label: 'Classic SoD', tomanRate: 7800, game: 'World of Warcraft Classic' },
    { label: 'Cata Classic', tomanRate: 2500, game: 'World of Warcraft Classic' },
    { label: 'Hardcore Realms', tomanRate: 20000, game: 'World of Warcraft Classic' },
  ];

  const applyPreset = (preset) => {
    onGoldRateTOMANChange?.(preset.tomanRate);
    const gNum = parseFloat(calcGold) || 1000;
    setCalcTOMAN(Math.round((gNum / 1000) * preset.tomanRate).toString());
    onToast?.(`Applied preset: ${preset.label} (${preset.tomanRate.toLocaleString()} T / 1k G)`);
  };

  // Synchronize calculation on rate change
  useEffect(() => {
    const num = parseFloat(calcGold) || 0;
    setCalcTOMAN(num > 0 ? Math.round((num / 1000) * goldRateTOMAN).toString() : '');
  }, [goldRateTOMAN]);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* 1. Portfolio Gold Summary Card */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Coins className="w-4 h-4 text-zinc-300" />
            <span>Ledger Gold Portfolio</span>
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            {ledgerGoldStats.goldCount} Gold Records
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
            {ledgerGoldStats.totalGold.toLocaleString()} G
          </div>
          <div className="text-xs font-mono text-zinc-400">
            ≈ {ledgerGoldStats.worthTOMAN.toLocaleString()} <span className="text-[10px] text-zinc-400 font-sans">تومان</span> (at {goldRateTOMAN.toLocaleString()} T / 1k G)
          </div>
        </div>
      </div>

      {/* 2. Interactive 2-Way Live Calculator */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-zinc-300" />
            <span>Live 2-Way Gold & Toman Calculator</span>
          </h3>
          <span className="text-[11px] font-mono text-zinc-500">
            Rate: {goldRateTOMAN.toLocaleString()} Toman / 1,000 G
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gold Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-400 flex items-center justify-between">
              <span>WoW Gold Amount</span>
              <span className="font-mono text-[10px] text-zinc-500">GOLD (G)</span>
            </label>
            <NumberStepperInput
              value={calcGold}
              onChange={(e) => handleGoldChange(e.target.value)}
              currency="GOLD"
              placeholder="1,000"
              className="text-sm"
            />
          </div>

          {/* Toman Output */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-400 flex items-center justify-between">
              <span>Equivalent in Iranian Toman</span>
              <span className="font-mono text-[10px] text-zinc-500">TOMAN (<span className="text-[9px] font-sans">تومان</span>)</span>
            </label>
            <NumberStepperInput
              value={calcTOMAN}
              onChange={(e) => handleTOMANChange(e.target.value)}
              currency="TOMAN"
              placeholder="3,200"
              className="text-sm"
            />
          </div>
        </div>

        {/* Quick Realm Presets inside Calculator */}
        <div className="pt-3 border-t border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-zinc-400" />
              <span>Quick Realm Token Presets</span>
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">1-click rate apply</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((preset) => {
              const isSelected = goldRateTOMAN === preset.tomanRate;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-2.5 rounded-xl border text-left transition-all space-y-1 ${
                    isSelected
                      ? 'bg-zinc-900 border-zinc-600 ring-1 ring-zinc-600'
                      : 'bg-zinc-900/40 hover:bg-zinc-900/80 border-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <GameIcon game={preset.game} className="w-3 h-3" />
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      {preset.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono font-medium">
                    {preset.tomanRate.toLocaleString()} T <span className="text-[9px] text-zinc-500">/ 1k G</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExchangeView;

