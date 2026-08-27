import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, X, Bookmark, Check, Users, UserPlus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';

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
    return ['ShadowPriest', 'TankGod', 'AuraHealer', 'FrostMage'];
  });

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const saveToStorage = (list) => {
    try {
      localStorage.setItem(SAVED_TEAMMATES_KEY, JSON.stringify(list));
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
    <div ref={containerRef} className={cn('relative w-full space-y-1.5', isOpen ? 'z-50' : 'z-10')}>
      {/* Input container with chips */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="min-h-[38px] w-full p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-100 text-xs hover:border-zinc-700 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500 flex flex-wrap items-center gap-1.5 transition-all duration-150 cursor-text"
      >
        {/* Active Teammate Chips */}
        {value.map((name, idx) => (
          <span
            key={name + idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-medium"
          >
            <Users className="w-3 h-3 text-zinc-400 shrink-0" />
            <span>{name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTeammate(idx);
              }}
              className="p-0.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700/60 transition-colors ml-0.5"
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
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : (language === 'fa' ? 'افزودن نام بیشتر...' : 'Add more...')}
          className={cn('flex-1 min-w-[120px] bg-transparent border-0 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none p-1', isRtl && 'font-farsi')}
        />

        {/* Dropdown Toggle / Add Action */}
        <div className="flex items-center gap-0.5 ml-auto shrink-0" dir="ltr">
          {inputValue.trim() && (
            <button
              type="button"
              onClick={() => handleAddTeammate(inputValue)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title={language === 'fa' ? `افزودن "${inputValue.trim()}"` : `Add "${inputValue.trim()}"`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title={language === 'fa' ? 'هم‌تیمی‌های ذخیره' : 'Saved Teammates'}
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-150', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-xl bg-zinc-950 border border-zinc-700 shadow-2xl p-1.5 space-y-1"
        >
          {inputValue.trim() && !savedTeammates.some((s) => s.toLowerCase() === inputValue.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => handleAddTeammate(inputValue)}
              className={cn('w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs text-left border border-zinc-700/60 transition-colors group', isRtl && 'font-farsi text-right')}
            >
              <span className="flex items-center gap-1.5 truncate">
                <UserPlus className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                <span>{language === 'fa' ? 'افزودن' : 'Add'} <strong className="text-zinc-100 font-semibold">"{inputValue.trim()}"</strong></span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">{language === 'fa' ? 'ثبت' : 'Add'}</span>
            </button>
          )}

          <div className={cn('px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between', isRtl && 'font-farsi')}>
            <span>{language === 'fa' ? `هم‌تیمی‌های ذخیره‌شده (${formatNumber(savedTeammates.length)})` : `Saved Team Members (${savedTeammates.length})`}</span>
          </div>

          {savedTeammates.length === 0 ? (
            <div className={cn('px-3 py-3 text-center text-xs text-zinc-500', isRtl && 'font-farsi')}>
              {language === 'fa' ? 'هنوز هم‌تیمی‌ای ثبت نشده است. نامی تایپ کرده و Enter بزنید.' : 'No saved teammates yet. Type a name and press Enter.'}
            </div>
          ) : filteredSaved.length > 0 ? (
            filteredSaved.map((member) => {
              const isSelected = value.some((t) => t.toLowerCase() === member.toLowerCase());
              return (
                <div
                  key={member}
                  onClick={() => handleToggleTeammateFromList(member)}
                  className={cn(
                    'group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors',
                    isSelected
                      ? 'bg-zinc-800/90 text-zinc-100 font-medium'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100'
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Users className="w-3 h-3 text-zinc-500 group-hover:text-zinc-400 shrink-0" />
                    <span className="truncate">{member}</span>
                  </span>

                  <div className="flex items-center gap-1 shrink-0 ml-2" dir="ltr">
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSaved(e, member)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
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
        </div>
      )}
    </div>
  );
}

export default TeammatesCombobox;
