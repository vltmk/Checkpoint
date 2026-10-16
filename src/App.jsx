import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue, lazy, Suspense } from 'react';
import { trackerDB } from './lib/db';
import { STATUS_CONFIG, generateDiscordReceiptText, convertEntryCurrency, formatMoney } from './lib/currencies';
import { Navbar } from './components/Navbar';
import { MobileHeader, MobileBottomNav } from './components/MobileNavigation';
import { LedgerView } from './components/views/LedgerView';
// Chart.js and react-chartjs-2 only matter on the Analytics tab, so keep them out of the startup bundle
const AnalyticsView = lazy(() =>
  import('./components/views/AnalyticsView').then((m) => ({ default: m.AnalyticsView }))
);
import { Lightbox } from './components/Lightbox';
import { ContextMenu } from './components/ui/ContextMenu';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, hasOpenDialog } from './components/ui/Dialog';
import { Button } from './components/ui/Button';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { toLocalISOString } from './components/ui/DateTimePicker';
import { ProfileOnboardingModal } from './components/ui/ProfileOnboardingModal';
import { UndoToast } from './components/ui/UndoToast';
import {
  getActiveProfileId,
  setActiveProfileId,
  isProfileOnboardingCompleted,
  setProfileOnboardingCompleted,
} from './lib/profiles';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from 'next-themes';
import { FileSpreadsheet, Download } from 'lucide-react';
import { checkForUpdate, getAppVersion, getStaticAppVersion } from './lib/updater';
import { loadCategories, importCategories } from './lib/categories';
import { fetchAnnouncements, resetAnnouncementState } from './lib/announcements';
import {
  getStoredNotifications,
  mergeNotificationsIntoHistory,
  countUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotificationItem,
  clearAllNotificationHistory,
  compareSemver,
  saveStoredNotifications,
} from './lib/notifications';
import {
  isTauri,
  saveFileNative,
  openFileNative,
  copyTextNative,
  enforceMinWindowSize,
  hideWindow,
  showWindow,
  sendTrayNotification,
  resetTrayNotificationFlag,
  listenToTrayEvents,
  sendDesktopNotification,
  pruneOldBackupsNative,
  generateLedgerFingerprint,
  openAppAwareUrl,
  closeWindow,
} from './lib/desktop';
import {
  initTelemetry,
  incrementLocalWorkCount,
  flushDailyTelemetry,
  isTelemetryEnabled,
  setTelemetryEnabled,
} from './lib/telemetry';

import { useLanguage, formatShamsiDate } from './lib/i18n';
import { sortLedgerRows } from './lib/ledgerQuery';

// True once `open` has been true, and stays true afterwards
const useHasBeenOpen = (open) => {
  const [hasBeenOpen, setHasBeenOpen] = useState(Boolean(open));
  useEffect(() => {
    if (open) setHasBeenOpen(true);
  }, [open]);
  return hasBeenOpen || Boolean(open);
};

