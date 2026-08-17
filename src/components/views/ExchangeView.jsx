import React, { useState, useMemo } from 'react';
import {
  Coins,
  ArrowRightLeft,
  Sliders,
  DollarSign,
  TrendingUp,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatMoney, convertCurrency } from '../../lib/currencies';

export function ExchangeView({
  entries = [],
  globalCurrency = 'USD',
  goldRateUSD = 0.035,
  goldRateTOMAN = 3200,
  onGoldRateUSDChange,
  onGoldRateTOMANChange,
  onToast,
}) {
  // 2-Way Calculator State
  const [calcGold, setCalcGold] = useState('100000');
  const [calcUSD, setCalcUSD] = useState('');
  const [calcTOMAN, setCalcTOMAN] = useState('');

  // Editable Rates State
  const [editRateUSD, setEditRateUSD] = useState(String(goldRateUSD));
  const [editRateTOMAN, setEditRateTOMAN] = useState(String(goldRateTOMAN));

  const rates = useMemo(
    () => ({ goldRateUSD, goldRateTOMAN }),
    [goldRateUSD, goldRateTOMAN]
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

    const worthUSD = (totalGold / 1000) * goldRateUSD;
    const worthTOMAN = (totalGold / 1000) * goldRateTOMAN;

    return { totalGold, goldCount, worthUSD, worthTOMAN };
  }, [entries, goldRateUSD, goldRateTOMAN]);

  // Handle calculator input changes
  const handleGoldChange = (val) => {
    setCalcGold(val);
    const num = parseFloat(val) || 0;
    setCalcUSD(num > 0 ? ((num / 1000) * goldRateUSD).toFixed(2) : '');
    setCalcTOMAN(num > 0 ? Math.round((num / 1000) * goldRateTOMAN).toString() : '');
  };

  const handleUSDChange = (val) => {
    setCalcUSD(val);
    const num = parseFloat(val) || 0;
    if (num > 0 && goldRateUSD > 0) {
      const g = (num / goldRateUSD) * 1000;
      setCalcGold(Math.round(g).toString());
      setCalcTOMAN(Math.round((g / 1000) * goldRateTOMAN).toString());
    } else {
      setCalcGold('');
      setCalcTOMAN('');
    }
  };

  const handleTOMANChange = (val) => {
    setCalcTOMAN(val);
    const num = parseFloat(val) || 0;
    if (num > 0 && goldRateTOMAN > 0) {
      const g = (num / goldRateTOMAN) * 1000;
      setCalcGold(Math.round(g).toString());
      setCalcUSD(((g / 1000) * goldRateUSD).toFixed(2));
    } else {
      setCalcGold('');
      setCalcUSD('');
    }
  };

  // Presets
  const presets = [
    { label: 'Retail WoW Token', usdRate: 0.035, tomanRate: 3200 },
    { label: 'Classic SoD', usdRate: 0.085, tomanRate: 7800 },
    { label: 'Cata Classic', usdRate: 0.028, tomanRate: 2500 },
    { label: 'Hardcore Realms', usdRate: 0.220, tomanRate: 20000 },
  ];

  const applyPreset = (preset) => {
    setEditRateUSD(String(preset.usdRate));
    setEditRateTOMAN(String(preset.tomanRate));
    onGoldRateUSDChange?.(preset.usdRate);
    onGoldRateTOMANChange?.(preset.tomanRate);
    onToast?.(`Applied preset: ${preset.label}`);
  };

  const handleSaveRates = () => {
    const u = parseFloat(editRateUSD) || 0.035;
    const t = parseFloat(editRateTOMAN) || 3200;
    onGoldRateUSDChange?.(u);
    onGoldRateTOMANChange?.(t);
    onToast?.('Exchange rates updated');
  };

  // Initial calculation on load
  React.useEffect(() => {
    handleGoldChange(calcGold);
  }, [goldRateUSD, goldRateTOMAN]);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* 1. Portfolio Gold Summary Card */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Ledger Gold Portfolio</span>
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            {ledgerGoldStats.goldCount} Gold Jobs
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
            🪙 {ledgerGoldStats.totalGold.toLocaleString()} GOLD
          </div>
          <div className="text-xs font-mono text-zinc-400">
            ≈ ${ledgerGoldStats.worthUSD.toFixed(2)} USD • {ledgerGoldStats.worthTOMAN.toLocaleString()} تومان
          </div>
        </div>
      </div>

      {/* 2. Interactive 2-Way Live Calculator */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-zinc-300" />
            <span>Live 2-Way Calculator</span>
          </h3>
          <span className="text-[11px] text-zinc-500">Instant Conversion</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Gold Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-400">
              WoW Gold (g)
            </label>
            <div className="relative">
              <Input
                type="number"
                value={calcGold}
                onChange={(e) => handleGoldChange(e.target.value)}
                placeholder="100,000"
                className="font-mono text-xs pr-8"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs">🪙</span>
            </div>
          </div>

          {/* USD Output */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-400">
              USD ($)
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={calcUSD}
                onChange={(e) => handleUSDChange(e.target.value)}
                placeholder="3.50"
                className="font-mono text-xs pr-8"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
            </div>
          </div>

          {/* Toman Output */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-400">
              Toman (تومان)
            </label>
            <div className="relative">
              <Input
                type="number"
                value={calcTOMAN}
                onChange={(e) => handleTOMANChange(e.target.value)}
                placeholder="320,000"
                className="font-mono text-xs pr-12"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">تومان</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Configurable Rates & Presets */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-zinc-300" />
            <span>Exchange Rates Configuration</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-400">
              Rate per 1,000 Gold in USD ($)
            </label>
            <Input
              type="number"
              step="0.001"
              value={editRateUSD}
              onChange={(e) => setEditRateUSD(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-400">
              Rate per 1,000 Gold in Toman (تومان)
            </label>
            <Input
              type="number"
              step="50"
              value={editRateTOMAN}
              onChange={(e) => setEditRateTOMAN(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" size="sm" onClick={handleSaveRates}>
            <Check className="w-3.5 h-3.5" />
            <span>Save Rate Settings</span>
          </Button>
        </div>

        {/* Realm Presets */}
        <div className="pt-3 border-t border-zinc-800/80 space-y-2">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Quick Realm Rate Presets
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="p-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/80 text-left transition-colors space-y-1"
              >
                <div className="text-xs font-semibold text-zinc-200 truncate">
                  {preset.label}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  ${preset.usdRate} / {preset.tomanRate} T
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExchangeView;
