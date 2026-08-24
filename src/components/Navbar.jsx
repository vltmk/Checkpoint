import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Layers,
  BarChart3,
  Plus,
  Zap,
  Settings,
  Keyboard,
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
import nodraLogo from '../../nodra-vault.svg';
import {
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
  closeWindow,
  hideWindow,
  sendTrayNotification,
  startDraggingWindow,
  isTauri,
} from '../lib/desktop';

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
  onOpenShortcuts,
  entriesCount = 0,
  appVersion = '',
  updateInfo = null,
  onOpenUpdateModal,
  unreadNotificationsCount = 0,
  onOpenNotifications,
}) {
  const isDesktop = isTauri();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isRatesOpen, setIsRatesOpen] = useState(false);
  const [tempRateTOMAN, setTempRateTOMAN] = useState(goldRateTOMAN);
  const ratesDropdownRef = useRef(null);

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
    e.stopPropagation();
    if (minimizeToTray) {
      await hideWindow();
      sendTrayNotification(false);
    } else {
      minimizeWindow();
    }
  };

  const handleToggleMaximize = async (e) => {
    e.stopPropagation();
    await toggleMaximizeWindow();
    const max = await isWindowMaximized();
    setIsMaximized(max);
  };

  const handleClose = async (e) => {
    e.stopPropagation();
    if (closeToTray) {
      await hideWindow();
      sendTrayNotification(false);
    } else {
      closeWindow();
    }
  };

  const handleHeaderMouseDown = (e) => {
    // Only initiate window drag if left button and not clicking an interactive control
    if (e.button === 0 && !e.target.closest('button, input, select, textarea, [data-no-drag]')) {
      startDraggingWindow();
    }
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleHeaderMouseDown}
      onDoubleClick={handleToggleMaximize}
      className="hidden md:flex h-12 w-full bg-black/95 border-b border-zinc-900 items-center justify-between px-3 lg:px-4 select-none shrink-0 z-40 text-zinc-300 relative cursor-default gap-2"
    >
      {/* 1. Left: Brand Identity (Draggable) & Add Work Button */}
      <div data-tauri-drag-region onMouseDown={handleHeaderMouseDown} className="flex items-center gap-2.5 shrink-0 z-10">
        <div
          data-tauri-drag-region
          onMouseDown={handleHeaderMouseDown}
          className="flex items-center gap-2 cursor-default select-none"
        >
          <img
            src={nodraLogo}
            alt="CHECKPOINT"
            className="w-5 h-5 object-contain pointer-events-none"
          />
          <span className="text-xs font-black tracking-wider text-white pointer-events-none uppercase">
            CHECKPOINT
          </span>
          {appVersion && (
            <span className="hidden xl:inline-block text-[10px] text-zinc-500 font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800/80 pointer-events-none">
              v{appVersion}
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-zinc-800/80 pointer-events-none" />

        <div data-no-drag className="flex items-center">
          <div className="inline-flex items-center rounded-lg bg-zinc-100 p-0.5 shadow-sm border border-zinc-200/20">
            {/* Primary Add Work (Left Side) */}
            <button
              type="button"
              onClick={() => onOpenWorkModal?.()}
              title="Add Work Record (N)"
              className="flex items-center gap-1.5 h-6 px-2 text-xs font-semibold text-zinc-950 hover:bg-white active:bg-zinc-200 rounded-md transition-all cursor-pointer select-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Add Work</span>
              <Kbd className="bg-zinc-900 text-zinc-300 border-zinc-700 text-[9px] px-1 ml-0.5">
                N
              </Kbd>
            </button>

            {/* Subtle vertical hairline divider */}
            <div className="h-3.5 w-px bg-zinc-300/80 my-auto mx-0.5" />

            {/* Quick Add Lightning (Right Side) */}
            <button
              type="button"
              onClick={() => onOpenQuickAdd?.()}
              title="Quick Add Record (Q)"
              className="flex items-center justify-center h-6 px-1.5 text-xs font-semibold text-zinc-950 hover:bg-white active:bg-zinc-200 rounded-md transition-all cursor-pointer select-none gap-1"
            >
              <Zap className="w-3.5 h-3.5 text-zinc-950" strokeWidth={1.5} />
              <Kbd className="bg-zinc-900 text-zinc-300 border-zinc-700 text-[9px] px-1">
                Q
              </Kbd>
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
        <div data-no-drag className="bg-zinc-950 border border-zinc-800/90 p-0.5 rounded-lg flex items-center gap-0.5 shadow-inner">
          {/* Tab 1: Ledger */}
          <button
            type="button"
            onClick={() => onTabChange?.('ledger')}
            className={`relative isolate flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors select-none ${
              activeTab === 'ledger'
                ? 'text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 font-medium'
            }`}
          >
            {activeTab === 'ledger' && (
              <motion.div
                layoutId="activeNavTabPill"
                className="absolute inset-0 bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-700"
                transition={{ type: 'spring', stiffness: 480, damping: 35 }}
              />
            )}
            <Layers className={`w-3.5 h-3.5 ${activeTab === 'ledger' ? 'text-white' : 'text-zinc-500'}`} />
            <span>Ledger</span>
            {entriesCount > 0 && (
              <span
                className={`text-[10px] font-mono px-1 py-0.2 rounded border ${
                  activeTab === 'ledger'
                    ? 'bg-zinc-900 text-zinc-100 border-zinc-700 font-semibold'
                    : 'bg-zinc-900/80 text-zinc-400 border-zinc-800/80'
                }`}
              >
                {entriesCount}
              </span>
            )}
          </button>

          {/* Tab 2: Analytics */}
          <button
            type="button"
            onClick={() => onTabChange?.('analytics')}
            className={`relative isolate flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors select-none ${
              activeTab === 'analytics'
                ? 'text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 font-medium'
            }`}
          >
            {activeTab === 'analytics' && (
              <motion.div
                layoutId="activeNavTabPill"
                className="absolute inset-0 bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-700"
                transition={{ type: 'spring', stiffness: 480, damping: 35 }}
              />
            )}
            <BarChart3 className={`w-3.5 h-3.5 ${activeTab === 'analytics' ? 'text-white' : 'text-zinc-500'}`} />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {/* 3. Right: Consolidated Currency & Rates Dropdown, Settings, Window Controls */}
      <div data-tauri-drag-region onMouseDown={handleHeaderMouseDown} className="flex items-center gap-1.5 shrink-0 z-10">
        {/* Consolidated Currency & Gold Ratio Dropdown */}
        <div className="relative" ref={ratesDropdownRef} data-no-drag>
          <div className={`relative rounded-md overflow-hidden ${isRateUpdateNeeded ? 'p-[1px]' : ''}`}>
            {/* Minimal Animated Monochromatic Rotating & Pulsing Border */}
            {isRateUpdateNeeded && (
              <motion.div
                className="absolute inset-[-200%] pointer-events-none"
                style={{
                  background:
                    'conic-gradient(from 0deg, #3f3f46, #e4e4e7, #71717a, #ffffff, #27272a, #d4d4d8, #3f3f46)',
                }}
                animate={{
                  rotate: 360,
                  opacity: [0.25, 0.95, 0.25],
                  filter: [
                    'drop-shadow(0 0 1px rgba(255, 255, 255, 0.1))',
                    'drop-shadow(0 0 5px rgba(255, 255, 255, 0.45))',
                    'drop-shadow(0 0 1px rgba(255, 255, 255, 0.1))',
                  ],
                }}
                transition={{
                  rotate: {
                    repeat: Infinity,
                    duration: 5,
                    ease: 'linear',
                  },
                  opacity: {
                    repeat: Infinity,
                    duration: 2.2,
                    ease: 'easeInOut',
                  },
                  filter: {
                    repeat: Infinity,
                    duration: 2.2,
                    ease: 'easeInOut',
                  },
                }}
              />
            )}

            <button
              type="button"
              onClick={() => {
                recordRateInteraction();
                setTempRateTOMAN(goldRateTOMAN);
                setIsRatesOpen((prev) => !prev);
              }}
              title="Configure Display Currency and Gold Rate"
              className={`relative z-10 h-7 flex items-center gap-1.5 px-2 lg:px-2.5 rounded-[5px] text-xs transition-colors cursor-pointer select-none ${
                isRateUpdateNeeded
                  ? isRatesOpen
                    ? 'bg-zinc-900 text-zinc-100 shadow-sm'
                    : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-zinc-100'
                  : isRatesOpen
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                    : 'bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100'
              }`}
            >
              {globalCurrency === 'GOLD' ? (
                <Coins className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              ) : (
                <Banknote className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              )}
              <span className={globalCurrency === 'TOMAN' ? 'font-farsi font-medium text-[11px]' : 'font-sans font-medium text-[11px]'}>
                {globalCurrency === 'TOMAN' ? 'تومان' : 'Gold'}
              </span>
              <span className="hidden xl:inline text-zinc-600 text-[10px]">•</span>
              <span className="hidden xl:inline font-sans text-[11px] text-zinc-400">
                1k={goldRateTOMAN >= 1000 ? `${(goldRateTOMAN / 1000).toFixed(1)}k` : goldRateTOMAN}T
              </span>
              <ChevronDown
                className={`w-3 h-3 text-zinc-500 transition-transform duration-150 ${
                  isRatesOpen ? 'rotate-180 text-zinc-300' : ''
                }`}
              />
            </button>
          </div>

          {/* Unified Downward Popover Menu */}
          {isRatesOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-60 p-3 bg-zinc-950 border border-zinc-800 shadow-2xl rounded-xl space-y-3 z-50">
              {/* Section 1: Display Currency Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Display Currency
                </label>
                <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      recordRateInteraction();
                      onCurrencyChange('TOMAN');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-colors ${
                      globalCurrency === 'TOMAN'
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span className="font-farsi font-medium">تومان</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      recordRateInteraction();
                      onCurrencyChange('GOLD');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-colors ${
                      globalCurrency === 'GOLD'
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Gold</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-zinc-800/80" />

              {/* Section 2: Default Gold Rate Stepper */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400">
                  <span className="uppercase tracking-wider">Default Gold Rate</span>
                  <span className="font-mono text-zinc-500">Toman / 1,000 G</span>
                </div>
                <NumberStepperInput
                  step={50}
                  value={tempRateTOMAN}
                  onChange={(e) => setTempRateTOMAN(e.target.value)}
                  placeholder="3200"
                  currency="TOMAN"
                  className="text-xs font-mono h-8"
                />
                <Button
                  variant="primary"
                  size="xs"
                  onClick={handleSaveRate}
                  className="w-full justify-center h-7 text-xs gap-1.5 mt-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Save Default Rate</span>
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

        {/* Notifications, Settings & Shortcuts Buttons */}
        <div className="flex items-center gap-0.5 pl-1 border-l border-zinc-800/80" data-no-drag>
          <button
            type="button"
            onClick={onOpenNotifications}
            title="Notifications & Feed"
            className="relative p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Open Settings"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts (?)"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Desktop Window Controls */}
        {isDesktop && (
          <div className="flex items-center gap-0.5 pl-1 border-l border-zinc-800/80" data-no-drag>
            <button
              type="button"
              onClick={handleMinimize}
              className="h-6 w-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none"
              title="Minimize"
              aria-label="Minimize Window"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              className="h-6 w-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none"
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
              className="h-6 w-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-red-600/90 transition-colors focus:outline-none"
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
