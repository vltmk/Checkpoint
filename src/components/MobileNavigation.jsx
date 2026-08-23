import React from 'react';
import {
  Layers,
  BarChart3,
  Plus,
  Settings,
} from 'lucide-react';
import nodraLogo from '../../nodra-vault.svg';

export function MobileHeader({
  globalCurrency = 'TOMAN',
  onOpenSettings,
  onOpenWorkModal,
}) {
  return (
    <header className="md:hidden sticky top-0 z-40 w-full bg-zinc-950/95 border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between safe-top">
      <div className="flex items-center gap-2">
        <img
          src={nodraLogo}
          alt="CHECKPOINT"
          className="w-5 h-5 object-contain"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold tracking-wider text-zinc-100 uppercase">
            CHECKPOINT
          </span>
          <span className="text-[9px] font-mono font-medium px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            v2.1.0
          </span>
        </div>
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
  activeTab = 'ledger',
  onTabChange,
  onOpenWorkModal,
}) {
  return (
    <nav className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-zinc-800/80 px-4 py-1.5 safe-bottom">
      <div className="flex items-center justify-around max-w-sm mx-auto">
        {/* Tab 1: Ledger */}
        <button
          type="button"
          onClick={() => onTabChange?.('ledger')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'ledger' ? 'text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Layers className={`w-4 h-4 ${activeTab === 'ledger' ? 'text-zinc-100' : 'text-zinc-500'}`} />
          <span>Ledger</span>
        </button>

        {/* Center CTA: + Add Work */}
        <button
          type="button"
          onClick={onOpenWorkModal}
          title="Add Work"
          className="flex items-center justify-center w-10 h-10 -mt-3 rounded-full bg-zinc-100 text-zinc-950 shadow-lg active:scale-95 transition-all border border-zinc-300 hover:bg-white"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Tab 2: Analytics */}
        <button
          type="button"
          onClick={() => onTabChange?.('analytics')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'analytics' ? 'text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-zinc-100' : 'text-zinc-500'}`} />
          <span>Analytics</span>
        </button>
      </div>
    </nav>
  );
}

export default MobileBottomNav;
