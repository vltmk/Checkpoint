import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  BarChart3,
  Plus,
  Settings,
  Banknote,
  Coins,
  ChevronDown,
  Check,
  Minus,
  Square,
  Copy,
  X,
  Bell,
  ArrowUpCircle,
} from 'lucide-react';
import { Button } from './ui/Button';
import { NumberStepperInput } from './ui/NumberStepperInput';
import { Kbd } from './ui/Tooltip';
import { CheckpointLogo } from './ui/Icons';
import checkpointLogo from '../assets/checkpoint.svg';
import {
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
  closeWindow,
  hideWindow,
  sendTrayNotification,
  startDraggingWindow,
  isTauri,
  openExternalUrl,
} from '../lib/desktop';

import { useLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';

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
  onOpenQuickAdd,
  onOpenSettings,
  entriesCount = 0,
  appVersion = '',
  updateInfo = null,
  onOpenUpdateModal,
  unreadNotificationsCount = 0,
  onOpenNotifications,
}) {
  const { t, formatNumber, isRtl, language } = useLanguage();
  const isDesktop = isTauri();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isRatesOpen, setIsRatesOpen] = useState(false);
  const [tempRateTOMAN, setTempRateTOMAN] = useState(goldRateTOMAN);
  const ratesDropdownRef = useRef(null);

  useEffect(() => {
    setTempRateTOMAN(goldRateTOMAN);
  }, [goldRateTOMAN]);

  // Plays monochromatic border pulse after each reload until user interacts with the button
  const [hasInteractedThisSession, setHasInteractedThisSession] = useState(false);
  const isRateUpdateNeeded = !hasInteractedThisSession;

  const recordRateInteraction = () => {
    setHasInteractedThisSession(true);
  };

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

  // Click outside listener for Rates & Currency dropdown
  useEffect(() => {
    if (!isRatesOpen) return;

    const handleClickOutside = (e) => {
      if (ratesDropdownRef.current && !ratesDropdownRef.current.contains(e.target)) {
        setIsRatesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRatesOpen]);

  const handleSaveRate = () => {
    recordRateInteraction();
    onGoldRateTOMANChange?.(Number(tempRateTOMAN) || 3200);
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
    // Only maximize/restore if double clicking empty titlebar space (not buttons/interactive controls)
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

  const handleHeaderMouseDown = (e) => {
    // Only initiate window drag if left button and not clicking an interactive control
    if (e.button === 0 && !e.target.closest('button, a, input, select, textarea, [data-no-drag]')) {
      startDraggingWindow();
    }
  };

  const [isTourGuideDismissed, setIsTourGuideDismissed] = useState(false);
  const showTourGuide = isRateUpdateNeeded && !isTourGuideDismissed && !isRatesOpen;

  const handleDismissTour = () => {
    setIsTourGuideDismissed(true);
    recordRateInteraction();
  };

  const handleApplyPreset = (presetRate) => {
    recordRateInteraction();
    setIsTourGuideDismissed(true);
    onGoldRateTOMANChange?.(presetRate);
  };

  return (
    <header
      dir="ltr"
      data-tauri-drag-region
      onMouseDown={handleHeaderMouseDown}
      onDoubleClick={handleHeaderDoubleClick}
      className="hidden md:flex h-12 w-full bg-white/95 dark:bg-black/95 border-b border-zinc-200 dark:border-zinc-900 items-center justify-between px-3 lg:px-4 select-none shrink-0 z-40 text-zinc-700 dark:text-zinc-300 relative cursor-default gap-2"
    >
      {/* 1. Left: Brand Identity (Link to GitHub) & Add Work Button */}
      <div data-no-drag className="flex items-center gap-2.5 shrink-0 z-10">
        <button
          type="button"
          data-no-drag
          onClick={() => openExternalUrl('https://github.com/vltmk/Checkpoint')}
          title="Open Checkpoint repository on GitHub"
          className="flex items-center gap-2 select-none cursor-pointer group p-1 -m-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900/80 transition-colors"
        >
          <CheckpointLogo className="w-5 h-5 text-zinc-800 dark:text-zinc-200 group-hover:scale-105 transition-transform shrink-0" />
          <span className="hidden lg:inline text-xs font-black tracking-wider text-zinc-800 dark:text-zinc-200 uppercase group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
            CHECKPOINT
          </span>
          {appVersion && (
            <span className="hidden xl:inline-block text-[10px] text-zinc-500 font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 group-hover:border-zinc-300 dark:group-hover:border-zinc-700 transition-colors">
              v{appVersion}
            </span>
          )}
        </button>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800/80 pointer-events-none" />

        <div data-no-drag className="flex items-center">
          <div className="inline-flex items-center rounded-lg bg-zinc-200/90 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 p-0.5 shadow-sm border border-zinc-300 dark:border-zinc-700">
            {/* Primary Add Work (Left Side) */}
            <button
              type="button"
              onClick={() => onOpenWorkModal?.()}
              title={`${t('nav.addWork')} (N)`}
              className="flex items-center gap-1.5 h-6 px-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300/80 active:bg-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600 rounded-md transition-all cursor-pointer select-none"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className={cn('hidden lg:inline', isRtl && 'font-farsi')}>{t('nav.addWork')}</span>
            </button>

            {/* Subtle vertical hairline divider */}
            <div className="h-3.5 w-px bg-zinc-300 dark:bg-zinc-700 my-auto mx-0.5" />

            {/* Quick Add Lightning (Right Side) */}
            <button
              type="button"
              onClick={() => onOpenQuickAdd?.()}
              title={`${t('nav.quickAdd')} (Q)`}
              className="flex items-center justify-center h-6 px-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300/80 active:bg-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-600 rounded-md transition-all cursor-pointer select-none gap-1"
            >
              <span className={cn('text-xs font-semibold', isRtl ? 'font-farsi' : 'leading-none')}>
                {t('nav.quickAdd')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Center: Segmented Sliding Tab Switcher with Draggable Empty Gaps */}
      <div
        data-tauri-drag-region
        onMouseDown={handleHeaderMouseDown}
        className="flex-1 flex items-center justify-center min-w-0 px-1 h-full cursor-default z-10"
      >
        <div data-no-drag className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 p-0.5 rounded-lg flex items-center gap-0.5 shadow-inner">
          {/* Tab 1: Ledger */}
          <button
            type="button"
            onClick={() => onTabChange?.('ledger')}
            className={`relative isolate flex items-center justify-center gap-1.5 h-7 px-3 rounded-md text-xs transition-colors select-none ${
              activeTab === 'ledger'
                ? 'text-zinc-800 dark:text-zinc-200 font-semibold'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium'
            }`}
          >
            {activeTab === 'ledger' && (
              <motion.div
                layoutId="activeNavTabPill"
                className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-200/90 dark:border-zinc-700"
                transition={{ type: 'spring', stiffness: 480, damping: 35 }}
              />
            )}
            <Layers className={`w-3.5 h-3.5 ${activeTab === 'ledger' ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 dark:text-zinc-500'}`} />
            <span className={cn(isRtl && 'font-farsi')}>{t('nav.ledger')}</span>
            {entriesCount > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0 h-4 inline-flex items-center justify-center leading-none rounded border ${
                  activeTab === 'ledger'
                    ? 'bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 font-semibold'
                    : 'bg-zinc-200/50 text-zinc-600 border-zinc-300/60 dark:bg-zinc-900/80 dark:text-zinc-400 dark:border-zinc-800/80'
                }`}
              >
                {formatNumber(entriesCount)}
              </span>
            )}
          </button>

          {/* Tab 2: Analytics */}
          <button
            type="button"
            onClick={() => onTabChange?.('analytics')}
            className={`relative isolate flex items-center justify-center gap-1.5 h-7 px-3 rounded-md text-xs transition-colors select-none ${
              activeTab === 'analytics'
                ? 'text-zinc-800 dark:text-zinc-200 font-semibold'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium'
            }`}
          >
            {activeTab === 'analytics' && (
              <motion.div
                layoutId="activeNavTabPill"
                className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-200/90 dark:border-zinc-700"
                transition={{ type: 'spring', stiffness: 480, damping: 35 }}
              />
            )}
            <BarChart3 className={`w-3.5 h-3.5 ${activeTab === 'analytics' ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 dark:text-zinc-500'}`} />
            <span className={cn(isRtl && 'font-farsi')}>{t('nav.analytics')}</span>
          </button>
        </div>
      </div>

      {/* 3. Right: Gold Ratio Dropdown, Settings, Window Controls */}
      <div data-no-drag className="flex items-center gap-1.5 shrink-0 z-10">
        {/* Dedicated Gold Ratio Dropdown */}
        <div className="relative" ref={ratesDropdownRef} data-no-drag>
          <div className="relative rounded-md">
            {/* Subtle Rate Update Indicator */}
            {isRateUpdateNeeded && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-zinc-950 z-20" />
            )}

            <button
              type="button"
              onClick={() => {
                recordRateInteraction();
                setIsTourGuideDismissed(true);
                setTempRateTOMAN(goldRateTOMAN);
                setIsRatesOpen((prev) => !prev);
              }}
              title="Configure Gold Ratio (Toman per 1,000 Gold)"
              className={`relative z-10 h-7 flex items-center gap-1.5 px-2 lg:px-2.5 rounded-md text-xs transition-colors cursor-pointer select-none ${
                isRatesOpen
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                  : isRateUpdateNeeded
                  ? 'bg-zinc-950 hover:bg-zinc-900 border border-amber-500/50 text-zinc-200 hover:text-zinc-100'
                  : 'bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-mono font-medium text-[11px] text-zinc-200 inline-flex items-baseline">
                1<span className="text-[0.78em] text-zinc-400 font-medium select-none">k</span>
                <span className="mx-1 text-zinc-500">=</span>
                {goldRateTOMAN?.toLocaleString()} <span className="text-zinc-400 font-farsi text-[10px] ml-0.5">ت</span>
              </span>
              <ChevronDown
                className={`w-3 h-3 text-zinc-500 transition-transform duration-150 ${
                  isRatesOpen ? 'rotate-180 text-zinc-300' : ''
                }`}
              />
            </button>
          </div>

          {/* Launch One-Step Tour Guide Floating Card */}
          <AnimatePresence>
            {showTourGuide && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                data-no-drag
                dir={isRtl ? 'rtl' : 'ltr'}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                className="absolute top-full right-0 mt-2.5 w-72 p-3.5 bg-zinc-900/98 backdrop-blur-2xl border border-zinc-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-zinc-700/50 rounded-xl space-y-2.5 z-50 text-zinc-200"
              >
                {/* Little triangle pointing to the Gold Ratio button */}
                <div className="absolute -top-1.5 right-6 w-3 h-3 bg-zinc-900 border-t border-l border-zinc-700/80 rotate-45 pointer-events-none" />

                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-950/70 border border-amber-800/70 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className={cn('text-xs font-bold text-zinc-100 uppercase tracking-wider', isRtl && 'font-farsi')}>
                      {language === 'fa' ? 'نرخ روزانه گلد' : 'Daily Gold Ratio'}
                    </h4>
                    <p className={cn('text-[10px] text-zinc-400', isRtl && 'font-farsi')}>
                      {language === 'fa' ? 'تبدیل زنده محاسبات دفتر کل' : 'Live ledger conversions'}
                    </p>
                  </div>
                </div>

                <p className={cn('text-[11px] text-zinc-400 leading-relaxed', isRtl && 'font-farsi')}>
                  {language === 'fa'
                    ? 'با کلیک روی این دکمه می‌توانید نرخ تبدیل گلد به تومان را برای تمام رکوردها و محاسبات روزانه تغییر دهید.'
                    : 'Click this button anytime to adjust your gold conversion rate for all entries and totals.'}
                </p>

                {/* Action Buttons */}
                <div className="flex items-center justify-end pt-1.5 border-t border-zinc-800">
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={handleDismissTour}
                    className={cn(
                      'h-7 px-3.5 text-xs font-semibold bg-zinc-200 text-zinc-900 hover:bg-zinc-100 cursor-pointer shadow-sm active:scale-95 leading-none',
                      isRtl && 'font-farsi'
                    )}
                  >
                    <span className="inline-flex items-center justify-center leading-none">
                      {language === 'fa' ? 'متوجه شدم' : 'Got it'}
                    </span>
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dedicated Gold Ratio Popover Menu */}
          {isRatesOpen && (
            <div
              data-no-drag
              dir={isRtl ? 'rtl' : 'ltr'}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute top-full right-0 mt-1.5 w-64 p-3 bg-zinc-950 border border-zinc-800 shadow-2xl rounded-xl space-y-3 z-50"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400">
                  <span className={cn('uppercase tracking-wider', isRtl && 'font-farsi')}>{language === 'fa' ? 'نرخ تبدیل گلد' : 'Gold Exchange Ratio'}</span>
                  <span className="font-mono text-zinc-500">{language === 'fa' ? 'تومان / ۱,۰۰۰ گلد' : 'Toman / 1,000 G'}</span>
                </div>
                <NumberStepperInput
                  step={50}
                  value={tempRateTOMAN}
                  onChange={(e) => setTempRateTOMAN(e.target.value)}
                  placeholder="3200"
                  currency="TOMAN"
                  className="text-xs font-mono h-8"
                />

                {/* Dynamic Quick Presets based on current/typed rate */}
                {(() => {
                  const currentNum = Number(tempRateTOMAN) || Number(goldRateTOMAN) || 3200;
                  const base = Math.max(100, Math.round(currentNum / 100) * 100);
                  const presets = Array.from(
                    new Set([
                      Math.max(100, base - 200),
                      base,
                      base + 200,
                      base + 500,
                    ])
                  );
                  return (
                    <div className="grid grid-cols-4 gap-1 pt-1" dir="ltr">
                      {presets.map((pr) => (
                        <button
                          key={pr}
                          type="button"
                          onClick={() => setTempRateTOMAN(pr)}
                          className={`py-1 px-1 rounded text-[10px] font-mono border transition-colors ${
                            Number(tempRateTOMAN) === pr
                              ? 'bg-zinc-800 text-amber-300 border-amber-700/80 font-bold'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                          }`}
                        >
                          {pr >= 1000 ? (
                            <>
                              {(pr / 1000).toFixed(1)}
                              <span className="text-[0.78em] text-zinc-500 font-medium">k</span>
                            </>
                          ) : (
                            pr
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })()}

                <Button
                  variant="primary"
                  size="xs"
                  onClick={handleSaveRate}
                  className={cn('w-full justify-center h-7 text-xs gap-1.5 mt-2', isRtl && 'font-farsi')}
                >
                  <Check className="w-3 h-3" />
                  <span>{language === 'fa' ? 'ذخیره نرخ تبدیل' : 'Save Gold Ratio'}</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Optional Available Update Indicator */}
        {updateInfo && updateInfo.available && (
          <div data-no-drag className="flex items-center">
            <button
              type="button"
              onClick={onOpenUpdateModal}
              title={`Software Update v${updateInfo.version} Available`}
              className="h-7 px-2 flex items-center gap-1.5 rounded-md bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/60 hover:text-emerald-100 text-xs font-mono transition-colors shadow-sm cursor-pointer"
            >
              <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold text-[11px]">v{updateInfo.version}</span>
            </button>
          </div>
        )}

        {/* Notifications & Settings Buttons */}
        <div className="flex items-center gap-0.5 pl-1 border-l border-zinc-200 dark:border-zinc-800/80" data-no-drag>
          <button
            type="button"
            onClick={onOpenNotifications}
            title="Notifications & Feed"
            className="relative p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-black" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Open Settings"
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Desktop Window Controls */}
        {isDesktop && (
          <div
            className="flex items-center gap-0.5 pl-1 border-l border-zinc-200 dark:border-zinc-800/80"
            data-no-drag
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleMinimize}
              className="h-6 w-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer select-none"
              title="Minimize"
              aria-label="Minimize Window"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              className="h-6 w-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer select-none"
              title={isMaximized ? 'Restore' : 'Maximize'}
              aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
            >
              {isMaximized ? (
                <Copy className="w-3 h-3 rotate-180" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="h-6 w-7 flex items-center justify-center rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-100 hover:bg-red-600 transition-colors focus:outline-none cursor-pointer select-none"
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
