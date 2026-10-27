import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { trackerDB } from './lib/db';
import { Navbar } from './components/Navbar';
import { ContextMenu } from './components/ui/ContextMenu';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, hasOpenDialog } from './components/ui/Dialog';
import { Button } from './components/ui/Button';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { WelcomeFlow } from './components/WelcomeFlow';
import { WELCOME_RELEASE, WELCOME_SEEN_KEY, crossesNotificationReset, welcomeMode } from './lib/welcome';
import {
  getActiveProfileId,
  setActiveProfileId,
  isProfileOnboardingCompleted,
  setProfileOnboardingCompleted,
} from './lib/profiles';
import { motion, AnimatePresence } from 'motion/react';
import { SCREEN } from './lib/motion';
import { useTheme } from 'next-themes';
import { FileSpreadsheet, Download } from 'lucide-react';
import { checkForUpdate, getAppVersion, getStaticAppVersion } from './lib/updater';
import { loadCategories, importCategories } from './lib/categories';
import { fetchAnnouncements } from './lib/announcements';
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
  enforceMinWindowSize,
  hideWindow,
  showWindow,
  sendTrayNotification,
  listenToTrayEvents,
  sendDesktopNotification,
  pruneOldBackupsNative,
  generateLedgerFingerprint,
  closeWindow,
} from './lib/desktop';
import { isAutoBackupDue } from './lib/autoBackup';
import {
  initTelemetry,
  flushDailyTelemetry,
  setTelemetryEnabled,
} from './lib/telemetry';

import { useLanguage } from './lib/i18n';
import { LedgerProvider } from './components/ledger/LedgerProvider';
import { ledgerFingerprint, buildOrdersCsv } from './lib/ledger/backup';

// The ledger screens (both profiles) are code-split so the frame paints before they load
const LedgerShell = lazy(() => import('./components/ledger/LedgerShell').then((m) => ({ default: m.LedgerShell })));

// Screens of both profiles (v2 ledger): home, orders / jobs, people / clients, money, reports
const LEDGER_TABS = ['cockpit', 'orders', 'people', 'money', 'analytics'];
// What every total can be shown in (gold is per game, so it is not one of them)
const DISPLAY_CURRENCIES = ['TOMAN', 'USD', 'EUR'];
// "Open on" in Settings: where the profile left off, or always one screen
const START_TAB_CHOICES = ['last', ...LEDGER_TABS];
const openingTab = (start, lastTab) => (start && start !== 'last' ? start : LEDGER_TABS.includes(lastTab) ? lastTab : null);

// Focus the search box of the screen that is showing; when it has none, open the Orders / Jobs list and focus its box.
function focusLedgerSearch(openOrdersTab) {
  const focus = () => {
    const el = document.querySelector('[data-ledger-search]');
    if (!el) return false;
    el.focus();
    el.select?.();
    return true;
  };
  if (focus()) return;
  openOrdersTab?.();
  // the new screen mounts after its transition
  setTimeout(focus, 260);
}

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

const OrderCalculatorPopover = lazyModal(() =>
  import('./components/OrderCalculatorPopover').then((m) => ({ default: m.OrderCalculatorPopover }))
);
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