// Large modals are code-split and fetched the first time they open. After that they stay mounted,
// so their close animations and internal state behave exactly as before.
const lazyModal = (loader) => {
  const Lazy = lazy(loader);
  return function LazyModal(props) {
    const mounted = useHasBeenOpen(props.isOpen);
    if (!mounted) return null;
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
};

const WorkModal = lazyModal(() => import('./components/WorkModal').then((m) => ({ default: m.WorkModal })));
const OrderCalculatorPopover = lazyModal(() =>
  import('./components/OrderCalculatorPopover').then((m) => ({ default: m.OrderCalculatorPopover }))
);
const ReceiptModal = lazyModal(() => import('./components/ReceiptModal').then((m) => ({ default: m.ReceiptModal })));
const SettingsModal = lazyModal(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const ShortcutsModal = lazyModal(() => import('./components/ShortcutsModal').then((m) => ({ default: m.ShortcutsModal })));
const NotificationCenter = lazyModal(() =>
  import('./components/NotificationCenter').then((m) => ({ default: m.NotificationCenter }))
);
const UpdateModal = lazyModal(() => import('./components/UpdateModal').then((m) => ({ default: m.UpdateModal })));

// Defensive Settings Parsing Utilities
const parseBooleanSetting = (val, fallback = false) => {
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return fallback;
};

const parseNumberSetting = (val, fallback = 0, min = null, max = null) => {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  if (isNaN(num)) return fallback;
  if (min !== null && num < min) return min;
  if (max !== null && num > max) return max;
  return num;
};

const parseStringSetting = (val, fallback = '', allowedList = null) => {
  if (typeof val !== 'string' || !val) return fallback;
  if (allowedList && !allowedList.includes(val)) return fallback;
  return val;
};

// Quoted CSV text cell. Values that start with a formula trigger get a leading apostrophe so
// spreadsheet apps show them as text instead of evaluating them (e.g. a title "=HYPERLINK(...)").
const csvText = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const buildLedgerCsv = (list, globalCurrency, goldRateTOMAN) => {
  const headers = [
    'ID',
    'Date & Time',
    'Game',
    'Work Title',
    'Seller / Source',
    'Currency',
    'Income Amount',
    'Applied Rate (Toman/1k G)',
    'Status',
    'Notes',
    'Has Proof Attached',
  ];

  const rows = list.map((e) => [
    e.id,
    e.dateTime,
    csvText(e.game || ''),
    csvText(e.title || ''),
    csvText(e.source || ''),
    csvText(e.currency || globalCurrency),
    e.income,
    e.exchangeRate || goldRateTOMAN || 3200,
    e.status,
    csvText(e.notes || ''),
    e.proofs && e.proofs.length > 0 ? 'YES' : 'NO',
  ]);

  return String.fromCharCode(0xfeff) + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};

const saveCsvFile = async (fileName, csvContent) => {
  if (isTauri()) {
    const res = await saveFileNative({
      defaultPath: fileName,
      filters: [{ name: 'CSV Spreadsheet', extensions: ['csv'] }],
      content: csvContent,
    });
    if (res && (res.success || res.cancelled)) {
      return;
    }
    console.warn('Native CSV save failed, falling back to browser download:', res?.error);
  }

  // Blob URL rather than a data: URI: encodeURI leaves '#' and '?' unescaped, so the
  // browser would cut the file off at the first '#' (common in notes and order IDs).
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function App() {
  const { language, setLanguage, t, isRtl } = useLanguage();
  const isDesktop = isTauri();
  const [appVersion, setAppVersion] = useState(() => getStaticAppVersion());
  // The ledger view loads its own rows. App only tracks a version number that tells it to refresh.
  const [ledgerVersion, setLedgerVersion] = useState(0);
  // Analytics needs every entry, so they load only while the Analytics tab is open
  const [analyticsEntries, setAnalyticsEntries] = useState([]);
  // Latest game and currency, used to pre-fill new entries
  const [latestEntryDefaults, setLatestEntryDefaults] = useState({ game: '', currency: '' });
  // Full rows for the current selection (can span pages)
  const [selectedRows, setSelectedRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dual-Profile Architecture ('booster' | 'advertiser')
  const [activeProfileId, setActiveProfileIdState] = useState(() => getActiveProfileId());
  const [isProfileOnboardingOpen, setIsProfileOnboardingOpen] = useState(() => !isProfileOnboardingCompleted());
  const [profileCounts, setProfileCounts] = useState({ booster: 0, advertiser: 0 });
  const activeProfileCount = profileCounts[activeProfileId] || 0;
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const profileSwitchSeqRef = useRef(0);
  const isSwitchingProfileRef = useRef(false);

  // Desktop Tray & Window Preferences
  const [closeToTray, setCloseToTray] = useState(() => {
    return parseBooleanSetting(null, true);
  });
  const [minimizeToTray, setMinimizeToTray] = useState(() => {
    return parseBooleanSetting(null, false);
  });

  const closeToTrayRef = useRef(closeToTray);
  useEffect(() => {
    closeToTrayRef.current = closeToTray;
  }, [closeToTray]);

  const minimizeToTrayRef = useRef(minimizeToTray);
  useEffect(() => {
    minimizeToTrayRef.current = minimizeToTray;
  }, [minimizeToTray]);

  // Automated Scheduled Backups to Custom Directory (Disabled by default)
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => {
    return parseBooleanSetting(null, false);
  });
  const [autoBackupPath, setAutoBackupPath] = useState(() => {
    return parseStringSetting(null, '');
  });
  const [autoBackupFrequency, setAutoBackupFrequency] = useState(() => {
    return parseStringSetting(null, 'daily', ['daily', 'weekly', 'on_start']);
  });
  const [autoBackupRetention, setAutoBackupRetention] = useState(() => {
    return parseNumberSetting(null, 5, 0);
  });

  // Anonymous Usage Telemetry (Enabled by default)
  const [telemetryEnabled, setTelemetryEnabledState] = useState(() => {
    return parseBooleanSetting(null, true);
  });

  // Ledger Group Date Format ('relative' | 'yyyy-mm-dd' | 'dd-mm-yyyy' | 'mm-dd-yyyy' | 'month-d-yyyy')
  const [ledgerDateFormat, setLedgerDateFormatState] = useState(() => {
    return parseStringSetting(
      null,
      'relative',
      ['relative', 'yyyy-mm-dd', 'dd-mm-yyyy', 'mm-dd-yyyy', 'month-d-yyyy']
    );
  });

  const handleLedgerDateFormatChange = useCallback((newFmt) => {
    setLedgerDateFormatState(newFmt);
    try {
    } catch (e) {}
  }, []);

  // Active View Tab ('ledger' | 'analytics')
  const [activeTab, setActiveTab] = useState(() => {
    const saved = null;
    if (saved === 'analytics') return 'analytics';
    return 'ledger';
  });

  // Interface Theme ('dark' | 'light') via next-themes
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || 'dark';

  // User Currency Preferences (TOMAN | GOLD | USD | EUR)
  const [globalCurrency, setGlobalCurrency] = useState(() => {
    const saved = null;
    if (saved === 'WOW_GOLD' || saved === 'GOLD') return 'GOLD';
    if (saved === 'USD') return 'USD';
    if (saved === 'EUR') return 'EUR';
    return 'TOMAN';
  });

  // Gold Exchange Rate in Toman (default 3,200 Toman per 1,000 Gold)
  const [goldRateTOMAN, setGoldRateTOMAN] = useState(() => {
    const saved = null;
    return parseNumberSetting(saved, 3200, 1);
  });

  // USD Exchange Rate in Toman (default 95,000 Toman per 1 USD)
  const [usdRateTOMAN, setUsdRateTOMAN] = useState(() => {
    const saved = null;
    return parseNumberSetting(saved, 95000, 1);
  });

  // EUR Exchange Rate in USD (default 1.08 USD per 1 EUR)
  const [eurRateUSD, setEurRateUSD] = useState(() => {
    const saved = null;
    return parseNumberSetting(saved, 1.08, 0.01);
  });

  // Order Calculator State
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Categories & Games State
  const [categories, setCategories] = useState([]);

  const refreshCategories = useCallback(async (reloadEntries = false) => {
    try {
      const list = await loadCategories();
      setCategories(list);
      if (reloadEntries) {
        setLedgerVersion((v) => v + 1);
      }
      return list;
    } catch (e) {
      return [];
    }
  }, []);

  // Modals State
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptEntry, setReceiptEntry] = useState(null);
  const [externalTeammateFilter, setExternalTeammateFilter] = useState('');
  const [externalSourceFilter, setExternalSourceFilter] = useState('');
  const handleClearExternalTeammateFilter = useCallback(() => setExternalTeammateFilter(''), []);
  const handleClearExternalSourceFilter = useCallback(() => setExternalSourceFilter(''), []);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialScrollSection, setSettingsInitialScrollSection] = useState(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [exportConfirm, setExportConfirm] = useState(null); // null | 'csv' | 'json'

  // Context Menu State
  const [contextMenuState, setContextMenuState] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    rect: null,
    targetEntry: null,
  });

  // Lifted selection state for context menu & ledger synchronization
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // The ledger filters on a deferred copy, so typing stays responsive while large lists re-filter
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState('');
  const [isDiscordBatchCopied, setIsDiscordBatchCopied] = useState(false);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState(null);
  const [undoDeleteState, setUndoDeleteState] = useState({ isOpen: false, items: [], count: 0 });

  const [lightboxData, setLightboxData] = useState({
    isOpen: false,
    imgSrc: '',
    caption: '',
  });

  // Software Updates & Announcements State
  const [updateInfo, setUpdateInfo] = useState(null);
  const updateInfoRef = useRef(updateInfo);
  useEffect(() => {
    updateInfoRef.current = updateInfo;
  }, [updateInfo]);

  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const hasNotifiedUpdateThisSession = useRef(false);

  // Data Loading
  const loadData = useCallback(async () => {
    const startTime = Date.now();
    try {
      // Hydrate runtime app version asynchronously and check for upgrade
      getAppVersion().then(async (v) => {
        if (v) {
          setAppVersion(v);
          try {
            const lastKnown = await trackerDB.getSetting('checkpoint_last_known_version', null);
            if (lastKnown && compareSemver(v, lastKnown) > 0) {
              // App was just upgraded! Post rich What's New notification
              const stored = await getStoredNotifications();
              const updated = mergeNotificationsIntoHistory(stored, {
                currentVersion: v,
                postUpdateInfo: {
                  version: v,
                  fromVersion: lastKnown,
                  language,
                  releaseUrl: `https://github.com/vltmk/Checkpoint/releases/tag/v${v}`,
                },
              });
              setNotifications(updated);
              await saveStoredNotifications(updated);

              // Spotlight What's New by opening Notification Center drawer on first launch after upgrade
              setIsNotificationCenterOpen(true);
            }
            await trackerDB.setSetting('checkpoint_last_known_version', v);
          } catch (e) {}
        }
      });

      setLedgerVersion((v) => v + 1);
      refreshCategories().catch(() => {});

      // Also hydrate persistent settings from SQLite / DB
      // Settings are pure reads, so fetch them together; reading them one by one was a chain of round trips at startup
      const [
        savedCur,
        savedRate,
        savedUsdRate,
        savedEurRate,
        savedCloseToTray,
        savedMinToTray,
        savedAutoBackupEnabled,
        savedAutoBackupPath,
        savedAutoBackupFreq,
        savedAutoBackupRetention,
        savedTelemetry,
        savedTab,
      ] = await Promise.all([
        trackerDB.getSetting('checkpoint_currency', null),
        trackerDB.getSetting('checkpoint_gold_rate_toman', null),
        trackerDB.getSetting('checkpoint_usd_rate_toman', null),
        trackerDB.getSetting('checkpoint_eur_rate_usd', null),
        trackerDB.getSetting('checkpoint_close_to_tray', null),
        trackerDB.getSetting('checkpoint_minimize_to_tray', null),
        trackerDB.getSetting('checkpoint_auto_backup_enabled', null),
        trackerDB.getSetting('checkpoint_auto_backup_path', null),
        trackerDB.getSetting('checkpoint_auto_backup_frequency', null),
        trackerDB.getSetting('checkpoint_auto_backup_retention', null),
        trackerDB.getSetting('checkpoint_telemetry_enabled', null),
        trackerDB.getSetting('checkpoint_tab', null),
      ]);
      if (savedCur && ['TOMAN', 'GOLD', 'USD', 'EUR'].includes(savedCur)) {
        setGlobalCurrency(savedCur);
      }
      if (savedRate !== null) {
        const parsedRate = parseNumberSetting(savedRate, 3200, 1);
        setGoldRateTOMAN(parsedRate);
      }
      if (savedUsdRate !== null) {
        const parsedUsd = parseNumberSetting(savedUsdRate, 95000, 1);
        setUsdRateTOMAN(parsedUsd);
      }
      if (savedEurRate !== null) {
        const parsedEur = parseNumberSetting(savedEurRate, 1.08, 0.01);
        setEurRateUSD(parsedEur);
      }
      if (savedCloseToTray !== null) {
        const val = parseBooleanSetting(savedCloseToTray, true);
        setCloseToTray(val);
      }
      if (savedMinToTray !== null) {
        const val = parseBooleanSetting(savedMinToTray, false);
        setMinimizeToTray(val);
      }
      if (savedAutoBackupEnabled !== null) {
        const val = parseBooleanSetting(savedAutoBackupEnabled, false);
        setAutoBackupEnabled(val);
      }
      if (savedAutoBackupPath && typeof savedAutoBackupPath === 'string') {
        setAutoBackupPath(savedAutoBackupPath);
      }
      if (savedAutoBackupFreq && ['on_start', 'daily', 'weekly'].includes(savedAutoBackupFreq)) {
        setAutoBackupFrequency(savedAutoBackupFreq);
      }
      if (savedAutoBackupRetention !== null) {
        const parsedRet = parseNumberSetting(savedAutoBackupRetention, 5, 0);
        setAutoBackupRetention(parsedRet);
      }
      if (savedTelemetry !== null) {
        const val = parseBooleanSetting(savedTelemetry, true);
        setTelemetryEnabledState(val);
      }
      if (savedTab === 'ledger' || savedTab === 'analytics') {
        setActiveTab(savedTab);
      }
      trackerDB.getProfileCounts?.().then((counts) => {
        if (counts) setProfileCounts(counts);
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to load data from storage engine:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Lightweight entry reload without full app re-hydration
  const reloadEntries = useCallback(async () => {
    try {
      setLedgerVersion((v) => v + 1);
      trackerDB.getProfileCounts?.().then((counts) => {
        if (counts) setProfileCounts(counts);
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to reload entries:', err);
    }
  }, []);

  // Profile Switching & Background Synchronization
  const handleProfileChange = useCallback(async (newProfileId) => {
    if (!newProfileId || newProfileId === activeProfileId) return;

    const seq = ++profileSwitchSeqRef.current;
    isSwitchingProfileRef.current = true;
    setIsSwitchingProfile(true);

    setActiveProfileId(newProfileId);
    setActiveProfileIdState(newProfileId);

    try {
      await trackerDB.switchProfile(newProfileId);
      if (profileSwitchSeqRef.current !== seq) return;

      setLedgerVersion((v) => v + 1);
      refreshCategories().catch(() => {});

      // Restore profile-specific preferred currency if configured
      const savedProfileCurrency = await trackerDB.getSetting(`checkpoint_currency_${newProfileId}`, null);
      if (savedProfileCurrency && ['TOMAN', 'GOLD', 'USD', 'EUR'].includes(savedProfileCurrency)) {
        setGlobalCurrency(savedProfileCurrency);
      }

      trackerDB.getProfileCounts?.().then((counts) => {
        if (counts && profileSwitchSeqRef.current === seq) {
          setProfileCounts(counts);
        }
      }).catch(() => {});
    } catch (e) {
      console.error('Failed to switch profile:', e);
    } finally {
      if (profileSwitchSeqRef.current === seq) {
        setIsSwitchingProfile(false);
        isSwitchingProfileRef.current = false;
      }
    }
  }, [activeProfileId, refreshCategories]);

  const handleSwitchProfileToggle = useCallback(() => {
    const next = activeProfileId === 'booster' ? 'advertiser' : 'booster';
    handleProfileChange(next);
  }, [activeProfileId, handleProfileChange]);

  useEffect(() => {
    const handleProfileEvent = (e) => {
      const targetId = e?.detail?.profileId;
      if (targetId && targetId !== activeProfileId && !isSwitchingProfileRef.current) {
        handleProfileChange(targetId);
      }
    };
    window.addEventListener('checkpoint:profile-changed', handleProfileEvent);
    return () => window.removeEventListener('checkpoint:profile-changed', handleProfileEvent);
  }, [activeProfileId, handleProfileChange]);

  // Calculate unread notification count
  const unreadNotificationsCount = useMemo(() => {
    return countUnreadNotifications(notifications);
  }, [notifications]);

  // Load stored notifications & sync remote feeds (non-blocking)
  const syncFeeds = useCallback(async (opts = { silent: true }) => {
    try {
      const stored = await getStoredNotifications();
      let currentMerged = stored;
      setNotifications(stored);

      // 1. Fetch remote announcements (async, non-blocking)
      try {
        const activeAnnouncements = await fetchAnnouncements(4000);
        currentMerged = mergeNotificationsIntoHistory(currentMerged, {
          updateInfo: updateInfoRef.current,
          announcements: activeAnnouncements,
          currentVersion: appVersion,
        });
        setNotifications(currentMerged);
        await saveStoredNotifications(currentMerged);
      } catch (e) {}

      // 2. Check for software updates (if desktop)
      if (isDesktop) {
        if (!opts.silent) setIsCheckingUpdates(true);
        const res = await checkForUpdate({ timeoutMs: 12000 });
        if (res && res.available) {
          setUpdateInfo(res);
          currentMerged = mergeNotificationsIntoHistory(currentMerged, {
            updateInfo: res,
            currentVersion: appVersion || res.currentVersion,
          });
          setNotifications(currentMerged);
          await saveStoredNotifications(currentMerged);

          // Alert user on discovery
          if (opts.silent && !hasNotifiedUpdateThisSession.current) {
            hasNotifiedUpdateThisSession.current = true;
            sendDesktopNotification({
              title: 'CHECKPOINT Update Available',
              body: `Version v${res.version} is published on GitHub and ready to download.`,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Feeds] Sync error:', err);
    } finally {
      if (!opts.silent) setIsCheckingUpdates(false);
    }
  }, [isDesktop, appVersion]);

  // Execute scheduled automated backups (if enabled)
  const runScheduledAutoBackup = useCallback(async (opts = {}) => {
    if (!isDesktop || !autoBackupEnabled || !autoBackupPath) return;
    try {
      const isManual = opts.force === true;
      const lastRunStr = await trackerDB.getSetting('checkpoint_last_auto_backup_timestamp', '');
      const lastRun = lastRunStr ? Number(lastRunStr) : 0;
      const now = Date.now();

      let intervalMs = 24 * 60 * 60 * 1000; // daily default
      if (autoBackupFrequency === 'on_start') {
        intervalMs = 0;
      } else if (autoBackupFrequency === 'weekly') {
        intervalMs = 7 * 24 * 60 * 60 * 1000;
      }

      if (isManual || now - lastRun >= intervalMs) {
        const entries = await trackerDB.getAllEntries();
        const currentFingerprint = generateLedgerFingerprint(entries, globalCurrency, goldRateTOMAN);
        const lastFingerprint = await trackerDB.getSetting('checkpoint_last_auto_backup_hash', '');

        // Smart Change Detection: Skip export if no financial/entry data changed and not a manual trigger
        if (!isManual && currentFingerprint === lastFingerprint && lastRun > 0) {
          await trackerDB.setSetting('checkpoint_last_auto_backup_timestamp', String(now));
          return;
        }

        const fullEntries = await trackerDB.getAllEntriesFull();
        let currentCategories = [];
        try {
          currentCategories = await loadCategories();
        } catch (e) {}

        const backupData = {
          app: 'CHECKPOINT',
          version: appVersion || '0.0.0',
          exportDate: new Date().toISOString(),
          type: isManual ? 'manual_auto_backup' : 'scheduled_auto_backup',
          currency: globalCurrency,
          goldRateTOMAN,
          categories: currentCategories,
          entriesCount: fullEntries.length,
          entries: fullEntries,
        };

        const todayStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `checkpoint_autobackup_${todayStr}.json`;
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        const sep = autoBackupPath.includes('\\') ? '\\' : '/';
        const fullPath = `${autoBackupPath.replace(/[/\\]+$/, '')}${sep}${fileName}`;

        await writeTextFile(fullPath, JSON.stringify(backupData, null, 2));
        await trackerDB.setSetting('checkpoint_last_auto_backup_timestamp', String(now));
        await trackerDB.setSetting('checkpoint_last_auto_backup_hash', currentFingerprint);

        // Auto-Pruning: Enforce retention limit (e.g. keep last N backups)
        if (autoBackupRetention > 0) {
          await pruneOldBackupsNative({
            backupDir: autoBackupPath,
            maxFiles: autoBackupRetention,
          });
        }
      }
    } catch (err) {
      console.warn('[AutoBackup] Backup execution failed:', err);
      if (opts.force) {
        throw err;
      }
    }
  }, [isDesktop, autoBackupEnabled, autoBackupPath, autoBackupFrequency, autoBackupRetention, appVersion, globalCurrency, goldRateTOMAN]);

  const syncFeedsRef = useRef(syncFeeds);
  useEffect(() => {
    syncFeedsRef.current = syncFeeds;
  }, [syncFeeds]);

  const runScheduledAutoBackupRef = useRef(runScheduledAutoBackup);
  useEffect(() => {
    runScheduledAutoBackupRef.current = runScheduledAutoBackup;
  }, [runScheduledAutoBackup]);

  // Initial application bootstrap and background synchronization timers (runs once on mount)
  useEffect(() => {
    loadData();
    showWindow();
    enforceMinWindowSize(800, 560);

    // Initial background feed sync & telemetry shortly after render
    const timer = setTimeout(() => {
      syncFeedsRef.current?.({ silent: true });
      runScheduledAutoBackupRef.current?.();
      initTelemetry();
    }, 700);

    // Periodic polling every 4 hours for long-running / tray sessions
    const intervalTimer = setInterval(() => {
      syncFeedsRef.current?.({ silent: true });
      runScheduledAutoBackupRef.current?.();
      flushDailyTelemetry();
    }, 4 * 60 * 60 * 1000);

    // Window focus listener to refresh feeds when switching back
    const handleFocus = () => {
      syncFeedsRef.current?.({ silent: true });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(timer);
      clearInterval(intervalTimer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData]);

  // Analytics works on every entry, so it loads them only while its tab is open
  useEffect(() => {
    if (activeTab !== 'analytics') return undefined;
    let cancelled = false;
    trackerDB.getAllEntries().then((rows) => {
      if (!cancelled) setAnalyticsEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, ledgerVersion, activeProfileId]);

  // Latest game and currency for pre-filling new entries
  useEffect(() => {
    let cancelled = false;
    trackerDB.getLatestEntryDefaults().then((defaults) => {
      if (!cancelled) setLatestEntryDefaults(defaults);
    }).catch((err) => console.warn('Could not read latest entry defaults:', err));
    return () => {
      cancelled = true;
    };
  }, [ledgerVersion, activeProfileId]);

  // Desktop Window & System Tray Event Listeners
  useEffect(() => {
    if (!isDesktop) return;

    let unlistenTray = null;
    let unlistenClose = null;

    const setupDesktopListeners = async () => {
      try {
        unlistenTray = await listenToTrayEvents({
          onSettings: () => setIsSettingsOpen(true),
        });

        const { listen } = await import('@tauri-apps/api/event');
        unlistenClose = await listen('tauri://close-requested', async () => {
          if (closeToTrayRef.current) {
            await hideWindow();
            sendTrayNotification(false);
          } else {
            await closeWindow();
          }
        });
      } catch (e) {
        console.warn('Failed to setup desktop listeners:', e);
      }
    };

    setupDesktopListeners();

    return () => {
      if (unlistenTray) unlistenTray();
      if (unlistenClose) unlistenClose();
    };
  }, [isDesktop]);

  // Tray Setting Handlers
  const handleCloseToTrayChange = async (val) => {
    const boolVal = parseBooleanSetting(val, true);
    setCloseToTray(boolVal);
    try {
      await trackerDB.setSetting('checkpoint_close_to_tray', String(boolVal));
    } catch (e) {}
  };

  const handleMinimizeToTrayChange = async (val) => {
    const boolVal = parseBooleanSetting(val, false);
    setMinimizeToTray(boolVal);
    try {
      await trackerDB.setSetting('checkpoint_minimize_to_tray', String(boolVal));
    } catch (e) {}
  };

  const handleAutoBackupEnabledChange = async (val) => {
    const boolVal = parseBooleanSetting(val, false);
    setAutoBackupEnabled(boolVal);
    try {
      await trackerDB.setSetting('checkpoint_auto_backup_enabled', String(boolVal));
    } catch (e) {}
  };

  const handleAutoBackupPathChange = async (val) => {
    const pathStr = typeof val === 'string' ? val : '';
    setAutoBackupPath(pathStr);
    try {
      await trackerDB.setSetting('checkpoint_auto_backup_path', pathStr);
    } catch (e) {}
  };

  const handleAutoBackupFrequencyChange = async (val) => {
    const freqStr = parseStringSetting(val, 'daily', ['daily', 'weekly', 'on_start']);
    setAutoBackupFrequency(freqStr);
    try {
      await trackerDB.setSetting('checkpoint_auto_backup_frequency', freqStr);
    } catch (e) {}
  };

  const handleAutoBackupRetentionChange = async (val) => {
    const num = parseNumberSetting(val, 5, 0);
    setAutoBackupRetention(num);
    try {
      await trackerDB.setSetting('checkpoint_auto_backup_retention', String(num));
    } catch (e) {}
  };

  const handleTelemetryEnabledChange = async (val) => {
    const boolVal = Boolean(val);
    setTelemetryEnabledState(boolVal);
    await setTelemetryEnabled(boolVal);
  };

  const handleThemeChange = async (newTheme) => {
    const validTheme = newTheme === 'light' ? 'light' : 'dark';
    setTheme(validTheme);
  };

  const handleManualAutoBackup = () => {
    return runScheduledAutoBackup({ force: true });
  };

  // Manual Check for Updates
  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    const res = await checkForUpdate({ timeoutMs: 7000 });
    setIsCheckingUpdates(false);
    if (res && res.available) {
      setUpdateInfo(res);
      const stored = await getStoredNotifications();
      const updated = mergeNotificationsIntoHistory(stored, { updateInfo: res });
      setNotifications(updated);
      await saveStoredNotifications(updated);
      setIsUpdateModalOpen(true);
    }
  };

  // Notification Actions
  const handleMarkNotificationAsRead = async (id) => {
    const updated = await markNotificationAsRead(id, notifications);
    setNotifications(updated);
  };

  const handleMarkAllNotificationsAsRead = async () => {
    const updated = await markAllNotificationsAsRead(notifications);
    setNotifications(updated);
  };

  const handleDismissNotification = async (id) => {
    const updated = await dismissNotificationItem(id, notifications);
    setNotifications(updated);
  };

  const handleClearAllNotifications = async () => {
    const updated = await clearAllNotificationHistory(notifications);
    setNotifications(updated);
  };

  const handleResetAnnouncements = async () => {
    await resetAnnouncementState();
    await syncFeeds({ silent: false });
  };

  // Tab Switcher
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    trackerDB.setSetting('checkpoint_tab', tab);
  };

  // Currency Handlers
  const handleCurrencyChange = (newCurr) => {
    const cur = newCurr === 'WOW_GOLD' ? 'GOLD' : (['TOMAN', 'GOLD', 'USD', 'EUR'].includes(newCurr) ? newCurr : 'TOMAN');
    setGlobalCurrency(cur);
    if (activeProfileId) {
      trackerDB.setSetting(`checkpoint_currency_${activeProfileId}`, cur).catch(() => {});
    }
    trackerDB.setSetting('checkpoint_currency', cur);
  };

  const handleGoldRateTOMANChange = (newRate) => {
    const r = Number(newRate) || 3200;
    setGoldRateTOMAN(r);
    trackerDB.setSetting('checkpoint_gold_rate_toman', String(r));
  };

  const handleUsdRateTOMANChange = (newRate) => {
    const r = Number(newRate) || 95000;
    setUsdRateTOMAN(r);
    trackerDB.setSetting('checkpoint_usd_rate_toman', String(r));
  };

  const handleEurRateUSDChange = (newRate) => {
    const r = Number(newRate) || 1.08;
    setEurRateUSD(r);
    trackerDB.setSetting('checkpoint_eur_rate_usd', String(r));
  };

  const handleSaveRates = (newRates) => {
    if (newRates?.goldRateTOMAN !== undefined) {
      handleGoldRateTOMANChange(newRates.goldRateTOMAN);
    }
    if (newRates?.usdRateTOMAN !== undefined) {
      handleUsdRateTOMANChange(newRates.usdRateTOMAN);
    }
    if (newRates?.eurRateUSD !== undefined) {
      handleEurRateUSDChange(newRates.eurRateUSD);
    }
  };

  // Save Entry (Create / Edit)
  const handleSaveEntry = async (entryData) => {
    const isNew = !editingEntry;
    await trackerDB.saveEntry(entryData);
    setIsWorkModalOpen(false);
    setEditingEntry(null);
    await reloadEntries();
    if (isNew) {
      handleTabChange('ledger');
      incrementLocalWorkCount();
    }
  };

  // Delete Single Entry (Called after in-line confirmation)
  const handleDeleteEntry = async (id) => {
    // Undo needs the full record, screenshots included
    const itemToDelete = (await trackerDB.getEntry(id)) || null;
    await trackerDB.deleteEntry(id);
    await reloadEntries();

    if (itemToDelete) {
      setUndoDeleteState({
        isOpen: true,
        items: [itemToDelete],
        count: 1,
      });
    }
  };

  // Bulk Delete Entries
  const handleBulkDelete = async (ids) => {
    if (!ids || ids.length === 0) return;
    // Undo needs full records, screenshots included
    const itemsToDelete = (await Promise.all(ids.map((id) => trackerDB.getEntry(id)))).filter(Boolean);
    await trackerDB.bulkDeleteEntries(ids);
    await reloadEntries();

    if (itemsToDelete.length > 0) {
      setUndoDeleteState({
        isOpen: true,
        items: itemsToDelete,
        count: itemsToDelete.length,
      });
    }
  };

  // Undo Delete (Restores deleted entries)
  const handleUndoDelete = async () => {
    const { items } = undoDeleteState;
    if (!items || items.length === 0) return;

    setUndoDeleteState({ isOpen: false, items: [], count: 0 });

    try {
      for (const item of items) {
        await trackerDB.saveEntry(item);
      }
      await reloadEntries();
    } catch (e) {
      console.error('Failed to undo delete:', e);
    }
  };

  // Bulk Update Status
  const handleBulkUpdateStatus = async (ids, nextStatus) => {
    if (!ids || ids.length === 0 || !nextStatus) return;
    await trackerDB.bulkUpdateStatus(ids, nextStatus);
    await reloadEntries();
  };

  // Full rows for the selection, refreshed when the selection or the data changes
  useEffect(() => {
    let cancelled = false;
    if (selectedEntryIds.size === 0) {
      setSelectedRows([]);
      return undefined;
    }
    trackerDB.getLedgerRowsByIds(Array.from(selectedEntryIds)).then((rows) => {
      if (!cancelled) setSelectedRows(rows);
    }).catch((err) => console.warn('Could not read the selection:', err));
    return () => {
      cancelled = true;
    };
  }, [selectedEntryIds, ledgerVersion]);

  const selectedSum = useMemo(() => {
    if (selectedEntryIds.size === 0) return 0;
    return sortLedgerRows(selectedRows, 'date_desc').reduce((sum, e) => {
      if (!selectedEntryIds.has(e.id)) return sum;
      if (e.status === 'Failed') return sum;
      return sum + convertEntryCurrency(e, globalCurrency, { goldRateTOMAN, usdRateTOMAN, eurRateUSD });
    }, 0);
  }, [selectedRows, selectedEntryIds, globalCurrency, goldRateTOMAN, usdRateTOMAN, eurRateUSD]);

  const handleBatchStatusChange = useCallback(async (status) => {
    if (selectedEntryIds.size === 0) return;
    const ids = Array.from(selectedEntryIds);
    await handleBulkUpdateStatus(ids, status);
  }, [selectedEntryIds, handleBulkUpdateStatus]);

  const handleBatchDeleteFromNav = useCallback(async () => {
    if (selectedEntryIds.size === 0) return;
    const ids = Array.from(selectedEntryIds);
    await handleBulkDelete(ids);
    setSelectedEntryIds(new Set());
    setIsSelectMode(false);
  }, [selectedEntryIds, handleBulkDelete]);

  const handleClearSelection = useCallback(() => {
    setSelectedEntryIds(new Set());
    setIsSelectMode(false);
  }, []);

  const handleBatchCopyDiscord = useCallback(async () => {
    if (selectedEntryIds.size === 0) return;
    const selectedEntriesList = sortLedgerRows(selectedRows, 'date_desc');
    if (selectedEntriesList.length === 0) return;
    const isFa = language === 'fa';
    const now = new Date();
    const dateStr = isFa
      ? formatShamsiDate(now, { month: 'long', day: 'numeric', year: 'numeric' })
      : now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

    const totalSumFormatted = formatMoney(selectedSum, globalCurrency, false, isFa);

    const itemsText = selectedEntriesList.map((entry, idx) => {
      const entryCur = entry.currency && entry.currency !== 'DEFAULT' ? entry.currency : globalCurrency;
      const amountStr = formatMoney(entry.income || 0, entryCur, false, isFa);
      const orderIdPart = entry.orderId ? `#${entry.orderId} | ` : '';
      const st = STATUS_CONFIG[entry.status]?.label || entry.status || 'Paid';
      const sourcePart = entry.source ? ` [${entry.source}]` : '';

      if (activeProfileId === 'advertiser') {
        const clientPrice = entry.pot || entry.income || 0;
        const formattedClient = formatMoney(clientPrice, entryCur, false, isFa);
        const payout = Math.max(0, (entry.pot || 0) - (entry.income || 0));
        const payoutStr = payout > 0 ? ` (Payout: ${formatMoney(payout, entryCur, false, isFa)})` : '';
        return `${idx + 1}. ${orderIdPart}${entry.title || 'Order'}${sourcePart} | ${formattedClient} | ${st}${payoutStr}`;
      }

      const teamPart = entry.teammates && entry.teammates.length > 0 ? ` (@${entry.teammates.join(', @')})` : '';
      return `${idx + 1}. ${orderIdPart}${entry.title || 'Job'}${sourcePart} | ${amountStr} | ${st}${teamPart}`;
    }).join('\n');

    let md = '';
    if (isFa) {
      md = `\`\`\`ini
[ گزارش دسته‌ای چک‌پوینت - CHECKPOINT ]
تاریخ        = ${dateStr}
تعداد کارها   = ${selectedEntriesList.length}
مجموع کارکرد  = ${totalSumFormatted}
ارز پایه     = ${globalCurrency}
--------------------------------------------------
${itemsText}
--------------------------------------------------
ثبت شده توسط CHECKPOINT Desktop
\`\`\``;
    } else {
      md = `\`\`\`ini
[ CHECKPOINT - BATCH SUMMARY ]
Date        = ${dateStr}
Total Jobs  = ${selectedEntriesList.length}
Total Earned= ${totalSumFormatted}
Base Unit   = ${globalCurrency}
--------------------------------------------------
${itemsText}
--------------------------------------------------
Exported via CHECKPOINT Desktop
\`\`\``;
    }

    copyTextNative(md);
    setIsDiscordBatchCopied(true);
    setTimeout(() => setIsDiscordBatchCopied(false), 2000);
  }, [selectedEntryIds, selectedRows, language, selectedSum, globalCurrency, activeProfileId]);

  // Bulk Export CSV
  const handleBulkExportCsv = useCallback(async (selectedIds) => {
    const listToExport = sortLedgerRows(await trackerDB.getLedgerRowsByIds(selectedIds), 'date_desc');
    if (listToExport.length === 0) {
      return;
    }

    const csvContent = buildLedgerCsv(listToExport, globalCurrency, goldRateTOMAN);
    const fileName = `checkpoint_selected_${listToExport.length}_jobs_${new Date().toISOString().slice(0, 10)}.csv`;
    await saveCsvFile(fileName, csvContent);
  }, [globalCurrency, goldRateTOMAN]);

  // Purge / Clear All Data
  const handleClearAllData = async (purgeSnapshots = false) => {
    await trackerDB.clearAll(purgeSnapshots);
    await loadData();
  };

  // Duplicate Entry
  const handleDuplicateEntry = async (id) => {
    try {
      const original = await trackerDB.getEntry(id);
      if (!original) return;

      const newId = 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const copy = {
        ...original,
        id: newId,
        title: `${original.title} (Copy)`,
        dateTime: toLocalISOString(new Date()),
        status: original.status || 'Pending',
        updatedAt: new Date().toISOString(),
        proofs: (original.proofs || []).map((p) => ({
          ...p,
          id: 'proof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          entry_id: newId,
          createdAt: new Date().toISOString(),
        })),
      };

      if (activeTab !== 'ledger') {
        setActiveTab('ledger');
      }

      await trackerDB.saveEntry(copy);
      await reloadEntries();
      incrementLocalWorkCount();
    } catch (err) {
      console.error('Failed to duplicate entry:', err);
      await reloadEntries();
    }
  };

  // Status Change / Flip
  const handleFlipStatus = async (id, currentStatus, targetStatus = null) => {
    const nextStatus = targetStatus || STATUS_CONFIG[currentStatus]?.next || 'Paid';
    // Targeted UPDATE: loading and re-saving the full record would also rewrite every screenshot blob
    await trackerDB.bulkUpdateStatus([id], nextStatus);
    await reloadEntries();
  };

  // Update Source Paid (Advertiser Dual-Settlement)
  const handleUpdateSourcePaid = async (id, sourcePaid) => {
    const val = sourcePaid ? 1 : 0;
    await trackerDB.updateSourcePaid(id, val);
    await reloadEntries();
  };

  // Update Booster Paid (Advertiser Dual-Settlement)
  const handleUpdateBoosterPaid = async (id, boosterPaid) => {
    const val = boosterPaid ? 1 : 0;
    await trackerDB.updateBoosterPaid(id, val);
    await reloadEntries();
  };

  // Transfer Calculated Order Data to WorkModal
  const handleTransferFromCalculator = useCallback((calcData) => {
    const isMultiBooster = calcData?.boosterCount > 1;
    const partialEntry = {
      pot: String(calcData?.clientPrice || ''),
      clientPrice: calcData?.clientPrice,
      income: String(calcData?.income || ''),
      feeRate: String(calcData?.feeRate || '15'),
      feeType: calcData?.feeType || 'percent',
      platformFee: calcData?.platformFeePct || 0,
      currency: calcData?.currency || 'USD',
      sourcePaid: false,
      boosterPaid: false,
      notes: isMultiBooster
        ? `Booster Pool: ${calcData.boosterPool} (${calcData.boosterCount}x @ ${calcData.perBoosterCut})`
        : '',
    };
    setEditingEntry(partialEntry);
    setIsWorkModalOpen(true);
    setIsCalculatorOpen(false);
  }, []);

  // Modal Openers
  const handleOpenWorkModal = async (entry = null) => {
    if (entry && entry.id) {
      const full = await trackerDB.getEntry(entry.id);
      setEditingEntry(full || entry);
    } else {
      setEditingEntry(null);
    }
    setIsWorkModalOpen(true);
  };

  const handleOpenReceipt = async (entry) => {
    if (!entry) return;
    const full = await trackerDB.getEntry(entry.id);
    setReceiptEntry(full || entry);
    setIsReceiptModalOpen(true);
  };

  const handleOpenLightbox = async (imgSrcOrEntry, caption) => {
    if (typeof imgSrcOrEntry === 'string' && (imgSrcOrEntry.startsWith('data:') || imgSrcOrEntry.startsWith('http') || imgSrcOrEntry.startsWith('blob:'))) {
      setLightboxData({
        isOpen: true,
        imgSrc: imgSrcOrEntry,
        caption: caption || 'Screenshot Proof',
      });
      return;
    }

    const targetId = typeof imgSrcOrEntry === 'string' ? imgSrcOrEntry : imgSrcOrEntry?.id;
    if (typeof targetId === 'string' && targetId) {
      const full = await trackerDB.getEntry(targetId);
      if (full && full.proofs && full.proofs.length > 0 && full.proofs[0]?.data) {
        setLightboxData({
          isOpen: true,
          imgSrc: full.proofs[0].data,
          caption: caption || full.title || 'Screenshot Proof',
        });
        return;
      }
    }
  };

  // Export CSV
  const handleExportCsv = useCallback(async () => {
    const allEntries = await trackerDB.getAllEntries();
    if (allEntries.length === 0) {
      return;
    }

    const csvContent = buildLedgerCsv(allEntries, globalCurrency, goldRateTOMAN);
    const fileName = `checkpoint_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    await saveCsvFile(fileName, csvContent);
  }, [globalCurrency, goldRateTOMAN]);

  // Export JSON Backup
  const handleExportJson = useCallback(async () => {
    if (activeProfileCount === 0) {
      return;
    }

    // Retrieve all records with complete full-res screenshot proofs
    const fullEntries = await trackerDB.getAllEntriesFull();

    let savedSources = [];
    let savedTeammates = [];
    let currentCategories = [];
    try {
      savedSources = await trackerDB.getSetting('checkpoint_user_saved_sources_v2', []);
      savedTeammates = await trackerDB.getSetting('checkpoint_saved_teammates_v1', []);
      currentCategories = await loadCategories();
    } catch (e) {}

    const backupData = {
      app: 'CHECKPOINT',
      version: appVersion || '0.0.0',
      exportDate: new Date().toISOString(),
      currency: globalCurrency,
      goldRateTOMAN,
      categories: currentCategories,
      preferences: {
        language,
        closeToTray,
        minimizeToTray,
        autoBackupEnabled,
        autoBackupPath,
        autoBackupFrequency,
        autoBackupRetention,
        categories: currentCategories,
        savedSources: Array.isArray(savedSources) ? savedSources : [],
        savedTeammates: Array.isArray(savedTeammates) ? savedTeammates : [],
      },
      entriesCount: fullEntries.length,
      entries: fullEntries,
    };

    const fileName = `checkpoint_backup_${new Date().toISOString().slice(0, 10)}.json`;

    if (isTauri()) {
      const res = await saveFileNative({
        defaultPath: fileName,
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
        content: backupData,
      });
      if (res && res.success) {
        return;
      }
      if (res && res.cancelled) {
        return;
      }
      console.warn('Native JSON backup save failed, falling back to browser download:', res?.error);
    }

    // Web Fallback
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    activeProfileCount,
    globalCurrency,
    goldRateTOMAN,
    appVersion,
    language,
    closeToTray,
    minimizeToTray,
    autoBackupEnabled,
    autoBackupPath,
    autoBackupFrequency,
    autoBackupRetention,
  ]);

  // Import JSON Restore
  const handleImportJson = async (fileOrRaw) => {
    try {
      let json = null;

      if (isTauri() && !fileOrRaw) {
        const res = await openFileNative({
          filters: [{ name: 'JSON Backup', extensions: ['json'] }],
        });
        if (!res || res.cancelled) return;
        if (!res.success || !res.content) {
          return;
        }
        try {
          json = JSON.parse(res.content);
        } catch (e) {
          return;
        }
      } else if (fileOrRaw instanceof File) {
        const text = await fileOrRaw.text();
        json = JSON.parse(text);
      } else if (typeof fileOrRaw === 'string') {
        json = JSON.parse(fileOrRaw);
      } else if (typeof fileOrRaw === 'object' && fileOrRaw !== null) {
        json = fileOrRaw;
      }

      if (!json) return;

      let importedList = [];
      if (Array.isArray(json)) {
        importedList = json;
      } else if (json.entries && Array.isArray(json.entries)) {
        importedList = json.entries;
        if (json.goldRateTOMAN) handleGoldRateTOMANChange(json.goldRateTOMAN);
        if (json.currency) handleCurrencyChange(json.currency);
        if (json.preferences && typeof json.preferences === 'object') {
          const pref = json.preferences;
          if (Array.isArray(pref.savedSources) && pref.savedSources.length > 0) {
            await trackerDB.setSetting('checkpoint_user_saved_sources_v2', pref.savedSources);
            try {
              trackerDB.setSetting('checkpoint_user_saved_sources_v2', pref.savedSources).catch(() => {});
            } catch (e) {}
          }
          if (Array.isArray(pref.savedTeammates) && pref.savedTeammates.length > 0) {
            await trackerDB.setSetting('checkpoint_saved_teammates_v1', pref.savedTeammates);
            try {
              trackerDB.setSetting('checkpoint_saved_teammates_v1', pref.savedTeammates).catch(() => {});
            } catch (e) {}
          }
        }

        // Restore and intelligently merge custom categories if present in backup
        const rawCategories = json.categories || json.preferences?.categories;
        if (Array.isArray(rawCategories) && rawCategories.length > 0) {
          try {
            await importCategories(rawCategories);
          } catch (e) {
            console.warn('Failed to merge categories from backup:', e);
          }
        }
      } else {
        return;
      }

      await trackerDB.bulkImport(importedList);
      await loadData();
      await refreshCategories();
    } catch (err) {
      console.error('Failed to import JSON backup:', err);
    }
  };


  const lastClosedContextTargetRef = useRef(null);

  // Context Menu Handlers
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState((prev) => {
      if (prev.isOpen) {
        lastClosedContextTargetRef.current = {
          id: prev.targetEntry?.id,
          time: Date.now(),
        };
      }
      return { ...prev, isOpen: false, targetEntry: null, rect: null };
    });
  }, []);

  const handleOpenEntryContextMenu = useCallback((entry, position) => {
    // Prevent immediate re-opening if clicking the same trigger button that just closed it
    if (
      lastClosedContextTargetRef.current &&
      lastClosedContextTargetRef.current.id === entry.id &&
      Date.now() - lastClosedContextTargetRef.current.time < 250
    ) {
      lastClosedContextTargetRef.current = null;
      return;
    }

    setContextMenuState({
      isOpen: true,
      x: position.x,
      y: position.y,
      rect: position.rect || null,
      targetEntry: entry,
    });
  }, []);

  const handleContextAddWork = useCallback(() => {
    if (activeTab !== 'ledger') {
      setActiveTab('ledger');
    }
    handleOpenWorkModal();
  }, [activeTab]);

  const handleContextToggleSelectMode = useCallback(() => {
    if (activeTab !== 'ledger') {
      setActiveTab('ledger');
    }
    setIsSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedEntryIds(new Set());
      }
      return next;
    });
  }, [activeTab]);

  const handleContextToggleCurrency = useCallback(() => {
    handleCurrencyChange(globalCurrency === 'TOMAN' ? 'GOLD' : 'TOMAN');
  }, [globalCurrency, handleCurrencyChange]);

  const handleContextExport = useCallback(() => {
    setSettingsInitialScrollSection('backup');
    setIsSettingsOpen(true);
  }, []);

  const handleContextReload = useCallback(() => {
    window.location.reload();
  }, []);

  const handleContextShortcuts = useCallback(() => {
    setIsShortcutsOpen(true);
  }, []);

  const handleContextCopyDiscord = useCallback(
    async (entry, receiptMode = null) => {
      if (!entry) return;
      const text = generateDiscordReceiptText(entry, {
        language,
        globalCurrency,
        activeProfileId,
        receiptMode,
      });
      await copyTextNative(text);
    },
    [language, globalCurrency, activeProfileId]
  );

  const handleContextBulkMarkPaid = useCallback(async () => {
    if (selectedEntryIds.size === 0) return;
    await handleBulkUpdateStatus(Array.from(selectedEntryIds), 'Paid');
    setSelectedEntryIds(new Set());
    setIsSelectMode(false);
  }, [selectedEntryIds, handleBulkUpdateStatus]);

  const handleContextBulkExportCsv = useCallback(async () => {
    if (selectedEntryIds.size === 0) return;
    await handleBulkExportCsv(Array.from(selectedEntryIds));
  }, [selectedEntryIds, handleBulkExportCsv]);

  const handleContextBulkDelete = useCallback(async () => {
    if (selectedEntryIds.size === 0) return;
    await handleBulkDelete(Array.from(selectedEntryIds));
    setSelectedEntryIds(new Set());
    setIsSelectMode(false);
  }, [selectedEntryIds, handleBulkDelete]);

  // Global Context Menu Listener (with editable input bypass)
  useEffect(() => {
    const handleContextMenu = (e) => {
      const target = e.target;
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input, textarea, [contenteditable="true"]');

      if (isEditable) {
        // Allow native browser cut/copy/paste inside inputs
        return;
      }

      e.preventDefault();

      // Check if user right-clicked on an individual job card
      const cardEl = target.closest('[data-entry-id]');
      let foundEntry = null;
      if (cardEl) {
        const entryId = cardEl.getAttribute('data-entry-id');
        foundEntry = entryId ? { id: entryId } : null;
        if (entryId) {
          // Rows only carry list fields; the menu gets the full record a moment later
          trackerDB.getEntry(entryId).then((full) => {
            if (!full) return;
            setContextMenuState((prev) =>
              prev.isOpen && prev.targetEntry?.id === full.id ? { ...prev, targetEntry: full } : prev
            );
          }).catch(() => {});
        }
      }

      setContextMenuState({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        targetEntry: foundEntry,
      });
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Keyboard Shortcuts Listener
  const appModalsRef = useRef({});
  appModalsRef.current = {
    contextMenuState,
    handleCloseContextMenu,
    lightboxData,
    isNotificationCenterOpen,
    isUpdateModalOpen,
    exportConfirm,
    isWorkModalOpen,
    isCalculatorOpen,
    isReceiptModalOpen,
    isSettingsOpen,
    isShortcutsOpen,
    handleOpenWorkModal,
    handleTabChange,
    handleSwitchProfileToggle,
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const state = appModalsRef.current;

      // Escape closes context menu, open modals, or lightbox
      if (e.key === 'Escape') {
        if (state.contextMenuState?.isOpen) {
          state.handleCloseContextMenu?.();
          return;
        }
        if (state.lightboxData?.isOpen) {
          setLightboxData({ isOpen: false, imgSrc: '', caption: '' });
          return;
        }
        // Dialogs close themselves on Escape (topmost only, with their unsaved-changes checks).
        // Closing them here as well would bypass those checks.
        if (hasOpenDialog()) return;
        if (state.isCalculatorOpen) {
          setIsCalculatorOpen(false);
          return;
        }
        if (state.isNotificationCenterOpen) {
          setIsNotificationCenterOpen(false);
          return;
        }
        if (state.isUpdateModalOpen) {
          setIsUpdateModalOpen(false);
          return;
        }
        if (state.exportConfirm) {
          setExportConfirm(null);
          return;
        }
        if (state.isWorkModalOpen) {
          setIsWorkModalOpen(false);
          setEditingEntry(null);
          return;
        }
        if (state.isReceiptModalOpen) {
          setIsReceiptModalOpen(false);
          setReceiptEntry(null);
          return;
        }
        if (state.isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
        if (state.isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
      }

      // Ctrl + Shift + P: Quick Profile Toggle (Booster <-> Advertiser)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyP' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        state.handleSwitchProfileToggle?.();
        return;
      }

      // Ctrl + F (Focus Search in Ledger): switch to the ledger; Navbar moves focus to the visible search field
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        state.handleTabChange?.('ledger');
        return;
      }

      const isAnyModalOpen =
        state.contextMenuState?.isOpen ||
        state.isWorkModalOpen ||
        state.isCalculatorOpen ||
        state.isReceiptModalOpen ||
        state.isSettingsOpen ||
        state.isShortcutsOpen ||
        state.isNotificationCenterOpen ||
        state.isUpdateModalOpen ||
        state.lightboxData?.isOpen ||
        Boolean(state.exportConfirm);

      if (isAnyModalOpen) return;

      // Don't trigger standard navigation hotkeys if typing in inputs/textareas
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      // Alt + E (Export CSV)
      if (e.altKey && (e.code === 'KeyE' || e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setExportConfirm('csv');
        return;
      }

      // Alt + B (Backup JSON)
      if (e.altKey && (e.code === 'KeyB' || e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setExportConfirm('json');
        return;
      }

      // '?' Hotkey opens Shortcuts dialog (Must check BEFORE '/' since '?' is Shift + '/')
      if (e.key === '?' || (e.shiftKey && (e.code === 'Slash' || e.key === '/'))) {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }

      // '/' Hotkey focuses Ledger Search (Only when no modifiers are active)
      if ((e.code === 'Slash' || e.key === '/') && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        state.handleTabChange?.('ledger');
        return;
      }

      if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        if (activeProfileId === 'advertiser') {
          setIsCalculatorOpen((prev) => !prev);
        }
      } else if (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        state.handleOpenWorkModal?.();
      } else if (e.code === 'Digit1' || e.key === '1') {
        e.preventDefault();
        state.handleTabChange?.('ledger');
      } else if (e.code === 'Digit2' || e.key === '2') {
        e.preventDefault();
        state.handleTabChange?.('analytics');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProfileId]);

  return (
    <div className="w-full h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col selection:bg-zinc-800 overflow-hidden border border-zinc-200/80 dark:border-zinc-800/80">
      {/* 1. Desktop Unified Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        globalCurrency={globalCurrency}
        onCurrencyChange={handleCurrencyChange}
        goldRateTOMAN={goldRateTOMAN}
        onGoldRateTOMANChange={handleGoldRateTOMANChange}
        usdRateTOMAN={usdRateTOMAN}
        eurRateUSD={eurRateUSD}
        onSaveRates={handleSaveRates}
        isCalculatorOpen={isCalculatorOpen}
        onToggleCalculator={() => setIsCalculatorOpen((prev) => !prev)}
        onCloseCalculator={() => setIsCalculatorOpen(false)}
        onTransferFromCalculator={handleTransferFromCalculator}
        closeToTray={closeToTray}
        minimizeToTray={minimizeToTray}
        onOpenWorkModal={handleOpenWorkModal}
        onOpenSettings={() => setIsSettingsOpen(true)}
        entriesCount={activeProfileCount}
        appVersion={appVersion}
        updateInfo={updateInfo}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationCenterOpen(true)}
        activeProfileId={activeProfileId}
        onProfileChange={handleProfileChange}
        boosterEntriesCount={profileCounts.booster || (activeProfileId === 'booster' ? activeProfileCount : 0)}
        advertiserEntriesCount={profileCounts.advertiser || (activeProfileId === 'advertiser' ? activeProfileCount : 0)}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        selectedCount={selectedEntryIds.size}
        selectedSum={selectedSum}
        onBatchStatusChange={handleBatchStatusChange}
        onBatchDelete={handleBatchDeleteFromNav}
        onCopyDiscordBatch={handleBatchCopyDiscord}
        isDiscordBatchCopied={isDiscordBatchCopied}
        onClearSelection={handleClearSelection}
      />

      {/* 2. Mobile Top Header (Only on Web viewports) */}
      {!isDesktop && (
        <MobileHeader
          globalCurrency={globalCurrency}
          appVersion={appVersion}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenWorkModal={handleOpenWorkModal}
          onOpenCalculator={() => setIsCalculatorOpen((prev) => !prev)}
          onOpenNotifications={() => setIsNotificationCenterOpen(true)}
          unreadNotificationsCount={unreadNotificationsCount}
          activeProfileId={activeProfileId}
          onProfileChange={handleProfileChange}
          boosterEntriesCount={profileCounts.booster || (activeProfileId === 'booster' ? activeProfileCount : 0)}
          advertiserEntriesCount={profileCounts.advertiser || (activeProfileId === 'advertiser' ? activeProfileCount : 0)}
        />
      )}

      {/* 3. Main Centered Mini-App Workspace */}
      <main className="flex-1 min-h-0 min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 lg:p-8 relative bg-zinc-50 dark:bg-zinc-950 gpu-scroll">
        {/* Centered Tablet-Width Mini-App Frame */}
        <div className="max-w-4xl mx-auto w-full">
          {isLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${activeProfileId}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1, ease: [0.23, 1, 0.32, 1] }}
              >
                <ErrorBoundary>
                  {activeTab === 'ledger' && (
                    <LedgerView
                      dataVersion={ledgerVersion}
                      categories={categories}
                      globalCurrency={globalCurrency}
                      onCurrencyChange={handleCurrencyChange}
                      goldRateTOMAN={goldRateTOMAN}
                      usdRateTOMAN={usdRateTOMAN}
                      eurRateUSD={eurRateUSD}
                      onSaveRates={handleSaveRates}
                      onOpenWorkModal={handleOpenWorkModal}
                      onOpenReceipt={handleOpenReceipt}
                      onOpenLightbox={handleOpenLightbox}
                      onFlipStatus={handleFlipStatus}
                      onDuplicateEntry={handleDuplicateEntry}
                      onDeleteEntry={handleDeleteEntry}
                      onBulkDelete={handleBulkDelete}
                      onBulkUpdateStatus={handleBulkUpdateStatus}
                      onBulkExportCsv={handleBulkExportCsv}
                      externalTeammateFilter={externalTeammateFilter}
                      onClearExternalTeammateFilter={handleClearExternalTeammateFilter}
                      externalSourceFilter={externalSourceFilter}
                      onClearExternalSourceFilter={handleClearExternalSourceFilter}
                      isSelectMode={isSelectMode}
                      onToggleSelectMode={setIsSelectMode}
                      selectedEntryIds={selectedEntryIds}
                      onSelectionChange={setSelectedEntryIds}
                      contextMenuTargetId={contextMenuState.isOpen ? contextMenuState.targetEntry?.id : null}
                      confirmDeleteEntryId={confirmDeleteEntryId}
                      onConfirmDeleteChange={setConfirmDeleteEntryId}
                      onOpenEntryContextMenu={handleOpenEntryContextMenu}
                      activeProfileId={activeProfileId}
                      onUpdateSourcePaid={handleUpdateSourcePaid}
                      onUpdateBoosterPaid={handleUpdateBoosterPaid}
                      ledgerDateFormat={ledgerDateFormat}
                      searchQuery={deferredSearchQuery}
                      onSearchQueryChange={setSearchQuery}
                      statusFilter={statusFilter}
                      onStatusFilterChange={setStatusFilter}
                    />
                  )}

                  {activeTab === 'analytics' && (
                    <Suspense fallback={null}>
                      <AnalyticsView
                        entries={analyticsEntries}
                        globalCurrency={globalCurrency}
                        goldRateTOMAN={goldRateTOMAN}
                        usdRateTOMAN={usdRateTOMAN}
                        eurRateUSD={eurRateUSD}
                        activeProfileId={activeProfileId}
                      />
                    </Suspense>
                  )}
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* 4. Mobile Bottom Navigation Bar (Only on Web viewports) */}
      {!isDesktop && (
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenWorkModal={() => handleOpenWorkModal()}
          onOpenCalculator={() => setIsCalculatorOpen((prev) => !prev)}
          activeProfileId={activeProfileId}
        />
      )}

      {/* Root Order Calculator Sliding Drawer */}
      <OrderCalculatorPopover
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        rates={{
          goldRateTOMAN,
          usdRateTOMAN,
          eurRateUSD,
        }}
        onSaveRates={handleSaveRates}
        onTransferToWorkModal={handleTransferFromCalculator}
      />

      {/* Modals & Dialogs */}
      <WorkModal
        isOpen={isWorkModalOpen}
        onClose={() => {
          setIsWorkModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
        editingEntry={editingEntry}
        globalCurrency={globalCurrency}
        goldRateTOMAN={goldRateTOMAN}
        onOpenLightbox={handleOpenLightbox}
        categories={categories}
        latestEntryDefaults={latestEntryDefaults}
        onRefreshCategories={refreshCategories}
        activeProfileId={activeProfileId}
        usdRateTOMAN={usdRateTOMAN}
        eurRateUSD={eurRateUSD}
        onSaveRates={handleSaveRates}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setReceiptEntry(null);
        }}
        entry={receiptEntry}
        globalCurrency={globalCurrency}
        onOpenLightbox={handleOpenLightbox}
        activeProfileId={activeProfileId}
        onFilterTeammate={(name) => {
          setIsReceiptModalOpen(false);
          setReceiptEntry(null);
          setActiveTab('ledger');
          setExternalTeammateFilter(name);
        }}
        onFilterSource={(source) => {
          setIsReceiptModalOpen(false);
          setReceiptEntry(null);
          setActiveTab('ledger');
          setExternalSourceFilter(source);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setSettingsInitialScrollSection(null);
        }}
        initialScrollSection={settingsInitialScrollSection}
        globalCurrency={globalCurrency}
        onCurrencyChange={handleCurrencyChange}
        categories={categories}
        onRefreshCategories={refreshCategories}
        activeProfileId={activeProfileId}
        onProfileChange={handleProfileChange}
        closeToTray={closeToTray}
        onCloseToTrayChange={handleCloseToTrayChange}
        minimizeToTray={minimizeToTray}
        onMinimizeToTrayChange={handleMinimizeToTrayChange}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onClearAllData={handleClearAllData}
        entriesCount={activeProfileCount}
        appVersion={appVersion}
        updateInfo={updateInfo}
        onCheckUpdates={handleCheckUpdates}
        isCheckingUpdates={isCheckingUpdates}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        autoBackupEnabled={autoBackupEnabled}
        onAutoBackupEnabledChange={handleAutoBackupEnabledChange}
        autoBackupPath={autoBackupPath}
        onAutoBackupPathChange={handleAutoBackupPathChange}
        autoBackupFrequency={autoBackupFrequency}
        onAutoBackupFrequencyChange={handleAutoBackupFrequencyChange}
        autoBackupRetention={autoBackupRetention}
        onAutoBackupRetentionChange={handleAutoBackupRetentionChange}
        onManualAutoBackup={handleManualAutoBackup}
        telemetryEnabled={telemetryEnabled}
        onTelemetryEnabledChange={handleTelemetryEnabledChange}
        theme={currentTheme}
        onThemeChange={handleThemeChange}
        handleThemeChange={handleThemeChange}
        ledgerDateFormat={ledgerDateFormat}
        onLedgerDateFormatChange={handleLedgerDateFormatChange}
      />

      {/* Context Menu (Apple-grade floating spring menu) */}
      <ContextMenu
        isOpen={contextMenuState.isOpen}
        position={{ x: contextMenuState.x, y: contextMenuState.y, rect: contextMenuState.rect }}
        onClose={handleCloseContextMenu}
        targetEntry={contextMenuState.targetEntry}
        selectedCount={selectedEntryIds.size}
        isTargetInSelection={
          contextMenuState.targetEntry ? selectedEntryIds.has(contextMenuState.targetEntry.id) : false
        }
        isSelectMode={isSelectMode}
        globalCurrency={globalCurrency}
        activeProfileId={activeProfileId}
        theme={currentTheme}
        onAddWork={handleContextAddWork}
        onToggleSelectMode={handleContextToggleSelectMode}
        onToggleCurrency={handleContextToggleCurrency}
        onExport={handleContextExport}
        onReload={handleContextReload}
        onOpenShortcuts={handleContextShortcuts}
        onThemeChange={handleThemeChange}
        onLanguageChange={setLanguage}
        onFlipStatus={handleFlipStatus}
        onEditEntry={(entry) => handleOpenWorkModal(entry)}
        onDuplicateEntry={(entry) => handleDuplicateEntry(entry.id)}
        onViewReceipt={(entry) => handleOpenReceipt(entry)}
        onCopyDiscordReceipt={handleContextCopyDiscord}
        onAddScreenshot={(entry) => handleOpenWorkModal(entry)}
        onOpenLink={(entry) => openAppAwareUrl(entry.link)}
        onDeleteEntry={(entry) => {
          if (activeTab !== 'ledger') {
            setActiveTab('ledger');
          }
          setConfirmDeleteEntryId(entry.id);
        }}
        onBulkMarkPaid={handleContextBulkMarkPaid}
        onBulkExportCsv={handleContextBulkExportCsv}
        onDeselectAll={() => {
          setSelectedEntryIds(new Set());
          setIsSelectMode(false);
        }}
        onBulkDelete={handleContextBulkDelete}
      />

      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onDismiss={handleDismissNotification}
        onClearAll={handleClearAllNotifications}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <Lightbox
        isOpen={lightboxData.isOpen}
        onClose={() => setLightboxData({ isOpen: false, imgSrc: '', caption: '' })}
        imgSrc={lightboxData.imgSrc}
        caption={lightboxData.caption}
      />

      {/* Compact Export Confirmation Dialog (Alt + E / Alt + B) */}
      <Dialog
        open={Boolean(exportConfirm)}
        onClose={() => setExportConfirm(null)}
        maxWidth="max-w-sm"
      >
        <DialogHeader onClose={() => setExportConfirm(null)}>
          <div className="flex items-center gap-2">
            <DialogTitle>
              {exportConfirm === 'csv' ? 'Export CSV Spreadsheet' : 'Download JSON Backup'}
            </DialogTitle>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
              {exportConfirm === 'csv' ? 'Alt + E' : 'Alt + B'}
            </span>
          </div>
        </DialogHeader>

        <DialogContent className="space-y-3 py-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
              {exportConfirm === 'csv' ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
              )}
            </div>
            <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              <p className="text-zinc-900 dark:text-zinc-200 font-medium">
                {exportConfirm === 'csv'
                  ? `Export ${activeProfileCount} records to a formatted .csv spreadsheet?`
                  : `Save a complete backup with ${activeProfileCount} records and proofs?`}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {exportConfirm === 'csv'
                  ? 'Compatible with Excel, Google Sheets, and financial apps.'
                  : 'Can be restored anytime in Settings to restore all data.'}
              </p>
            </div>
          </div>
        </DialogContent>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExportConfirm(null)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (exportConfirm === 'csv') handleExportCsv();
              if (exportConfirm === 'json') handleExportJson();
              setExportConfirm(null);
            }}
            className="gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Confirm & Save</span>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Apple-style First Launch Role Onboarding Dialog */}
      <ProfileOnboardingModal
        isOpen={isProfileOnboardingOpen}
        onSelectRole={(chosenRole) => {
          setProfileOnboardingCompleted(true);
          setIsProfileOnboardingOpen(false);
          handleProfileChange(chosenRole);
        }}
        onComplete={(chosenRole) => {
          setProfileOnboardingCompleted(true);
          setIsProfileOnboardingOpen(false);
          handleProfileChange(chosenRole);
        }}
      />

      {/* Transient Floating Undo Delete Safety Net Toast */}
      <UndoToast
        isOpen={undoDeleteState.isOpen}
        count={undoDeleteState.count}
        onUndo={handleUndoDelete}
        onDismiss={() => setUndoDeleteState({ isOpen: false, items: [], count: 0 })}
      />
    </div>
  );
}
