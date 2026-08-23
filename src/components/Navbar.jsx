import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Layers,
  BarChart3,
  Plus,
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
  isTauri,
} from '../lib/desktop';

export function Navbar({
  activeTab = 'ledger',
  onTabChange,
  globalCurrency = 'TOMAN',
  onCurrencyChange,
  goldRateTOMAN = 3200,
  onGoldRateTOMANChange,
  onOpenWorkModal,
  onOpenSettings,
  onOpenShortcuts,
  entriesCount = 0,
}) {
  const isDesktop = isTauri();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isRatesOpen, setIsRatesOpen] = useState(false);
  const [tempRateTOMAN, setTempRateTOMAN] = useState(goldRateTOMAN);
  const ratesDropdownRef = useRef(null);

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
    onGoldRateTOMANChange?.(Number(tempRateTOMAN) || 3200);
    setIsRatesOpen(false);
  };

  const handleMinimize = (e) => {
    e.stopPropagation();
    minimizeWindow();
  };

  const handleToggleMaximize = async (e) => {
    e.stopPropagation();
    await toggleMaximizeWindow();
    const max = await isWindowMaximized();
    setIsMaximized(max);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    closeWindow();
  };

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={handleToggleMaximize}
      className="hidden md:flex h-12 w-full bg-zinc-950/95 border-b border-zinc-800/80 items-center justify-between px-3 lg:px-4 select-none shrink-0 z-40 text-zinc-300 relative cursor-default"
    >
      {/* 1. Left: Brand Identity (Draggable) & Add Work Button */}
      <div className="flex items-center gap-3 z-10 shrink-0">
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 cursor-default select-none"
        >
          <img
            src={nodraLogo}
            alt="Checkpoint"
            className="w-4 h-4 object-contain pointer-events-none"
          />
          <span className="text-xs font-bold tracking-tight text-zinc-100 pointer-events-none">
            Checkpoint
          </span>
          <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800/80 pointer-events-none">
            v2.1.0
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-800/80 pointer-events-none" />

        <div className="no-drag">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenWorkModal?.()}
            className="h-7 px-2.5 text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Work</span>
            <Kbd className="bg-zinc-900 text-zinc-300 border-zinc-700 text-[9px] px-1 py-0 ml-0.5">
              N
            </Kbd>
          </Button>
        </div>
      </div>

      {/* 2. Center: Segmented Sliding Tab Switcher (High-Contrast Active Pill) */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center no-drag z-10">
        <div className="bg-zinc-900/90 border border-zinc-800/90 p-0.5 rounded-lg flex items-center gap-0.5 shadow-inner">
          {/* Tab 1: Ledger */}
          <button
            type="button"
            onClick={() => onTabChange?.('ledger')}
            className={`relative flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'ledger'
                ? 'text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'ledger' && (
              <motion.div
                layoutId="activeNavTabPill"
                className="absolute inset-0 bg-zinc-100 rounded-md -z-10 shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Layers className={`w-3.5 h-3.5 ${activeTab === 'ledger' ? 'text-zinc-950' : 'text-zinc-500'}`} />
            <span>Ledger</span>
            {entriesCount > 0 && (
              <span
                className={`text-[10px] font-mono px-1 py-0.2 rounded border ${
                  activeTab === 'ledger'
                    ? 'bg-zinc-200 text-zinc-900 border-zinc-300 font-semibold'
                    : 'bg-zinc-900/80 text-zinc-400 border-zinc-800/80'
                }`}
              >
                {entriesCount}
              </span>
            )}
            <Kbd
              className={`text-[9px] bg-transparent border-transparent px-0 ${
                activeTab === 'ledger' ? 'text-zinc-700 font-semibold' : 'text-zinc-500'
              }`}
            >
              1
            </Kbd>
          </button>

          {/* Tab 2: Analytics */}
          <button
            type="button"
            onClick={() => onTabChange?.('analytics')}
            className={`relative flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'analytics' && (
              <motion.div
                layoutId="activeNavTabPill"
                className="absolute inset-0 bg-zinc-100 rounded-md -z-10 shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <BarChart3 className={`w-3.5 h-3.5 ${activeTab === 'analytics' ? 'text-zinc-950' : 'text-zinc-500'}`} />
            <span>Analytics</span>
            <Kbd
              className={`text-[9px] bg-transparent border-transparent px-0 ${
                activeTab === 'analytics' ? 'text-zinc-700 font-semibold' : 'text-zinc-500'
              }`}
            >
              2
            </Kbd>
          </button>
        </div>
      </div>

      {/* 3. Right: Consolidated Currency & Rates Dropdown, Settings, Window Controls */}
      <div className="flex items-center gap-2 no-drag z-10 shrink-0">
        {/* Consolidated Currency & Gold Ratio Dropdown */}
        <div className="relative" ref={ratesDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setTempRateTOMAN(goldRateTOMAN);
              setIsRatesOpen((prev) => !prev);
            }}
            title="Configure Display Currency and Gold Rate"
            className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md border text-xs transition-colors ${
              isRatesOpen
                ? 'bg-zinc-800 text-zinc-100 border-zinc-700 shadow-sm'
                : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100'
            }`}
          >
            {globalCurrency === 'GOLD' ? (
              <Coins className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            ) : (
              <Banknote className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            )}
            <span className="font-mono font-medium text-[11px]">{globalCurrency}</span>
            <span className="text-zinc-600 text-[10px]">•</span>
            <span className="font-mono text-[11px] text-zinc-400">
              1k={goldRateTOMAN >= 1000 ? `${(goldRateTOMAN / 1000).toFixed(1)}k` : goldRateTOMAN}T
            </span>
            <ChevronDown
              className={`w-3 h-3 text-zinc-500 transition-transform duration-150 ${
                isRatesOpen ? 'rotate-180 text-zinc-300' : ''
              }`}
            />
          </button>

          {/* Unified Downward Popover Menu */}
          {isRatesOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-60 p-3 bg-zinc-950 border border-zinc-800 shadow-2xl rounded-xl space-y-3 z-50">
              {/* Section 1: Display Currency Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Display Currency
                </label>
                <div className="grid grid-cols-2 gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => onCurrencyChange('TOMAN')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-colors ${
                      globalCurrency === 'TOMAN'
                        ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>TOMAN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCurrencyChange('GOLD')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium transition-colors ${
                      globalCurrency === 'GOLD'
                        ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>GOLD</span>
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

        {/* Settings & Shortcuts Buttons */}
        <div className="flex items-center gap-0.5 pl-1 border-l border-zinc-800/80">
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
          <div className="flex items-center gap-0.5 pl-1 border-l border-zinc-800/80">
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
                <Square className="w-3 h-3" />
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