const saveCsvFile = async (fileName, csvContent) => {
  if (isTauri()) {
    const res = await saveFileNative({
      defaultPath: fileName,
      filters: [{ name: 'CSV Spreadsheet', extensions: ['csv'] }],
      content: csvContent,
    });
    if (res && res.success) return true;
    if (res && res.cancelled) return false;
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
  return true;
};

export default function App() {
  const { language, setLanguage, t, isRtl } = useLanguage();
  const isDesktop = isTauri();
  const [appVersion, setAppVersion] = useState(() => getStaticAppVersion());
  // The ledger view loads its own rows. App only tracks a version number that tells it to refresh.
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Dual-Profile Architecture ('booster' | 'advertiser')
  const [activeProfileId, setActiveProfileIdState] = useState(() => getActiveProfileId());
  // The welcome screen: 'new' on first run, 'returning' once for existing users on the release that brings it
  const [welcome, setWelcome] = useState(() => (isProfileOnboardingCompleted() ? null : 'new'));
  const [profileCounts, setProfileCounts] = useState({ booster: 0, advertiser: 0 });
  const activeProfileCount = profileCounts[activeProfileId] || 0;
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

  // True while a scheduled backup is writing, so overlapping checks cannot write the same backup twice
  const autoBackupRunningRef = useRef(false);

  // Anonymous Usage Telemetry (Enabled by default)
  const [telemetryEnabled, setTelemetryEnabledState] = useState(() => {
    return parseBooleanSetting(null, true);
  });

  // Active view: cockpit (home) | orders (Orders / Jobs) | people (Boosters / Clients) | money | analytics (Reports)
  const [activeTab, setActiveTab] = useState('cockpit');
  // A saved tab from an older version (the old 'ledger' tab) falls back to the home screen
  const visibleTab = LEDGER_TABS.includes(activeTab) ? activeTab : 'cockpit';
  // Which screen each profile opens on: 'last' (where you left off) or one tab. Kept per profile, because the two
  // profiles have different screens and the last tab of one means nothing in the other.
  const [startTabs, setStartTabs] = useState({ advertiser: 'last', booster: 'last' });
  const startTabsRef = useRef(startTabs);
  startTabsRef.current = startTabs;

  // Advertiser: "New order" requests from the top bar, the N shortcut and the calculator
  const [newOrderSignal, setNewOrderSignal] = useState(0);
  const [ledgerQuote, setLedgerQuote] = useState(null);

  // Interface Theme ('dark' | 'light') via next-themes
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || 'dark';

  // User Currency Preferences (TOMAN | USD | EUR). Gold is not a display currency: each game's gold is its own
  // currency with its own rate, so totals are shown in Toman, USD or EUR and a saved "Gold" falls back to Toman.
  const [globalCurrency, setGlobalCurrency] = useState(() => {
    const saved = null;
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
  const ledgerRates = useMemo(() => ({ goldRateTOMAN, usdRateTOMAN, eurRateUSD }), [goldRateTOMAN, usdRateTOMAN, eurRateUSD]);

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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialScrollSection, setSettingsInitialScrollSection] = useState(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [exportConfirm, setExportConfirm] = useState(null); // null | 'csv' | 'json'

  // Context Menu State
  const [contextMenuState, setContextMenuState] = useState({ isOpen: false, x: 0, y: 0, rect: null });

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
    try {
      // Hydrate runtime app version asynchronously and check for upgrade
      getAppVersion().then(async (v) => {
        if (v) {
          setAppVersion(v);
          try {
            const lastKnown = await trackerDB.getSetting('checkpoint_last_known_version', null);
            // existing users see the new welcome once (it carries the patch notes, so the drawer stays closed then)
            const mode = welcomeMode({ onboardingCompleted: isProfileOnboardingCompleted(), seenVersion: await trackerDB.getSetting(WELCOME_SEEN_KEY, null), appVersion: v });
            if (mode === 'returning') setWelcome('returning');
            if (lastKnown && compareSemver(v, lastKnown) > 0) {
              // App was just upgraded! Post rich What's New notification. On the release that resets the
              // notification center, everything stored before is dropped and only the new patch notes remain.
              const stored = crossesNotificationReset(lastKnown, v) ? [] : await getStoredNotifications();
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

              // Spotlight What's New by opening Notification Center drawer on first launch after upgrade,
              // unless the welcome screen is about to show the same notes
              if (mode !== 'returning') setIsNotificationCenterOpen(true);
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
        savedProfileTab,
        savedStartAdvertiser,
        savedStartBooster,
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
        trackerDB.getSetting(`checkpoint_tab_${getActiveProfileId()}`, null),
        trackerDB.getSetting('checkpoint_start_tab_advertiser', null),
        trackerDB.getSetting('checkpoint_start_tab_booster', null),
      ]);
      if (savedCur && DISPLAY_CURRENCIES.includes(savedCur)) {
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
      const starts = {
        advertiser: START_TAB_CHOICES.includes(savedStartAdvertiser) ? savedStartAdvertiser : 'last',
        booster: START_TAB_CHOICES.includes(savedStartBooster) ? savedStartBooster : 'last',
      };
      setStartTabs(starts);
      // the old app-wide last tab is the fallback until this profile has its own
      const lastTab = LEDGER_TABS.includes(savedProfileTab) ? savedProfileTab : savedTab;
      const opening = openingTab(starts[getActiveProfileId()], lastTab);
      if (opening) setActiveTab(opening);
      trackerDB.getProfileCounts?.().then((counts) => {
        if (counts) setProfileCounts(counts);
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to load data from storage engine:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Profile Switching & Background Synchronization
  const handleProfileChange = useCallback(async (newProfileId) => {
    if (!newProfileId || newProfileId === activeProfileId) return;

    const seq = ++profileSwitchSeqRef.current;
    isSwitchingProfileRef.current = true;

    setActiveProfileId(newProfileId);
    setActiveProfileIdState(newProfileId);

    try {
      await trackerDB.switchProfile(newProfileId);
      if (profileSwitchSeqRef.current !== seq) return;

      setLedgerVersion((v) => v + 1);
      refreshCategories().catch(() => {});

      // each profile opens on its own screen: its chosen start tab, or the one it was left on
      const lastTab = await trackerDB.getSetting(`checkpoint_tab_${newProfileId}`, null);
      if (profileSwitchSeqRef.current !== seq) return;
      setActiveTab(openingTab(startTabsRef.current[newProfileId], lastTab) || 'cockpit');

      // Restore profile-specific preferred currency if configured
      const savedProfileCurrency = await trackerDB.getSetting(`checkpoint_currency_${newProfileId}`, null);
      if (savedProfileCurrency && DISPLAY_CURRENCIES.includes(savedProfileCurrency)) {
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
        // read the list again after the wait: something else (the one-time reset on an upgrade, a dismissal) may
        // have saved a newer one meanwhile, and merging into the old copy would bring back what it removed
        currentMerged = mergeNotificationsIntoHistory(await getStoredNotifications(), {
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
          currentMerged = mergeNotificationsIntoHistory(await getStoredNotifications(), {
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

  // Runs a scheduled folder backup when one is due. Backup Now passes force: it always writes and rethrows
  // failures so the button can report them. Every real attempt is recorded in 'checkpoint_auto_backup_status'.
  const runScheduledAutoBackup = useCallback(async (opts = {}) => {
    const isManual = opts.force === true;
    if (!isDesktop || !autoBackupEnabled || !autoBackupPath) {
      if (isManual) throw new Error('No backup folder selected');
      return { status: 'skipped' };
    }
    if (autoBackupRunningRef.current && !isManual) return { status: 'busy' };

    autoBackupRunningRef.current = true;
    try {
      const now = Date.now();
      const lastRunStr = await trackerDB.getSetting('checkpoint_last_auto_backup_timestamp', '');
      const lastRun = lastRunStr ? Number(lastRunStr) : 0;

      if (!isManual && !isAutoBackupDue({ frequency: autoBackupFrequency, lastRunMs: lastRun, nowMs: now, source: opts.source })) {
        return { status: 'not_due' };
      }

      const entries = await trackerDB.getAllEntries();
      // The v2 ledger has to count as "changed" too, or orders made on the new screens would never be backed up
      let ledgerExport = null;
      try {
        ledgerExport = await (await trackerDB.getLedgerStore()).exportAll();
      } catch (e) {
        console.warn('[AutoBackup] Ledger data unavailable, backing up legacy entries only:', e);
      }
      const currentFingerprint = `${generateLedgerFingerprint(entries, globalCurrency, goldRateTOMAN)}|${ledgerFingerprint(ledgerExport)}`;
      const lastFingerprint = await trackerDB.getSetting('checkpoint_last_auto_backup_hash', '');

      // Smart Change Detection: Skip export if no financial/entry data changed and not a manual trigger
      if (!isManual && currentFingerprint === lastFingerprint && lastRun > 0) {
        await trackerDB.setSetting('checkpoint_last_auto_backup_timestamp', String(now));
        return { status: 'unchanged' };
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
        profile: activeProfileId,
        ledger: ledgerExport,
      };

      const todayStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `checkpoint_autobackup_${todayStr}.json`;
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const sep = autoBackupPath.includes('\\') ? '\\' : '/';
      const fullPath = `${autoBackupPath.replace(/[/\\]+$/, '')}${sep}${fileName}`;

      await writeTextFile(fullPath, JSON.stringify(backupData, null, 2));
      await trackerDB.setSetting('checkpoint_last_auto_backup_timestamp', String(now));
      await trackerDB.setSetting('checkpoint_last_auto_backup_hash', currentFingerprint);
      await trackerDB.setSetting('checkpoint_auto_backup_status', { ok: true, at: now, fileName });

      // Auto-Pruning: Enforce retention limit (e.g. keep last N backups)
      if (autoBackupRetention > 0) {
        await pruneOldBackupsNative({
          backupDir: autoBackupPath,
          maxFiles: autoBackupRetention,
        });
      }
      return { status: 'written', fileName };
    } catch (err) {
      console.warn('[AutoBackup] Backup execution failed:', err);
      const message = String(err?.message || err);
      await trackerDB.setSetting('checkpoint_auto_backup_status', { ok: false, at: Date.now(), error: message });
      if (isManual) throw err;
      sendDesktopNotification({ title: 'CHECKPOINT auto-backup failed', body: message });
      return { status: 'error', error: message };
    } finally {
      autoBackupRunningRef.current = false;
    }
  }, [isDesktop, autoBackupEnabled, autoBackupPath, autoBackupFrequency, autoBackupRetention, appVersion, globalCurrency, goldRateTOMAN, activeProfileId]);

  const syncFeedsRef = useRef(syncFeeds);
  useEffect(() => {
    syncFeedsRef.current = syncFeeds;
  }, [syncFeeds]);

  const runScheduledAutoBackupRef = useRef(runScheduledAutoBackup);
  useEffect(() => {
    runScheduledAutoBackupRef.current = runScheduledAutoBackup;
  }, [runScheduledAutoBackup]);

  // Backup check on launch and whenever the auto-backup settings change. Settings load asynchronously
  // after the first render, so this runs off the hydrated values rather than a fixed startup timer.
  useEffect(() => {
    if (!isDesktop || !autoBackupEnabled || !autoBackupPath) return undefined;
    const timer = setTimeout(() => {
      runScheduledAutoBackupRef.current?.({ source: 'change' });
    }, 700);
    return () => clearTimeout(timer);
  }, [isDesktop, autoBackupEnabled, autoBackupPath, autoBackupFrequency]);

  // Initial application bootstrap and background synchronization timers (runs once on mount)
  useEffect(() => {
    loadData();
    showWindow();
    enforceMinWindowSize(960, 640);

    // Initial background feed sync & telemetry shortly after render
    const timer = setTimeout(() => {
      syncFeedsRef.current?.({ silent: true });
      initTelemetry();
    }, 700);

    // Periodic polling every 4 hours for long-running / tray sessions
    const intervalTimer = setInterval(() => {
      syncFeedsRef.current?.({ silent: true });
      runScheduledAutoBackupRef.current?.({ source: 'interval' });
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

  // Desktop Window & System Tray Event Listeners
  useEffect(() => {
    if (!isDesktop) return;

    let unlistenTray = null;
    let unlistenClose = null;
    let unlistenResize = null;

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

        // Minimize to Tray: a minimized window is hidden so it lives only in the tray (restored via tray click)
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        unlistenResize = await getCurrentWindow().onResized(async () => {
          if (!minimizeToTrayRef.current) return;
          try {
            if (await getCurrentWindow().isMinimized()) {
              await hideWindow();
            }
          } catch (e) {}
        });
      } catch (e) {
        console.warn('Failed to setup desktop listeners:', e);
      }
    };

    setupDesktopListeners();

    return () => {
      if (unlistenTray) unlistenTray();
      if (unlistenClose) unlistenClose();
      if (unlistenResize) unlistenResize();
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
  // Returns the check result so the settings panel can report "up to date" or a failed check
  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    let res;
    try {
      res = await checkForUpdate({ timeoutMs: 7000 });
    } catch (err) {
      res = { available: false, error: err?.message || String(err) };
    }
    setIsCheckingUpdates(false);
    if (res && res.available) {
      setUpdateInfo(res);
      const stored = await getStoredNotifications();
      const updated = mergeNotificationsIntoHistory(stored, { updateInfo: res });
      setNotifications(updated);
      await saveStoredNotifications(updated);
      setIsUpdateModalOpen(true);
    }
    return res;
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

  // Tab Switcher
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    trackerDB.setSetting('checkpoint_tab', tab).catch(() => {});
    if (activeProfileId) trackerDB.setSetting(`checkpoint_tab_${activeProfileId}`, tab).catch(() => {});
  };

  const handleStartTabChange = useCallback((profileId, tab) => {
    const next = START_TAB_CHOICES.includes(tab) ? tab : 'last';
    setStartTabs((m) => ({ ...m, [profileId]: next }));
    trackerDB.setSetting(`checkpoint_start_tab_${profileId}`, next).catch(() => {});
  }, []);

  // Currency Handlers
  const handleCurrencyChange = (newCurr) => {
    const cur = DISPLAY_CURRENCIES.includes(newCurr) ? newCurr : 'TOMAN';
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

  // Purge / Clear All Data
  // Returns false when the wipe failed, so the settings panel can say so
  const handleClearAllData = async (purgeSnapshots = false) => {
    let ok = false;
    try {
      ok = (await trackerDB.clearAll(purgeSnapshots)) !== false;
    } catch (err) {
      console.error('Clear all data failed:', err);
    }
    await loadData();
    return ok;
  };

  // A calculator quote becomes the starting point of a new order (Advertiser) or job (Booster)
  const handleTransferFromCalculator = useCallback((calcData) => {
    setLedgerQuote(calcData || null);
    setNewOrderSignal((n) => n + 1);
    setIsCalculatorOpen(false);
  }, []);

  // Opens the new order / job form
  const handleOpenWorkModal = () => {
    setLedgerQuote(null);
    setNewOrderSignal((n) => n + 1);
  };

  // Export CSV
  const handleExportCsv = useCallback(async () => {
    // One row per order or job from the ledger, with price, fee, team, margin and paid state
    const data = await (await trackerDB.getLedgerStore()).loadAll();
    if (data.orders.length === 0) return false;
    const fileName = `checkpoint_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    return saveCsvFile(fileName, String.fromCharCode(0xfeff) + buildOrdersCsv(data));
  }, []);

  // Export JSON Backup
  const handleExportJson = useCallback(async () => {
    // v2 orders, people and payments ride along in every backup
    let ledger = null;
    try {
      ledger = await (await trackerDB.getLedgerStore()).exportAll();
    } catch (e) {
      console.warn('Ledger data could not be read for the backup:', e);
    }
    const ledgerHasData = Boolean(ledger && (ledger.orders.length > 0 || ledger.payments.length > 0));
    if (activeProfileCount === 0 && !ledgerHasData) {
      return false;
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
      profile: activeProfileId,
      ledger,
    };

    const fileName = `checkpoint_backup_${new Date().toISOString().slice(0, 10)}.json`;

    if (isTauri()) {
      const res = await saveFileNative({
        defaultPath: fileName,
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
        content: backupData,
      });
      if (res && res.success) {
        return true;
      }
      if (res && res.cancelled) {
        return false;
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
    return true;
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
    activeProfileId,
  ]);

  // Import JSON Restore. Returns { status: 'imported', count } | { status: 'cancelled' } | { status: 'invalid' | 'error' }
  // so the settings panel can confirm the restore or explain why it did not happen.
  const handleImportJson = async (fileOrRaw) => {
    try {
      let json = null;

      if (isTauri() && !fileOrRaw) {
        const res = await openFileNative({
          filters: [{ name: 'JSON Backup', extensions: ['json'] }],
        });
        if (!res || res.cancelled) return { status: 'cancelled' };
        if (!res.success || !res.content) {
          return { status: 'error' };
        }
        try {
          json = JSON.parse(res.content);
        } catch (e) {
          return { status: 'invalid' };
        }
      } else if (fileOrRaw instanceof File) {
        const text = await fileOrRaw.text();
        json = JSON.parse(text);
      } else if (typeof fileOrRaw === 'string') {
        json = JSON.parse(fileOrRaw);
      } else if (typeof fileOrRaw === 'object' && fileOrRaw !== null) {
        json = fileOrRaw;
      }

      if (!json) return { status: 'invalid' };

      let importedList = [];
      // A v2 backup may hold orders and payments only (no legacy entries at all)
      // (a ledger exported from the other profile is not merged into this one)
      const importedLedger = !Array.isArray(json) && json.ledger && typeof json.ledger === 'object'
        && (!json.profile || json.profile === activeProfileId)
        ? json.ledger
        : null;
      if (Array.isArray(json)) {
        importedList = json;
      } else if ((json.entries && Array.isArray(json.entries)) || importedLedger) {
        importedList = Array.isArray(json.entries) ? json.entries : [];
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
        return { status: 'invalid' };
      }

      // Entries without an id are skipped by bulkImport, so only count the ones that will be written
      const count = importedList.filter((entry) => entry && entry.id).length;
      if (count === 0 && importedList.length > 0) {
        return { status: 'invalid' };
      }

      await trackerDB.bulkImport(importedList);

      // Bring the same data into the v2 ledger. Merging never overwrites what is already there.
      const ledgerStore = await trackerDB.getLedgerStore();
      let ledgerCount = 0;
      if (importedLedger) {
        await ledgerStore.mergeAll(importedLedger);
        ledgerCount = Array.isArray(importedLedger.orders) ? importedLedger.orders.length : 0;
      } else if (count > 0) {
        await ledgerStore.importLegacyEntries(importedList, { profile: activeProfileId });
      }

      await loadData();
      await refreshCategories();
      setLedgerVersion((v) => v + 1);
      return { status: 'imported', count: count || ledgerCount };
    } catch (err) {
      console.error('Failed to import JSON backup:', err);
      return { status: 'error' };
    }
  };


  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState((prev) => ({ ...prev, isOpen: false, rect: null }));
  }, []);

  const handleContextToggleCurrency = useCallback(() => {
    handleCurrencyChange(DISPLAY_CURRENCIES[(DISPLAY_CURRENCIES.indexOf(globalCurrency) + 1) % DISPLAY_CURRENCIES.length]);
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

      setContextMenuState({ isOpen: true, x: e.clientX, y: e.clientY, rect: null });
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Keyboard Shortcuts Listener
  const appModalsRef = useRef({});
  appModalsRef.current = {
    contextMenuState,
    handleCloseContextMenu,
    isNotificationCenterOpen,
    isUpdateModalOpen,
    exportConfirm,
    isCalculatorOpen,
    isSettingsOpen,
    isShortcutsOpen,
    handleOpenWorkModal,
    handleTabChange,
    handleSwitchProfileToggle,
    globalCurrency,
    handleCurrencyChange,
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

      // Ctrl + F (Focus Search): the search box of the screen you are on, else the Orders / Jobs list
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F')) {
        // never yank the user out from under an open dialog and the draft they are typing in it
        if (hasOpenDialog()) return;
        e.preventDefault();
        focusLedgerSearch(() => state.handleTabChange?.('orders'));
        return;
      }

      const isAnyModalOpen =
        state.contextMenuState?.isOpen ||
        state.isCalculatorOpen ||
        state.isSettingsOpen ||
        state.isShortcutsOpen ||
        state.isNotificationCenterOpen ||
        state.isUpdateModalOpen ||
        Boolean(state.exportConfirm) ||
        hasOpenDialog();

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

      // '/' Hotkey focuses the search box (Only when no modifiers are active)
      if ((e.code === 'Slash' || e.key === '/') && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        focusLedgerSearch(() => state.handleTabChange?.('orders'));
        return;
      }

      if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        if (activeProfileId === 'advertiser') {
          setIsCalculatorOpen((prev) => !prev);
        }
      } else if ((e.code === 'KeyT' || e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // T: cycle the main currency every amount is shown in (Toman, USD, EUR), for both profiles
        e.preventDefault();
        const next = DISPLAY_CURRENCIES[(DISPLAY_CURRENCIES.indexOf(state.globalCurrency) + 1) % DISPLAY_CURRENCIES.length];
        state.handleCurrencyChange?.(next);
      } else if (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        state.handleOpenWorkModal?.();
      } else if (/^Digit[1-5]$/.test(e.code || '') || /^[1-5]$/.test(e.key)) {
        const n = Number(e.key) || Number(String(e.code).slice(-1));
        // Advertiser: 1 Overview, 2 Orders, 3 Boosters, 4 Money, 5 Reports. Booster: 1 Overview, 2 Jobs, 3 Clients, 4 Reports.
        const tab = activeProfileId === 'advertiser' ? LEDGER_TABS[n - 1] : ['cockpit', 'orders', 'people', 'analytics'][n - 1];
        if (tab) {
          e.preventDefault();
          state.handleTabChange?.(tab);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProfileId]);

  return (
    <div className="w-full h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col selection:bg-zinc-800 overflow-hidden border border-zinc-200/80 dark:border-zinc-800/80">
      {/* 1. Desktop Unified Top Navigation Bar */}
      <Navbar
        activeTab={visibleTab}
        onTabChange={handleTabChange}
        globalCurrency={globalCurrency}
        onCurrencyChange={handleCurrencyChange}
        goldRateTOMAN={goldRateTOMAN}
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
      />

      {/* 3. Main Centered Mini-App Workspace */}
      <main className="flex-1 min-h-0 min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 lg:p-8 relative bg-zinc-50 dark:bg-zinc-950 gpu-scroll">
        {/* Centered Tablet-Width Mini-App Frame */}
        <div className="max-w-[1080px] mx-auto w-full">
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
            <LedgerProvider
              profileId={activeProfileId}
              dataVersion={ledgerVersion}
              rates={ledgerRates}
              displayCurrency={globalCurrency}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  // Both profiles switch screens inside one mounted shell, so an open dialog and its draft survive any tab change
                  key={activeProfileId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={SCREEN}
                >
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      <LedgerShell
                        activeTab={visibleTab}
                        onTabChange={handleTabChange}
                        onCurrencyChange={handleCurrencyChange}
                        categories={categories}
                        onRefreshCategories={refreshCategories}
                        newOrderSignal={newOrderSignal}
                        quote={ledgerQuote}
                      />
                    </Suspense>
                  </ErrorBoundary>
                </motion.div>
              </AnimatePresence>
            </LedgerProvider>
          )}
        </div>
      </main>

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
        startTabs={startTabs}
        onStartTabChange={handleStartTabChange}
      />

      {/* Context Menu (Apple-grade floating spring menu) */}
      <ContextMenu
        isOpen={contextMenuState.isOpen}
        position={{ x: contextMenuState.x, y: contextMenuState.y, rect: contextMenuState.rect }}
        onClose={handleCloseContextMenu}
        globalCurrency={globalCurrency}
        activeProfileId={activeProfileId}
        theme={currentTheme}
        onAddWork={handleOpenWorkModal}
        onToggleCurrency={handleContextToggleCurrency}
        onExport={handleContextExport}
        onReload={handleContextReload}
        onOpenShortcuts={handleContextShortcuts}
        onThemeChange={handleThemeChange}
        onLanguageChange={setLanguage}
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
        activeProfileId={activeProfileId}
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

      {/* Welcome: first run (role, language, currency) or, once per release that brings it, what is new */}
      <WelcomeFlow
        open={Boolean(welcome)}
        mode={welcome || 'new'}
        currentProfile={activeProfileId || 'booster'}
        currency={globalCurrency}
        onCurrencyChange={handleCurrencyChange}
        onOpenNotes={() => setIsNotificationCenterOpen(true)}
        onDone={({ role }) => {
          const wasNew = welcome === 'new';
          setWelcome(null);
          setProfileOnboardingCompleted(true);
          trackerDB.setSetting(WELCOME_SEEN_KEY, WELCOME_RELEASE).catch(() => {});
          if (wasNew) handleProfileChange(role);
        }}
      />

    </div>
  );
}
