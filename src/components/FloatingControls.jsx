import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  FileSpreadsheet,
  Download,
  Upload,
  SlidersHorizontal,
  Keyboard,
  Eye,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';
import { Kbd } from './ui/Tooltip';

export function FloatingControls({
  visibleElements = {
    avgRate: false,
    topGame: false,
    chartMonthly: true,
    chartCategory: false,
    chartClients: false,
  },
  onToggleElement,
  onResetDefaults,
  onExportCsv,
  onExportJson,
  onImportJson,
  onOpenShortcuts,
}) {
  const [activeMenu, setActiveMenu] = useState(null); // 'data' | 'views' | null
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!activeMenu) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenu]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson?.(file);
      e.target.value = '';
      setActiveMenu(null);
    }
  };

  const viewItems = [
    { key: 'avgRate', label: 'Average Rate' },
    { key: 'topGame', label: 'Top Client / Realm' },
    { key: 'chartMonthly', label: 'Monthly Income Chart' },
    { key: 'chartCategory', label: 'Revenue by Game Chart' },
    { key: 'chartClients', label: 'Top Clients Chart' },
  ];

  return (
    <div ref={containerRef} className="fixed bottom-5 left-5 z-40 flex items-center gap-2">
      {/* Hidden file input for Restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Button 1: Data / Backup Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'data' ? null : 'data')}
          title="Data & Backup Options"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-2xl border text-xs font-medium shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all active:scale-95 ${
            activeMenu === 'data'
              ? 'bg-white text-black border-white'
              : 'bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800/90 border-white/15'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Data</span>
        </button>

        {/* Data Popover */}
        <AnimatePresence>
          {activeMenu === 'data' && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full mb-2 left-0 w-56 bg-[#09090b]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl p-2 space-y-1 z-50"
            >
              <div className="flex items-center justify-between px-2 py-1 border-b border-white/[0.07] mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Data & Backup
                </span>
                <button
                  type="button"
                  onClick={() => setActiveMenu(null)}
                  className="p-0.5 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Export CSV */}
              <button
                type="button"
                onClick={() => {
                  onExportCsv?.();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.08] text-left text-xs text-zinc-200 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Kbd>Alt</Kbd>
                  <Kbd>E</Kbd>
                </div>
              </button>

              {/* Backup JSON */}
              <button
                type="button"
                onClick={() => {
                  onExportJson?.();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.08] text-left text-xs text-zinc-200 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Backup JSON</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Kbd>Alt</Kbd>
                  <Kbd>B</Kbd>
                </div>
              </button>

              {/* Restore JSON */}
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.08] text-left text-xs text-zinc-200 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  <span>Restore Backup</span>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Button 2: Customize Views Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'views' ? null : 'views')}
          title="Customize Visible Cards & Charts"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-2xl border text-xs font-medium shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all active:scale-95 ${
            activeMenu === 'views'
              ? 'bg-white text-black border-white'
              : 'bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800/90 border-white/15'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Views</span>
        </button>

        {/* Views Popover */}
        <AnimatePresence>
          {activeMenu === 'views' && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full mb-2 left-0 w-64 bg-[#09090b]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl p-3 space-y-2.5 z-50"
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Eye className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Customize Elements</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMenu(null)}
                  className="p-0.5 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Toggle checkboxes */}
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {viewItems.map((item) => {
                  const isChecked = Boolean(visibleElements[item.key]);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onToggleElement(item.key, !isChecked)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.07] text-left text-xs transition-all"
                    >
                      <span className={isChecked ? 'text-white font-medium' : 'text-zinc-400'}>
                        {item.label}
                      </span>
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-500 text-black'
                            : 'border-white/20 bg-transparent'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Reset footer */}
              <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between">
                <button
                  type="button"
                  onClick={onResetDefaults}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMenu(null)}
                  className="px-2.5 py-0.5 rounded-md bg-white text-black text-[11px] font-semibold hover:bg-zinc-200 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Button 3: Keyboard Shortcuts Guide */}
      <button
        type="button"
        onClick={onOpenShortcuts}
        title="Keyboard Shortcuts (?)"
        className="flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 text-zinc-300 hover:text-white border border-white/15 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all active:scale-95 text-xs font-mono font-bold"
      >
        ?
      </button>
    </div>
  );
}

export default FloatingControls;
