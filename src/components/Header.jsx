import React from 'react';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Kbd } from './ui/Tooltip';
import { Plus, Coins } from 'lucide-react';

export function Header({
  globalCurrency = 'USD',
  onCurrencyChange,
  onOpenWorkModal,
  onOpenShortcuts,
  onExportCsv,
  onExportJson,
  onImportJson,
  totalEntriesCount = 0,
}) {
  const currencyOptions = [
    { value: 'USD', label: 'USD ($)', flag: '🇺🇸' },
    { value: 'TOMAN', label: 'Toman (تومان)', flag: '🇮🇷' },
    { value: 'WOW_GOLD', label: 'WoW Gold (g)', icon: '🟡' },
    { value: 'EUR', label: 'EUR (€)', flag: '🇪🇺' },
    { value: 'GBP', label: 'GBP (£)', flag: '🇬🇧' },
    { value: 'USDT', label: 'USDT (₮)', flag: '🌐' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-black/80 backdrop-blur-2xl border-b border-white/[0.07] px-4 lg:px-8 py-3 transition-all duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="relative group flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-white/[0.12] to-white/[0.02] border border-white/[0.15] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
            <span className="text-xs font-black tracking-tighter text-white font-mono">NP</span>
            <div className="absolute inset-0 rounded-xl bg-emerald-500/10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                Nodra Pay
              </h1>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/[0.07] text-zinc-300 border border-white/[0.08]">
                LEDGER
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium hidden sm:block">
              Gaming & Freelance Ledger
            </p>
          </div>
        </div>

        {/* Global Controls & Log Work Action */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Main Currency Selector */}
          <div className="w-36 sm:w-44">
            <Select
              value={globalCurrency}
              onChange={onCurrencyChange}
              options={currencyOptions}
              className="h-8 text-xs font-semibold bg-white/[0.04] border-white/[0.08]"
              placeholder="Currency"
            />
          </div>

          {/* Primary Log Work Action */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenWorkModal?.()}
            className="gap-1.5 shadow-[0_0_20px_rgba(255,255,255,0.15)] font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log Work</span>
            <span className="sm:hidden">Log</span>
            <Kbd className="bg-black/10 border-black/20 text-black hidden sm:inline-flex">N</Kbd>
          </Button>
        </div>
      </div>
    </header>
  );
}

export default Header;
