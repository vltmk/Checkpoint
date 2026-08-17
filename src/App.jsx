import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { trackerDB } from './lib/db';
import { STATUS_CONFIG } from './lib/currencies';
import { toLocalISOString } from './components/ui/DateTimePicker';
import { Sidebar } from './components/Sidebar';
import { MobileHeader, MobileBottomNav } from './components/MobileNavigation';
import { OverviewView } from './components/views/OverviewView';
import { LedgerView } from './components/views/LedgerView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ExchangeView } from './components/views/ExchangeView';
import { WorkModal } from './components/WorkModal';
import { ReceiptModal } from './components/ReceiptModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Lightbox } from './components/Lightbox';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

export default function App() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active View Tab ('overview' | 'ledger' | 'analytics' | 'exchange')
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('nodrapay_tab') || 'overview';
  });

  // User Currency Preferences (USD | TOMAN | GOLD)
  const [globalCurrency, setGlobalCurrency] = useState(() => {
    const saved = localStorage.getItem('nodrapay_currency');
    if (saved === 'WOW_GOLD') return 'GOLD';
    return ['USD', 'TOMAN', 'GOLD'].includes(saved) ? saved : 'USD';
  });

  // Gold Exchange Rates
  const [goldRateUSD, setGoldRateUSD] = useState(() => {
    const saved = localStorage.getItem('nodrapay_gold_rate_usd');
    if (saved !== null) {
      const parsed = parseFloat(saved);
      return !isNaN(parsed) && parsed > 0 ? parsed : 0.035;
    }
    return 0.035;
  });

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

  const [lightboxData, setLightboxData] = useState({
    isOpen: false,
    imgSrc: '',
    caption: '',
  });

  // Toast Notification
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  const showToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ text: msg, time: Date.now() });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2600);
  }, []);

  // Data Loading
  const loadData = useCallback(async () => {
    try {
      await trackerDB.seedInitialDataIfEmpty();
      const all = await trackerDB.getAllEntries();
      setEntries(all);
    } catch (err) {
      console.error('Failed to load data from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tab Switcher
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('nodrapay_tab', tab);
  };

  // Currency Handlers
  const handleCurrencyChange = (newCurr) => {
    const cur = newCurr === 'WOW_GOLD' ? 'GOLD' : newCurr;
    setGlobalCurrency(cur);
    localStorage.setItem('nodrapay_currency', cur);
  };

  const handleGoldRateUSDChange = (newRate) => {
    const r = Number(newRate) || 0.035;
    setGoldRateUSD(r);
    localStorage.setItem('nodrapay_gold_rate_usd', String(r));
  };

  const handleGoldRateTOMANChange = (newRate) => {
    const r = Number(newRate) || 3200;
    setGoldRateTOMAN(r);
    localStorage.setItem('nodrapay_gold_rate_toman', String(r));
  };

  // Save Entry (Create / Edit)
  const handleSaveEntry = async (entryData) => {
    await trackerDB.saveEntry(entryData);
    setIsWorkModalOpen(false);
    setEditingEntry(null);
    await loadData();
    showToast(editingEntry ? 'Work record updated' : 'Work record saved');
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
      status: original.status || 'Paid',
      updatedAt: new Date().toISOString(),
    };

    await trackerDB.saveEntry(copy);
    await loadData();
    showToast('⚡ Record duplicated');
  };

  // 1-Click Status Flip
  const handleFlipStatus = async (id, currentStatus) => {
    const nextStatus = STATUS_CONFIG[currentStatus]?.next || 'Paid';
    const entry = await trackerDB.getEntry(id);
    if (!entry) return;

    const updated = {
      ...entry,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    await trackerDB.saveEntry(updated);
    await loadData();
    showToast(`Status updated to "${nextStatus}"`);
  };

  // Modal Openers
  const handleOpenWorkModal = (entry = null) => {
    setEditingEntry(entry);
    setIsWorkModalOpen(true);
  };

  const handleOpenReceipt = (entry) => {
    setReceiptEntry(entry);
    setIsReceiptModalOpen(true);
  };

  const handleOpenLightbox = (imgSrc, caption) => {
    setLightboxData({
      isOpen: true,
      imgSrc,
      caption,
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    if (entries.length === 0) {
      showToast('No records to export');
      return;
    }

    const headers = [
      'ID',
      'Date & Time',
      'Game',
      'Work Title',
      'Currency',
      'Income Amount',
      'Status',
      'Hours',
      'Notes',
      'Has Proof Attached',
    ];

    const rows = entries.map((e) => [
      e.id,
      e.dateTime,
      `"${(e.game || '').replace(/"/g, '""')}"`,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${e.currency || globalCurrency}"`,
      e.income,
      e.status,
      e.hours || '',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      e.proofs && e.proofs.length > 0 ? 'YES' : 'NO',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `nodrapay_ledger_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV export downloaded');
  };

  // Export JSON Backup
  const handleExportJson = () => {
    if (entries.length === 0) {
      showToast('No records to export');
      return;
    }

    const backupData = {
      app: 'Nodra Pay',
      version: '3.0.0',
      exportDate: new Date().toISOString(),
      currency: globalCurrency,
      goldRateUSD,
      goldRateTOMAN,
      entriesCount: entries.length,
      entries,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nodrapay_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Full JSON backup downloaded');
  };

  // Import JSON Restore
  const handleImportJson = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        let importedList = [];

        if (Array.isArray(json)) {
          importedList = json;
        } else if (json.entries && Array.isArray(json.entries)) {
          importedList = json.entries;
          if (json.goldRateUSD) handleGoldRateUSDChange(json.goldRateUSD);
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
    reader.readAsText(file);
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
      // Don't trigger if typing in inputs/textareas
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleOpenWorkModal();
      } else if (e.key === '1') {
        e.preventDefault();
        handleTabChange('overview');
      } else if (e.key === '2') {
        e.preventDefault();
        handleTabChange('ledger');
      } else if (e.key === '3') {
        e.preventDefault();
        handleTabChange('analytics');
      } else if (e.key === '4') {
        e.preventDefault();
        handleTabChange('exchange');
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
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex justify-center selection:bg-zinc-800">
      {/* Tablet-Width Desktop Shell Container */}
      <div className="w-full max-w-5xl min-h-screen flex flex-col md:flex-row md:border-x border-zinc-800/80 bg-zinc-950 shadow-2xl relative">
        {/* Desktop Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          globalCurrency={globalCurrency}
          onCurrencyChange={handleCurrencyChange}
          goldRateUSD={goldRateUSD}
          goldRateTOMAN={goldRateTOMAN}
          onGoldRateUSDChange={handleGoldRateUSDChange}
          onGoldRateTOMANChange={handleGoldRateTOMANChange}
          onOpenWorkModal={handleOpenWorkModal}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          entriesCount={entries.length}
        />

        {/* Mobile Top Header */}
        <MobileHeader
          globalCurrency={globalCurrency}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenWorkModal={handleOpenWorkModal}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 max-w-full overflow-y-auto">
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
                {activeTab === 'overview' && (
                  <OverviewView
                    entries={entries}
                    globalCurrency={globalCurrency}
                    goldRateUSD={goldRateUSD}
                    goldRateTOMAN={goldRateTOMAN}
                    onOpenWorkModal={handleOpenWorkModal}
                    onOpenReceipt={handleOpenReceipt}
                    onOpenLightbox={handleOpenLightbox}
                    onFlipStatus={handleFlipStatus}
                    onNavigateToLedger={() => handleTabChange('ledger')}
                    onNavigateToExchange={() => handleTabChange('exchange')}
                  />
                )}

                {activeTab === 'ledger' && (
                  <LedgerView
                    entries={entries}
                    globalCurrency={globalCurrency}
                    goldRateUSD={goldRateUSD}
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
                    goldRateUSD={goldRateUSD}
                    goldRateTOMAN={goldRateTOMAN}
                  />
                )}

                {activeTab === 'exchange' && (
                  <ExchangeView
                    entries={entries}
                    globalCurrency={globalCurrency}
                    goldRateUSD={goldRateUSD}
                    goldRateTOMAN={goldRateTOMAN}
                    onGoldRateUSDChange={handleGoldRateUSDChange}
                    onGoldRateTOMANChange={handleGoldRateTOMANChange}
                    onToast={showToast}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenWorkModal={() => handleOpenWorkModal()}
        />
      </div>

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

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-16 sm:bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 text-zinc-100 text-xs font-medium border border-zinc-800 shadow-xl"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
