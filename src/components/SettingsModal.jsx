import React, { useRef } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from './ui/Dialog';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Check,
} from 'lucide-react';

export function SettingsModal({
  isOpen,
  onClose,
  globalCurrency = 'TOMAN',
  onCurrencyChange,
  onExportCsv,
  onExportJson,
  onImportJson,
  onResetData,
  onToast,
  entriesCount = 0,
}) {
  const fileInputRef = useRef(null);

  const currencyOptions = [
    { value: 'TOMAN', label: 'Toman (تومان)', flag: '🇮🇷' },
    { value: 'GOLD', label: 'GOLD (G)', icon: 'G' },
  ];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson?.(file);
      e.target.value = '';
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <DialogTitle>Settings & Data</DialogTitle>
      </DialogHeader>

      <DialogContent className="space-y-5">
        {/* Hidden file input for restore */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />

        {/* 1. Global Currency Preference */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-300">
            Default Display Currency
          </label>
          <p className="text-[11px] text-zinc-500">
            Choose the default primary currency used to calculate dashboard metrics and charts.
          </p>
          <div className="pt-1">
            <Select
              value={globalCurrency}
              onChange={(val) => {
                onCurrencyChange?.(val);
                onToast?.(`Currency switched to ${val}`);
              }}
              options={currencyOptions}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* 2. Data Backup & Export */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <label className="block text-xs font-semibold text-zinc-300">
            Data Backup & Portability
          </label>
          <p className="text-[11px] text-zinc-500">
            Nodra Vault stores all work records and screenshot proofs securely in local IndexedDB.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onExportJson?.();
                onClose();
              }}
              className="justify-start gap-2 text-xs"
            >
              <Download className="w-4 h-4 text-zinc-400" />
              <span>Full JSON Backup</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="justify-start gap-2 text-xs"
            >
              <Upload className="w-4 h-4 text-zinc-400" />
              <span>Restore JSON</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onExportCsv?.();
                onClose();
              }}
              className="justify-start gap-2 text-xs sm:col-span-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
              <span>Export CSV Spreadsheet</span>
            </Button>
          </div>
        </div>

        {/* 3. Reset Data */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <label className="block text-xs font-semibold text-rose-400">
            Database Reset
          </label>
          <p className="text-[11px] text-zinc-500">
            Reset database with fresh default sample jobs.
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (window.confirm('Reset database with fresh sample data?')) {
                onResetData?.();
                onClose();
              }
            }}
            className="gap-2 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset with Fresh Seed Data</span>
          </Button>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="primary" size="sm" onClick={onClose}>
          <Check className="w-3.5 h-3.5" />
          <span>Done</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default SettingsModal;
