import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { trackerDB } from './lib/db';
import { STATUS_CONFIG } from './lib/currencies';
import { Header } from './components/Header';
import { MetricStrip } from './components/MetricStrip';
import { AnalyticsDrawer } from './components/AnalyticsDrawer';
import { Toolbar } from './components/Toolbar';
import { LedgerTable } from './components/LedgerTable';
import { LedgerCards } from './components/LedgerCards';
import { WorkModal } from './components/WorkModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Lightbox } from './components/Lightbox';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle } from 'lucide-react';

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

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
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

  // Handle Currency Preference Change
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
      dateTime: new Date().toISOString().slice(0, 16),
      status: 'In Progress',
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
      'Game / Client',
      'Work Title',
      'Category',
      'Platform',
      'Currency',
      'Income Amount',
      'Status',
      'Hours',
      'Deliverable URL',
      'Tags',
      'Notes',
      'Has Proof Attached',
    ];

    const rows = entries.map((e) => [
      e.id,
      e.dateTime,
      `"${(e.game || '').replace(/"/g, '""')}"`,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.category || '').replace(/"/g, '""')}"`,
      `"${(e.platform || '').replace(/"/g, '""')}"`,
      `"${e.currency || globalCurrency}"`,
      e.income,
      e.status,
      e.hours || '',
      `"${(e.deliverableUrl || '').replace(/"/g, '""')}"`,
      `"${(Array.isArray(e.tags) ? e.tags.join(', ') : '').replace(/"/g, '""')}"`,
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
      // Don't trigger letter shortcuts when focused in inputs / textareas
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

      // 'N' or 'Ctrl+N' -> Open Log Work Modal
      if (
        (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) ||
        ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'n')
      ) {
        e.preventDefault();
        handleOpenWorkModal();
      }

      // '/' -> Focus Search Input
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // 'V' -> Toggle View Mode
      if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handleViewModeChange(viewMode === 'dense' ? 'cards' : 'dense');
        showToast(`Switched to ${viewMode === 'dense' ? 'Cards' : 'Table'} view`);
      }

      // 'A' -> Toggle Analytics
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsAnalyticsOpen((prev) => !prev);
      }

      // 'E' -> Export CSV
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportCsv();
      }

      // 'B' -> Backup JSON
      if (e.key.toLowerCase() === 'b') {
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
        const platformMatch = (item.platform || '').toLowerCase().includes(q);
        const tagsMatch =
          Array.isArray(item.tags) &&
          item.tags.some((t) => (t || '').toLowerCase().includes(q));
        return titleMatch || gameMatch || notesMatch || platformMatch || tagsMatch;
      });
    }

    if (categoryFilter) {
      list = list.filter((item) => item.category === categoryFilter);
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
  }, [entries, searchQuery, categoryFilter, statusFilter, proofFilter, sortOption]);

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

      {/* High Density Metric Strip */}
      <MetricStrip entries={entries} globalCurrency={globalCurrency} />

      {/* Analytics Drawer */}
      <AnalyticsDrawer
        isOpen={isAnalyticsOpen}
        onToggle={() => setIsAnalyticsOpen((prev) => !prev)}
        entries={entries}
        globalCurrency={globalCurrency}
      />

      {/* Main Ledger Control & Listing */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col">
        <Toolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
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
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/90 text-white text-xs font-medium border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-xl"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
