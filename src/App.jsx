import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { trackerDB } from './lib/db';
import { STATUS_CONFIG } from './lib/currencies';
import { toLocalISOString } from './components/ui/DateTimePicker';
import { Navbar } from './components/Navbar';
import { MobileHeader, MobileBottomNav } from './components/MobileNavigation';
import { SplashScreen } from './components/ui/SplashScreen';
import { LedgerView } from './components/views/LedgerView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { WorkModal } from './components/WorkModal';
import { QuickAddModal } from './components/QuickAddModal';
import { ReceiptModal } from './components/ReceiptModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Lightbox } from './components/Lightbox';
import { NotificationCenter } from './components/NotificationCenter';
import { UpdateModal } from './components/UpdateModal';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './components/ui/Dialog';
import { Button } from './components/ui/Button';
import { Toast } from './components/ui/Toast';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { checkForUpdate, getAppVersion } from './lib/updater';
import { fetchAnnouncements, resetAnnouncementState } from './lib/announcements';
import {
  getStoredNotifications,
  mergeNotificationsIntoHistory,
  countUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotificationItem,
  clearAllNotificationHistory,
} from './lib/notifications';
import {
  isTauri,
  saveFileNative,
  openFileNative,
  enforceMinWindowSize,
  hideWindow,
  sendTrayNotification,
  resetTrayNotificationFlag,
  listenToTrayEvents,
} from './lib/desktop';

