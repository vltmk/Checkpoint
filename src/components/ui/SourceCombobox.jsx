import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, X, Bookmark, Check, Store, Edit2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { trackerDB } from '../../lib/db';
import { Button } from './Button';
import { FrostedGlass } from './FrostedGlass';

const LEGACY_PRESETS = new Set([
  'direct client',
  'g2g',
  'funpay',
  'eldorado',
  'discord',
  'guild',
]);

const SAVED_SOURCES_KEY = 'checkpoint_user_saved_sources_v2';
const LEGACY_SAVED_SOURCES_KEY = 'vault_user_saved_sources_v2';

export function SourceCombobox({ value = '', onChange, placeholder = 'e.g. Enter seller, broker, or client...' }) {
  const { language, isRtl, formatNumber } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [savedSources, setSavedSources] = useState(() => {
    try {
      // Purge old preset key from localStorage
      localStorage.removeItem('vault_saved_sources');
      const saved = localStorage.getItem(SAVED_SOURCES_KEY) || localStorage.getItem(LEGACY_SAVED_SOURCES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((s) => typeof s === 'string' && !LEGACY_PRESETS.has(s.toLowerCase().trim()));
        }
      }
    } catch (e) {}
    return [];
  });

  // Hydrate saved sources from SQLite trackerDB
  useEffect(() => {
    trackerDB.getSetting(SAVED_SOURCES_KEY, null).then((saved) => {
      if (saved) {
        const parsed = Array.isArray(saved) ? saved : (typeof saved === 'string' ? JSON.parse(saved) : []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((s) => typeof s === 'string' && !LEGACY_PRESETS.has(s.toLowerCase().trim()));
          setSavedSources(clean);
          try {
            localStorage.setItem(SAVED_SOURCES_KEY, JSON.stringify(clean));
          } catch (e) {}
        }
      }
    }).catch(() => {});
  }, []);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const saveToStorage = (sourcesList) => {
    try {
      localStorage.setItem(SAVED_SOURCES_KEY, JSON.stringify(sourcesList));
      trackerDB.setSetting(SAVED_SOURCES_KEY, sourcesList).catch(() => {});
    } catch (e) {}
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSource = (src) => {
    onChange?.(src);
    setIsOpen(false);
  };

  const handleSaveCurrentSource = (srcToSave) => {
    const trimmed = (srcToSave || value).trim();
    if (!trimmed) return;

    if (savedSources.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    const updated = [trimmed, ...savedSources];
    setSavedSources(updated);
    saveToStorage(updated);
  };

  const [editingSource, setEditingSource] = useState(null);
  const [editInputVal, setEditInputVal] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, oldSource: '', newSource: '', count: 0 });

  const startEditSource = (e, src) => {
    e.stopPropagation();
    setEditingSource(src);
    setEditInputVal(src);
  };

  const handleSaveEdit = async (oldSrc, newSrc) => {
    const trimmedNew = newSrc.trim();
    if (!trimmedNew || trimmedNew.toLowerCase() === oldSrc.toLowerCase()) {
      setEditingSource(null);
      return;
    }
    try {
      const count = await trackerDB.countEntriesWithSource(oldSrc);
      if (count > 0) {
        setConfirmModal({
          open: true,
          oldSource: oldSrc,
          newSource: trimmedNew,
          count,
        });
      } else {
        applySourceRename(oldSrc, trimmedNew, false);
      }
    } catch (e) {
      applySourceRename(oldSrc, trimmedNew, false);
    }
    setEditingSource(null);
  };

  const applySourceRename = async (oldSrc, newSrc, updateRecords = false) => {
    if (updateRecords) {
      try {
        await trackerDB.renameSourceInEntries(oldSrc, newSrc);
      } catch (err) {
        console.error('Failed to rename source in entries:', err);
      }
    }
    const updated = savedSources.map((s) => (s.toLowerCase() === oldSrc.toLowerCase() ? newSrc : s));
    setSavedSources(updated);
    saveToStorage(updated);
    if (value.toLowerCase() === oldSrc.toLowerCase()) {
      onChange?.(newSrc);
    }
    setConfirmModal({ open: false, oldSource: '', newSource: '', count: 0 });
  };

  const handleDeleteSource = (e, srcToDelete) => {
    e.stopPropagation();
    const updated = savedSources.filter((s) => s !== srcToDelete);
    setSavedSources(updated);
    saveToStorage(updated);
  };

  const trimmedValue = value.trim();
  const isAlreadySaved = savedSources.some(
    (s) => s.toLowerCase() === trimmedValue.toLowerCase()
  );

  const filteredSources = savedSources.filter((s) =>
    s.toLowerCase().includes(trimmedValue.toLowerCase())
  );

  return (
    <div ref={containerRef} className={cn('relative w-full', isOpen && 'z-50')}>
      {/* Input Field with Dropdown Toggle & Save Bookmark Button */}
      <div className="relative flex items-center w-full">
        <input
          ref={inputRef}
          type="text"
          name="checkpoint_job_source"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            onChange?.(e.target.value);
            if (!isOpen && savedSources.length > 0) setIsOpen(true);
          }}
          onFocus={() => {
            if (savedSources.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={cn(
            'w-full h-9 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all duration-150',
            isRtl ? 'pr-3 pl-16 font-farsi' : 'pl-3 pr-16'
          )}
        />

        {/* Action icons in input */}
        <div className={cn('absolute flex items-center gap-0.5', isRtl ? 'left-1.5' : 'right-1.5')} dir="ltr">
          {trimmedValue && !isAlreadySaved && (
            <button
              type="button"
              onClick={() => handleSaveCurrentSource(trimmedValue)}
              className="p-1 rounded text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={language === 'fa' ? `ذخیره "${trimmedValue}" در سورس‌ها` : `Save "${trimmedValue}" to your saved sources`}
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={language === 'fa' ? 'نمایش سورس‌های ذخیره‌شده' : 'Show saved sources'}
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-150', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <FrostedGlass
          variant="popover"
          dir={isRtl ? 'rtl' : 'ltr'}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl p-1.5 space-y-1"
        >
          {/* Option to save new source if not already saved */}
          {trimmedValue && !isAlreadySaved && (
            <button
              type="button"
              onClick={() => handleSaveCurrentSource(trimmedValue)}
              className={cn('w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs text-left border border-zinc-200 dark:border-zinc-700/60 transition-colors group', isRtl && 'font-farsi text-right')}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Plus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{language === 'fa' ? 'ذخیره سورس' : 'Save'} <strong className="text-zinc-800 dark:text-zinc-200 font-medium">"{trimmedValue}"</strong></span>
              </span>
              <span className="text-[10px] font-medium text-zinc-400">{language === 'fa' ? 'ثبت' : 'Save'}</span>
            </button>
          )}

          <div className={cn('px-2 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between', isRtl && 'font-farsi')}>
            <span>{language === 'fa' ? `سورس‌های ذخیره (${formatNumber(savedSources.length)})` : `Saved Sources (${savedSources.length})`}</span>
          </div>

          {savedSources.length === 0 ? (
            <div className={cn('px-3 py-3 text-center text-xs text-zinc-500', isRtl && 'font-farsi')}>
              {language === 'fa' ? 'هنوز سورسی ذخیره نشده است.' : <>No saved sources yet. Type a source above and click <Bookmark className="w-3 h-3 inline text-zinc-400 mx-0.5" /> to save.</>}
            </div>
          ) : filteredSources.length > 0 ? (
            filteredSources.map((src) => {
              const isSelected = value.toLowerCase() === src.toLowerCase();
              const isEditing = editingSource === src;

              if (isEditing) {
                return (
                  <div
                    key={src}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={editInputVal}
                      onChange={(e) => setEditInputVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(src, editInputVal);
                        if (e.key === 'Escape') setEditingSource(null);
                      }}
                      className={cn(
                        'flex-1 min-w-0 h-6 px-1.5 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400',
                        isRtl && 'font-farsi'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(src, editInputVal)}
                      className="p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title={language === 'fa' ? 'ذخیره نام جدید' : 'Save rename'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSource(null)}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title={language === 'fa' ? 'انصراف' : 'Cancel'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={src}
                  onClick={() => handleSelectSource(src)}
                  className={cn(
                    'group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors',
                    isSelected
                      ? 'bg-zinc-100 text-zinc-800 font-medium dark:bg-zinc-800/90 dark:text-zinc-200'
                      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Store className="w-3 h-3 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 shrink-0" />
                    <span className={cn('truncate', isRtl && 'font-farsi')}>{src}</span>
                  </span>

                  <div className="flex items-center gap-0.5 shrink-0 ms-2" dir="ltr">
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 me-1" />}
                    <button
                      type="button"
                      onClick={(e) => startEditSource(e, src)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
                      title={language === 'fa' ? `ویرایش نام "${src}"` : `Rename "${src}"`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSource(e, src)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
                      title={language === 'fa' ? `حذف "${src}"` : `Remove "${src}" from saved sources`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={cn('px-2.5 py-2 text-center text-xs text-zinc-500', isRtl && 'font-farsi')}>
              {language === 'fa' ? 'سورسی مطابق با جستجو یافت نشد' : 'No matching sources found'}
            </div>
          )}
        </FrostedGlass>
      )}

      {/* Retroactive DB Update Confirmation Modal */}
      {confirmModal.open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/20 dark:bg-black/30 backdrop-blur-[1px] animate-in fade-in duration-150">
          <FrostedGlass variant="modal" className="w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className={cn('text-sm font-semibold text-zinc-900 dark:text-zinc-100', isRtl && 'font-farsi')}>
                  {language === 'fa' ? 'بروزرسانی رکوردهای قبلی؟' : 'Update Existing Records?'}
                </h3>
                <p className={cn('text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed', isRtl && 'font-farsi')}>
                  {language === 'fa'
                    ? `نام سورس از «${confirmModal.oldSource}» به «${confirmModal.newSource}» تغییر کرد. آیا می‌خواهید ${formatNumber(confirmModal.count)} رکورد قبلی نیز به نام جدید بروزرسانی شوند؟`
                    : `You renamed "${confirmModal.oldSource}" to "${confirmModal.newSource}". Would you like to update ${confirmModal.count} older work record(s) that use this source?`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setConfirmModal({ open: false, oldSource: '', newSource: '', count: 0 })}
                className={cn('w-full sm:w-auto', isRtl && 'font-farsi')}
              >
                {language === 'fa' ? 'انصراف' : 'Cancel'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => applySourceRename(confirmModal.oldSource, confirmModal.newSource, false)}
                className={cn('w-full sm:w-auto', isRtl && 'font-farsi')}
              >
                {language === 'fa' ? 'فقط لیست سورس‌ها' : 'Saved List Only'}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="xs"
                onClick={() => applySourceRename(confirmModal.oldSource, confirmModal.newSource, true)}
                className={cn('w-full sm:w-auto', isRtl && 'font-farsi')}
              >
                {language === 'fa' ? `بروزرسانی همه (${formatNumber(confirmModal.count)})` : `Update All (${confirmModal.count})`}
              </Button>
            </div>
          </FrostedGlass>
        </div>,
        document.body
      )}
    </div>
  );
}

export default SourceCombobox;
