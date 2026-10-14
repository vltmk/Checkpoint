import React, { useState } from 'react';
import {
  Layers,
  BarChart3,
  Plus,
  Zap,
  Megaphone,
  Settings,
  Bell,
  ChevronDown,
  Calculator,
} from 'lucide-react';
import { CheckpointLogo } from './ui/Icons';
import { ProfilePopover } from './ui/ProfilePopover';
import { useLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';

export function MobileHeader({
  globalCurrency = 'TOMAN',
  onOpenSettings,
  onOpenWorkModal,
  onOpenCalculator,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  appVersion = '',
  activeProfileId = 'booster',
  onProfileChange,
  boosterEntriesCount = 0,
  advertiserEntriesCount = 0,
}) {
  const { t, language, isRtl } = useLanguage();
  const [isProfilePopoverOpen, setIsProfilePopoverOpen] = useState(false);

  return (
    <header
      dir={isRtl ? 'rtl' : 'ltr'}
      className="md:hidden sticky top-0 z-40 w-full bg-white/95 dark:bg-zinc-900/90 border-b border-zinc-200/80 dark:border-zinc-800/80 px-3 py-2 flex items-center justify-between safe-top select-none"
    >
      {/* Brand & Profile Popover Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsProfilePopoverOpen((prev) => !prev)}
          title="Switch Profile"
          className="flex items-center gap-2 active:opacity-75 transition-opacity text-start cursor-pointer"
        >
          <CheckpointLogo className="w-6 h-6 text-zinc-900 dark:text-zinc-100 shrink-0" />
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
            {activeProfileId === 'advertiser' ? (
              <>
                <Megaphone className="w-2.5 h-2.5 text-zinc-400" />
                <span className={cn(isRtl && 'font-farsi')}>{language === 'fa' ? 'ادورتایزر' : 'Advertiser'}</span>
              </>
            ) : (
              <>
                <Zap className="w-2.5 h-2.5 text-zinc-400" />
                <span className={cn(isRtl && 'font-farsi')}>{language === 'fa' ? 'بوستر' : 'Booster'}</span>
              </>
            )}
            <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
          </span>
        </button>

        <ProfilePopover
          isOpen={isProfilePopoverOpen}
          onClose={() => setIsProfilePopoverOpen(false)}
          activeProfileId={activeProfileId}
          onProfileChange={onProfileChange}
          appVersion={appVersion}
          boosterEntriesCount={boosterEntriesCount}
          advertiserEntriesCount={advertiserEntriesCount}
        />
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenNotifications}
          title="Notifications & Feed"
          className="relative flex items-center justify-center w-7 h-7 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>

        {activeProfileId === 'advertiser' && (
          <button
            type="button"
            onClick={onOpenCalculator}
            title={language === 'fa' ? 'ماشین حساب سفارشات (Q)' : 'Order Calculator (Q)'}
            className="flex items-center justify-center w-7 h-7 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="text-[10px] font-mono">{globalCurrency}</span>
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
  onOpenCalculator,
  activeProfileId = 'booster',
}) {
  const { t, isRtl, language } = useLanguage();
  return (
    <nav
      dir={isRtl ? 'rtl' : 'ltr'}
      className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/90 border-t border-zinc-200/80 dark:border-zinc-800/80 px-4 py-1.5 safe-bottom select-none"
    >
      <div className="flex items-center justify-around max-w-sm mx-auto">
        {/* Tab 1: Ledger */}
        <button
          type="button"
          onClick={() => onTabChange?.('ledger')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
            activeTab === 'ledger' ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Layers className={`w-4 h-4 ${activeTab === 'ledger' ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`} />
          <span className={cn('leading-normal', isRtl && 'font-farsi')}>{t('nav.ledger')}</span>
        </button>

        {/* Center CTA Group */}
        <div className="flex items-center gap-1.5 -mt-3">
          <button
            type="button"
            onClick={onOpenWorkModal}
            title={`${t('nav.addWork')} (N)`}
            className={cn(
              'mobile-add-work-btn flex items-center justify-center rounded-full bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 shadow-md active:scale-[0.98] transition-all hover:bg-zinc-800 dark:hover:bg-white cursor-pointer',
              activeProfileId === 'advertiser' ? 'w-11 h-11' : 'w-10 h-10'
            )}
          >
            <Plus className="w-5 h-5" />
          </button>
          {activeProfileId === 'advertiser' && (
            <button
              type="button"
              onClick={onOpenCalculator}
              title={language === 'fa' ? 'ماشین حساب سفارشات (Q)' : 'Order Calculator (Q)'}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 shadow-xs active:scale-[0.98] transition-all hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tab 2: Analytics */}
        <button
          type="button"
          onClick={() => onTabChange?.('analytics')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'analytics' ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`} />
          <span className={cn('leading-normal', isRtl && 'font-farsi')}>{t('nav.analytics')}</span>
        </button>
      </div>
    </nav>
  );
}

export default MobileBottomNav;
