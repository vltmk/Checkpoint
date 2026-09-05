import React from 'react';
import {
  Layers,
  BarChart3,
  Plus,
  Zap,
  Settings,
  Bell,
} from 'lucide-react';
import { CheckpointLogo } from './ui/Icons';
import { openExternalUrl } from '../lib/desktop';
import { useLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';

export function MobileHeader({
  globalCurrency = 'TOMAN',
  onOpenSettings,
  onOpenWorkModal,
  onOpenQuickAdd,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  appVersion = '',
}) {
  const { t } = useLanguage();
  return (
    <header dir="ltr" className="md:hidden sticky top-0 z-40 w-full bg-white/95 dark:bg-zinc-950/95 border-b border-zinc-200 dark:border-zinc-800/80 px-4 py-2.5 flex items-center justify-between safe-top">
      <button
        type="button"
        onClick={() => openExternalUrl('https://github.com/vltmk/Checkpoint')}
        title="Open Checkpoint on GitHub"
        className="flex items-center gap-2 active:opacity-75 transition-opacity text-left cursor-pointer"
      >
        <CheckpointLogo className="w-5 h-5 text-zinc-800 dark:text-zinc-200 shrink-0" />
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black tracking-wider text-zinc-800 dark:text-zinc-200 uppercase">
            CHECKPOINT
          </span>
          {appVersion && (
            <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              v{appVersion}
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenNotifications}
          title="Notifications & Feed"
          className="relative flex items-center justify-center w-7 h-7 rounded-md bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 hover:text-zinc-900 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100 active:scale-[0.97] transition-transform duration-150 ease-out cursor-pointer"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 ring-1 ring-zinc-100 dark:ring-zinc-950" />
          )}
        </button>
        <button
          type="button"
          onClick={onOpenQuickAdd}
          title="Quick Add Work"
          className="flex items-center justify-center w-7 h-7 rounded-md bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 hover:text-zinc-900 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100 active:scale-[0.97] transition-transform duration-150 ease-out cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-300 active:scale-[0.97] transition-transform duration-150 ease-out cursor-pointer"
        >
          <span className="font-mono text-[11px]">{globalCurrency}</span>
          <Settings className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
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
  const { t, isRtl } = useLanguage();
  return (
    <nav className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 border-t border-zinc-200 dark:border-zinc-800/80 px-4 py-1.5 safe-bottom">
      <div className="flex items-center justify-around max-w-sm mx-auto">
        {/* Tab 1: Ledger */}
        <button
          type="button"
          onClick={() => onTabChange?.('ledger')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
            activeTab === 'ledger' ? 'text-zinc-800 dark:text-zinc-200 font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Layers className={`w-4 h-4 ${activeTab === 'ledger' ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 dark:text-zinc-500'}`} />
          <span className={cn(isRtl && 'font-farsi')}>{t('nav.ledger')}</span>
        </button>

        {/* Center CTA Group: + Add Work & ⚡ Quick Add */}
        <div className="flex items-center gap-1.5 -mt-3">
          <button
            type="button"
            onClick={onOpenWorkModal}
            title={`${t('nav.addWork')} (N)`}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900 text-zinc-100 border border-zinc-800 dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-300 shadow-lg active:scale-[0.97] transition-transform duration-150 ease-out hover:bg-zinc-800 dark:hover:bg-zinc-100 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onOpenQuickAdd}
            title={`${t('nav.quickAdd')} (Q)`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 shadow-sm active:scale-[0.97] transition-transform duration-150 ease-out hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Tab 2: Analytics */}
        <button
          type="button"
          onClick={() => onTabChange?.('analytics')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'analytics' ? 'text-zinc-800 dark:text-zinc-200 font-semibold' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 dark:text-zinc-500'}`} />
          <span className={cn(isRtl && 'font-farsi')}>{t('nav.analytics')}</span>
        </button>
      </div>
    </nav>
  );
}

export default MobileBottomNav;
