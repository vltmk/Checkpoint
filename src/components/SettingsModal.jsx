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
  AlertTriangle,
  Monitor,
  Bell,
  ArrowUpCircle,
  RotateCw,
  Keyboard,
  FolderArchive,
  Folder,
} from 'lucide-react';
import { isTauri, selectDirectoryNative } from '../lib/desktop';
import { trackerDB } from '../lib/db';
import { Input } from './ui/Input';

export function SettingsModal({
  isOpen,
  onClose,
  globalCurrency = 'TOMAN',
  onCurrencyChange,
  closeToTray = true,
  onCloseToTrayChange,
  minimizeToTray = false,
  onMinimizeToTrayChange,
  onExportCsv,
  onExportJson,
  onImportJson,
  onResetData,
  onClearAllData,
  onToast,
  entriesCount = 0,
  appVersion = '',
  updateInfo = null,
  onCheckUpdates,
  isCheckingUpdates = false,
  onOpenUpdateModal,
  onOpenShortcuts,
  autoBackupEnabled = false,
  onAutoBackupEnabledChange,
  autoBackupPath = '',
  onAutoBackupPathChange,
  autoBackupFrequency = 'daily',
  onAutoBackupFrequencyChange,
}) {
  const fileInputRef = useRef(null);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [purgeSnapshots, setPurgeSnapshots] = useState(false);
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
        <DialogTitle>Settings & Data</DialogTitle>
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

        {/* 2. Desktop Window & System Tray Behavior */}
        {isDesktop && (
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-zinc-400" />
                <span>Desktop Window & Tray</span>
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                System Tray
              </span>
            </div>

            <div className="space-y-2 pt-0.5">
              {/* Switch 1: Close to System Tray */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-medium text-zinc-200">
                    Close to System Tray
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Keep CHECKPOINT running in the background when window is closed
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={closeToTray}
                  onClick={() => onCloseToTrayChange?.(!closeToTray)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    closeToTray ? 'bg-zinc-100' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
                      closeToTray ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                    }`}
                  />
                </button>
              </div>

              {/* Switch 2: Minimize to System Tray */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-medium text-zinc-200">
                    Minimize to System Tray
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Hide to system tray instead of the taskbar when minimized
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={minimizeToTray}
                  onClick={() => onMinimizeToTrayChange?.(!minimizeToTray)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    minimizeToTray ? 'bg-zinc-100' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
                      minimizeToTray ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Software Updates & Announcements Feed */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <ArrowUpCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span>Updates & Announcements</span>
            </label>
            {appVersion && (
              <span className="text-[10px] font-mono text-zinc-500">
                v{appVersion}
              </span>
            )}
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-zinc-200">
                  {updateInfo?.available
                    ? `Update Available: v${updateInfo.version}`
                    : 'Checkpoint is up to date'}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {updateInfo?.available
                    ? 'A new version is ready for installation.'
                    : `Running official build${appVersion ? ` v${appVersion}` : ''}.`}
                </div>
              </div>

              {updateInfo?.available ? (
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => {
                    onOpenUpdateModal?.();
                    onClose();
                  }}
                  className="gap-1.5 text-xs h-7"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  <span>Update...</span>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={isCheckingUpdates}
                  onClick={onCheckUpdates}
                  className="gap-1.5 text-xs h-7"
                >
                  <RotateCw className={`w-3 h-3 text-zinc-400 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                  <span>{isCheckingUpdates ? 'Checking...' : 'Check Now'}</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 4. Data Backup & Portability */}
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
              <Upload className="w-4 h-4 text-zinc-400" />
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
              <Download className="w-4 h-4 text-zinc-400" />
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

        {/* 4. Scheduled Folder Backups (Custom User Directory) */}
        {isDesktop && (
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <FolderArchive className="w-3.5 h-3.5 text-zinc-400" />
                <span>Scheduled Folder Backups</span>
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                {autoBackupEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Automatically save timestamped JSON ledger backups to a designated folder on your PC.
            </p>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <div className="space-y-0.5 pr-2">
                <div className="text-xs font-medium text-zinc-200">
                  Auto-Export to Folder
                </div>
                <div className="text-[11px] text-zinc-500">
                  {autoBackupEnabled ? 'Backup will run on schedule' : 'Disabled by default'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoBackupEnabled}
                onClick={() => onAutoBackupEnabledChange?.(!autoBackupEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoBackupEnabled ? 'bg-zinc-100' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
                    autoBackupEnabled ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                  }`}
                />
              </button>
            </div>

            {/* Directory & Frequency Configuration when Enabled */}
            {autoBackupEnabled && (
              <div className="space-y-2.5 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/80">
                {/* Folder Selector */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Backup Folder Path
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs font-mono text-zinc-300 truncate">
                      {autoBackupPath || 'No folder selected'}
                    </div>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={async () => {
                        const dir = await selectDirectoryNative({ title: 'Select Automated Backup Folder' });
                        if (dir) {
                          onAutoBackupPathChange?.(dir);
                          onToast?.('Backup folder selected');
                        }
                      }}
                      className="gap-1 h-7 text-xs shrink-0"
                    >
                      <Folder className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Browse...</span>
                    </Button>
                  </div>
                </div>

                {/* Frequency Selector */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Export Frequency
                  </span>
                  <Select
                    value={autoBackupFrequency}
                    onChange={(val) => onAutoBackupFrequencyChange?.(val)}
                    options={[
                      { value: 'on_start', label: 'On Every App Startup' },
                      { value: 'daily', label: 'Daily (Once per day)' },
                      { value: 'weekly', label: 'Weekly (Once every 7 days)' },
                    ]}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Danger Zone: Reset & Clear All Data */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <label className="block text-xs font-semibold text-rose-400">
            Danger Zone
          </label>
          <p className="text-[11px] text-zinc-500">
            Re-populate with default mock data or completely wipe the database.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (window.confirm('Reset database with 25 fresh sample records? All existing custom records will be replaced.')) {
                  onResetData?.();
                  onClose();
                }
              }}
              className="gap-2 text-xs flex-1 justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Reset Sample Data</span>
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setClearConfirmText('');
                setPurgeSnapshots(false);
                setIsClearConfirmOpen(true);
              }}
              className="gap-2 text-xs flex-1 justify-center bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/80"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear All Data...</span>
            </Button>
          </div>
        </div>
      </DialogContent>

      <DialogFooter className="justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onOpenShortcuts?.();
          }}
          className="gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Shortcuts</span>
        </Button>
        <Button variant="primary" size="sm" onClick={onClose}>
          <Check className="w-3.5 h-3.5" />
          <span>Done</span>
        </Button>
      </DialogFooter>

      {/* Dedicated Text-Confirmation Security Modal for Wiping Database */}
      <Dialog
        open={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        maxWidth="max-w-sm"
      >
        <DialogHeader onClose={() => setIsClearConfirmOpen(false)}>
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <DialogTitle>Erase All Ledger Data</DialogTitle>
          </div>
        </DialogHeader>

        <DialogContent className="space-y-3.5 py-2">
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/60 space-y-1.5 text-xs text-rose-200">
            <p className="font-semibold text-rose-300">
              Warning: This action is permanent!
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              All <strong className="text-zinc-200 font-mono">{entriesCount}</strong> work entries, earnings records, and screenshot proof attachments will be permanently purged.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-300">
              Type <span className="font-mono font-bold text-rose-400">DELETE ALL</span> or <span className="font-mono font-bold text-rose-400">CLEAR</span> to confirm:
            </label>
            <Input
              type="text"
              placeholder="DELETE ALL"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              className="h-8 text-xs font-mono bg-zinc-950/80 border-rose-900/60 focus:border-rose-500 text-zinc-100"
              autoFocus
            />
          </div>

          <label className="flex items-center gap-2 text-[11px] text-zinc-400 select-none cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={purgeSnapshots}
              onChange={(e) => setPurgeSnapshots(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-rose-500 focus:ring-0 w-3.5 h-3.5"
            />
            <span>Also delete automatic recovery snapshots</span>
          </label>
        </DialogContent>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsClearConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={
              clearConfirmText.trim().toUpperCase() !== 'DELETE ALL' &&
              clearConfirmText.trim().toUpperCase() !== 'CLEAR'
            }
            onClick={() => {
              onClearAllData?.(purgeSnapshots);
              setIsClearConfirmOpen(false);
              onClose();
            }}
            className="gap-1.5 font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Erase Everything</span>
          </Button>
        </DialogFooter>
      </Dialog>
    </Dialog>
  );
}

export default SettingsModal;
