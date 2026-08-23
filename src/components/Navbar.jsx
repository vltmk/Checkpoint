import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Receipt,
  BarChart3,
  Plus,
  Settings,
  Keyboard,
  Banknote,
  Coins,
  Check,
  Minus,
  Square,
  Copy,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
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
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRateTOMAN, setTempRateTOMAN] = useState(goldRateTOMAN);
  const ratePopoverRef = useRef(null);

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

  // Click outside listener for Gold Rate popover
  useEffect(() => {
    if (!isEditingRate) return;

    const handleClickOutside = (e) => {
      if (ratePopoverRef.current && !ratePopoverRef.current.contains(e.target)) {
        setIsEditingRate(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditingRate]);

  const currencyOptions = [
    {
      value: 'TOMAN',
      label: 'Toman (تومان)',
      icon: <Banknote className="w-3.5 h-3.5" />,
    },
    {
      value: 'GOLD',
      label: 'GOLD (G)',
      icon: <Coins className="w-3.5 h-3.5" />,
    },
  ];

  const handleSaveRate = () => {
    onGoldRateTOMANChange?.(Number(tempRateTOMAN) || 3200);
    setIsEditingRate(false);
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
      className="hidden md:flex h-12 w-full bg-zinc-950/95 border-b border-zinc-800/80 items-center justify-between px-3 lg:px-4 select-none shrink-0 z-40 text-zinc-300 relative"
    >
      {/* 1. Left: Brand Identity & Add Work Button */}
      <div className="flex items-center gap-3 no-drag z-10 shrink-0">
        <div className="flex items-center gap-2 pointer-events-none">
          <img
            src={nodraLogo}
            alt="Nodra Vault"
            className="w-4 h-4 object-contain"
          />
          <span className="text-xs font-bold tracking-tight text-zinc-100">
            Vault
          </span>
          <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800/80">
            v2.1.0
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-800/80" />

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

      {/* 2. Center: Segmented Sliding Tab Switcher */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center no-drag z-10">
        <div className="bg-zinc-900/90 border border-zinc-800/90 p-0.5 rounded-lg flex items-center gap-0.5 shadow-inner">
          {/* Tab 1: Ledger */}
          <button
            type="button"
            onClick={() => onTabChange?.('ledger')}
            className={`relative flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'ledger'
                ? 'text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'ledger' && (
              <motion.div
                layoutId="activeNavTabPill"
                className="absolute inset-0 bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-700/50"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <Receipt className={`w-3.5 h-3.5 ${activeTab === 'ledger' ? 'text-zinc-100' : 'text-zinc-500'}`} />
            <span>Ledger</span>
            {entriesCount > 0 && (
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-900/80 text-zinc-400 border border-zinc-800/80">
                {entriesCount}
              </span>
            )}
            <Kbd className="text-[9px] text-zinc-500 bg-transparent border-transparent px-0">
              1
            </Kbd>
          </button>

          {/* Tab 2: Analytics */}
          <button
            type="button"
            onClick={() => onTabChange?.('analytics')}
            className={`relative flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'analytics' && (
              <motion.div
                layoutId="activeNavTabPill"
                className="absolute inset-0 bg-zinc-800 rounded-md -z-10 shadow-sm border border-zinc-700/50"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <BarChart3 className={`w-3.5 h-3.5 ${activeTab === 'analytics' ? 'text-zinc-100' : 'text-zinc-500'}`} />
            <span>Analytics</span>
            <Kbd className="text-[9px] text-zinc-500 bg-transparent border-transparent px-0">
              2
            </Kbd>
          </button>
        </div>
      </div>

      {/* 3. Right: Currency, Gold Ratio, Settings, Window Controls */}
      <div className="flex items-center gap-2 no-drag z-10 shrink-0">
        {/* Currency Switcher */}
        <div className="w-28 sm:w-32">
          <Select
            value={globalCurrency}
            onChange={onCurrencyChange}
            options={currencyOptions}
            className="h-7 text-xs bg-zinc-900/60 border-zinc-800"
            placeholder="Currency"
          />
        </div>

        {/* Quick Gold Rate Pill */}
        <div className="relative" ref={ratePopoverRef}>
          <button
            type="button"
            onClick={() => {
              setTempRateTOMAN(goldRateTOMAN);
              setIsEditingRate((prev) => !prev);
            }}
            title="Click to edit live WoW Gold rate"
            className="h-7 flex items-center gap-1.5 px-2 rounded-md bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Coins className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="font-mono text-[11px]">
              1k = {goldRateTOMAN.toLocaleString()} T
            </span>
          </button>

          {/* Downward Quick Rate Editor Popover */}
          {isEditingRate && (
            <div className="absolute top-full right-0 mt-1.5 w-52 p-2.5 bg-zinc-950 border border-zinc-800 shadow-2xl rounded-lg space-y-2 z-50">
              <div className="text-[10px] font-semibold text-zinc-400 flex items-center justify-between">
                <span>Set 1,000 Gold Rate (Toman)</span>
              </div>
              <div className="space-y-1.5">
                <NumberStepperInput
                  step={50}
                  value={tempRateTOMAN}
                  onChange={(e) => setTempRateTOMAN(e.target.value)}
                  placeholder="3200"
                  currency="TOMAN"
                  className="text-xs font-mono h-7"
                />
              </div>
              <Button
                variant="primary"
                size="xs"
                onClick={handleSaveRate}
                className="w-full justify-center h-7 text-xs"
              >
                <Check className="w-3 h-3" />
                <span>Save Rate</span>
              </Button>
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
