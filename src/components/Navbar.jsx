import React, { useState, useEffect, useRef } from 'react';

import {
  BarChart3,
  Settings,
  ArrowLeftRight,
  ChevronDown,
  Check,
  Minus,
  Square,
  Copy,
  X,
  Bell,
  ArrowUpCircle,
  Zap,
  Megaphone,
  Calculator,
  Info,
  Gauge,
  Users,
  Wallet,
  ClipboardList,
} from 'lucide-react';
import { Button } from './ui/Button';
import { NumberStepperInput } from './ui/NumberStepperInput';
import { CheckpointLogo } from './ui/Icons';
import { ProfilePopover } from './ui/ProfilePopover';
import {
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
  closeWindow,
  hideWindow,
  sendTrayNotification,
  isTauri,
} from '../lib/desktop';

import { useLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';

// OrderCalculatorPopover right-side drawer integration (toggled via onToggleCalculator & isCalculatorOpen)

export function Navbar({
  activeTab = 'ledger',
  onTabChange,
  globalCurrency = 'TOMAN',
  onCurrencyChange,
  goldRateTOMAN = 3200,
  closeToTray = true,
  minimizeToTray = false,
  onOpenWorkModal,
  onOpenSettings,
  entriesCount = 0,
  appVersion = '',
  updateInfo = null,
  onOpenUpdateModal,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  activeProfileId = 'booster',
  onProfileChange,
  boosterEntriesCount = 0,
  advertiserEntriesCount = 0,
  isCalculatorOpen = false,
  onToggleCalculator,
  onCloseCalculator,
  usdRateTOMAN = 95000,
  eurRateUSD = 1.08,
  onSaveRates,
  onTransferFromCalculator,
}) {
  const navTab = activeProfileId === 'booster' && activeTab === 'money' ? 'cockpit' : activeTab;
  const { t, formatNumber, isRtl, language } = useLanguage();
  const isDesktop = isTauri();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isRatesOpen, setIsRatesOpen] = useState(false);
  const [isProfilePopoverOpen, setIsProfilePopoverOpen] = useState(false);
  const [tempRateUSD, setTempRateUSD] = useState(usdRateTOMAN);
  const [tempRateEUR, setTempRateEUR] = useState(eurRateUSD);
  const ratesDropdownRef = useRef(null);

  useEffect(() => {
    setTempRateUSD(usdRateTOMAN);
  }, [usdRateTOMAN]);

  useEffect(() => {
    setTempRateEUR(eurRateUSD);
  }, [eurRateUSD]);

  // Desktop window maximize state listener
  useEffect(() => {
    if (!isDesktop) return;

    let unlisten = null;
    const setupListener = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const max = await win.isMaximized();
        setIsMaximized(max);

        unlisten = await win.onResized(async () => {
          const isMax = await win.isMaximized();
          setIsMaximized(isMax);
        });
      } catch (e) {}
    };

    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, [isDesktop]);

  // Click outside listener for the rates dropdown
  useEffect(() => {
    if (!isRatesOpen) return;

    const handleClickOutside = (e) => {
      if (ratesDropdownRef.current && !ratesDropdownRef.current.contains(e.target)) setIsRatesOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRatesOpen]);

  const handleSaveRate = () => {
    // an empty or invalid field keeps the rate you already had; it never snaps back to a built-in default.
    // The gold rate is not edited here any more (each gold job carries its own), so it is passed through unchanged.
    const gRate = goldRateTOMAN;
    const uRate = Number(tempRateUSD) > 0 ? Number(tempRateUSD) : usdRateTOMAN;
    const eRate = Number(tempRateEUR) > 0 ? Number(tempRateEUR) : eurRateUSD;
    onSaveRates?.({
      goldRateTOMAN: gRate,
      usdRateTOMAN: uRate,
      eurRateUSD: eRate,
    });
    setIsRatesOpen(false);
  };

  const handleMinimize = async (e) => {
    e?.stopPropagation();
    if (minimizeToTray) {
      await hideWindow();
      sendTrayNotification(false);
    } else {
      await minimizeWindow();
    }
  };

  const handleToggleMaximize = async (e) => {
    e?.stopPropagation();
    await toggleMaximizeWindow();
    const max = await isWindowMaximized();
    setIsMaximized(max);
  };

  const handleHeaderDoubleClick = async (e) => {
    if (e.target.closest('button, a, input, select, textarea, [data-no-drag]')) {
      return;
    }
    e.stopPropagation();
    await handleToggleMaximize();
  };

  const handleClose = async (e) => {
    e?.stopPropagation();
    if (closeToTray) {
      await hideWindow();
      sendTrayNotification(false);
    } else {
      await closeWindow();
    }
  };

  return (
    <header
      dir="ltr"
      data-tauri-drag-region
      onDoubleClick={handleHeaderDoubleClick}
      className="hidden md:flex h-11 w-full bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800/80 items-center justify-between px-3 lg:px-4 select-none shrink-0 z-40 text-zinc-700 dark:text-zinc-300 relative cursor-default gap-3"
    >
      {/* 1. Left Region: Brand & Profile Dropdown, +Work, Tabs */}
      <div data-no-drag className="flex items-center gap-2 shrink-0 z-10">
        {/* Brand & Profile Switcher */}
        <div className="relative z-50" data-no-drag>
          <button
            type="button"
            data-no-drag
            onClick={() => setIsProfilePopoverOpen((prev) => !prev)}
            title="Switch Profile (Ctrl+Shift+P)"
            className="flex items-center gap-2 select-none cursor-pointer group py-1 px-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <CheckpointLogo className="w-6 h-6 text-zinc-900 dark:text-zinc-100 shrink-0 transition-transform group-hover:scale-105" />
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors border border-zinc-200/60 dark:border-zinc-700/60">
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
              <ChevronDown className={cn('w-2.5 h-2.5 text-zinc-400 transition-transform duration-100', isProfilePopoverOpen && 'rotate-180')} />
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

        {/* Add Work Button (Booster / Advertiser) */}
        <div data-no-drag className="flex items-center">
          {activeProfileId === 'advertiser' ? (
            <div className="flex items-center gap-1.5 select-none">
              {/* New orders are started from the Overview and Orders screens (or with N), so the top bar keeps only the calculator */}
              <button
                type="button"
                onClick={onToggleCalculator}
                title={language === 'fa' ? 'ماشین حساب سفارشات ادورتایزر (Q)' : 'Order Calculator (Q)'}
                aria-label={language === 'fa' ? 'ماشین حساب سفارشات ادورتایزر' : 'Order Calculator'}
                aria-pressed={isCalculatorOpen}
                className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-md border shadow-xs transition-colors cursor-pointer select-none active:scale-[0.97]',
                  isCalculatorOpen
                    ? 'bg-zinc-900 border-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-950'
                    : 'bg-white border-zinc-400 text-zinc-800 hover:bg-zinc-100 hover:border-zinc-500 dark:bg-zinc-900 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-400'
                )}
              >
                <Calculator className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
          ) : (
            null
          )}
        </div>

        {/* View Switcher Pills. Booster: Overview, Jobs, Clients, Reports (Money opens from the Overview). Advertiser: Overview, Orders, Boosters, Money, Reports. */}
        <div data-no-drag className="flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-md p-0.5 ml-1">
          {/* the Booster's Money screen opens from the Overview, so Overview stays lit while it is open */}
          {(activeProfileId === 'advertiser'
            ? [
                { id: 'cockpit', icon: Gauge, label: t('nav.cockpit') },
                { id: 'orders', icon: ClipboardList, label: t('nav.orders') },
                { id: 'people', icon: Users, label: t('nav.people') },
                { id: 'money', icon: Wallet, label: t('nav.money') },
                { id: 'analytics', icon: BarChart3, label: t('nav.reports') },
              ]
            : [
                { id: 'cockpit', icon: Gauge, label: t('nav.overview') },
                { id: 'orders', icon: ClipboardList, label: t('nav.jobs') },
                { id: 'people', icon: Users, label: t('nav.clients') },
                { id: 'analytics', icon: BarChart3, label: t('nav.reports') },
              ]
          ).map(({ id, icon: Icon, label, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange?.(id)}
              aria-current={navTab === id ? 'page' : undefined}
              className={cn(
                'flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium transition-colors select-none',
                navTab === id
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              )}
            >
              <Icon className="w-3 h-3" />
              <span className={cn(isRtl && 'font-farsi')}>{label}</span>
              {count > 0 && (
                <span className="text-[9px] px-1 py-0 leading-none rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-mono">
                  {formatNumber(count)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Center Region: empty drag area (search lives on the screens that have lists) */}
      <div data-tauri-drag-region className="flex-1 min-w-0 h-full cursor-default z-10" />

      {/* 3. Right Region: Ghost Actions & Desktop Window Controls */}
      <div data-no-drag className="flex items-center gap-1 shrink-0 z-10">
        {/* Software Update Badge */}
        {updateInfo && updateInfo.available && (
          <div data-no-drag className="flex items-center">
            <button
              type="button"
              onClick={onOpenUpdateModal}
              title={`Software Update v${updateInfo.version} Available`}
              className="h-6 px-2 flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-[11px] transition-colors cursor-pointer"
            >
              <ArrowUpCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-mono">v{updateInfo.version}</span>
            </button>
          </div>
        )}

        {/* Exchange Rates Button (Booster & Advertiser profiles) */}
        <div className="relative" ref={ratesDropdownRef} data-no-drag>
          <button
            type="button"
            onClick={() => setIsRatesOpen((prev) => !prev)}
            title={
              language === 'fa'
                ? `نرخ دلار: ۱ دلار = ${formatNumber(Number(usdRateTOMAN || 0).toLocaleString())} تومان`
                : `Exchange rates: $1 = ${Number(usdRateTOMAN || 0).toLocaleString()} Toman`
            }
            aria-label={language === 'fa' ? 'نرخ‌های تبدیل ارز' : 'Exchange rates'}
            className={cn(
              'relative p-1.5 rounded-md transition-colors cursor-pointer select-none',
              isRatesOpen
                ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            )}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* USD and EUR rates dropdown (gold is priced on each gold job) */}
          {isRatesOpen && (
            <div
              data-no-drag
              dir={isRtl ? 'rtl' : 'ltr'}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute top-full mt-1.5 right-0 left-auto w-80 p-3.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl space-y-3.5 z-50 text-xs"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span className={cn('text-xs font-semibold text-zinc-900 dark:text-zinc-100', isRtl && 'font-farsi')}>
                  {language === 'fa' ? 'نرخ‌های تبدیل ارز' : 'Exchange Rates'}
                </span>
                <span className="text-[10px] text-zinc-400">{activeProfileId === 'advertiser' ? 'Advertiser' : 'Pro / Booster'}</span>
              </div>

              {/* What these rates do and when to update them */}
              <div className={cn('flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30 p-2.5 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300', isRtl && 'font-farsi')}>
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <p>
                  {language === 'fa'
                    ? 'این نرخ‌ها مبالغ دلار و یورو را در کارهای جدید به تومان تبدیل می‌کنند. خودکار به‌روز نمی‌شوند؛ هر بار بازار تغییر کرد، نرخ فعلی را ذخیره کنید. نرخ گلد روی هر کار گلدی جداگانه پرسیده می‌شود.'
                    : 'These rates convert USD and EUR into Toman on new jobs. They do not update automatically: save the current rate whenever it changes. Gold is priced on each gold job instead.'}
                </p>
              </div>

              {/* 1. USD Rate */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span className={cn('font-medium', isRtl && 'font-farsi')}>{language === 'fa' ? 'تبدیل ۱ دلار (USD)' : '1 USD ($)'}</span>
                  <span className="font-mono text-zinc-400">{language === 'fa' ? 'تومان' : 'Toman'}</span>
                </div>
                <NumberStepperInput
                  step={500}
                  value={tempRateUSD}
                  onChange={(e) => setTempRateUSD(e.target.value)}
                  placeholder="95000"
                  currency="TOMAN"
                  className="text-xs"
                />
              </div>

              {/* 2. EUR Rate */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span className={cn('font-medium', isRtl && 'font-farsi')}>{language === 'fa' ? 'تبدیل ۱ یورو (EUR)' : '1 EUR (€)'}</span>
                  <span className="font-mono text-zinc-400">USD ($)</span>
                </div>
                <NumberStepperInput
                  step={0.01}
                  value={tempRateEUR}
                  onChange={(e) => setTempRateEUR(e.target.value)}
                  placeholder="1.08"
                  currency="USD"
                  className="text-xs"
                />
              </div>

              <Button
                variant="primary"
                size="xs"
                onClick={handleSaveRate}
                className={cn('w-full justify-center h-8 text-xs gap-1.5 mt-1', isRtl && 'font-farsi')}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{language === 'fa' ? 'ذخیره نرخ‌ها' : 'Save Rates'}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Notifications Icon */}
        <button
          type="button"
          onClick={onOpenNotifications}
          title="Notifications & Feed"
          className="relative p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>

        {/* Settings Icon */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Open Settings"
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Desktop Window Controls */}
        {isDesktop && (
          <div
            className="flex items-center gap-0.5 ml-1 pl-1 border-l border-zinc-200/80 dark:border-zinc-800/80"
            data-no-drag
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleMinimize}
              className="h-6 w-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer select-none"
              title="Minimize"
              aria-label="Minimize Window"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              className="h-6 w-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer select-none"
              title={isMaximized ? 'Restore' : 'Maximize'}
              aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
            >
              {isMaximized ? (
                <Copy className="w-3 h-3 rotate-180" />
              ) : (
                <Square className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="h-6 w-6 flex items-center justify-center rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-100 hover:bg-red-600 transition-colors cursor-pointer select-none"
              title="Close"
              aria-label="Close Window"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

    </header>
  );
}

export default Navbar;
