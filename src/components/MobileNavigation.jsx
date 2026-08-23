import React from 'react';
import {
  Layers,
  BarChart3,
  Plus,
  Zap,
  Settings,
} from 'lucide-react';
import nodraLogo from '../../nodra-vault.svg';

export function MobileHeader({
  globalCurrency = 'TOMAN',
  onOpenSettings,
  onOpenWorkModal,
  onOpenQuickAdd,
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
          <span className="text-sm font-black tracking-wider text-white uppercase">
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
          onClick={onOpenQuickAdd}
          title="Quick Add Work"
          className="flex items-center justify-center w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95 transition-all cursor-pointer hover:text-white hover:border-zinc-700"
        >
          <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 active:scale-95 transition-all cursor-pointer"
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
  onOpenQuickAdd,
}) {
  return (
    <nav className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-zinc-800/80 px-4 py-1.5 safe-bottom">
      <div className="flex items-center justify-around max-w-sm mx-auto">
        {/* Tab 1: Ledger */}
        <button
          type="button"
          onClick={() => onTabChange?.('ledger')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
            activeTab === 'ledger' ? 'text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Layers className={`w-4 h-4 ${activeTab === 'ledger' ? 'text-zinc-100' : 'text-zinc-500'}`} />
          <span>Ledger</span>
        </button>

        {/* Center CTA Group: + Add Work & ⚡ Quick Add */}
        <div className="flex items-center gap-1.5 -mt-3">
          <button
            type="button"
            onClick={onOpenWorkModal}
            title="Add Work Record (N)"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-100 text-zinc-950 shadow-lg active:scale-95 transition-all border border-zinc-300 hover:bg-white cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onOpenQuickAdd}
            title="Quick Add Record (Q)"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-md active:scale-95 transition-all hover:bg-zinc-800 hover:text-white cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

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