export default function App() {
  const isDesktop = isTauri();
  const [appVersion, setAppVersion] = useState('');
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Desktop Tray & Window Preferences
  const [closeToTray, setCloseToTray] = useState(() => {
    const saved = localStorage.getItem('checkpoint_close_to_tray');
    if (saved !== null) return saved === 'true';
    return true; // Default ON
  });
  const [minimizeToTray, setMinimizeToTray] = useState(() => {
    const saved = localStorage.getItem('checkpoint_minimize_to_tray');
    if (saved !== null) return saved === 'true';
    return false; // Default OFF
  });

  const closeToTrayRef = useRef(closeToTray);
  useEffect(() => {
    closeToTrayRef.current = closeToTray;
  }, [closeToTray]);

  const minimizeToTrayRef = useRef(minimizeToTray);
  useEffect(() => {
    minimizeToTrayRef.current = minimizeToTray;
  }, [minimizeToTray]);

  // Active View Tab ('ledger' | 'analytics')
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('nodrapay_tab');
    if (saved === 'analytics') return 'analytics';
    return 'ledger';
  });

  // User Currency Preferences (TOMAN | GOLD)
  const [globalCurrency, setGlobalCurrency] = useState(() => {
    const saved = localStorage.getItem('nodrapay_currency');
    if (saved === 'WOW_GOLD') return 'GOLD';
    if (saved === 'GOLD') return 'GOLD';
    return 'TOMAN';
  });

  // Gold Exchange Rate in Toman (default 3,200 Toman per 1,000 Gold)
  const [goldRateTOMAN, setGoldRateTOMAN] = useState(() => {
    const saved = localStorage.getItem('nodrapay_gold_rate_toman');
    if (saved !== null) {
      const parsed = parseFloat(saved);
      return !isNaN(parsed) && parsed > 0 ? parsed : 3200;
    }
    return 3200;
  });

  // Modals State
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptEntry, setReceiptEntry] = useState(null);
  const [externalTeammateFilter, setExternalTeammateFilter] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [exportConfirm, setExportConfirm] = useState(null); // null | 'csv' | 'json'

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

  // Toast Notification
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  const showToast = useCallback((msg, options = {}) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    let toastObj = {};
    if (typeof msg === 'string') {
      let variant = options.variant || 'success';
      if (
        msg.toLowerCase().includes('failed') ||
        msg.toLowerCase().includes('error') ||
        msg.toLowerCase().includes('required')
      ) {
        variant = 'destructive';
      }

      toastObj = {
        id: Date.now(),
        title: options.title || msg,
        description: options.description || null,
        variant,
      };
    } else if (typeof msg === 'object' && msg !== null) {
      toastObj = {
        id: Date.now(),
        title: msg.title || 'Notification',
        description: msg.description || msg.text || null,
        variant: msg.variant || 'success',
      };
    }

    setToast(toastObj);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  // Data Loading
  const loadData = useCallback(async () => {
    const startTime = Date.now();
    try {
      // Hydrate runtime app version asynchronously
      getAppVersion().then((v) => {
        if (v) setAppVersion(v);
      });

      await trackerDB.seedInitialDataIfEmpty();
      const all = await trackerDB.getAllEntries();
      setEntries(all);

      // Also hydrate persistent settings from SQLite / DB
      const savedCur = await trackerDB.getSetting('nodrapay_currency', null);
      if (savedCur && ['TOMAN', 'GOLD'].includes(savedCur)) {
        setGlobalCurrency(savedCur);
      }
      const savedRate = await trackerDB.getSetting('nodrapay_gold_rate_toman', null);
      if (savedRate && Number(savedRate) > 0) {
        setGoldRateTOMAN(Number(savedRate));
      }
      const savedCloseToTray = await trackerDB.getSetting('checkpoint_close_to_tray', null);
      if (savedCloseToTray !== null) {
        setCloseToTray(savedCloseToTray === 'true');
        localStorage.setItem('checkpoint_close_to_tray', savedCloseToTray);
      }
      const savedMinToTray = await trackerDB.getSetting('checkpoint_minimize_to_tray', null);
      if (savedMinToTray !== null) {
        setMinimizeToTray(savedMinToTray === 'true');
        localStorage.setItem('checkpoint_minimize_to_tray', savedMinToTray);
      }
    } catch (err) {
      console.error('Failed to load data from storage engine:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 2200 - elapsed);
      setTimeout(() => {
        setIsLoading(false);
      }, remaining);
    }
  }, []);

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
        });
        setNotifications(currentMerged);
        await saveStoredNotifications(currentMerged);
      } catch (e) {}

      // 2. Check for software updates (if desktop)
      if (isDesktop) {
        if (!opts.silent) setIsCheckingUpdates(true);
        const res = await checkForUpdate({ timeoutMs: 6000 });
        if (res && res.available) {
          setUpdateInfo(res);
          currentMerged = mergeNotificationsIntoHistory(currentMerged, {
            updateInfo: res,
          });
          setNotifications(currentMerged);
          await saveStoredNotifications(currentMerged);
          if (!opts.silent) {
            showToast(`Update available: v${res.version}`);
          }
        } else if (!opts.silent) {
          if (res?.error) {
            showToast('Unable to connect to update server', { variant: 'destructive' });
          } else {
            showToast(`Checkpoint is up to date${res?.currentVersion ? ` (v${res.currentVersion})` : ''}`);
          }
        }
      }
    } catch (err) {
      console.warn('[Feeds] Sync error:', err);
    } finally {
      if (!opts.silent) setIsCheckingUpdates(false);
    }
  }, [isDesktop, showToast]);

  useEffect(() => {
    loadData();
    enforceMinWindowSize(800, 560);
    // Asynchronous non-blocking background feed sync after UI render
    const timer = setTimeout(() => {
      syncFeeds({ silent: true });
    }, 600);
    return () => clearTimeout(timer);
  }, [loadData, syncFeeds]);

  // Desktop Window & System Tray Event Listeners
  useEffect(() => {
    if (!isDesktop) return;

    let unlistenTray = null;
    let unlistenClose = null;

    const setupDesktopListeners = async () => {
      try {
        unlistenTray = await listenToTrayEvents({
          onQuickAdd: () => setIsQuickAddOpen(true),
          onSettings: () => setIsSettingsOpen(true),
        });

        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        unlistenClose = await win.onCloseRequested(async (event) => {
          if (closeToTrayRef.current) {
            event.preventDefault();
            await hideWindow();
            sendTrayNotification(false);
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
  const handleCloseToTrayChange = (val) => {
    setCloseToTray(val);
    localStorage.setItem('checkpoint_close_to_tray', String(val));
    trackerDB.setSetting('checkpoint_close_to_tray', String(val));
    showToast(val ? 'Close button will minimize to System Tray' : 'Close button will quit the application');
  };

  const handleMinimizeToTrayChange = (val) => {
    setMinimizeToTray(val);
    localStorage.setItem('checkpoint_minimize_to_tray', String(val));
    trackerDB.setSetting('checkpoint_minimize_to_tray', String(val));
    showToast(val ? 'Minimize button will hide to System Tray' : 'Minimize button will minimize to Taskbar');
  };

  const handleTestNotification = async () => {
    const sent = await sendTrayNotification(true);
    if (sent) {
      showToast('🔔 Sent test notification to Windows system tray');
    } else {
      showToast('⚠️ Unable to dispatch notification (check permissions)', { variant: 'destructive' });
    }
  };

  const handleResetNotification = async () => {
    await resetTrayNotificationFlag();
    showToast('🔄 One-time background notification alert reset');
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
      showToast(`Update available: v${res.version}`);
      setIsUpdateModalOpen(true);
    } else if (res?.error) {
      showToast('Unable to connect to update server', { variant: 'destructive' });
    } else {
      showToast(`Checkpoint is up to date${(res?.currentVersion || appVersion) ? ` (v${res?.currentVersion || appVersion})` : ''}`);
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
    showToast('All notifications marked as read');
  };

  const handleDismissNotification = async (id) => {
    const updated = await dismissNotificationItem(id, notifications);
    setNotifications(updated);
  };

  const handleClearAllNotifications = async () => {
    const updated = await clearAllNotificationHistory(notifications);
    setNotifications(updated);
    showToast('Notification history cleared');
  };

  const handleResetAnnouncements = async () => {
    await resetAnnouncementState();
    await syncFeeds({ silent: false });
  };

  // Tab Switcher
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('nodrapay_tab', tab);
    trackerDB.setSetting('nodrapay_tab', tab);
  };

  // Currency Handlers
  const handleCurrencyChange = (newCurr) => {
    const cur = newCurr === 'WOW_GOLD' ? 'GOLD' : (newCurr === 'USD' ? 'TOMAN' : newCurr);
    setGlobalCurrency(cur);
    localStorage.setItem('nodrapay_currency', cur);
    trackerDB.setSetting('nodrapay_currency', cur);
  };

  const handleGoldRateTOMANChange = (newRate) => {
    const r = Number(newRate) || 3200;
    setGoldRateTOMAN(r);
    localStorage.setItem('nodrapay_gold_rate_toman', String(r));
    trackerDB.setSetting('nodrapay_gold_rate_toman', String(r));
  };

  // Save Entry (Create / Edit)
  const handleSaveEntry = async (entryData) => {
    const isNew = !editingEntry;
    await trackerDB.saveEntry(entryData);
    setIsWorkModalOpen(false);
    setEditingEntry(null);
    await loadData();
    if (isNew) {
      handleTabChange('ledger');
    }
    showToast(isNew ? 'Work record saved' : 'Work record updated');
  };

  // Quick Add Save Entry
  const handleSaveQuickEntry = async (entryData) => {
    await trackerDB.saveEntry(entryData);
    setIsQuickAddOpen(false);
    await loadData();
    handleTabChange('ledger');
    showToast('⚡ Quick record added');
  };

  // Delete Single Entry (Called after in-line confirmation)
  const handleDeleteEntry = async (id) => {
    await trackerDB.deleteEntry(id);
    await loadData();
    showToast('🗑️ Work record deleted');
  };

  // Bulk Delete Entries
  const handleBulkDelete = async (ids) => {
    if (!ids || ids.length === 0) return;
    await trackerDB.bulkDeleteEntries(ids);
    await loadData();
    showToast(`🗑️ Deleted ${ids.length} ${ids.length === 1 ? 'record' : 'records'}`);
  };

  // Bulk Update Status
  const handleBulkUpdateStatus = async (ids, nextStatus) => {
    if (!ids || ids.length === 0 || !nextStatus) return;
    await trackerDB.bulkUpdateStatus(ids, nextStatus);
    await loadData();
    showToast(`⚡ Updated ${ids.length} ${ids.length === 1 ? 'record' : 'records'} to ${nextStatus}`);
  };

  // Bulk Export CSV
  const handleBulkExportCsv = useCallback(async (selectedIds) => {
    const listToExport = entries.filter((e) => selectedIds.includes(e.id));
    if (listToExport.length === 0) {
      showToast('No records to export');
      return;
    }

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

    const rows = listToExport.map((e) => [
      e.id,
      e.dateTime,
      `"${(e.game || '').replace(/"/g, '""')}"`,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.source || 'Direct Client').replace(/"/g, '""')}"`,
      `"${e.currency || globalCurrency}"`,
      e.income,
      e.exchangeRate || goldRateTOMAN || 3200,
      e.status,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      e.proofs && e.proofs.length > 0 ? 'YES' : 'NO',
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const fileName = `nodravault_selected_${listToExport.length}_jobs_${new Date().toISOString().slice(0, 10)}.csv`;

    if (isTauri()) {
      const res = await saveFileNative({
        defaultPath: fileName,
        filters: [{ name: 'CSV Spreadsheet', extensions: ['csv'] }],
        content: csvContent,
      });
      if (res && res.success) {
        showToast(`📄 Exported ${listToExport.length} records to CSV`);
        return;
      }
      if (res && res.cancelled) {
        return;
      }
      console.warn('Native bulk CSV save failed, falling back to browser download:', res?.error);
    }

    // Web Fallback
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`📄 Exported ${listToExport.length} records to CSV`);
  }, [entries, globalCurrency, goldRateTOMAN, showToast]);

  // Purge / Clear All Data
  const handleClearAllData = async (purgeSnapshots = false) => {
    await trackerDB.clearAll(purgeSnapshots);
    await loadData();
    showToast('Database wiped successfully');
  };

  // Duplicate Entry
  const handleDuplicateEntry = async (id) => {
    const original = await trackerDB.getEntry(id);
    if (!original) return;

    const copy = {
      ...original,
      id: 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: `${original.title} (Copy)`,
      dateTime: new Date().toISOString().slice(0, 16),
      status: original.status || 'Pending',
      updatedAt: new Date().toISOString(),
    };

    await trackerDB.saveEntry(copy);
    await loadData();
    showToast('⚡ Record duplicated');
  };

  // Status Change / Flip
  const handleFlipStatus = async (id, currentStatus, targetStatus = null) => {
    const nextStatus = targetStatus || STATUS_CONFIG[currentStatus]?.next || 'Paid';
    const entry = await trackerDB.getEntry(id);
    if (!entry) return;

    const updated = {
      ...entry,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    await trackerDB.saveEntry(updated);
    await loadData();
  };

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

    if (typeof imgSrcOrEntry === 'string') {
      const full = await trackerDB.getEntry(imgSrcOrEntry);
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
    if (entries.length === 0) {
      showToast('No records to export');
      return;
    }

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

    const rows = entries.map((e) => [
      e.id,
      e.dateTime,
      `"${(e.game || '').replace(/"/g, '""')}"`,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.source || 'Direct Client').replace(/"/g, '""')}"`,
      `"${e.currency || globalCurrency}"`,
      e.income,
      e.exchangeRate || goldRateTOMAN || 3200,
      e.status,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      e.proofs && e.proofs.length > 0 ? 'YES' : 'NO',
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const fileName = `nodravault_ledger_${new Date().toISOString().slice(0, 10)}.csv`;

    if (isTauri()) {
      const res = await saveFileNative({
        defaultPath: fileName,
        filters: [{ name: 'CSV Spreadsheet', extensions: ['csv'] }],
        content: csvContent,
      });
      if (res && res.success) {
        showToast('CSV export saved successfully');
        return;
      }
      if (res && res.cancelled) {
        return;
      }
      console.warn('Native CSV save failed, falling back to browser download:', res?.error);
    }

    // Web Fallback
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV export downloaded');
  }, [entries, globalCurrency, goldRateTOMAN, showToast]);

  // Export JSON Backup
  const handleExportJson = useCallback(async () => {
    if (entries.length === 0) {
      showToast('No records to export');
      return;
    }

    // Retrieve all records with complete full-res screenshot proofs
    const fullEntries = await trackerDB.getAllEntriesFull();

    const backupData = {
      app: 'CHECKPOINT',
      version: appVersion || '0.0.0',
      exportDate: new Date().toISOString(),
      currency: globalCurrency,
      goldRateTOMAN,
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
        showToast('Full JSON backup saved successfully');
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
    showToast('Full JSON backup downloaded');
  }, [entries, globalCurrency, goldRateTOMAN, showToast]);

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
          showToast('Failed to open backup file', { variant: 'destructive' });
          return;
        }
        try {
          json = JSON.parse(res.content);
        } catch (e) {
          showToast('Selected file is not valid JSON', { variant: 'destructive' });
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
      } else {
        showToast('Invalid backup JSON format', { variant: 'destructive' });
        return;
      }

      await trackerDB.bulkImport(importedList);
      await loadData();
      showToast(`Successfully restored ${importedList.length} records`);
    } catch (err) {
      console.error('Failed to import JSON backup:', err);
      showToast('Error restoring backup file', { variant: 'destructive' });
    }
  };

  // Reset Data with Fresh Seed
  const handleResetData = async () => {
    await trackerDB.resetWithFreshSeed();
    await loadData();
    showToast('Database reset with fresh sample data');
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape closes open modals / lightbox
      if (e.key === 'Escape') {
        if (lightboxData.isOpen) {
          setLightboxData({ isOpen: false, imgSrc: '', caption: '' });
          return;
        }
        if (isNotificationCenterOpen) {
          setIsNotificationCenterOpen(false);
          return;
        }
        if (isUpdateModalOpen) {
          setIsUpdateModalOpen(false);
          return;
        }
        if (exportConfirm) {
          setExportConfirm(null);
          return;
        }
        if (isWorkModalOpen) {
          setIsWorkModalOpen(false);
          setEditingEntry(null);
          return;
        }
        if (isQuickAddOpen) {
          setIsQuickAddOpen(false);
          return;
        }
        if (isReceiptModalOpen) {
          setIsReceiptModalOpen(false);
          setReceiptEntry(null);
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
      }

      // Ctrl + F (Focus Search in Ledger)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        handleTabChange('ledger');
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
        return;
      }

      // Don't trigger standard navigation hotkeys if typing in inputs/textareas
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      // Alt + E (Export CSV)
      if (e.altKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setExportConfirm('csv');
        return;
      }

      // Alt + B (Backup JSON)
      if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setExportConfirm('json');
        return;
      }

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsQuickAddOpen(true);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleOpenWorkModal();
      } else if (e.key === '1') {
        e.preventDefault();
        handleTabChange('ledger');
      } else if (e.key === '2') {
        e.preventDefault();
        handleTabChange('analytics');
      } else if (e.key === '/') {
        e.preventDefault();
        handleTabChange('ledger');
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExportCsv, handleExportJson, isWorkModalOpen, isQuickAddOpen, isReceiptModalOpen, isSettingsOpen, isShortcutsOpen, isNotificationCenterOpen, isUpdateModalOpen, lightboxData, exportConfirm]);

  return (
    <div className="w-full h-screen bg-black text-zinc-100 flex flex-col selection:bg-zinc-800 overflow-hidden select-none border border-zinc-900 shadow-2xl">
      {/* 0. App Launch Splash Screen */}
      <AnimatePresence>
        {isLoading && <SplashScreen key="app-splash" />}
      </AnimatePresence>

      {/* 1. Desktop Unified Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        globalCurrency={globalCurrency}
        onCurrencyChange={handleCurrencyChange}
        goldRateTOMAN={goldRateTOMAN}
        onGoldRateTOMANChange={handleGoldRateTOMANChange}
        closeToTray={closeToTray}
        minimizeToTray={minimizeToTray}
        onOpenWorkModal={handleOpenWorkModal}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        entriesCount={entries.length}
        appVersion={appVersion}
        updateInfo={updateInfo}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationCenterOpen(true)}
      />

      {/* 2. Mobile Top Header (Only on Web viewports) */}
      {!isDesktop && (
        <MobileHeader
          globalCurrency={globalCurrency}
          appVersion={appVersion}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenWorkModal={handleOpenWorkModal}
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
          onOpenNotifications={() => setIsNotificationCenterOpen(true)}
          unreadNotificationsCount={unreadNotificationsCount}
        />
      )}

      {/* 3. Main Centered Mini-App Workspace */}
      <main className="flex-1 h-full min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 lg:p-8 relative bg-black gpu-scroll">
        {/* Top-Center Toast Notification */}
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm sm:max-w-md pointer-events-none flex justify-center">
          <AnimatePresence>
            {toast && (
              <Toast
                key={toast.id || 'toast'}
                toast={toast}
                onClose={() => setToast(null)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Centered Tablet-Width Mini-App Frame */}
        <div className="max-w-4xl mx-auto w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-zinc-500 text-xs">
              Loading ledger...
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
              >
                {activeTab === 'ledger' && (
                  <LedgerView
                    entries={entries}
                    globalCurrency={globalCurrency}
                    goldRateTOMAN={goldRateTOMAN}
                    onOpenWorkModal={handleOpenWorkModal}
                    onOpenReceipt={handleOpenReceipt}
                    onOpenLightbox={handleOpenLightbox}
                    onFlipStatus={handleFlipStatus}
                    onDuplicateEntry={handleDuplicateEntry}
                    onDeleteEntry={handleDeleteEntry}
                    onBulkDelete={handleBulkDelete}
                    onBulkUpdateStatus={handleBulkUpdateStatus}
                    onBulkExportCsv={handleBulkExportCsv}
                    searchInputRef={searchInputRef}
                    externalTeammateFilter={externalTeammateFilter}
                    onClearExternalTeammateFilter={() => setExternalTeammateFilter('')}
                    onToast={showToast}
                  />
                )}

                {activeTab === 'analytics' && (
                  <AnalyticsView
                    entries={entries}
                    globalCurrency={globalCurrency}
                    goldRateTOMAN={goldRateTOMAN}
                  />
                )}
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
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        />
      )}

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
        onToast={showToast}
      />

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSave={handleSaveQuickEntry}
        globalCurrency={globalCurrency}
        goldRateTOMAN={goldRateTOMAN}
        onToast={showToast}
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
        onToast={showToast}
        onFilterTeammate={(name) => {
          setIsReceiptModalOpen(false);
          setReceiptEntry(null);
          setActiveTab('ledger');
          setExternalTeammateFilter(name);
          showToast(`Filtered for teammate: ${name}`);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        globalCurrency={globalCurrency}
        onCurrencyChange={handleCurrencyChange}
        closeToTray={closeToTray}
        onCloseToTrayChange={handleCloseToTrayChange}
        minimizeToTray={minimizeToTray}
        onMinimizeToTrayChange={handleMinimizeToTrayChange}
        onTestNotification={handleTestNotification}
        onResetNotification={handleResetNotification}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onResetData={handleResetData}
        onClearAllData={handleClearAllData}
        onToast={showToast}
        entriesCount={entries.length}
        appVersion={appVersion}
        updateInfo={updateInfo}
        onCheckUpdates={handleCheckUpdates}
        isCheckingUpdates={isCheckingUpdates}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onResetAnnouncements={handleResetAnnouncements}
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
        onToast={showToast}
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
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              {exportConfirm === 'csv' ? 'Alt + E' : 'Alt + B'}
            </span>
          </div>
        </DialogHeader>

        <DialogContent className="space-y-3 py-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
              {exportConfirm === 'csv' ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-cyan-400" />
              )}
            </div>
            <div className="space-y-1 text-xs text-zinc-400">
              <p className="text-zinc-200 font-medium">
                {exportConfirm === 'csv'
                  ? `Export ${entries.length} records to a formatted .csv spreadsheet?`
                  : `Save a complete backup with ${entries.length} records and proofs?`}
              </p>
              <p className="text-[11px] text-zinc-500">
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
    </div>
  );
}
