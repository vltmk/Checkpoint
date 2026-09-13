import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, X, Bookmark, Check, Users, UserPlus, Edit2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { trackerDB } from '../../lib/db';
import { Button } from './Button';
import { FrostedGlass } from './FrostedGlass';

const SAVED_TEAMMATES_KEY = 'checkpoint_saved_teammates_v1';

export function TeammatesCombobox({
  value = [],
  onChange,
  placeholder = 'Add teammate name and press Enter...',
}) {
  const { language, isRtl, formatNumber } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [savedTeammates, setSavedTeammates] = useState(() => {
    try {
      const saved = localStorage.getItem(SAVED_TEAMMATES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((t) => typeof t === 'string');
        }
      }
    } catch (e) {}
    return [];
  });

  // Hydrate saved teammates from SQLite trackerDB
  useEffect(() => {
    trackerDB.getSetting(SAVED_TEAMMATES_KEY, null).then((saved) => {
      if (saved) {
        const parsed = Array.isArray(saved) ? saved : (typeof saved === 'string' ? JSON.parse(saved) : []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((t) => typeof t === 'string');
          setSavedTeammates(clean);
          try {
            localStorage.setItem(SAVED_TEAMMATES_KEY, JSON.stringify(clean));
          } catch (e) {}
        }
      }
    }).catch(() => {});
  }, []);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const saveToStorage = (list) => {
    try {
      localStorage.setItem(SAVED_TEAMMATES_KEY, JSON.stringify(list));
      trackerDB.setSetting(SAVED_TEAMMATES_KEY, list).catch(() => {});
    } catch (e) {}
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTeammate = (nameToAdd) => {
    const trimmed = (nameToAdd || inputValue).trim();
    if (!trimmed) return;

    if (value.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInputValue('');
      return;
    }

    const updatedValue = [...value, trimmed];
    onChange?.(updatedValue);
    setInputValue('');

    // If not in saved list, automatically add it to quick list
    if (!savedTeammates.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      const updatedSaved = [trimmed, ...savedTeammates];
      setSavedTeammates(updatedSaved);
      saveToStorage(updatedSaved);
    }
  };

  const handleRemoveTeammate = (idxToRemove) => {
    const updated = value.filter((_, i) => i !== idxToRemove);
    onChange?.(updated);
  };

  const handleToggleTeammateFromList = (name) => {
    if (value.some((t) => t.toLowerCase() === name.toLowerCase())) {
      const updated = value.filter((t) => t.toLowerCase() !== name.toLowerCase());
      onChange?.(updated);
    } else {
      handleAddTeammate(name);
    }
  };

  const [editingTeammate, setEditingTeammate] = useState(null);
  const [editInputVal, setEditInputVal] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, oldTeammate: '', newTeammate: '', count: 0 });

  const startEditTeammate = (e, member) => {
    e.stopPropagation();
    setEditingTeammate(member);
    setEditInputVal(member);
  };

  const handleSaveEdit = async (oldMember, newMember) => {
    const trimmedNew = newMember.trim();
    if (!trimmedNew || trimmedNew.toLowerCase() === oldMember.toLowerCase()) {
      setEditingTeammate(null);
      return;
    }
    try {
      const count = await trackerDB.countEntriesWithTeammate(oldMember);
      if (count > 0) {
        setConfirmModal({
          open: true,
          oldTeammate: oldMember,
          newTeammate: trimmedNew,
          count,
        });
      } else {
        applyTeammateRename(oldMember, trimmedNew, false);
      }
    } catch (e) {
      applyTeammateRename(oldMember, trimmedNew, false);
    }
    setEditingTeammate(null);
  };

  const applyTeammateRename = async (oldMember, newMember, updateRecords = false) => {
    if (updateRecords) {
      try {
        await trackerDB.renameTeammateInEntries(oldMember, newMember);
      } catch (err) {
        console.error('Failed to rename teammate in entries:', err);
      }
    }
    const updatedSaved = savedTeammates.map((m) => (m.toLowerCase() === oldMember.toLowerCase() ? newMember : m));
    setSavedTeammates(updatedSaved);
    saveToStorage(updatedSaved);

    if (value.some((t) => t.toLowerCase() === oldMember.toLowerCase())) {
      const updatedValue = value.map((t) => (t.toLowerCase() === oldMember.toLowerCase() ? newMember : t));
      onChange?.(updatedValue);
    }
    setConfirmModal({ open: false, oldTeammate: '', newTeammate: '', count: 0 });
  };

  const handleDeleteSaved = (e, nameToDelete) => {
    e.stopPropagation();
    const updated = savedTeammates.filter((s) => s !== nameToDelete);
    setSavedTeammates(updated);
    saveToStorage(updated);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTeammate(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      handleRemoveTeammate(value.length - 1);
    }
  };

  const filteredSaved = savedTeammates.filter((s) =>
    s.toLowerCase().includes(inputValue.trim().toLowerCase())
  );

  return (
    <div ref={containerRef} className={cn('relative w-full space-y-1.5', isOpen ? 'z-[100]' : 'z-10')}>
      {/* Input container with chips */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="min-h-[38px] w-full p-1.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs hover:border-zinc-300 dark:hover:border-zinc-700 focus-within:border-zinc-400 dark:focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-400 dark:focus-within:ring-zinc-500 flex flex-wrap items-center gap-1.5 transition-all duration-150 cursor-text"
      >
        {/* Active Teammate Chips */}
        {value.map((name, idx) => (
          <span
            key={name + idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium"
          >
            <Users className="w-3 h-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <span>{name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTeammate(idx);
              }}
              className="p-0.5 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 transition-colors ms-0.5"
              title={language === 'fa' ? `حذف ${name}` : `Remove ${name}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {/* Input box */}
        <input
          ref={inputRef}
          type="text"
          name="checkpoint_teammate_input"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : (language === 'fa' ? 'افزودن نام بیشتر...' : 'Add more...')}
          className={cn('flex-1 min-w-[120px] bg-transparent border-0 text-zinc-800 dark:text-zinc-200 text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none p-1', isRtl && 'font-farsi')}
        />

        {/* Dropdown Toggle / Add Action */}
        <div className="flex items-center gap-0.5 ms-auto shrink-0" dir="ltr">
          {inputValue.trim() && (
            <button
              type="button"
              onClick={() => handleAddTeammate(inputValue)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={language === 'fa' ? `افزودن "${inputValue.trim()}"` : `Add "${inputValue.trim()}"`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={language === 'fa' ? 'هم‌تیمی‌های ذخیره' : 'Saved Teammates'}
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-150', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <FrostedGlass
          variant="popover"
          dir={isRtl ? 'rtl' : 'ltr'}
          className="absolute top-full left-0 right-0 z-[100] mt-1 max-h-56 overflow-y-auto rounded-xl p-1.5 space-y-1"
        >
          {inputValue.trim() && !savedTeammates.some((s) => s.toLowerCase() === inputValue.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => handleAddTeammate(inputValue)}
              className={cn('w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs text-left border border-zinc-200 dark:border-zinc-700/60 transition-colors group', isRtl && 'font-farsi text-right')}
            >
              <span className="flex items-center gap-1.5 truncate">
                <UserPlus className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300 shrink-0" />
                <span>{language === 'fa' ? 'افزودن' : 'Add'} <strong className="text-zinc-800 dark:text-zinc-200 font-medium">"{inputValue.trim()}"</strong></span>
              </span>
              <span className="text-[10px] font-medium text-zinc-400">{language === 'fa' ? 'ثبت' : 'Add'}</span>
            </button>
          )}

          <div className={cn('px-2 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between', isRtl && 'font-farsi')}>
            <span>{language === 'fa' ? `هم‌تیمی‌های ذخیره‌شده (${formatNumber(savedTeammates.length)})` : `Saved Team Members (${savedTeammates.length})`}</span>
          </div>

          {savedTeammates.length === 0 ? (
            <div className={cn('px-3 py-3 text-center text-xs text-zinc-500', isRtl && 'font-farsi')}>
              {language === 'fa' ? 'هنوز هم‌تیمی‌ای ثبت نشده است. نامی تایپ کرده و Enter بزنید.' : 'No saved teammates yet. Type a name and press Enter.'}
            </div>
          ) : filteredSaved.length > 0 ? (
            filteredSaved.map((member) => {
              const isSelected = value.some((t) => t.toLowerCase() === member.toLowerCase());
              const isEditing = editingTeammate === member;

              if (isEditing) {
                return (
                  <div
                    key={member}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={editInputVal}
                      onChange={(e) => setEditInputVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(member, editInputVal);
                        if (e.key === 'Escape') setEditingTeammate(null);
                      }}
                      className={cn(
                        'flex-1 min-w-0 h-6 px-1.5 text-xs rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400',
                        isRtl && 'font-farsi'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(member, editInputVal)}
                      className="p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title={language === 'fa' ? 'ذخیره نام جدید' : 'Save rename'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTeammate(null)}
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
                  key={member}
                  onClick={() => handleToggleTeammateFromList(member)}
                  className={cn(
                    'group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors',
                    isSelected
                      ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/90 dark:text-zinc-200 font-medium'
                      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Users className="w-3 h-3 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 shrink-0" />
                    <span className={cn('truncate', isRtl && 'font-farsi')}>{member}</span>
                  </span>

                  <div className="flex items-center gap-0.5 shrink-0 ms-2" dir="ltr">
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 me-1" />}
                    <button
                      type="button"
                      onClick={(e) => startEditTeammate(e, member)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
                      title={language === 'fa' ? `ویرایش نام "${member}"` : `Rename "${member}"`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSaved(e, member)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
                      title={language === 'fa' ? `حذف "${member}"` : `Remove "${member}" from saved teammates`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={cn('px-2.5 py-2 text-center text-xs text-zinc-500', isRtl && 'font-farsi')}>
              {language === 'fa' ? 'هم‌تیمی‌ای مطابق با جستجو یافت نشد' : 'No matching teammates found'}
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
                    ? `نام هم‌تیمی از «${confirmModal.oldTeammate}» به «${confirmModal.newTeammate}» تغییر کرد. آیا می‌خواهید در ${formatNumber(confirmModal.count)} رکورد قبلی نیز نام هم‌تیمی بروزرسانی شود؟`
                    : `You renamed teammate "${confirmModal.oldTeammate}" to "${confirmModal.newTeammate}". Would you like to update ${confirmModal.count} older work record(s) where they were part of the crew?`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setConfirmModal({ open: false, oldTeammate: '', newTeammate: '', count: 0 })}
                className={cn('w-full sm:w-auto', isRtl && 'font-farsi')}
              >
                {language === 'fa' ? 'انصراف' : 'Cancel'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => applyTeammateRename(confirmModal.oldTeammate, confirmModal.newTeammate, false)}
                className={cn('w-full sm:w-auto', isRtl && 'font-farsi')}
              >
                {language === 'fa' ? 'فقط لیست هم‌تیمی‌ها' : 'Saved List Only'}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="xs"
                onClick={() => applyTeammateRename(confirmModal.oldTeammate, confirmModal.newTeammate, true)}
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

export default TeammatesCombobox;
