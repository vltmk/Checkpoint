import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { trackerDB } from './lib/db';
import { STATUS_CONFIG } from './lib/currencies';
import { Header } from './components/Header';
import { GoldConversionBar } from './components/GoldConversionBar';
import { MetricStrip } from './components/MetricStrip';
import { AnalyticsDrawer } from './components/AnalyticsDrawer';
import { Toolbar } from './components/Toolbar';
import { LedgerTable } from './components/LedgerTable';
import { LedgerCards } from './components/LedgerCards';
import { WorkModal } from './components/WorkModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Lightbox } from './components/Lightbox';
import { FloatingControls } from './components/FloatingControls';
import { toLocalISOString } from './components/ui/DateTimePicker';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle } from 'lucide-react';

const DEFAULT_VISIBLE_ELEMENTS = {
  avgRate: false,
  topGame: false,
  chartMonthly: true,
  chartCategory: false,
  chartClients: false,
};

export default function App() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // User Preferences
  const [globalCurrency, setGlobalCurrency] = useState(() => {
    return localStorage.getItem('nodrapay_currency') || 'USD';
  });

  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('nodrapay_view') || 'dense';
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

  // Visible Elements Customization
  const [visibleElements, setVisibleElements] = useState(() => {
    try {
      const saved = localStorage.getItem('nodrapay_visible_elements');
      if (saved) {
        return { ...DEFAULT_VISIBLE_ELEMENTS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to parse saved visible elements:', e);
    }
    return DEFAULT_VISIBLE_ELEMENTS;
  });

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [proofFilter, setProofFilter] = useState('');
  const [sortOption, setSortOption] = useState('date_desc');

  // UI Drawer / Modals State
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
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
  const searchInputRef = useRef(null);

  const showToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ text: msg, time: Date.now() });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  }, []);

  // Initial Data Load
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

  // Handlers for Visible Elements
  const handleToggleVisibleElement = (key, val) => {
    setVisibleElements((prev) => {
      const updated = { ...prev, [key]: val };
      localStorage.setItem('nodrapay_visible_elements', JSON.stringify(updated));
      return updated;
    });
  };

  const handleResetVisibleDefaults = () => {
    setVisibleElements(DEFAULT_VISIBLE_ELEMENTS);
    localStorage.setItem('nodrapay_visible_elements', JSON.stringify(DEFAULT_VISIBLE_ELEMENTS));
    showToast('Reset views to defaults');
  };

  // Handle Global Currency Preference Change
  const handleCurrencyChange = (newCurr) => {
    setGlobalCurrency(newCurr);
    localStorage.setItem('nodrapay_currency', newCurr);
  };

  // Handle View Mode Change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('nodrapay_view', mode);
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
      `nodrapay_gaming_ledger_${new Date().toISOString().slice(0, 10)}.csv`
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
      version: '2.0',
      currency: globalCurrency,
      goldRate,
      goldCurrency,
      isConversionEnabled,
      entries: entries,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nodrapay_ledger_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Full JSON backup with screenshots downloaded');
  };

  // Import JSON Backup
  const handleImportJson = (file) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const importedEntries = Array.isArray(data) ? data : data.entries || [];

        if (!Array.isArray(importedEntries)) {
          throw new Error('Invalid JSON format');
        }

        if (
          window.confirm(
            `Restore ${importedEntries.length} entries into Nodra Pay ledger?`
          )
        ) {
          await trackerDB.bulkImport(importedEntries);
          await loadData();
          showToast(`Successfully restored ${importedEntries.length} entries`);
        }
      } catch (err) {
        console.error('Import error:', err);
        showToast('Failed to parse JSON backup file');
      }
    };
    reader.readAsText(file);
  };

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInputFocused =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) ||
        document.activeElement?.isContentEditable;

      // Escape closes any open modal or blurs search
      if (e.key === 'Escape') {
        if (lightboxData.isOpen) {
          setLightboxData({ isOpen: false, imgSrc: '', caption: '' });
        } else if (isReceiptModalOpen) {
          setIsReceiptModalOpen(false);
        } else if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
        } else if (isWorkModalOpen) {
          setIsWorkModalOpen(false);
        } else if (isInputFocused) {
          document.activeElement?.blur();
        }
        return;
      }

      if (isInputFocused) return;

      // '?' or 'Shift+/' -> Shortcuts modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }

      // 'N' or 'Ctrl+N' / 'Cmd+N' -> Open Log Work Modal
      if (
        (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) ||
        ((e.ctrlKey || e.metaKey || e.altKey) && e.key.toLowerCase() === 'n')
      ) {
        e.preventDefault();
        handleOpenWorkModal();
      }

      // '/' or 'Ctrl+K' / 'Cmd+K' -> Focus Search Input
      if (
        (e.key === '/' && !e.ctrlKey && !e.metaKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // 'V' -> Toggle View Mode
      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleViewModeChange(viewMode === 'dense' ? 'cards' : 'dense');
        showToast(`Switched to ${viewMode === 'dense' ? 'Cards' : 'Table'} view`);
      }

      // 'A' -> Toggle Analytics
      if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsAnalyticsOpen((prev) => !prev);
      }

      // 'Ctrl+Shift+E' or 'Alt+E' -> Mistake-proof Export CSV
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') ||
        (e.altKey && e.key.toLowerCase() === 'e')
      ) {
        e.preventDefault();
        handleExportCsv();
      }

      // 'Ctrl+Shift+B' or 'Alt+B' -> Mistake-proof Full JSON Backup
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') ||
        (e.altKey && e.key.toLowerCase() === 'b')
      ) {
        e.preventDefault();
        handleExportJson();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isWorkModalOpen,
    isReceiptModalOpen,
    isShortcutsOpen,
    lightboxData.isOpen,
    viewMode,
    entries,
    globalCurrency,
    showToast,
  ]);

  // Filter and Sort Entries
  const filteredEntries = useMemo(() => {
    let list = [...entries];
    const q = searchQuery.toLowerCase().trim();

    if (q) {
      list = list.filter((item) => {
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const gameMatch = (item.game || '').toLowerCase().includes(q);
        const notesMatch = (item.notes || '').toLowerCase().includes(q);
        return titleMatch || gameMatch || notesMatch;
      });
    }

    if (gameFilter) {
      list = list.filter((item) => item.game === gameFilter);
    }

    if (statusFilter) {
      list = list.filter((item) => item.status === statusFilter);
    }

    if (proofFilter === 'has_proof') {
      list = list.filter((item) => item.proofs && item.proofs.length > 0);
    } else if (proofFilter === 'no_proof') {
      list = list.filter((item) => !item.proofs || item.proofs.length === 0);
    }

    // Sort
    list.sort((a, b) => {
      if (sortOption === 'date_desc') return new Date(b.dateTime) - new Date(a.dateTime);
      if (sortOption === 'date_asc') return new Date(a.dateTime) - new Date(b.dateTime);
      if (sortOption === 'income_desc') return (b.income || 0) - (a.income || 0);
      if (sortOption === 'income_asc') return (a.income || 0) - (b.income || 0);
      if (sortOption === 'title_asc') return (a.title || '').localeCompare(b.title || '');
      return 0;
    });

    return list;
  }, [entries, searchQuery, gameFilter, statusFilter, proofFilter, sortOption]);

  return (
    <div className="relative min-h-screen bg-[#000000] text-zinc-100 flex flex-col selection:bg-white/20">
      {/* Translucent radial ambient background mesh */}
      <div className="ambient-mesh" />

      {/* Top Header */}
      <Header
        globalCurrency={globalCurrency}
        onCurrencyChange={handleCurrencyChange}
        onOpenWorkModal={handleOpenWorkModal}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        totalEntriesCount={entries.length}
      />

      {/* Live WoW Gold Conversion Bar */}
      <GoldConversionBar
        goldRate={goldRate}
        onGoldRateChange={handleGoldRateChange}
        goldCurrency={goldCurrency}
        onGoldCurrencyChange={handleGoldCurrencyChange}
        isConversionEnabled={isConversionEnabled}
        onToggleConversion={handleToggleConversion}
        entries={entries}
      />

      {/* High Density Metric Strip */}
      <MetricStrip
        entries={entries}
        globalCurrency={globalCurrency}
        goldRate={goldRate}
        goldCurrency={goldCurrency}
        isConversionEnabled={isConversionEnabled}
        visibleElements={visibleElements}
      />

      {/* Analytics Drawer */}
      <AnalyticsDrawer
        isOpen={isAnalyticsOpen}
        onToggle={() => setIsAnalyticsOpen((prev) => !prev)}
        entries={entries}
        globalCurrency={globalCurrency}
        goldRate={goldRate}
        goldCurrency={goldCurrency}
        isConversionEnabled={isConversionEnabled}
        visibleElements={visibleElements}
      />

      {/* Main Ledger Control & Listing */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col">
        <Toolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          gameFilter={gameFilter}
          onGameFilterChange={setGameFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          proofFilter={proofFilter}
          onProofFilterChange={setProofFilter}
          sortOption={sortOption}
          onSortOptionChange={setSortOption}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          visibleCount={filteredEntries.length}
          totalCount={entries.length}
          searchInputRef={searchInputRef}
        />

        {viewMode === 'dense' ? (
          <LedgerTable
            entries={filteredEntries}
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
        ) : (
          <LedgerCards
            entries={filteredEntries}
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
        )}
      </main>

      {/* Floating Controls at bottom-left */}
      <FloatingControls
        visibleElements={visibleElements}
        onToggleElement={handleToggleVisibleElement}
        onResetDefaults={handleResetVisibleDefaults}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Modals */}
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

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/95 text-white text-xs font-medium border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-2xl"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
