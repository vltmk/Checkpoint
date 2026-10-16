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
  Zap,
  Sliders,
  Palette,
  Info,
  Database,
  Megaphone,
} from 'lucide-react';
import { isTauri, selectDirectoryNative, openExternalUrl, copyTextNative, openPathNative } from '../lib/desktop';
import { DiscordIcon, GithubIcon, TomanIcon } from './ui/Icons';
import { trackerDB } from '../lib/db';
import { useTheme } from 'next-themes';
import { Input } from './ui/Input';
import { useLanguage } from '../lib/i18n';
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
  ledgerDateFormat = 'relative',
  onLedgerDateFormatChange,
}) {
  const { language, setLanguage, t, isRtl, formatNumber, getDatePatternPreview, ledgerDateFormatOptions } = useLanguage();
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
  const [exportJsonState, setExportJsonState] = useState('idle');
  const [exportCsvState, setExportCsvState] = useState('idle');
  const [highlightBackup, setHighlightBackup] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const isDesktop = isTauri();

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
    }
  }, [isOpen]);

  const currencyOptions = [
    {
      value: 'TOMAN',
      label: 'Toman',
      icon: <TomanIcon className="w-[24px] h-[24px] min-w-[24px] min-h-[24px]" />,
    },
    {
      value: 'GOLD',
      label: 'Gold',
      icon: <Zap className="w-3.5 h-3.5" />,
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
                  ? 'text-zinc-800 dark:text-zinc-200 font-medium'
                  : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              {currentTheme === 'dark' && (
                <motion.div
                  layoutId="settingsThemePill"
                  className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-full shadow-sm border border-zinc-300 dark:border-zinc-600"
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
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-start cursor-pointer shrink-0 sm:w-full',
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
                  transition={{ duration: 0.12 }}
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
                </motion.div>
              )}

              {activeTab === 'appearance' && (
                <motion.div
                  key="tab-appearance"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
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
                  transition={{ duration: 0.12 }}
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
                  transition={{ duration: 0.12 }}
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
                        'space-y-3 p-3 rounded-xl border transition-all duration-300',
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
                              'w-full px-2.5 py-1.5 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 border rounded-md text-xs font-medium transition-all flex items-center justify-between gap-2 text-left group cursor-pointer',
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
                            >
                              <RotateCw className={cn('w-3.5 h-3.5 text-zinc-400', manualBackupState === 'running' && 'animate-spin')} />
                              <span>{t('settings.backupNow')}</span>
                            </Button>
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
                        onClick={async () => {
                          setExportJsonState('success');
                          await onExportJson?.();
                          setTimeout(() => setExportJsonState('idle'), 1800);
                        }}
                        className={cn('justify-start gap-2 text-xs py-2 h-auto leading-relaxed', isRtl && 'font-farsi')}
                      >
                        <Upload className="w-4 h-4 text-zinc-400 shrink-0" />
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
                        className={cn('justify-start gap-2 text-xs py-2 h-auto leading-relaxed', isRtl && 'font-farsi')}
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
                        className={cn('justify-start gap-2 text-xs sm:col-span-2 py-2 h-auto leading-relaxed', isRtl && 'font-farsi')}
                      >
                        <FileSpreadsheet className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span>{t('settings.exportCsv')}</span>
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'about' && (
                <motion.div
                  key="tab-about"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
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
                        <span>{updateInfo?.available ? `${t('settings.updateAvailable')}: v${updateInfo.version}` : t('settings.upToDate')}</span>
                        {appVersion && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            v{appVersion}
                          </span>
                        )}
                      </div>
                      <p className={cn('text-[11px] text-zinc-500 mt-0.5', isRtl && 'font-farsi')}>
                        {updateInfo?.available ? 'A new official update is available.' : 'Running the official production build.'}
                      </p>
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
              await onClearAllData?.(purgeSnapshots);
              setIsClearConfirmOpen(false);
              onClose();
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
