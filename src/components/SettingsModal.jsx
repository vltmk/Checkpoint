import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Mail,
  ExternalLink,
  Loader2,
  Sun,
  Moon,
} from 'lucide-react';
import { isTauri, selectDirectoryNative, openExternalUrl, copyTextNative, openPathNative } from '../lib/desktop';
import { DiscordIcon, TelegramIcon } from './ui/Icons';
import { trackerDB } from '../lib/db';
import { useTheme } from 'next-themes';
import { Input } from './ui/Input';
import { useLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';

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
  onClearAllData,
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
  autoBackupRetention = 5,
  onAutoBackupRetentionChange,
  onManualAutoBackup,
  theme = 'dark',
  onThemeChange,
  handleThemeChange,
}) {
  const { language, setLanguage, t, isRtl, formatNumber } = useLanguage();
  const fileInputRef = useRef(null);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [purgeSnapshots, setPurgeSnapshots] = useState(false);
  const [manualBackupState, setManualBackupState] = useState('idle'); // 'idle' | 'running' | 'success' | 'no_folder_error' | 'error'
  const [snapshotRestoreState, setSnapshotRestoreState] = useState('idle'); // 'idle' | 'restoring' | 'success' | 'error'
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [exportJsonState, setExportJsonState] = useState('idle');
  const [exportCsvState, setExportCsvState] = useState('idle');
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
    if (window.confirm(t('settings.restoreSnapshotConfirm', 'Restore database from this snapshot? Current unsaved modifications will be replaced.'))) {
      setSnapshotRestoreState('restoring');
      const ok = await trackerDB.restoreSnapshot(selectedSnapshot);
      if (ok) {
        setSnapshotRestoreState('success');
        setTimeout(() => window.location.reload(), 400);
      } else {
        setSnapshotRestoreState('error');
        setTimeout(() => setSnapshotRestoreState('idle'), 2500);
      }
    }
  };

  const { theme: activeTheme, setTheme } = useTheme();
  const currentTheme = activeTheme || theme || 'dark';

  const toggleTheme = (e) => {
    e?.stopPropagation?.();
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const handler = handleThemeChange || onThemeChange;
    if (handler) {
      handler(nextTheme);
    } else {
      setTheme(nextTheme);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader
        onClose={onClose}
        actions={
          <div
            role="button"
            tabIndex={0}
            onClick={toggleTheme}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleTheme(e);
              }
            }}
            title={currentTheme === 'light' ? t('settings.themeDark', 'Dark mode') : t('settings.themeLight', 'Light mode')}
            aria-label="Toggle theme"
            className="relative flex items-center p-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 shadow-inner select-none cursor-pointer group active:scale-[0.96] transition-transform duration-150"
            dir="ltr"
          >
            {/* Light Option */}
            <div
              className={cn(
                'relative flex items-center justify-center w-6 h-6 rounded-full transition-colors pointer-events-none',
                currentTheme === 'light'
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              {currentTheme === 'light' && (
                <motion.div
                  layoutId="settingsThemePill"
                  className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-full shadow-sm border border-zinc-300 dark:border-zinc-700"
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
              <Sun className={cn('w-3.5 h-3.5 relative z-10 transition-transform duration-200 stroke-[2.2]', currentTheme === 'light' ? 'scale-105 rotate-12' : 'scale-90 opacity-70')} />
            </div>

            {/* Dark Option */}
            <div
              className={cn(
                'relative flex items-center justify-center w-6 h-6 rounded-full transition-colors pointer-events-none',
                currentTheme === 'dark'
                  ? 'text-zinc-800 dark:text-zinc-200 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              {currentTheme === 'dark' && (
                <motion.div
                  layoutId="settingsThemePill"
                  className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-full shadow-sm border border-zinc-300 dark:border-zinc-700"
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
              <Moon className={cn('w-3.5 h-3.5 relative z-10 transition-transform duration-200 stroke-[2.2]', currentTheme === 'dark' ? 'scale-105 -rotate-12' : 'scale-90 opacity-70')} />
            </div>
          </div>
        }
      >
        <DialogTitle className={cn(isRtl && 'font-farsi')}>{t('settings.title')}</DialogTitle>
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

        {/* 0. Language Selector */}
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <div className="space-y-0.5 min-w-0 pr-1">
            <label className={cn('block text-xs font-semibold text-zinc-200', isRtl && 'font-farsi')}>
              {t('settings.language')}
            </label>
            <p className={cn('text-[11px] text-zinc-500 leading-tight', isRtl && 'font-farsi')}>
              {t('settings.languageDesc')}
            </p>
          </div>
          <div className="w-36 shrink-0">
            <Select
              value={language}
              onChange={(val) => {
                setLanguage(val);
              }}
              options={[
                { value: 'fa', label: 'فارسی (پیش‌فرض)' },
                { value: 'en', label: 'English' },
              ]}
              className="h-8 text-xs bg-zinc-950/80 font-medium"
            />
          </div>
        </div>

        {/* 1. Global Currency Preference */}
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <div className="space-y-0.5 min-w-0 pr-1">
            <label className={cn('block text-xs font-semibold text-zinc-200', isRtl && 'font-farsi')}>
              {t('settings.currency')}
            </label>
            <p className={cn('text-[11px] text-zinc-500 leading-tight', isRtl && 'font-farsi')}>
              {t('settings.currencyDesc')}
            </p>
          </div>
          <div className="w-36 shrink-0">
            <Select
              value={globalCurrency}
              onChange={(val) => {
                onCurrencyChange?.(val);
              }}
              options={currencyOptions}
              className="h-8 text-xs bg-zinc-950/80"
            />
          </div>
        </div>

        {/* 2. Desktop Window & System Tray Behavior */}
        {isDesktop && (
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className={cn('block text-xs font-semibold text-zinc-300 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                <Monitor className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t('settings.desktopTray')}</span>
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                Tray
              </span>
            </div>

            <div className="space-y-2 pt-0.5">
              {/* Switch 1: Close to System Tray */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                <div className="space-y-0.5 pr-2">
                  <div className={cn('text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                    {t('settings.closeToTray')}
                  </div>
                  <div className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                    {t('settings.closeToTrayDesc')}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  dir="ltr"
                  aria-checked={closeToTray}
                  onClick={() => onCloseToTrayChange?.(!closeToTray)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
                    closeToTray
                      ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-200'
                      : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-sm ring-0 transition duration-200 ease-in-out ${
                      closeToTray ? 'translate-x-4 bg-white dark:bg-zinc-950' : 'translate-x-0 bg-white dark:bg-zinc-400'
                    }`}
                  />
                </button>
              </div>

              {/* Switch 2: Minimize to System Tray */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                <div className="space-y-0.5 pr-2">
                  <div className={cn('text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                    {t('settings.minimizeToTray')}
                  </div>
                  <div className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                    {t('settings.minimizeToTrayDesc')}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  dir="ltr"
                  aria-checked={minimizeToTray}
                  onClick={() => onMinimizeToTrayChange?.(!minimizeToTray)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
                    minimizeToTray
                      ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-200'
                      : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-sm ring-0 transition duration-200 ease-in-out ${
                      minimizeToTray ? 'translate-x-4 bg-white dark:bg-zinc-950' : 'translate-x-0 bg-white dark:bg-zinc-400'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Scheduled Folder Backups (Custom User Directory) */}
        {isDesktop && (
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className={cn('block text-xs font-semibold text-zinc-300 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                <FolderArchive className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t('settings.autoBackups')}</span>
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                {autoBackupEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
              {t('settings.autoBackupsDesc')}
            </p>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
              <div className="space-y-0.5 pr-2">
                <div className={cn('text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                  {t('settings.autoBackups')}
                </div>
                <div className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                  {autoBackupEnabled
                    ? (autoBackupPath ? 'Automated backups active' : 'Select a folder to activate')
                    : 'Disabled by default'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                dir="ltr"
                aria-checked={autoBackupEnabled}
                onClick={async () => {
                  if (!autoBackupEnabled && !autoBackupPath) {
                    const dir = await selectDirectoryNative({ title: 'Select Automated Backup Folder' });
                    if (dir) {
                      onAutoBackupPathChange?.(dir);
                      onAutoBackupEnabledChange?.(true);
                    }
                  } else {
                    onAutoBackupEnabledChange?.(!autoBackupEnabled);
                  }
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoBackupEnabled
                    ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-200'
                    : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-sm ring-0 transition duration-200 ease-in-out ${
                    autoBackupEnabled ? 'translate-x-4 bg-white dark:bg-zinc-950' : 'translate-x-0 bg-white dark:bg-zinc-400'
                  }`}
                />
              </button>
            </div>

            {/* Directory & Frequency Configuration when Enabled */}
            {autoBackupEnabled && (
              <div className="space-y-2.5 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/80">
                {/* Folder Selector - Row 1: Address Bar (Clickable) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block', isRtl && 'font-farsi')}>
                      {t('settings.backupFolder')}
                    </span>
                    {autoBackupPath && (
                      <span className={cn('text-[10px] text-zinc-500 font-mono', isRtl && 'font-farsi')}>
                        {language === 'fa' ? 'برای باز کردن در فایل‌ها کلیک کنید' : 'Click to open in Explorer'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (autoBackupPath) {
                        await openPathNative(autoBackupPath);
                      } else {
                        const dir = await selectDirectoryNative({ title: 'Select Automated Backup Folder' });
                        if (dir) {
                          onAutoBackupPathChange?.(dir);
                        }
                      }
                    }}
                    className={cn(
                      'w-full px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-900/80 border rounded-md text-xs font-mono transition-all flex items-center justify-between gap-2 text-left group cursor-pointer',
                      manualBackupState === 'no_folder_error'
                        ? 'border-rose-500/80 ring-1 ring-rose-500/60'
                        : 'border-zinc-800 hover:border-zinc-700'
                    )}
                    title={autoBackupPath ? (language === 'fa' ? 'باز کردن پوشه پشتیبان' : 'Open backup directory in Explorer') : (language === 'fa' ? 'انتخاب پوشه پشتیبان' : 'Select backup directory')}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Folder className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
                      <span className={cn(
                        'truncate text-xs',
                        autoBackupPath ? 'text-zinc-200 group-hover:text-zinc-100' : 'text-zinc-500 italic'
                      )}>
                        {autoBackupPath || (language === 'fa' ? 'هیچ پوشه‌ای انتخاب نشده است (برای انتخاب کلیک کنید)' : 'No folder selected (click to choose)')}
                      </span>
                    </div>
                    {autoBackupPath && (
                      <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                    )}
                  </button>
                </div>

                {/* Folder Selector - Row 2: Browse & Backup Now Buttons */}
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={async () => {
                        const dir = await selectDirectoryNative({ title: 'Select Automated Backup Folder' });
                        if (dir) {
                          onAutoBackupPathChange?.(dir);
                        }
                      }}
                      className={cn('justify-center gap-1.5 h-7 text-xs', isRtl && 'font-farsi')}
                    >
                      <Folder className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{t('settings.browse')}</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={manualBackupState === 'running'}
                      onClick={async () => {
                        if (!autoBackupPath) {
                          setManualBackupState('no_folder_error');
                          setTimeout(() => setManualBackupState('idle'), 2500);
                          return;
                        }
                        setManualBackupState('running');
                        try {
                          await onManualAutoBackup?.();
                          setManualBackupState('success');
                          setTimeout(() => setManualBackupState('idle'), 1800);
                        } catch (err) {
                          setManualBackupState('error');
                          setTimeout(() => setManualBackupState('idle'), 2500);
                        }
                      }}
                      className={cn('justify-center gap-1.5 h-7 text-xs', isRtl && 'font-farsi')}
                      title="Trigger an immediate backup snapshot"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {manualBackupState === 'running' ? (
                          <motion.span
                            key="running"
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            className="flex items-center justify-center"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-zinc-300 animate-spin" />
                          </motion.span>
                        ) : manualBackupState === 'success' ? (
                          <motion.span
                            key="success"
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="flex items-center justify-center"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="idle"
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            className="flex items-center justify-center"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-zinc-400" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <span>{t('settings.backupNow')}</span>
                    </Button>
                  </div>
                  {manualBackupState === 'no_folder_error' && (
                    <span className="text-[10px] text-rose-400 font-medium block animate-in fade-in-50 duration-150">
                      Please select a backup folder first
                    </span>
                  )}
                  {manualBackupState === 'error' && (
                    <span className="text-[10px] text-rose-400 font-medium block animate-in fade-in-50 duration-150">
                      Backup failed: check folder permissions
                    </span>
                  )}
                </div>

                {/* Frequency & Retention Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Frequency Selector */}
                  <div className="space-y-1">
                    <span className={cn('text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block', isRtl && 'font-farsi')}>
                      {t('settings.frequency')}
                    </span>
                    <Select
                      value={autoBackupFrequency}
                      onChange={(val) => onAutoBackupFrequencyChange?.(val)}
                      options={[
                        { value: 'on_start', label: 'On Startup' },
                        { value: 'daily', label: 'Daily (24h)' },
                        { value: 'weekly', label: 'Weekly (7d)' },
                      ]}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Retention Limit Selector */}
                  <div className="space-y-1">
                    <span className={cn('text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block', isRtl && 'font-farsi')}>
                      {t('settings.retention')}
                    </span>
                    <Select
                      value={String(autoBackupRetention)}
                      onChange={(val) => onAutoBackupRetentionChange?.(Number(val))}
                      options={[
                        { value: '5', label: 'Keep 5 (Default)' },
                        { value: '10', label: 'Keep 10 Backups' },
                        { value: '20', label: 'Keep 20 Backups' },
                        { value: '0', label: 'Keep All (No Limit)' },
                      ]}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500 pt-0.5 leading-relaxed">
                  Smart change detection skips redundant exports when ledger data is unchanged. Older backups beyond the retention limit are automatically rotated.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 4. Automatic Daily Rolling Snapshots (Desktop/SQLite) */}
        {snapshots.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className={cn('block text-xs font-semibold text-zinc-300 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                <History className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t('settings.snapshots')}</span>
              </label>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Protected
              </span>
            </div>
            <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
              {t('settings.snapshotsDesc')}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <Select
                  value={selectedSnapshot}
                  onChange={setSelectedSnapshot}
                  options={snapshots.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${formatNumber(s.entries_count)} records)`,
                  }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={snapshotRestoreState === 'restoring'}
                onClick={handleRestoreSnapshot}
                className={cn('gap-1.5 text-xs shrink-0', isRtl && 'font-farsi')}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {snapshotRestoreState === 'restoring' ? (
                    <motion.span
                      key="restoring"
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.92, opacity: 0 }}
                      className="flex items-center justify-center"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-300 animate-spin" />
                    </motion.span>
                  ) : snapshotRestoreState === 'success' ? (
                    <motion.span
                      key="restored"
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.92, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="flex items-center justify-center"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.92, opacity: 0 }}
                      className="flex items-center justify-center"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                    </motion.span>
                  )}
                </AnimatePresence>
                <span>{t('settings.restore')}</span>
              </Button>
            </div>
            {snapshotRestoreState === 'error' && (
              <span className="text-[10px] text-rose-400 font-medium block animate-in fade-in-50 duration-150">
                Failed to restore snapshot
              </span>
            )}
          </div>
        )}

        {/* 5. Software Updates & Announcements Feed */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <label className={cn('block text-xs font-semibold text-zinc-300 flex items-center gap-1.5', isRtl && 'font-farsi')}>
              <ArrowUpCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span>{t('settings.updates')}</span>
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
                <div className={cn('text-xs font-medium text-zinc-200', isRtl && 'font-farsi')}>
                  {updateInfo?.available
                    ? `${t('settings.updateAvailable')}: v${updateInfo.version}`
                    : t('settings.upToDate')}
                </div>
                <div className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
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
                  className={cn('gap-1.5 text-xs h-7', isRtl && 'font-farsi')}
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  <span>{t('update.installNow')}</span>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={isCheckingUpdates}
                  onClick={onCheckUpdates}
                  className={cn('gap-1.5 text-xs h-7', isRtl && 'font-farsi')}
                >
                  <RotateCw className={`w-3 h-3 text-zinc-400 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                  <span>{isCheckingUpdates ? t('settings.checking') : t('settings.checkNow')}</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 6. Community & Contact Info */}
        <div className="space-y-2.5 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <label className={cn('block text-xs font-semibold text-zinc-300 flex items-center gap-1.5', isRtl && 'font-farsi')}>
              <DiscordIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>{t('settings.community')}</span>
            </label>
            <span className="text-[10px] font-mono text-zinc-500">
              Direct Support
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
            {/* Discord */}
            <button
              type="button"
              onClick={() => openExternalUrl('https://discord.gg/TYPRXeKPp')}
              className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 transition-colors text-left group"
              title="Join official Discord server: https://discord.gg/TYPRXeKPp"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <DiscordIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">
                    Discord
                  </span>
                </div>
                <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
              </div>
              <div className="text-xs font-medium text-zinc-200 truncate w-full font-mono">
                discord.gg/TYPRXeKPp
              </div>
            </button>

            {/* Telegram */}
            <button
              type="button"
              onClick={() => openExternalUrl('https://t.me/sovrgn0')}
              className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 transition-colors text-left group"
              title="Message @sovrgn0 on Telegram"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TelegramIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">
                    Telegram
                  </span>
                </div>
                <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
              </div>
              <div className="text-xs font-medium text-zinc-200 truncate w-full font-mono">
                @sovrgn0
              </div>
            </button>

            {/* Email */}
            <button
              type="button"
              onClick={async () => {
                await copyTextNative('sovrgnx@proton.me');
                setCopiedEmail(true);
                setTimeout(() => setCopiedEmail(false), 1800);
                openExternalUrl('mailto:sovrgnx@proton.me');
              }}
              className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 transition-colors text-left group"
              title="Copy email: sovrgnx@proton.me"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AnimatePresence mode="wait" initial={false}>
                    {copiedEmail ? (
                      <motion.span
                        key="copied-email"
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.92, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="flex items-center justify-center shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="default-email"
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.92, opacity: 0 }}
                        className="flex items-center justify-center shrink-0"
                      >
                        <Mail className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">
                    Email
                  </span>
                </div>
                <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
              </div>
              <div className="text-xs font-medium text-zinc-200 truncate w-full font-mono">
                sovrgnx@proton.me
              </div>
            </button>
          </div>
        </div>

        {/* 7. Privacy & Anonymous Diagnostics Notice */}
        <div className="pt-2 border-t border-zinc-800">
          <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/70 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className={cn('text-xs font-medium text-zinc-300', isRtl && 'font-farsi')}>
                {t('settings.privacy')}
              </div>
              <p className={cn('text-[11px] text-zinc-500 leading-relaxed', isRtl && 'font-farsi')}>
                {t('settings.privacyDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* 8. Data Backup & Portability */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <label className={cn('block text-xs font-semibold text-zinc-300', isRtl && 'font-farsi')}>
              {t('settings.dataPortability')}
            </label>
            <span className="text-[10px] font-mono text-zinc-500">
              {formatNumber(entriesCount)} Records
            </span>
          </div>
          <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
            {isDesktop
              ? 'Stored securely on this PC in standalone SQLite format.'
              : 'Stored securely in local client IndexedDB.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                setExportJsonState('success');
                await onExportJson?.();
                setTimeout(() => setExportJsonState('idle'), 1800);
              }}
              className={cn('justify-start gap-2 text-xs py-2.5 h-auto leading-relaxed', isRtl && 'font-farsi')}
            >
              <AnimatePresence mode="wait" initial={false}>
                {exportJsonState === 'success' ? (
                  <motion.span
                    key="json-success"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center shrink-0"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="json-default"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    className="flex items-center justify-center shrink-0"
                  >
                    <Upload className="w-4 h-4 text-zinc-400" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span>{t('settings.fullJsonBackup')}</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (isDesktop) {
                  onImportJson?.();
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className={cn('justify-start gap-2 text-xs py-2.5 h-auto leading-relaxed', isRtl && 'font-farsi')}
            >
              <Download className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>{t('settings.restoreJson')}</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                setExportCsvState('success');
                await onExportCsv?.();
                setTimeout(() => setExportCsvState('idle'), 1800);
              }}
              className={cn('justify-start gap-2 text-xs sm:col-span-2 py-2.5 h-auto leading-relaxed', isRtl && 'font-farsi')}
            >
              <AnimatePresence mode="wait" initial={false}>
                {exportCsvState === 'success' ? (
                  <motion.span
                    key="csv-success"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center shrink-0"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="csv-default"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    className="flex items-center justify-center shrink-0"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span>{t('settings.exportCsv')}</span>
            </Button>
          </div>
        </div>

        {/* 9. Danger Zone: Clear All Data */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <label className={cn('block text-xs font-semibold text-rose-400', isRtl && 'font-farsi')}>
            {t('settings.dangerZone')}
          </label>
          <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
            {t('settings.clearAllDataDesc')}
          </p>

          <div className="pt-0.5">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setClearConfirmText('');
                setPurgeSnapshots(false);
                setIsClearConfirmOpen(true);
              }}
              className={cn('gap-2 text-xs w-full justify-center bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/80', isRtl && 'font-farsi')}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{t('settings.clearAllData')}</span>
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
          className={cn('gap-1.5 text-xs text-zinc-400 hover:text-zinc-200', isRtl && 'font-farsi')}
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>{t('settings.shortcuts')}</span>
        </Button>
        <Button variant="primary" size="sm" onClick={onClose} className={cn(isRtl && 'font-farsi')}>
          <Check className="w-3.5 h-3.5" />
          <span>{t('common.done')}</span>
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
            <DialogTitle className={cn(isRtl && 'font-farsi')}>{t('settings.eraseAllData')}</DialogTitle>
          </div>
        </DialogHeader>

        <DialogContent className="space-y-3.5 py-2">
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/60 space-y-1.5 text-xs text-rose-200">
            <p className={cn('font-semibold text-rose-300', isRtl && 'font-farsi')}>
              {t('settings.eraseWarning')}
            </p>
            <p className={cn('text-[11px] text-zinc-400 leading-relaxed', isRtl && 'font-farsi')}>
              All <strong className="text-zinc-200 font-mono">{formatNumber(entriesCount)}</strong> work entries, earnings records, and screenshot proof attachments will be permanently purged.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className={cn('block text-[11px] font-medium text-zinc-300', isRtl && 'font-farsi')}>
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

          <label className={cn('flex items-center gap-2 text-[11px] text-zinc-400 select-none cursor-pointer pt-1', isRtl && 'font-farsi')}>
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
            className={cn(isRtl && 'font-farsi')}
          >
            {t('common.cancel')}
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
            className={cn('gap-1.5 font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:pointer-events-none', isRtl && 'font-farsi')}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('settings.eraseAllData')}</span>
          </Button>
        </DialogFooter>
      </Dialog>
    </Dialog>
  );
}

export default SettingsModal;
