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
import { ReceiptModal } from './components/ReceiptModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Lightbox } from './components/Lightbox';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './components/ui/Dialog';
import { Button } from './components/ui/Button';
import { Toast } from './components/ui/Toast';
import { motion, AnimatePresence } from 'motion/react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { isTauri, saveFileNative, openFileNative } from './lib/desktop';

export default function App() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
  const [editingEntry, setEditingEntry] = useState(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptEntry, setReceiptEntry] = useState(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [exportConfirm, setExportConfirm] = useState(null); // null | 'csv' | 'json'

  const [lightboxData, setLightboxData] = useState({
    isOpen: false,
    imgSrc: '',
    caption: '',
  });

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
    } catch (err) {
      console.error('Failed to load data from storage engine:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 450 - elapsed);
      setTimeout(() => {
        setIsLoading(false);
      }, remaining);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Delete Entry
  const handleDeleteEntry = async (id) => {
    if (window.confirm('Delete this work record and attached proofs?')) {
      await trackerDB.deleteEntry(id);
      await loadData();
      showToast('Work record deleted');
    }
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
      }
      return;
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
      app: 'Checkpoint',
      version: '2.1.0',
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
      }
      return;
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
        if (!res || !res.success || !res.content) return;
        json = JSON.parse(res.content);
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
        showToast('Invalid backup JSON format');
        return;
      }

      await trackerDB.bulkImport(importedList);
      await loadData();
      showToast(`Successfully restored ${importedList.length} records`);
    } catch (err) {
      console.error('Failed to import JSON backup:', err);
      showToast('Error restoring backup file');
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
        if (exportConfirm) {
          setExportConfirm(null);
          return;
        }
        if (isWorkModalOpen) {
          setIsWorkModalOpen(false);
          setEditingEntry(null);
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

      if (e.key === 'n' || e.key === 'N') {
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
  }, [handleExportCsv, handleExportJson, isWorkModalOpen, isReceiptModalOpen, isSettingsOpen, isShortcutsOpen, lightboxData, exportConfirm]);

  return (
    <div className="w-full h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-zinc-800 overflow-hidden select-none border border-zinc-800/80 shadow-2xl">
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
        onOpenWorkModal={handleOpenWorkModal}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        entriesCount={entries.length}
      />

      {/* 2. Mobile Top Header */}
      <MobileHeader
        globalCurrency={globalCurrency}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenWorkModal={handleOpenWorkModal}
      />

      {/* 3. Main Centered Mini-App Workspace */}
      <main className="flex-1 h-full min-w-0 max-w-full overflow-y-auto p-4 sm:p-6 lg:p-8 relative bg-zinc-950">
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
                    searchInputRef={searchInputRef}
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

      {/* 4. Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenWorkModal={() => handleOpenWorkModal()}
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
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        globalCurrency={globalCurrency}
        onCurrencyChange={handleCurrencyChange}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onResetData={handleResetData}
        onToast={showToast}
        entriesCount={entries.length}
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
