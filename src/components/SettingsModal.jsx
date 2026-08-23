import React, { useState, useEffect, useRef } from 'react';
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
  History,
  RotateCcw,
  ShieldCheck,
  Banknote,
  Coins,
} from 'lucide-react';
import { isTauri } from '../lib/desktop';
import { trackerDB } from '../lib/db';

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
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const isDesktop = isTauri();

  useEffect(() => {
    if (isOpen) {
      trackerDB.listSnapshots().then((list) => {
        setSnapshots(list || []);
        if (list && list.length > 0) {
          setSelectedSnapshot(list[0].id);
        }
      });
    }
  }, [isOpen]);

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

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson?.(file);
      e.target.value = '';
      onClose();
    }
  };

  const handleRestoreSnapshot = async () => {
    if (!selectedSnapshot) return;
    if (window.confirm('Restore database from this snapshot? Current unsaved modifications will be replaced.')) {
      const ok = await trackerDB.restoreSnapshot(selectedSnapshot);
      if (ok) {
        onToast?.('Database restored from snapshot successfully');
        window.location.reload();
      } else {
        onToast?.('Failed to restore snapshot');
      }
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <DialogTitle>Settings & Data</DialogTitle>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 flex items-center gap-1">
            <Database className="w-3 h-3 text-emerald-400" />
            {isDesktop ? 'SQLite Engine' : 'IndexedDB'}
          </span>
        </div>
      </DialogHeader>

      <DialogContent className="space-y-5">
        {/* Hidden file input for web restore */}
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
            Choose the default primary currency used across dashboard metrics and financial charts.
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

        {/* 2. Data Backup & Portability */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-zinc-300">
              Data Backup & Portability
            </label>
            <span className="text-[10px] font-mono text-zinc-500">
              {entriesCount} {entriesCount === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            {isDesktop
              ? 'Stored securely on this PC in standalone SQLite format.'
              : 'Stored securely in local client IndexedDB.'}
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
              onClick={() => {
                if (isDesktop) {
                  onImportJson?.();
                  onClose();
                } else {
                  fileInputRef.current?.click();
                }
              }}
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

        {/* 3. Automatic Daily Rolling Snapshots (Desktop/SQLite) */}
        {snapshots.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-zinc-400" />
                <span>Automatic Snapshots</span>
              </label>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Protected
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Rolling daily recovery points saved automatically to prevent data loss.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <Select
                  value={selectedSnapshot}
                  onChange={setSelectedSnapshot}
                  options={snapshots.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.entries_count} records)`,
                  }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRestoreSnapshot}
                className="gap-1.5 text-xs shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Restore</span>
              </Button>
            </div>
          </div>
        )}

        {/* 4. Reset Data */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <label className="block text-xs font-semibold text-rose-400">
            Database Reset
          </label>
          <p className="text-[11px] text-zinc-500">
            Reset database and populate with 25 realistic sample work logs for testing.
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (window.confirm('Reset database with 25 fresh sample records? All existing custom records will be replaced.')) {
                onResetData?.();
                onClose();
              }
            }}
            className="gap-2 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset with 25 Sample Jobs</span>
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
