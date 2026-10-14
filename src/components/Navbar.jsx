import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  BarChart3,
  Plus,
  Settings,
  Coins,
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
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from './ui/Button';
import { NumberStepperInput } from './ui/NumberStepperInput';
import { Kbd } from './ui/Tooltip';
import { CheckpointLogo, TomanIcon, DiscordIcon } from './ui/Icons';
import { ProfilePopover } from './ui/ProfilePopover';
import { STATUSES, STATUS_CONFIG, formatMoney } from '../lib/currencies';
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
import { trackerDB } from '../lib/db';
import { getStaticAppVersion } from '../lib/updater';
import {
  shouldShowGoldRatioTour,
  getStoredGoldRatioTourSeenVersion,
  markGoldRatioTourSeen,
  GOLD_RATIO_TOUR_SEEN_KEY,
} from '../lib/tours';

// OrderCalculatorPopover right-side drawer integration (toggled via onToggleCalculator & isCalculatorOpen)

export function Navbar({
  activeTab = 'ledger',
  onTabChange,
  globalCurrency = 'TOMAN',
  onCurrencyChange,
  goldRateTOMAN = 3200,
  onGoldRateTOMANChange,
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
  searchQuery = '',
  onSearchQueryChange,
  statusFilter = 'ALL',
  onStatusFilterChange,
  selectedCount = 0,
  selectedSum = 0,
  onBatchStatusChange,
  onBatchDelete,
  onCopyDiscordBatch,
  isDiscordBatchCopied = false,
  onClearSelection,
}) {
  const { t, formatNumber, isRtl, language } = useLanguage();
  const isDesktop = isTauri();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isRatesOpen, setIsRatesOpen] = useState(false);
  const [isProfilePopoverOpen, setIsProfilePopoverOpen] = useState(false);
  const [isBatchStatusOpen, setIsBatchStatusOpen] = useState(false);
  const [tempRateTOMAN, setTempRateTOMAN] = useState(goldRateTOMAN);
  const [tempRateUSD, setTempRateUSD] = useState(usdRateTOMAN);
  const [tempRateEUR, setTempRateEUR] = useState(eurRateUSD);
  const ratesDropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const batchStatusRef = useRef(null);

  useEffect(() => {
    setTempRateTOMAN(goldRateTOMAN);
  }, [goldRateTOMAN]);

  useEffect(() => {
    setTempRateUSD(usdRateTOMAN);
  }, [usdRateTOMAN]);

  useEffect(() => {
    setTempRateEUR(eurRateUSD);
  }, [eurRateUSD]);

  // Booster profile Gold Exchange Ratio tour management
  const [isTourGuideDismissed, setIsTourGuideDismissed] = useState(false);
  const [shouldShowTour, setShouldShowTour] = useState(() => {
    const effVersion = appVersion || getStaticAppVersion();
    const lastSeen = getStoredGoldRatioTourSeenVersion();
    const lastKnown = typeof localStorage !== 'undefined' ? localStorage.getItem('checkpoint_last_known_version') : null;
    return shouldShowGoldRatioTour({
      currentVersion: effVersion,
      lastSeenVersion: lastSeen,
      lastKnownVersion: lastKnown,
    });
  });

  // Re-verify eligibility whenever appVersion arrives or changes from SQLite DB
  useEffect(() => {
    let isCancelled = false;
    const checkEligibility = async () => {
      try {
        const effVersion = appVersion || getStaticAppVersion();
        const dbSeen = await trackerDB.getSetting(GOLD_RATIO_TOUR_SEEN_KEY, null);
        const lastKnown = (await trackerDB.getSetting('checkpoint_last_known_version', null)) ||
          (typeof localStorage !== 'undefined' ? localStorage.getItem('checkpoint_last_known_version') : null);
        const effectiveSeen = dbSeen || getStoredGoldRatioTourSeenVersion();
        if (!isCancelled) {
          const eligible = shouldShowGoldRatioTour({
            currentVersion: effVersion,
            lastSeenVersion: effectiveSeen,
            lastKnownVersion: lastKnown,
          });
          setShouldShowTour(eligible);
        }
      } catch (e) {}
    };

    checkEligibility();
    return () => {
      isCancelled = true;
    };
  }, [appVersion]);

  // Mark tour as seen for the current version once it loads for Booster profile
  useEffect(() => {
    if (activeProfileId === 'booster' && shouldShowTour && !isTourGuideDismissed) {
      const effVersion = appVersion || getStaticAppVersion();
      if (effVersion) {
        markGoldRatioTourSeen(effVersion);
      }
    }
  }, [activeProfileId, shouldShowTour, isTourGuideDismissed, appVersion]);

  const dismissTour = () => {
    setIsTourGuideDismissed(true);
    setShouldShowTour(false);
    const effVersion = appVersion || getStaticAppVersion();
    if (effVersion) {
      markGoldRatioTourSeen(effVersion);
    }
  };

  const showTourGuide = activeProfileId !== 'advertiser' && shouldShowTour && !isTourGuideDismissed && !isRatesOpen;
  const isRateUpdateNeeded = showTourGuide;

  const handleDismissTour = () => {
    dismissTour();
  };

  // Keyboard shortcut listener for Omnibar search focus (Ctrl+K or /)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const target = e.target;
        const tag = target?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !target?.isContentEditable) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Click outside listener for Rates dropdown & tour guide
  useEffect(() => {
    if (!isRatesOpen && !showTourGuide && !isBatchStatusOpen) return;

    const handleClickOutside = (e) => {
      if (ratesDropdownRef.current && !ratesDropdownRef.current.contains(e.target)) {
        if (isRatesOpen) setIsRatesOpen(false);
        if (showTourGuide) dismissTour();
      }
      if (batchStatusRef.current && !batchStatusRef.current.contains(e.target)) {
        setIsBatchStatusOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRatesOpen, showTourGuide, isBatchStatusOpen]);

  const handleSaveRate = () => {
    dismissTour();
    const gRate = Number(tempRateTOMAN) || 3200;
    const uRate = Number(tempRateUSD) || 95000;
    const eRate = Number(tempRateEUR) || 1.08;
    onGoldRateTOMANChange?.(gRate);
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
      className="hidden md:flex h-11 w-full bg-white/95 dark:bg-zinc-900/90 border-b border-zinc-200/80 dark:border-zinc-800/80 items-center justify-between px-3 lg:px-4 select-none shrink-0 z-40 text-zinc-700 dark:text-zinc-300 relative cursor-default gap-3"
    >
      {/* 1. Left Region: Brand & Profile Dropdown, +Work, Tabs */}
      <div data-no-drag className="flex items-center gap-2 shrink-0 z-10">
        {/* Brand & Profile Switcher */}
        <div className="relative" data-no-drag>
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
            <div className="inline-flex items-center rounded-md bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 shadow-xs border border-transparent select-none overflow-hidden h-7">
              <button
                type="button"
                onClick={() => onOpenWorkModal?.()}
                title={`${t('nav.addWork')} (N)`}
                className="flex items-center gap-1 h-full px-2.5 text-[11px] font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-colors cursor-pointer select-none"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span className={cn(isRtl && 'font-farsi')}>{t('nav.addWork')}</span>
              </button>
              <div className="h-3 w-px bg-zinc-700 dark:bg-zinc-300 pointer-events-none shrink-0" />
              <button
                type="button"
                onClick={onToggleCalculator}
                title={language === 'fa' ? 'ماشین حساب سفارشات ادورتایزر (Q)' : 'Order Calculator (Q)'}
                aria-label="Order Calculator"
                className="flex items-center justify-center h-full px-1.5 text-[11px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer select-none"
              >
                <Calculator className="w-3 h-3 shrink-0" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenWorkModal?.()}
              title={`${t('nav.addWork')} (N)`}
              className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] text-[11px] font-medium shadow-xs border border-transparent transition-all cursor-pointer select-none"
            >
              <Plus className="w-3 h-3 shrink-0" />
              <span className={cn(isRtl && 'font-farsi')}>{t('nav.addWork')}</span>
            </button>
          )}
        </div>

        {/* View Switcher Pills */}
        <div data-no-drag className="flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-md p-0.5 ml-1">
          <button
            type="button"
            onClick={() => onTabChange?.('ledger')}
            className={cn(
              'flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium transition-colors select-none',
              activeTab === 'ledger'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <Layers className="w-3 h-3" />
            <span className={cn(isRtl && 'font-farsi')}>{t('nav.ledger')}</span>
            {entriesCount > 0 && (
              <span className="text-[9px] px-1 py-0 leading-none rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-mono">
                {formatNumber(entriesCount)}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onTabChange?.('analytics')}
            className={cn(
              'flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium transition-colors select-none',
              activeTab === 'analytics'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <BarChart3 className="w-3 h-3" />
            <span className={cn(isRtl && 'font-farsi')}>{t('nav.analytics')}</span>
          </button>
        </div>
      </div>

      {/* 2. Center Region: Centered Omnibar */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-center min-w-0 px-2 h-full cursor-default z-10"
      >
        <div
          data-no-drag
          className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-400/40 dark:focus-within:ring-zinc-600/40 rounded-lg px-2.5 h-7 w-64 lg:w-80 transition-all text-xs shadow-2xs"
        >
          <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
          
          {statusFilter && statusFilter !== 'ALL' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shrink-0">
              <span>{t('status.' + statusFilter, statusFilter)}</span>
              <button
                type="button"
                onClick={() => onStatusFilterChange?.('')}
                className="hover:text-rose-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder={t('common.search', 'Search or filter...')}
            className="flex-1 bg-transparent border-0 outline-none p-0 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 min-w-0"
          />

          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange?.('')}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Kbd className="shrink-0 text-[9px] text-zinc-400 dark:text-zinc-500">⌘K</Kbd>
          )}
        </div>
      </div>

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
            onClick={() => {
              dismissTour();
              setTempRateTOMAN(goldRateTOMAN);
              setIsRatesOpen((prev) => !prev);
            }}
            title={
              language === 'fa'
                ? `نرخ تبدیل گلد: ۱k = ${goldRateTOMAN?.toLocaleString()} تومان`
                : `Gold Ratio: 1k = ${goldRateTOMAN?.toLocaleString()} Toman`
            }
            aria-label="Configure Gold Ratio"
            className={cn(
              'relative p-1.5 rounded-md transition-colors cursor-pointer select-none',
              isRatesOpen
                ? 'bg-zinc-100 dark:bg-zinc-900 text-amber-600 dark:text-amber-400'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            )}
          >
            <Coins className={cn('w-3.5 h-3.5', isRatesOpen ? 'text-amber-600 dark:text-amber-400' : 'text-amber-500/90 dark:text-amber-400/90')} />
            {isRateUpdateNeeded && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-black" />
            )}
          </button>

          {/* Tour Guide Card */}
          <AnimatePresence>
            {showTourGuide && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                data-no-drag
                dir={isRtl ? 'rtl' : 'ltr'}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                className="absolute top-full right-0 mt-2 w-72 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl space-y-2.5 z-50 text-zinc-900 dark:text-zinc-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      <Coins className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <h4 className={cn('text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider truncate', isRtl && 'font-farsi')}>
                        {language === 'fa' ? 'نرخ روزانه گلد' : 'Daily Gold Ratio'}
                      </h4>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDismissTour}
                    aria-label={language === 'fa' ? 'بستن' : 'Close'}
                    className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className={cn('text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed', isRtl && 'font-farsi')}>
                  {language === 'fa'
                    ? 'با کلیک روی این دکمه می‌توانید نرخ تبدیل گلد به تومان را برای تمام رکوردها تغییر دهید.'
                    : 'Click this button anytime to adjust your gold conversion rate for all entries.'}
                </p>
                <div className="flex items-center justify-end pt-1">
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={handleDismissTour}
                    className={cn('h-6 px-3 text-xs font-medium', isRtl && 'font-farsi')}
                  >
                    {language === 'fa' ? 'متوجه شدم' : 'Got it'}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Gold & Fiat Rates Dropdown */}
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

              {/* 1. Gold Rate */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span className={cn('font-medium', isRtl && 'font-farsi')}>{language === 'fa' ? 'تبدیل ۱,۰۰۰ گلد' : '1,000 Gold (G)'}</span>
                  <span className="font-mono text-zinc-400">{language === 'fa' ? 'تومان' : 'Toman'}</span>
                </div>
                <NumberStepperInput
                  step={50}
                  value={tempRateTOMAN}
                  onChange={(e) => setTempRateTOMAN(e.target.value)}
                  placeholder="3200"
                  currency="TOMAN"
                  className="text-xs"
                />
              </div>

              {/* 2. USD Rate */}
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

              {/* 3. EUR Rate */}
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
