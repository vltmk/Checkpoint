import React, { useRef } from 'react';
import { CURRENCIES } from '../lib/currencies';
import { Button } from './ui/Button';
import { Kbd } from './ui/Tooltip';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Plus,
  Keyboard,
  Coins,
  ShieldCheck,
} from 'lucide-react';

export function Header({
  globalCurrency,
  onCurrencyChange,
  onOpenWorkModal,
  onOpenShortcuts,
  onExportCsv,
  onExportJson,
  onImportJson,
  totalEntriesCount = 0,
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-black/80 backdrop-blur-2xl border-b border-white/[0.07] px-4 lg:px-8 py-3 transition-all duration-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="relative group flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-white/[0.12] to-white/[0.02] border border-white/[0.15] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
              <span className="text-xs font-black tracking-tighter text-white font-mono">NP</span>
              <div className="absolute inset-0 rounded-xl bg-emerald-500/10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  Nodra Pay
                </h1>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/[0.07] text-zinc-300 border border-white/[0.08]">
                  LEDGER
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" /> IndexedDB Active
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium hidden sm:block">
                Gaming Freelance & In-Game Currency Tracker
              </p>
            </div>
          </div>

          {/* Mobile '+ Log Work' shortcut */}
          <div className="md:hidden">
            <Button
              variant="primary"
              size="xs"
              onClick={() => onOpenWorkModal()}
              className="gap-1 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log</span>
            </Button>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto">
          {/* Currency Selector */}
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs">
            <Coins className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[10px] font-semibold text-zinc-400 tracking-wider">VIEW:</span>
            <select
              value={globalCurrency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <optgroup label="Fiat & Crypto" className="bg-[#0c0c0e] text-zinc-200">
                <option value="USD">USD ($)</option>
                <option value="TOMAN">Iranian Toman (تومان)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="USDT">USDT (₮)</option>
              </optgroup>
              <optgroup label="In-Game Currencies" className="bg-[#0c0c0e] text-zinc-200">
                <option value="ROBUX">Robux (R$)</option>
                <option value="VP">Valorant Points (VP)</option>
                <option value="VBUCKS">V-Bucks</option>
                <option value="WOW_GOLD">WoW Gold (g)</option>
                <option value="OSRS_GP">OSRS GP</option>
                <option value="TF2_KEYS">TF2 Keys</option>
                <option value="MINECOINS">Minecoins (MC)</option>
                <option value="CUSTOM_IGC">Custom Game Currency</option>
              </optgroup>
            </select>
          </div>

          {/* Keyboard Shortcuts Hint */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
            className="hidden sm:inline-flex"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <Kbd>?</Kbd>
          </Button>

          {/* Export CSV */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onExportCsv}
            title="Export Ledger to CSV (E)"
            className="text-zinc-300 hover:text-white"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">CSV</span>
          </Button>

          {/* Backup JSON */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onExportJson}
            title="Backup full ledger with screenshots as JSON (B)"
            className="text-zinc-300 hover:text-white"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden lg:inline">Backup</span>
          </Button>

          {/* Restore JSON */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title="Restore ledger from JSON backup file"
            className="text-zinc-300 hover:text-white"
          >
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden lg:inline">Restore</span>
          </Button>

          {/* Primary + Log Work Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenWorkModal()}
            className="hidden md:inline-flex gap-1.5 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Work</span>
            <Kbd className="bg-black/10 border-black/20 text-black">N</Kbd>
          </Button>
        </div>
      </div>
    </header>
  );
}
