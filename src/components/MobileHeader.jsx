import React from 'react';
import { Settings, Coins, Sparkles } from 'lucide-react';
import { CURRENCIES } from '../lib/currencies';

export function MobileHeader({
  globalCurrency = 'USD',
  onOpenSettings,
  onOpenWorkModal,
}) {
  const currentCurrMeta = CURRENCIES[globalCurrency] || CURRENCIES.USD;

  return (
    <header className="sticky top-0 z-30 w-full bg-[#09090b]/80 backdrop-blur-2xl border-b border-white/[0.08] px-5 py-3.5 flex items-center justify-between transition-all">
      {/* Left: App Title & Icon matching reference screenshot */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-white/[0.12] to-white/[0.03] border border-white/[0.15] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] flex items-center justify-center text-sm font-black text-white">
          <span>⚔️</span>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
            Nodra Pay
          </h1>
        </div>
      </div>

      {/* Right: Currency Indicator & Settings Sheet Trigger */}
      <div className="flex items-center gap-2">
        {/* Active Currency Badge */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Change Global Currency"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] text-xs font-semibold text-zinc-300 hover:text-white transition-all active:scale-95"
        >
          <span className="text-xs">{currentCurrMeta.flag || '🪙'}</span>
          <span className="font-mono text-[11px]">{globalCurrency}</span>
        </button>

        {/* Settings / Data Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings & Data Management"
          className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

export default MobileHeader;
