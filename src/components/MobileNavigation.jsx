import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Coins,
  Plus,
  Settings,
} from 'lucide-react';
import nodraLogo from '../../nodra-pay.png';

export function MobileHeader({
  globalCurrency = 'USD',
  onOpenSettings,
  onOpenWorkModal,
}) {
  return (
    <header className="md:hidden sticky top-0 z-40 w-full bg-zinc-950/95 border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between safe-top">
      <div className="flex items-center gap-2.5">
        <img
          src={nodraLogo}
          alt="Nodra Pay"
          className="w-5 h-5 object-contain invert brightness-200"
        />
        <span className="text-sm font-bold tracking-tight text-zinc-100">
          Nodra Pay
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 active:scale-95 transition-all"
        >
          <span className="font-mono text-[11px]">{globalCurrency}</span>
          <Settings className="w-3 h-3 text-zinc-400" />
        </button>
      </div>
    </header>
  );
}

export function MobileBottomNav({
  activeTab = 'overview',
  onTabChange,
  onOpenWorkModal,
}) {
  const tabs = [
    { id: 'overview', label: 'Home', icon: LayoutDashboard },
    { id: 'ledger', label: 'Ledger', icon: Receipt },
    { id: 'analytics', label: 'Stats', icon: BarChart3 },
    { id: 'exchange', label: 'Exchange', icon: Coins },
  ];

  return (
    <nav className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-zinc-800/80 px-2 py-1.5 safe-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Tab 1: Overview */}
        <button
          type="button"
          onClick={() => onTabChange?.('overview')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'overview' ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 ${activeTab === 'overview' ? 'text-zinc-100' : 'text-zinc-500'}`} />
          <span>Home</span>
        </button>

        {/* Tab 2: Ledger */}
        <button
          type="button"
          onClick={() => onTabChange?.('ledger')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'ledger' ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
          }`}
        >
          <Receipt className={`w-4 h-4 ${activeTab === 'ledger' ? 'text-zinc-100' : 'text-zinc-500'}`} />
          <span>Ledger</span>
        </button>

        {/* Center CTA: + Log */}
        <button
          type="button"
          onClick={onOpenWorkModal}
          title="Log new work"
          className="flex items-center justify-center w-10 h-10 -mt-3 rounded-full bg-zinc-100 text-zinc-950 shadow-lg active:scale-95 transition-all border border-zinc-300"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Tab 3: Analytics */}
        <button
          type="button"
          onClick={() => onTabChange?.('analytics')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'analytics' ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
          }`}
        >
          <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-zinc-100' : 'text-zinc-500'}`} />
          <span>Stats</span>
        </button>

        {/* Tab 4: Exchange */}
        <button
          type="button"
          onClick={() => onTabChange?.('exchange')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'exchange' ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
          }`}
        >
          <Coins className={`w-4 h-4 ${activeTab === 'exchange' ? 'text-zinc-100' : 'text-zinc-500'}`} />
          <span>Rates</span>
        </button>
      </div>
    </nav>
  );
}
