import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Switch } from './ui/Switch';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Check,
  X,
  History,
  RotateCcw,
  ShieldCheck,
  Monitor,
  ArrowUpCircle,
  RotateCw,
  Keyboard,
  FolderArchive,
  Folder,
  Mail,
  ExternalLink,
  Sun,
  Moon,
  Gamepad2,
  Plus,
  Edit2,
  Sliders,
  Palette,
  Info,
  Database,
} from 'lucide-react';
import { isTauri, selectDirectoryNative, openExternalUrl, copyTextNative, openPathNative } from '../lib/desktop';
import { DiscordIcon, GithubIcon, TomanIcon } from './ui/Icons';
import { trackerDB } from '../lib/db';
import { useTheme } from 'next-themes';
import { Input } from './ui/Input';
import { useLanguage, formatClock, resolveHour12 } from '../lib/i18n';
import { SCREEN, SPRING_PILL } from '../lib/motion';
import { cn } from '../lib/utils';
import { CategoryModal } from './ui/CategoryModal';
import { deleteCategory } from '../lib/categories';
import { GameIcon } from './ui/GameIcon';

export function SettingsModal({
  isOpen,
  onClose,
  globalCurrency = 'TOMAN',
  onCurrencyChange,
  categories = [],
  onRefreshCategories,
  activeProfileId = 'booster',
  onProfileChange,
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
  telemetryEnabled = true,
  onTelemetryEnabledChange,
  theme = 'dark',
  onThemeChange,
  handleThemeChange,
  initialScrollSection = null,
  startTabs = { advertiser: 'last', booster: 'last' },
  onStartTabChange,
}) {
  const { language, setLanguage, t, isRtl, formatNumber, getDatePatternPreview, ledgerDateFormatOptions, dateFormat: ledgerDateFormat, setDateFormat: onLedgerDateFormatChange, timeFormat, setTimeFormat } = useLanguage();
  const fileInputRef = useRef(null);

  // Vertically Tabbed Category State: 'general' | 'appearance' | 'system' | 'backups' | 'about'
  const [activeTab, setActiveTab] = useState(() => {
    if (initialScrollSection === 'backup') return 'backups';
    if (initialScrollSection === 'categories') return 'appearance';
    if (initialScrollSection === 'updates') return 'about';
    return 'general';
  });

  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [purgeSnapshots, setPurgeSnapshots] = useState(false);
  const [manualBackupState, setManualBackupState] = useState('idle'); // 'idle' | 'running' | 'success' | 'no_folder_error' | 'error'
  const [snapshotRestoreState, setSnapshotRestoreState] = useState('idle'); // 'idle' | 'restoring' | 'success' | 'error'
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null); // { state: 'running' | 'success' | 'error', count?, reason? }
  const [updateCheck, setUpdateCheck] = useState(null); // { state: 'upToDate' | 'error' | 'desktopOnly', at, message? }
  const [clearResult, setClearResult] = useState(null); // { state: 'running' | 'success' | 'error', purged? }
  const [exportJsonState, setExportJsonState] = useState('idle');
  const [exportCsvState, setExportCsvState] = useState('idle');
  const [highlightBackup, setHighlightBackup] = useState(false);
  const [lastBackupStatus, setLastBackupStatus] = useState(null); // { ok, at, fileName?, error? } from the last backup attempt
  const [retentionDraft, setRetentionDraft] = useState(String(autoBackupRetention));
  const backupFeedbackTimerRef = useRef(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const isDesktop = isTauri();

  const refreshBackupStatus = () => {
    trackerDB.getSetting('checkpoint_auto_backup_status', null)
      .then((status) => setLastBackupStatus(status && typeof status === 'object' ? status : null))
      .catch(() => {});
  };

  // Shows a transient button state; 'ms' > 0 returns the button to idle after that long
  const setBackupFeedback = (state, ms = 0) => {
    clearTimeout(backupFeedbackTimerRef.current);
    setManualBackupState(state);
    if (ms > 0) {
      backupFeedbackTimerRef.current = setTimeout(() => setManualBackupState('idle'), ms);
    }
  };

  // Runs an export and reports it on the button. 'success' only when a file was saved, not when the save dialog was cancelled
  const runExport = async (setState, exporter) => {
    setState('running');
    let outcome = 'error';
    try {
      const saved = await exporter?.();
      outcome = saved === false ? 'idle' : 'success';
    } catch (err) {
      console.error('Export failed:', err);
    }
    setState(outcome);
    if (outcome !== 'idle') {
      setTimeout(() => setState('idle'), 1800);
    }
  };

  const feedbackLabel = (state, idleLabel) => {
    if (state === 'success') return language === 'fa' ? 'ذخیره شد' : 'Saved';
    if (state === 'error') return language === 'fa' ? 'خطا در خروجی' : 'Export failed';
    return idleLabel;
  };

  const feedbackClass = (state) => {
    if (state === 'success') return 'border-emerald-500/60 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10';
    if (state === 'error') return 'border-rose-500/70 text-rose-600 dark:text-rose-400 bg-rose-500/10';
    return '';
  };

  const feedbackIcon = (state, DefaultIcon) => {
    if (state === 'success') return <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    if (state === 'error') return <X className="w-4 h-4 text-rose-500 shrink-0" />;
    return <DefaultIcon className="w-4 h-4 text-zinc-400 shrink-0" />;
  };

  const commitRetention = () => {
    const parsed = Math.floor(Number(retentionDraft));
    if (retentionDraft.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
      setRetentionDraft(String(autoBackupRetention));
      return;
    }
    const clamped = Math.min(parsed, 365);
    setRetentionDraft(String(clamped));
    if (clamped !== autoBackupRetention) {
      onAutoBackupRetentionChange?.(clamped);
    }
  };

  const formatBackupTime = (ts) => {
    const date = new Date(ts);
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const handleDeleteCategory = async (cat) => {
    const remaining = categories.filter((c) => (c.id || c.name) !== (cat.id || cat.name));
    const fallbackName = remaining.length > 0 ? remaining[0].name : 'General';
    const confirmMessage = language === 'fa'
      ? `دسته‌بندی «${cat.name}» حذف شود؟ کارهای ثبت‌شده در این دسته به «${fallbackName}» منتقل خواهند شد.`
      : `Delete category "${cat.name}"? Existing work logs will be moved to "${fallbackName}".`;

    if (window.confirm(confirmMessage)) {
      await deleteCategory(cat.id || cat.name, fallbackName);
      await onRefreshCategories?.(true);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialScrollSection === 'backup') {
        setActiveTab('backups');
        setHighlightBackup(true);
        const timer = setTimeout(() => setHighlightBackup(false), 2000);
        return () => clearTimeout(timer);
      } else if (initialScrollSection === 'categories') {
        setActiveTab('appearance');
      } else if (initialScrollSection === 'updates') {
        setActiveTab('about');
      }
    }
  }, [isOpen, initialScrollSection]);

  useEffect(() => {
    if (isOpen) {
      trackerDB.listSnapshots().then((list) => {
        setSnapshots(list || []);
        if (list && list.length > 0) {
          setSelectedSnapshot(list[0].id);
        }
      });
      refreshBackupStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    setRetentionDraft(String(autoBackupRetention));
  }, [autoBackupRetention]);

  useEffect(() => () => clearTimeout(backupFeedbackTimerRef.current), []);

  const currencyOptions = [
    {
      value: 'TOMAN',
      label: 'Toman',
      icon: <TomanIcon className="w-[24px] h-[24px] min-w-[24px] min-h-[24px]" />,
    },
    {
      value: 'USD',
      label: 'USD ($)',
      icon: <span className="font-semibold text-xs">$</span>,
    },
    {
      value: 'EUR',
      label: 'EUR (€)',
      icon: <span className="font-semibold text-xs">€</span>,
    },
  ];

  const dateFormatOptions = useMemo(() => {
    const list = ledgerDateFormatOptions || [
      { id: 'relative', labelEn: 'Relative (Today, Yesterday)', labelFa: 'نسبی (امروز، دیروز)' },
      { id: 'yyyy-mm-dd', labelEn: 'YYYY-MM-DD', labelFa: 'سال-ماه-روز' },
      { id: 'dd-mm-yyyy', labelEn: 'DD/MM/YYYY', labelFa: 'روز/ماه/سال' },
      { id: 'mm-dd-yyyy', labelEn: 'MM/DD/YYYY', labelFa: 'ماه/روز/سال' },
      { id: 'month-d-yyyy', labelEn: 'Month D, YYYY', labelFa: 'نام ماه و روز، سال' },
    ];
    return list.map((opt) => {
      const preview = getDatePatternPreview?.(opt.id) || '';
      const baseLabel = language === 'fa' ? opt.labelFa : opt.labelEn;
      return {
        value: opt.id,
        label: preview ? `${baseLabel} (${preview})` : baseLabel,
      };
    });
  }, [ledgerDateFormatOptions, getDatePatternPreview, language]);

  // 12 or 24 hours, previewed with the current time so the choice is obvious
  const timeFormatOptions = useMemo(() => {
    const now = new Date();
    return [
      { value: 'auto', label: `${t('settings.timeFormat.auto', 'Automatic')} (${formatClock(now, language, resolveHour12('auto', language))})` },
      { value: '12', label: `${t('settings.timeFormat.12', '12-hour')} (${formatClock(now, language, true)})` },
      { value: '24', label: `${t('settings.timeFormat.24', '24-hour')} (${formatClock(now, language, false)})` },
    ];
  }, [t, language]);

  // The screens each profile can open on; the names follow each profile's own navigation
  const startTabOptions = (profileId) => [
    { value: 'last', label: t('settings.startTab.last', 'Where I left off') },
    { value: 'cockpit', label: profileId === 'booster' ? t('nav.overview', 'Overview') : t('nav.cockpit', 'Overview') },
    { value: 'orders', label: profileId === 'booster' ? t('nav.jobs', 'Jobs') : t('nav.orders', 'Orders') },
    { value: 'people', label: profileId === 'booster' ? t('nav.clients', 'Clients') : t('nav.people', 'Boosters') },
    { value: 'money', label: t('nav.money', 'Money') },
    { value: 'analytics', label: t('nav.reports', 'Reports') },
  ];

  // Maps the App's import result to the status line. Cancelling the file dialog leaves no message.
  const toRestoreResult = (res) => {
    if (!res || res.status === 'cancelled') return null;
    if (res.status === 'imported') return { state: 'success', count: res.count };
    return { state: 'error', reason: res.status };
  };

  const restoreJson = async () => {
    if (!isDesktop) {
      fileInputRef.current?.click();
      return;
    }
    setRestoreResult({ state: 'running' });
    const res = await onImportJson?.();
    setRestoreResult(toRestoreResult(res));
  };

  // The modal stays open after a web restore so the confirmation is visible
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestoreResult({ state: 'running' });
    const res = await onImportJson?.(file);
    setRestoreResult(toRestoreResult(res));
  };

  const checkUpdatesNow = async () => {
    if (!isDesktop) {
      setUpdateCheck({ state: 'desktopOnly', at: Date.now() });
      return;
    }
    const res = await onCheckUpdates?.();
    if (res?.available) {
      // The update modal takes over from here
      setUpdateCheck(null);
      return;
    }
    setUpdateCheck(res?.error
      ? { state: 'error', at: Date.now(), message: res.error }
      : { state: 'upToDate', at: Date.now() });
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

  const frequencyOptions = [
    { value: 'on_start', label: language === 'fa' ? 'هنگام شروع برنامه' : 'On app start' },
    { value: 'daily', label: language === 'fa' ? 'روزانه' : 'Daily' },
    { value: 'weekly', label: language === 'fa' ? 'هفتگی' : 'Weekly' },
  ];

  const backupButtonLabel = manualBackupState === 'running'
    ? (language === 'fa' ? 'در حال پشتیبان‌گیری…' : 'Backing up…')
    : manualBackupState === 'success'
      ? (language === 'fa' ? 'پشتیبان ذخیره شد' : 'Backup saved')
      : manualBackupState === 'error'
        ? (language === 'fa' ? 'پشتیبان ناموفق' : 'Backup failed')
        : t('settings.backupNow');
  const backupButtonIcon = manualBackupState === 'success'
    ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
    : manualBackupState === 'error'
      ? <X className="w-3.5 h-3.5 text-rose-500" />
      : <RotateCw className={cn('w-3.5 h-3.5 text-zinc-400', manualBackupState === 'running' && 'animate-spin')} />;
  const backupButtonClass = feedbackClass(manualBackupState);

  // Status line under the backup controls: the outcome of the latest attempt (manual or automatic)
  let backupStatusText = language === 'fa' ? 'هنوز نسخه پشتیبانی ثبت نشده است' : 'No backup has been written yet';
  let backupStatusTone = 'text-zinc-500 dark:text-zinc-400';
  let BackupStatusIcon = History;
  if (manualBackupState === 'no_folder_error') {
    backupStatusText = language === 'fa' ? 'ابتدا یک پوشه برای پشتیبان انتخاب کنید' : 'Choose a backup folder first';
    backupStatusTone = 'text-rose-600 dark:text-rose-400';
    BackupStatusIcon = X;
  } else if (manualBackupState === 'running') {
    backupStatusText = language === 'fa' ? 'در حال نوشتن فایل پشتیبان…' : 'Writing backup file…';
  } else if (lastBackupStatus?.ok === false) {
    backupStatusText = `${language === 'fa' ? 'آخرین پشتیبان ناموفق بود' : 'Last backup failed'}: ${formatBackupTime(lastBackupStatus.at)} — ${lastBackupStatus.error || ''}`;
    backupStatusTone = 'text-rose-600 dark:text-rose-400';
    BackupStatusIcon = X;
  } else if (lastBackupStatus?.ok) {
    backupStatusText = `${language === 'fa' ? 'آخرین پشتیبان' : 'Last backup'}: ${formatBackupTime(lastBackupStatus.at)}${lastBackupStatus.fileName ? ` · ${lastBackupStatus.fileName}` : ''}`;
    backupStatusTone = 'text-emerald-700 dark:text-emerald-400';
    BackupStatusIcon = Check;
  }

  // Category Tab Definitions
  const TABS = [
    {
      id: 'general',
      label: t('settings.tabGeneral', 'General'),
      icon: Sliders,
    },
    {
      id: 'appearance',
      label: t('settings.tabAppearance', 'Appearance'),
      icon: Palette,
    },
    {
      id: 'system',
      label: t('settings.tabSystem', 'System'),
      icon: Monitor,
    },
    {
      id: 'backups',
      label: t('settings.tabBackups', 'Backups & Data'),
      icon: Database,
    },
    {
      id: 'about',
      label: t('settings.tabAbout', 'About & Updates'),
      icon: Info,
      hasBadge: Boolean(updateInfo?.available),
    },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-3xl">
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
            className="relative flex items-center p-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 shadow-inner select-none cursor-pointer group active:scale-[0.96] transition-transform duration-150 shrink-0"
            dir="ltr"
          >
            {/* Light Option */}
            <div
              className={cn(
                'relative flex items-center justify-center w-6 h-6 rounded-full transition-colors pointer-events-none',
                currentTheme === 'light'
                  ? 'text-amber-600 dark:text-amber-400 font-medium'
                  : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              {currentTheme === 'light' && (
                <motion.div
                  layoutId="settingsThemePill"
                  className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-full shadow-sm border border-zinc-300 dark:border-zinc-600"
                  transition={SPRING_PILL}
                />
              )}
              <Sun className={cn('w-3.5 h-3.5 relative z-10 transition-transform duration-200 stroke-[2.2]', currentTheme === 'light' ? 'scale-105 rotate-12' : 'scale-90 opacity-70')} />
            </div>

            {/* Dark Option */}
            <div
              className={cn(
                'relative flex items-center justify-center w-6 h-6 rounded-full transition-colors pointer-events-none',
                currentTheme === 'dark'
                  ? 'text-zinc-800 dark:text-zinc-200 font-medium'
                  : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              {currentTheme === 'dark' && (
                <motion.div
                  layoutId="settingsThemePill"
                  className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-full shadow-sm border border-zinc-300 dark:border-zinc-600"
                  transition={SPRING_PILL}
                />
              )}
              <Moon className={cn('w-3.5 h-3.5 relative z-10 transition-transform duration-200 stroke-[2.2]', currentTheme === 'dark' ? 'scale-105 -rotate-12' : 'scale-90 opacity-70')} />
            </div>
          </div>
        }
      >
        <DialogTitle className={cn(isRtl && 'font-farsi')}>{t('settings.title')}</DialogTitle>
      </DialogHeader>

      <DialogContent className="p-0 space-y-0 overflow-hidden">
        {/* Hidden file input for web restore */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          hidden
          className="hidden"
        />

        {/* Vertically Tabbed Settings Container */}
        <div className="flex flex-col sm:flex-row h-full min-h-[440px] max-h-[72vh] overflow-hidden">
          {/* Left/Sidebar Category Navigation */}
          <div
            className={cn(
              'w-full sm:w-48 lg:w-52 shrink-0 p-2 sm:p-3 bg-zinc-50/70 dark:bg-zinc-900/40 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible select-none',
              isRtl ? 'sm:border-l border-b sm:border-b-0 border-zinc-200 dark:border-zinc-800' : 'sm:border-r border-b sm:border-b-0 border-zinc-200 dark:border-zinc-800'
            )}
          >
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] text-start cursor-pointer shrink-0 sm:w-full',
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                  )}
                >
                  <TabIcon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500')} />
                  <span className={cn('truncate', isRtl && 'font-farsi')}>{tab.label}</span>
                  {tab.hasBadge && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 ms-auto shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right/Main Settings Pane */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto gpu-scroll space-y-4">
            <AnimatePresence mode="wait">
              {activeTab === 'general' && (
                <motion.div
                  key="tab-general"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={SCREEN}
                  className="space-y-4"
                >
                  {/* Category Title */}
                  <div>
                    <h4 className={cn('text-sm font-semibold text-zinc-900 dark:text-zinc-100', isRtl && 'font-farsi')}>
                      {t('settings.tabGeneral', 'General Settings')}
                    </h4>
                    <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                      {language === 'fa' ? 'مدیریت پروفایل کاربری، زبان و فرمت‌های پیش‌فرض' : 'Profile role, language, and default currency formats'}
                    </p>
                  </div>

                  {/* Active Profile & Database Isolation */}
                  <div className="p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{activeProfileId === 'advertiser' ? '📢' : '⚡'}</span>
                        <div className="min-w-0">
                          <div className={cn('text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 flex-wrap', isRtl && 'font-farsi')}>
                            <span>{activeProfileId === 'advertiser' ? (language === 'fa' ? 'پروفایل ادورتایزر' : 'Advertiser Profile') : (language === 'fa' ? 'پروفایل بوستر' : 'Booster Profile')}</span>
                            <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                              {isDesktop ? (activeProfileId === 'advertiser' ? 'checkpoint_advertiser.db' : 'checkpoint.db') : (activeProfileId === 'advertiser' ? 'checkpoint_advertiser' : 'checkpoint_local_db')}
                            </span>
                          </div>
                          <p className={cn('text-[11px] text-zinc-500 truncate mt-0.5', isRtl && 'font-farsi')}>
                            {activeProfileId === 'advertiser'
                              ? (language === 'fa' ? 'سفارشات مشتریان، شناسه سفارش و کارمزدها' : 'Client orders, order IDs, booster payouts & commissions')
                              : (language === 'fa' ? 'رهگیری بوست‌ها، پات‌های تیمی و درآمدهای شخصی' : 'Boost tracking, team pot splits & personal earnings')}
                          </p>
                        </div>
                      </div>

                      {onProfileChange && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => {
                            const nextProfile = activeProfileId === 'advertiser' ? 'booster' : 'advertiser';
                            onProfileChange(nextProfile);
                          }}
                          className={cn('h-7 px-2.5 text-xs shrink-0 font-medium', isRtl && 'font-farsi')}
                          title="Ctrl+Shift+P"
                        >
                          <span>{activeProfileId === 'advertiser' ? (language === 'fa' ? 'تغییر به بوستر' : 'Switch to Booster') : (language === 'fa' ? 'تغییر به ادورتایزر' : 'Switch to Advertiser')}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Language Selector */}
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                    <div className="space-y-0.5 min-w-0 pe-1">
                      <label className={cn('block text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                        {t('settings.language')}
                      </label>
                      <p className={cn('text-[11px] text-zinc-500 leading-tight', isRtl && 'font-farsi')}>
                        {t('settings.languageDesc')}
                      </p>
                    </div>
                    <div className="w-36 shrink-0">
                      <Select
                        value={language}
                        onChange={(val) => setLanguage(val)}
                        options={[
                          { value: 'fa', label: 'فارسی (پیش‌فرض)' },
                          { value: 'en', label: 'English' },
                        ]}
                        className="h-8 text-xs bg-white dark:bg-zinc-900 font-medium"
                      />
                    </div>
                  </div>

                  {/* Global Currency Preference */}
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                    <div className="space-y-0.5 min-w-0 pe-1">
                      <label className={cn('block text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                        {t('settings.currency')}
                      </label>
                      <p className={cn('text-[11px] text-zinc-500 leading-tight', isRtl && 'font-farsi')}>
                        {t('settings.currencyDesc')}
                      </p>
                    </div>
                    <div className="w-36 shrink-0">
                      <Select
                        value={globalCurrency}
                        onChange={(val) => onCurrencyChange?.(val)}
                        options={currencyOptions}
                        className="h-8 text-xs bg-white dark:bg-zinc-900"
                      />
                    </div>
                  </div>

                  {/* Ledger Date Format Preference */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                    <div className="space-y-0.5 min-w-0 pe-1">
                      <label className={cn('block text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                        {t('settings.ledgerDateFormat')}
                      </label>
                      <p className={cn('text-[11px] text-zinc-500 leading-tight', isRtl && 'font-farsi')}>
                        {t('settings.ledgerDateFormatDesc')}
                      </p>
                    </div>
                    <div className="w-full sm:w-60 shrink-0">
                      <Select
                        value={ledgerDateFormat}
                        onChange={(val) => onLedgerDateFormatChange?.(val)}
                        options={dateFormatOptions}
                        className="h-8 text-xs bg-white dark:bg-zinc-900"
                      />
                    </div>
                  </div>

                  {/* Time Format Preference */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                    <div className="space-y-0.5 min-w-0 pe-1">
                      <label className={cn('block text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                        {t('settings.timeFormat', 'Time format')}
                      </label>
                      <p className={cn('text-[11px] text-zinc-500 leading-tight', isRtl && 'font-farsi')}>
                        {t('settings.timeFormatDesc', 'How times of day are shown on jobs, orders, receipts and the date picker.')}
                      </p>
                    </div>
                    <div className="w-full sm:w-60 shrink-0">
                      <Select value={timeFormat} onChange={setTimeFormat} options={timeFormatOptions} className="h-8 text-xs bg-white dark:bg-zinc-900" />
                    </div>
                  </div>

                  {/* Start screen per profile */}
                  <div className="p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
                    <div className="space-y-0.5 min-w-0">
                      <label className={cn('block text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                        {t('settings.startTab', 'Open on start')}
                      </label>
                      <p className={cn('text-[11px] text-zinc-500 leading-tight', isRtl && 'font-farsi')}>
                        {t('settings.startTabDesc', 'The screen Checkpoint opens on, for each profile.')}
                      </p>
                    </div>
                    {['advertiser', 'booster'].map((pid) => (
                      <div key={pid} className="flex items-center justify-between gap-3">
                        <span className={cn('text-xs text-zinc-600 dark:text-zinc-400', isRtl && 'font-farsi')}>
                          {pid === 'booster' ? t('settings.startTab.booster', 'Booster') : t('settings.startTab.advertiser', 'Advertiser')}
                        </span>
                        <div className="w-full sm:w-60 shrink-0">
                          <Select value={startTabs[pid] || 'last'} onChange={(v) => onStartTabChange?.(pid, v)} options={startTabOptions(pid)} className="h-8 text-xs bg-white dark:bg-zinc-900" />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'appearance' && (
                <motion.div
                  key="tab-appearance"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={SCREEN}
                  className="space-y-4"
                >
                  {/* Category Title */}
                  <div>
                    <h4 className={cn('text-sm font-semibold text-zinc-900 dark:text-zinc-100', isRtl && 'font-farsi')}>
                      {t('settings.tabAppearance', 'Appearance & Visuals')}
                    </h4>
                    <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                      {language === 'fa' ? 'تم، جلوه‌های بصری و دسته‌بندی بازی‌ها' : 'Themes, visual effects, and game categories'}
                    </p>
                  </div>

                  {/* Categories & Games Customization */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className={cn('block text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                        <Gamepad2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{t('categories.title', 'Categories & Games')}</span>
                      </label>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setEditingCategory(null);
                          setIsCategoryModalOpen(true);
                        }}
                        className={cn('h-7 px-2 text-xs gap-1.5', isRtl && 'font-farsi')}
                      >
                        <Plus className="w-3 h-3 text-zinc-400" />
                        <span>{t('categories.addCategory', 'Add Category')}</span>
                      </Button>
                    </div>
                    <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                      {t('categories.desc', 'Custom game icons, colors, and ledger row themes')}
                    </p>

                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5 custom-scrollbar">
                      {categories.map((cat) => (
                        <div
                          key={cat.id || cat.name}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="shrink-0">
                              <GameIcon
                                game={cat.name}
                                customIcon={cat.icon}
                                categories={categories}
                                className="w-6 h-6 rounded-md object-cover shadow-sm"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={cn('text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate', isRtl && 'font-farsi')}>
                                  {cat.name}
                                </span>
                                {cat.isDefault && (
                                  <span className={cn('text-[9px] px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium leading-normal', isRtl && 'font-farsi')}>
                                    {language === 'fa' ? 'پیش‌فرض' : 'default'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Color swatch badge */}
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 font-mono">
                              <span
                                className="w-2.5 h-2.5 rounded-full shadow-inner shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="uppercase">{cat.color}</span>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setIsCategoryModalOpen(true);
                                }}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                title={t('categories.editCategory', 'Edit Category')}
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
                                className="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title={t('common.delete', 'Delete')}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'system' && (
                <motion.div
                  key="tab-system"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={SCREEN}
                  className="space-y-4"
                >
                  {/* Category Title */}
                  <div>
                    <h4 className={cn('text-sm font-semibold text-zinc-900 dark:text-zinc-100', isRtl && 'font-farsi')}>
                      {t('settings.tabSystem', 'Desktop & System Settings')}
                    </h4>
                    <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                      {language === 'fa' ? 'مدیریت پنجره دسکتاپ، سینی سیستم و گزارش‌های محلی' : 'Desktop window behavior, system tray, and local diagnostics'}
                    </p>
                  </div>

                  {/* Desktop Window & System Tray Behavior */}
                  {isDesktop && (
                    <div className="space-y-2">
                      {/* Switch 1: Close to System Tray */}
                      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                        <div className="space-y-0.5 min-w-0">
                          <div className={cn('text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                            {t('settings.closeToTray')}
                          </div>
                          <div className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                            {t('settings.closeToTrayDesc')}
                          </div>
                        </div>
                        <Switch
                          checked={closeToTray}
                          onChange={(val) => onCloseToTrayChange?.(val)}
                          aria-label={t('settings.closeToTray')}
                          className="shrink-0"
                        />
                      </div>

                      {/* Switch 2: Minimize to System Tray */}
                      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                        <div className="space-y-0.5 min-w-0">
                          <div className={cn('text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                            {t('settings.minimizeToTray')}
                          </div>
                          <div className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                            {t('settings.minimizeToTrayDesc')}
                          </div>
                        </div>
                        <Switch
                          checked={minimizeToTray}
                          onChange={(val) => onMinimizeToTrayChange?.(val)}
                          aria-label={t('settings.minimizeToTray')}
                          className="shrink-0"
                        />
                      </div>
                    </div>
                  )}

                  {/* Anonymous Usage Analytics & Telemetry */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className={cn('text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{t('settings.telemetryLabel')}</span>
                        </div>
                        <p className={cn('text-[11px] text-zinc-500 leading-relaxed', isRtl && 'font-farsi')}>
                          {t('settings.telemetryDesc')}
                        </p>
                      </div>
                      <Switch
                        checked={telemetryEnabled}
                        onChange={(val) => onTelemetryEnabledChange?.(val)}
                        aria-label={t('settings.telemetry')}
                        className="shrink-0"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'backups' && (
                <motion.div
                  key="tab-backups"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={SCREEN}
                  className="space-y-4"
                >
                  {/* Category Title */}
                  <div>
                    <h4 className={cn('text-sm font-semibold text-zinc-900 dark:text-zinc-100', isRtl && 'font-farsi')}>
                      {t('settings.tabBackups', 'Backups & Storage')}
                    </h4>
                    <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                      {language === 'fa' ? 'پشتیبان‌گیری خودکار، اسنپ‌شات‌های محلی و خروجی اکسل و JSON' : 'Automated folder backups, local snapshots, and CSV/JSON portability'}
                    </p>
                  </div>

                  {/* Scheduled Folder Backups (Custom User Directory) */}
                  {isDesktop && (
                    <div
                      id="settings-backup-section"
                      className={cn(
                        'space-y-3 p-3 rounded-xl border transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300',
                        highlightBackup
                          ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-400 dark:border-zinc-600 ring-2 ring-zinc-400/50'
                          : 'bg-zinc-100/80 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <label className={cn('block text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                          <FolderArchive className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{t('settings.autoBackups')}</span>
                        </label>
                        <Switch
                          checked={autoBackupEnabled}
                          onChange={async (val) => {
                            if (val && !autoBackupPath) {
                              const dir = await selectDirectoryNative({ title: 'Select Automated Backup Folder' });
                              if (dir) {
                                onAutoBackupPathChange?.(dir);
                                onAutoBackupEnabledChange?.(true);
                              }
                            } else {
                              onAutoBackupEnabledChange?.(val);
                            }
                          }}
                          aria-label={t('settings.autoBackups')}
                          className="shrink-0"
                        />
                      </div>
                      <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                        {t('settings.autoBackupsDesc')}
                      </p>

                      {/* Directory & Frequency Configuration when Enabled */}
                      {autoBackupEnabled && (
                        <div className="space-y-2.5 pt-1">
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
                              'w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 border rounded-md text-xs font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] flex items-center justify-between gap-2 text-left group cursor-pointer',
                              manualBackupState === 'no_folder_error'
                                ? 'border-rose-500/80 ring-1 ring-rose-500/60'
                                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Folder className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 shrink-0" />
                              <span className={cn('truncate text-xs', autoBackupPath ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 italic')}>
                                {autoBackupPath || (language === 'fa' ? 'هیچ پوشه‌ای انتخاب نشده است' : 'No folder selected')}
                              </span>
                            </div>
                            {autoBackupPath && (
                              <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                            )}
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1 min-w-0">
                              <label className={cn('block text-[11px] font-medium text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                                {t('settings.frequency')}
                              </label>
                              <Select
                                value={autoBackupFrequency}
                                onChange={(val) => onAutoBackupFrequencyChange?.(val)}
                                options={frequencyOptions}
                                className="h-7 text-xs bg-white dark:bg-zinc-950"
                              />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <label htmlFor="autoBackupRetention" className={cn('block text-[11px] font-medium text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                                {t('settings.retention')}
                              </label>
                              <Input
                                id="autoBackupRetention"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={365}
                                value={retentionDraft}
                                onChange={(e) => setRetentionDraft(e.target.value)}
                                onBlur={commitRetention}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitRetention();
                                }}
                                className="h-7 text-xs bg-white dark:bg-zinc-950"
                              />
                              <p className={cn('text-[10px] text-zinc-400 dark:text-zinc-500', isRtl && 'font-farsi')}>
                                {language === 'fa' ? '۰ یعنی همه فایل‌ها نگه داشته شوند' : '0 keeps every backup file'}
                              </p>
                            </div>
                          </div>

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
                                  setBackupFeedback('no_folder_error', 2500);
                                  return;
                                }
                                setBackupFeedback('running');
                                try {
                                  await onManualAutoBackup?.();
                                  setBackupFeedback('success', 2500);
                                } catch (err) {
                                  console.error('Manual backup failed:', err);
                                  setBackupFeedback('error', 3500);
                                }
                                refreshBackupStatus();
                              }}
                              className={cn('justify-center gap-1.5 h-7 text-xs', backupButtonClass, isRtl && 'font-farsi')}
                            >
                              {backupButtonIcon}
                              <span>{backupButtonLabel}</span>
                            </Button>
                          </div>

                          <div
                            role="status"
                            aria-live="polite"
                            className={cn('flex items-start gap-1.5 text-[11px] leading-snug', backupStatusTone, isRtl && 'font-farsi')}
                          >
                            <BackupStatusIcon className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="min-w-0 break-words">{backupStatusText}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Daily Rolling Snapshots (Desktop/SQLite) */}
                  {snapshots.length > 0 && (
                    <div className="p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className={cn('block text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                          <History className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{t('settings.snapshots')}</span>
                        </label>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
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
                            className="h-8 text-xs font-medium bg-white dark:bg-zinc-950"
                          />
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={snapshotRestoreState === 'restoring'}
                          onClick={handleRestoreSnapshot}
                          className={cn('gap-1.5 text-xs shrink-0', isRtl && 'font-farsi')}
                        >
                          <RotateCcw className={cn('w-3.5 h-3.5 text-zinc-400', snapshotRestoreState === 'restoring' && 'animate-spin')} />
                          <span>{t('settings.restore')}</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Data Portability (JSON / CSV Export & Import) */}
                  <div className="p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={cn('block text-xs font-medium text-zinc-800 dark:text-zinc-200', isRtl && 'font-farsi')}>
                        {t('settings.dataPortability')}
                      </label>
                      <span className="text-[10px] font-medium text-zinc-500">
                        {formatNumber(entriesCount)} Records
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={exportJsonState === 'running'}
                        onClick={() => runExport(setExportJsonState, onExportJson)}
                        className={cn('justify-start gap-2 text-xs py-2 h-auto leading-relaxed', feedbackClass(exportJsonState), isRtl && 'font-farsi')}
                      >
                        {feedbackIcon(exportJsonState, Upload)}
                        <span>{feedbackLabel(exportJsonState, t('settings.fullJsonBackup'))}</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={restoreResult?.state === 'running'}
                        onClick={restoreJson}
                        className={cn('justify-start gap-2 text-xs py-2 h-auto leading-relaxed', isRtl && 'font-farsi')}
                      >
                        <Download className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span>{t('settings.restoreJson')}</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={exportCsvState === 'running'}
                        onClick={() => runExport(setExportCsvState, onExportCsv)}
                        className={cn('justify-start gap-2 text-xs sm:col-span-2 py-2 h-auto leading-relaxed', feedbackClass(exportCsvState), isRtl && 'font-farsi')}
                      >
                        {feedbackIcon(exportCsvState, FileSpreadsheet)}
                        <span>{feedbackLabel(exportCsvState, t('settings.exportCsv'))}</span>
                      </Button>
                    </div>

                    {restoreResult && restoreResult.state !== 'running' && (
                      <div
                        role="status"
                        aria-live="polite"
                        className={cn(
                          'flex items-start gap-1.5 text-[11px] leading-snug',
                          restoreResult.state === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                          isRtl && 'font-farsi'
                        )}
                      >
                        {restoreResult.state === 'success'
                          ? <Check className="w-3 h-3 mt-0.5 shrink-0" />
                          : <X className="w-3 h-3 mt-0.5 shrink-0" />}
                        <span className="min-w-0 break-words">
                          {restoreResult.state === 'success'
                            ? (language === 'fa'
                              ? `${formatNumber(restoreResult.count)} رکورد بازیابی شد`
                              : `Restored ${formatNumber(restoreResult.count)} records from the file.`)
                            : restoreResult.reason === 'invalid'
                              ? (language === 'fa'
                                ? 'این فایل پشتیبان معتبر CHECKPOINT نیست.'
                                : 'This file is not a valid CHECKPOINT backup.')
                              : (language === 'fa'
                                ? 'بازیابی ناموفق بود. دفتر کار را بررسی کنید و دوباره تلاش کنید.'
                                : 'Restore failed. Check your ledger, then try again.')}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'about' && (
                <motion.div
                  key="tab-about"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={SCREEN}
                  className="space-y-4"
                >
                  {/* Category Title */}
                  <div>
                    <h4 className={cn('text-sm font-semibold text-zinc-900 dark:text-zinc-100', isRtl && 'font-farsi')}>
                      {t('settings.tabAbout', 'About & Updates')}
                    </h4>
                    <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                      {language === 'fa' ? 'نسخه برنامه، به‌روزرسانی‌ها و ارتباط با تیم چِک‌پوینت' : 'App release version, official updates, and community links'}
                    </p>
                  </div>

                  {/* Software Updates Card */}
                  <div className="p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                    <div>
                      <div className={cn('text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                        <span>{updateInfo?.available
                          ? `${t('settings.updateAvailable')}: v${updateInfo.version}`
                          : updateCheck?.state === 'error'
                            ? (language === 'fa' ? 'بررسی به‌روزرسانی ناموفق بود' : 'Could not check for updates')
                            : t('settings.upToDate')}</span>
                        {appVersion && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            v{appVersion}
                          </span>
                        )}
                      </div>
                      <p className={cn('text-[11px] text-zinc-500 mt-0.5', isRtl && 'font-farsi')}>
                        {updateInfo?.available ? 'A new official update is available.' : 'Running the official production build.'}
                      </p>
                      {!updateInfo?.available && updateCheck && (
                        <div
                          role="status"
                          aria-live="polite"
                          className={cn(
                            'mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug',
                            updateCheck.state === 'upToDate' && 'text-emerald-700 dark:text-emerald-400',
                            updateCheck.state === 'error' && 'text-rose-600 dark:text-rose-400',
                            updateCheck.state === 'desktopOnly' && 'text-zinc-500 dark:text-zinc-400',
                            isRtl && 'font-farsi'
                          )}
                        >
                          {updateCheck.state === 'upToDate' && <Check className="w-3 h-3 mt-0.5 shrink-0" />}
                          {updateCheck.state === 'error' && <X className="w-3 h-3 mt-0.5 shrink-0" />}
                          <span className="min-w-0 break-words">
                            {updateCheck.state === 'upToDate' && (language === 'fa'
                              ? `نسخه شما به‌روز است · بررسی شد ${formatBackupTime(updateCheck.at)}`
                              : `You're on the latest version · checked ${formatBackupTime(updateCheck.at)}`)}
                            {updateCheck.state === 'error' && (language === 'fa'
                              ? 'اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.'
                              : 'Check your connection and try again.')}
                            {updateCheck.state === 'desktopOnly' && (language === 'fa'
                              ? 'بررسی به‌روزرسانی فقط در نسخه دسکتاپ انجام می‌شود.'
                              : 'Update checks run in the desktop app.')}
                          </span>
                        </div>
                      )}
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
                        onClick={checkUpdatesNow}
                        className={cn('gap-1.5 text-xs h-7', isRtl && 'font-farsi')}
                      >
                        <RotateCw className={cn('w-3 h-3 text-zinc-400', isCheckingUpdates && 'animate-spin')} />
                        <span>{isCheckingUpdates ? t('settings.checking') : t('settings.checkNow')}</span>
                      </Button>
                    )}
                  </div>

                  {/* Community & Support */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => openExternalUrl('https://discord.gg/TYPRXeKPp')}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-100/70 hover:bg-zinc-200/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800/80 transition-colors text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <DiscordIcon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200 shrink-0" />
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                          Discord
                        </span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openExternalUrl('https://github.com/vltmk/Checkpoint/releases')}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-100/70 hover:bg-zinc-200/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800/80 transition-colors text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GithubIcon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200 shrink-0" />
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate">
                          GitHub
                        </span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await copyTextNative('sovrgnx@proton.me');
                        setCopiedEmail(true);
                        setTimeout(() => setCopiedEmail(false), 1800);
                        openExternalUrl('mailto:sovrgnx@proton.me');
                      }}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-100/70 hover:bg-zinc-200/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800/80 transition-colors text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200 shrink-0" />
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                          {copiedEmail ? (isRtl ? 'کپی شد' : 'Copied') : 'Email'}
                        </span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                    </button>
                  </div>

                  {/* Danger Zone: Clear All Data */}
                  <div className="p-3 rounded-xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 space-y-2">
                    <label className={cn('block text-xs font-semibold text-rose-600 dark:text-rose-400', isRtl && 'font-farsi')}>
                      {t('settings.dangerZone')}
                    </label>
                    <p className={cn('text-[11px] text-zinc-500', isRtl && 'font-farsi')}>
                      {t('settings.clearAllDataDesc')}
                    </p>

                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => {
                        setClearConfirmText('');
                        setPurgeSnapshots(false);
                        setIsClearConfirmOpen(true);
                      }}
                      className={cn('gap-2 text-xs w-full justify-center bg-rose-600 hover:bg-rose-500 text-white', isRtl && 'font-farsi')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('settings.clearAllData')}</span>
                    </Button>

                    {clearResult && (
                      <div
                        role="status"
                        aria-live="polite"
                        className={cn(
                          'flex items-start gap-1.5 text-[11px] leading-snug',
                          clearResult.state === 'success' && 'text-emerald-700 dark:text-emerald-400',
                          clearResult.state === 'error' && 'text-rose-600 dark:text-rose-400',
                          clearResult.state === 'running' && 'text-zinc-500 dark:text-zinc-400',
                          isRtl && 'font-farsi'
                        )}
                      >
                        {clearResult.state === 'success' && <Check className="w-3 h-3 mt-0.5 shrink-0" />}
                        {clearResult.state === 'error' && <X className="w-3 h-3 mt-0.5 shrink-0" />}
                        <span className="min-w-0 break-words">
                          {clearResult.state === 'running' && (language === 'fa' ? 'در حال حذف…' : 'Deleting…')}
                          {clearResult.state === 'success' && (language === 'fa'
                            ? `تمام رکوردهای دفتر کار حذف شد${clearResult.purged ? ' و اسنپ‌شات‌ها نیز حذف شدند' : ''}.`
                            : `All ledger records were deleted${clearResult.purged ? ' and so were the snapshots' : isDesktop ? '; snapshots were kept' : ''}.`)}
                          {clearResult.state === 'error' && (language === 'fa'
                            ? 'حذف اطلاعات انجام نشد. دوباره تلاش کنید.'
                            : 'Could not clear the data. Try again.')}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>

      <DialogFooter className="justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenShortcuts?.()}
          className={cn('gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100', isRtl && 'font-farsi')}
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
          <DialogTitle className="text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>{t('settings.clearAllData')}</span>
          </DialogTitle>
        </DialogHeader>

        <DialogContent className="space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {language === 'fa'
              ? 'این عملیات تمام رکوردهای کاری را برای همیشه پاک خواهد کرد. برای تایید، عبارت DELETE را در کادر زیر وارد کنید:'
              : 'This action will permanently wipe all ledger records. To confirm, type "DELETE" below:'}
          </p>

          <Input
            value={clearConfirmText}
            onChange={(e) => setClearConfirmText(e.target.value)}
            placeholder="DELETE"
            className="font-mono text-center tracking-widest uppercase border-rose-300 dark:border-rose-900"
            autoFocus
          />

          {isDesktop && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="purgeSnapshots"
                checked={purgeSnapshots}
                onChange={(e) => setPurgeSnapshots(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <label htmlFor="purgeSnapshots" className="text-[11px] text-zinc-500 select-none cursor-pointer">
                {language === 'fa' ? 'حذف تمام اسنپ‌شات‌های پشتیبان نیز انجام شود' : 'Also purge all historical snapshots'}
              </label>
            </div>
          )}
        </DialogContent>

        <DialogFooter className="justify-between">
          <Button variant="ghost" size="sm" onClick={() => setIsClearConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={clearConfirmText.trim() !== 'DELETE'}
            onClick={async () => {
              const purged = purgeSnapshots;
              setIsClearConfirmOpen(false);
              setClearResult({ state: 'running' });
              const ok = await onClearAllData?.(purged);
              setClearResult({ state: ok === true ? 'success' : 'error', purged });
              if (ok === true) {
                setClearConfirmText('');
                // Snapshot list may have been purged, so refresh the restore picker
                trackerDB.listSnapshots().then((list) => {
                  setSnapshots(list || []);
                  setSelectedSnapshot(list?.[0]?.id || '');
                }).catch(() => {});
              }
            }}
          >
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Category Modal for adding/editing games */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        onSave={async () => {
          await onRefreshCategories?.(true);
        }}
        onSaved={async () => {
          await onRefreshCategories?.(true);
        }}
      />
    </Dialog>
  );
}

export default SettingsModal;
