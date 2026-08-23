import React, { useState } from 'react';
import {
  Receipt,
  BarChart3,
  Coins,
  Banknote,
  Plus,
  Settings,
  Keyboard,
  Check,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { NumberStepperInput } from './ui/NumberStepperInput';
import { Kbd } from './ui/Tooltip';
import { CURRENCIES, formatMoney } from '../lib/currencies';

export function Sidebar({
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
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRateTOMAN, setTempRateTOMAN] = useState(goldRateTOMAN);

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

  const navItems = [
    { id: 'ledger', label: 'Ledger', icon: Receipt, hotkey: '1', count: entriesCount },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, hotkey: '2' },
  ];

  const handleSaveRate = () => {
    onGoldRateTOMANChange?.(Number(tempRateTOMAN) || 3200);
    setIsEditingRate(false);
  };

  return (
    <aside className="sidebar hidden md:flex flex-col w-56 lg:w-60 h-full bg-zinc-950 border-r border-zinc-800/80 p-3.5 select-none shrink-0 overflow-y-auto">
      {/* Primary Add Work CTA */}
      <div className="mb-4">
        <Button
          variant="primary"
          size="md"
          onClick={() => onOpenWorkModal?.()}
          className="w-full justify-between font-semibold shadow-sm"
        >
          <div className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Add Work</span>
          </div>
          <Kbd className="bg-zinc-900 text-zinc-300 border-zinc-700">N</Kbd>
        </Button>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange?.(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-900 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-100' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400">
                    {item.count}
                  </span>
                )}
                <Kbd className="text-[9px] text-zinc-500 bg-transparent border-transparent">
                  {item.hotkey}
                </Kbd>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom Controls */}
      <div className="pt-3 border-t border-zinc-800/80 space-y-2">
        {/* Currency Switcher */}
        <div>
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 px-1">
            Display Currency
          </label>
          <Select
            value={globalCurrency}
            onChange={onCurrencyChange}
            options={currencyOptions}
            className="h-8 text-xs bg-zinc-900/60 border-zinc-800"
            placeholder="Currency"
            dropUp={true}
          />
        </div>

        {/* Quick Gold Rate Pill */}
        <div className="relative">
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 px-1">
            Gold Ratio
          </label>
          <button
            type="button"
            onClick={() => {
              setTempRateTOMAN(goldRateTOMAN);
              setIsEditingRate((prev) => !prev);
            }}
            title="Click to edit live WoW Gold rate"
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/80 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Coins className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="font-mono text-[10px] truncate">
                1k = {goldRateTOMAN.toLocaleString()} T
              </span>
            </div>
            <span className="text-[9px] font-medium text-zinc-500 uppercase">Rate</span>
          </button>

          {/* Inline Quick Rate Editor Popover */}
          {isEditingRate && (
            <div className="absolute bottom-full left-0 right-0 mb-1.5 p-2.5 bg-zinc-950 border border-zinc-800 shadow-xl rounded-lg space-y-2 z-50">
              <div className="text-[10px] font-semibold text-zinc-400 flex items-center justify-between">
                <span>Set 1,000 Gold Rate (Toman)</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <NumberStepperInput
                    step={50}
                    value={tempRateTOMAN}
                    onChange={(e) => setTempRateTOMAN(e.target.value)}
                    placeholder="3200"
                    currency="TOMAN"
                    className="text-xs font-mono"
                  />
                </div>
              </div>
              <Button
                variant="primary"
                size="xs"
                onClick={handleSaveRate}
                className="w-full justify-center"
              >
                <Check className="w-3 h-3" />
                Save Rate
              </Button>
            </div>
          )}
        </div>

        {/* Settings & Shortcuts Footer Bar */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts (?)"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <Kbd>?</Kbd>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

