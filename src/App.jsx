import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { trackerDB } from './lib/db';
import { STATUS_CONFIG } from './lib/currencies';
import { MobileShell } from './components/MobileShell';
import { MobileHeader } from './components/MobileHeader';
import { MobileNavBar } from './components/MobileNavBar';
import { SettingsSheet } from './components/SettingsSheet';
import { HomeScreen } from './components/screens/HomeScreen';
import { LedgerScreen } from './components/screens/LedgerScreen';
import { StatsRatesScreen } from './components/screens/StatsRatesScreen';
import { WorkModal } from './components/WorkModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Lightbox } from './components/Lightbox';
import { toLocalISOString } from './components/ui/DateTimePicker';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle } from 'lucide-react';

export default function App() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'ledger' | 'stats'

  // User Preferences
  const [globalCurrency, setGlobalCurrency] = useState(() => {
    return localStorage.getItem('nodrapay_currency') || 'USD';
  });

  // Gold Conversion State
  const [goldCurrency, setGoldCurrency] = useState(() => {
    return localStorage.getItem('nodrapay_gold_currency') || 'USD';
  });

  const [goldRate, setGoldRate] = useState(() => {
    const saved = localStorage.getItem('nodrapay_gold_rate');
    if (saved !== null) {
      const parsed = parseFloat(saved);
      return !isNaN(parsed) ? parsed : 0.035;
    }
    return 0.035;
  });

  const [isConversionEnabled, setIsConversionEnabled] = useState(() => {
    const saved = localStorage.getItem('nodrapay_gold_conversion');
    return saved !== null ? saved === 'true' : true;
  });

  // UI Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptEntry, setReceiptEntry] = useState(null);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const [lightboxData, setLightboxData] = useState({
    isOpen: false,
    imgSrc: '',
    caption: '',
  });

  // Toast Notification
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ text: msg, time: Date.now() });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  }, []);

  // Initial Data Load (IndexedDB)
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

  // Handlers for Gold Conversion
  const handleGoldRateChange = (newRate) => {
    setGoldRate(newRate);
    localStorage.setItem('nodrapay_gold_rate', String(newRate));
  };

  const handleGoldCurrencyChange = (newCurr) => {
    setGoldCurrency(newCurr);
    localStorage.setItem('nodrapay_gold_currency', newCurr);
  };

  const handleToggleConversion = (enabled) => {
    setIsConversionEnabled(enabled);
    localStorage.setItem('nodrapay_gold_conversion', String(enabled));
  };

  // Handle Global Currency Preference Change
  const handleCurrencyChange = (newCurr) => {
    setGlobalCurrency(newCurr);
    localStorage.setItem('nodrapay_currency', newCurr);
    showToast(`Currency set to ${newCurr}`);
  };

  // Save Entry (Create / Update)
  const handleSaveEntry = async (entryData) => {
    await trackerDB.saveEntry(entryData);
    setIsWorkModalOpen(false);
    setEditingEntry(null);
    await loadData();
    showToast(editingEntry ? 'Work entry updated' : 'Work entry logged successfully');
  };

  // Delete Entry
  const handleDeleteEntry = async (id) => {
    if (window.confirm('Delete this work entry and its attached proofs?')) {
      await trackerDB.deleteEntry(id);
      await loadData();
      showToast('Work entry deleted');
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
      dateTime: toLocalISOString(new Date()),
      status: original.status || 'Paid',
      updatedAt: new Date().toISOString(),
    };

    await trackerDB.saveEntry(copy);
    await loadData();
    showToast('⚡ Entry duplicated');
  };

  // 1-Click Inline Status Flip
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
      showToast('No entries to export');
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

  // Export Full JSON Backup (including screenshots)
  const handleExportJson = () => {
    if (entries.length === 0) {
      showToast('No entries to export');
      return;
    }

    const backupData = {
      app: 'Nodra Pay',
      exportDate: new Date().toISOString(),
      version: '2.0-mobile',
      settings: {
        globalCurrency,
        goldRate,
        goldCurrency,
        isConversionEnabled,
      },
      entries,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute(
      'download',
      `nodrapay_backup_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Full JSON backup downloaded');
  };

  // Import JSON Backup
  const handleImportJson = async (file) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          const entriesToImport = Array.isArray(imported)
            ? imported
            : imported.entries || [];

          if (!Array.isArray(entriesToImport) || entriesToImport.length === 0) {
            showToast('Invalid backup file or no entries found');
            return;
          }

          if (
            window.confirm(
              `Restore ${entriesToImport.length} work records from this backup?`
            )
          ) {
            await trackerDB.restoreFromBackup(entriesToImport);
            if (imported.settings) {
              if (imported.settings.globalCurrency) handleCurrencyChange(imported.settings.globalCurrency);
              if (imported.settings.goldRate) handleGoldRateChange(imported.settings.goldRate);
              if (imported.settings.goldCurrency) handleGoldCurrencyChange(imported.settings.goldCurrency);
            }
            await loadData();
            showToast(`⚡ Successfully restored ${entriesToImport.length} entries!`);
          }
        } catch (err) {
          console.error('Failed to parse backup JSON:', err);
          showToast('Failed to parse backup file');
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error('Import error:', err);
      showToast('Error importing file');
    }
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input or textarea
      const targetTag = e.target.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleOpenWorkModal();
      } else if (e.key === '1') {
        e.preventDefault();
        setActiveTab('home');
      } else if (e.key === '2') {
        e.preventDefault();
        setActiveTab('ledger');
      } else if (e.key === '3') {
        e.preventDefault();
        setActiveTab('stats');
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <MobileShell>
      {/* Mobile Top Header */}
      <MobileHeader
        globalCurrency={globalCurrency}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenWorkModal={() => handleOpenWorkModal()}
      />

      {/* Main Active Screen */}
      <main className="flex-1 flex flex-col relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col"
            >
              <HomeScreen
                entries={entries}
                globalCurrency={globalCurrency}
                goldRate={goldRate}
                goldCurrency={goldCurrency}
                isConversionEnabled={isConversionEnabled}
                onNavigateToLedger={() => setActiveTab('ledger')}
                onOpenWorkModal={handleOpenWorkModal}
                onFlipStatus={handleFlipStatus}
                onOpenReceipt={handleOpenReceipt}
                onOpenLightbox={handleOpenLightbox}
              />
            </motion.div>
          )}

          {activeTab === 'ledger' && (
            <motion.div
              key="ledger"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col"
            >
              <LedgerScreen
                entries={entries}
                globalCurrency={globalCurrency}
                goldRate={goldRate}
                goldCurrency={goldCurrency}
                isConversionEnabled={isConversionEnabled}
                onEditEntry={handleOpenWorkModal}
                onDuplicateEntry={handleDuplicateEntry}
                onDeleteEntry={handleDeleteEntry}
                onFlipStatus={handleFlipStatus}
                onOpenReceipt={handleOpenReceipt}
                onOpenLightbox={handleOpenLightbox}
                onOpenWorkModal={handleOpenWorkModal}
              />
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col"
            >
              <StatsRatesScreen
                entries={entries}
                globalCurrency={globalCurrency}
                goldRate={goldRate}
                onGoldRateChange={handleGoldRateChange}
                goldCurrency={goldCurrency}
                onGoldCurrencyChange={handleGoldCurrencyChange}
                isConversionEnabled={isConversionEnabled}
                onToggleConversion={handleToggleConversion}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Bottom Navigation Bar */}
      <MobileNavBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenWorkModal={() => handleOpenWorkModal()}
      />

      {/* Settings Bottom-Sheet */}
      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        globalCurrency={globalCurrency}
        onCurrencyChange={handleCurrencyChange}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        totalEntriesCount={entries.length}
      />

      {/* Work Modal (Log / Edit) */}
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

      {/* Client Receipt Modal */}
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

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Lightbox Modal */}
      <Lightbox
        isOpen={lightboxData.isOpen}
        onClose={() => setLightboxData({ isOpen: false, imgSrc: '', caption: '' })}
        imgSrc={lightboxData.imgSrc}
        caption={lightboxData.caption}
      />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-4 inset-x-0 mx-auto w-fit z-[70] flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900/95 text-white text-xs font-medium border border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-2xl"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </MobileShell>
  );
}
