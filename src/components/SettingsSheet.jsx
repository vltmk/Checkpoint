import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Database,
  FileSpreadsheet,
  Download,
  Upload,
  Keyboard,
  Coins,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { CURRENCIES } from '../lib/currencies';

export function SettingsSheet({
  isOpen,
  onClose,
  globalCurrency = 'USD',
  onCurrencyChange,
  onExportCsv,
  onExportJson,
  onImportJson,
  onOpenShortcuts,
  totalEntriesCount = 0,
}) {
  const fileInputRef = useRef(null);

  const currencyOptions = [
    { code: 'USD', label: 'USD ($)', flag: '🇺🇸' },
    { code: 'TOMAN', label: 'Toman (تومان)', flag: '🇮🇷' },
    { code: 'WOW_GOLD', label: 'WoW Gold (g)', flag: '🟡' },
    { code: 'EUR', label: 'EUR (€)', flag: '🇪🇺' },
    { code: 'GBP', label: 'GBP (£)', flag: '🇬🇧' },
    { code: 'USDT', label: 'USDT (₮)', flag: '🌐' },
  ];

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson?.(file);
      e.target.value = '';
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Frosted Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Bottom Sheet Modal Body */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 w-full max-w-[440px] bg-[#0c0c0f] border-t sm:border border-white/15 rounded-t-[32px] sm:rounded-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.2)] p-6 flex flex-col gap-5 max-h-[85vh] overflow-y-auto"
          >
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto -mt-2 mb-1 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Settings & Data
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  100% Offline Local Ledger • {totalEntriesCount} records
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Currency Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                Display Currency
              </label>
              <div className="grid grid-cols-2 gap-2">
                {currencyOptions.map((c) => {
                  const isSelected = globalCurrency === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        onCurrencyChange?.(c.code);
                      }}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-white text-black border-white shadow-[0_4px_16px_rgba(255,255,255,0.2)]'
                          : 'bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/[0.07] border-white/[0.08]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{c.flag}</span>
                        <span className="font-semibold">{c.code}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Data Export & Backup Actions */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                Data & Storage
              </label>
              <div className="flex flex-col gap-2">
                {/* Full JSON Backup */}
                <button
                  type="button"
                  onClick={() => {
                    onExportJson?.();
                    onClose();
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-white transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Export JSON Backup</div>
                      <div className="text-[11px] text-zinc-400">Includes all entries & proof screenshots</div>
                    </div>
                  </div>
                </button>

                {/* Restore JSON Backup */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-white transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Restore JSON Backup</div>
                      <div className="text-[11px] text-zinc-400">Import saved JSON file into local database</div>
                    </div>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* CSV Export */}
                <button
                  type="button"
                  onClick={() => {
                    onExportCsv?.();
                    onClose();
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-white transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Export Spreadsheet (CSV)</div>
                      <div className="text-[11px] text-zinc-400">Standard spreadsheet for Excel/Sheets</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Shortcuts trigger */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenShortcuts?.();
              }}
              className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-xs text-zinc-300 hover:text-white transition-all"
            >
              <span className="flex items-center gap-2 font-medium">
                <Keyboard className="w-4 h-4 text-zinc-400" />
                Keyboard Shortcuts Cheat Sheet
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/10 font-mono text-[10px]">
                ?
              </span>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default SettingsSheet;
