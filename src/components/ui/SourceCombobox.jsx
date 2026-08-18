import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, X, Bookmark, Check, Store } from 'lucide-react';
import { cn } from '../../lib/utils';

const LEGACY_PRESETS = new Set([
  'direct client',
  'g2g',
  'funpay',
  'eldorado',
  'discord',
  'guild',
]);

const SAVED_SOURCES_KEY = 'vault_user_saved_sources_v2';

export function SourceCombobox({ value = '', onChange, onToast, placeholder = 'e.g. Enter seller, broker, or client...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedSources, setSavedSources] = useState(() => {
    try {
      // Purge old preset key from localStorage
      localStorage.removeItem('vault_saved_sources');
      const saved = localStorage.getItem(SAVED_SOURCES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((s) => typeof s === 'string' && !LEGACY_PRESETS.has(s.toLowerCase().trim()));
        }
      }
    } catch (e) {}
    return [];
  });

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const saveToStorage = (sourcesList) => {
    try {
      localStorage.setItem(SAVED_SOURCES_KEY, JSON.stringify(sourcesList));
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
      onToast?.(`"${trimmed}" is already in your saved sources.`);
      return;
    }

    const updated = [trimmed, ...savedSources];
    setSavedSources(updated);
    saveToStorage(updated);
    onToast?.(`⭐ Saved "${trimmed}" to your job sources!`);
  };

  const handleDeleteSource = (e, srcToDelete) => {
    e.stopPropagation();
    const updated = savedSources.filter((s) => s !== srcToDelete);
    setSavedSources(updated);
    saveToStorage(updated);
    onToast?.(`Removed "${srcToDelete}" from saved sources`);
  };

  const trimmedValue = value.trim();
  const isAlreadySaved = savedSources.some(
    (s) => s.toLowerCase() === trimmedValue.toLowerCase()
  );

  const filteredSources = savedSources.filter((s) =>
    s.toLowerCase().includes(trimmedValue.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input Field with Dropdown Toggle & Save Bookmark Button */}
      <div className="relative flex items-center w-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange?.(e.target.value);
            if (!isOpen && savedSources.length > 0) setIsOpen(true);
          }}
          onFocus={() => {
            if (savedSources.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full h-9 pl-3 pr-16 rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 hover:border-zinc-700 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-150"
        />

        {/* Action icons in input */}
        <div className="absolute right-1.5 flex items-center gap-0.5">
          {trimmedValue && !isAlreadySaved && (
            <button
              type="button"
              onClick={() => handleSaveCurrentSource(trimmedValue)}
              className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
              title={`Save "${trimmedValue}" to your saved sources`}
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Show saved sources"
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-150', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl p-1.5 space-y-1">
          {/* Option to save new source if not already saved */}
          {trimmedValue && !isAlreadySaved && (
            <button
              type="button"
              onClick={() => handleSaveCurrentSource(trimmedValue)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 text-xs text-left border border-zinc-700/60 transition-colors group"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Plus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Save <strong className="text-zinc-100 font-semibold">"{trimmedValue}"</strong></span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Save</span>
            </button>
          )}

          <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span>Saved Sources ({savedSources.length})</span>
          </div>

          {savedSources.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-zinc-500">
              No saved sources yet. Type a source above and click <Bookmark className="w-3 h-3 inline text-zinc-400 mx-0.5" /> to save.
            </div>
          ) : filteredSources.length > 0 ? (
            filteredSources.map((src) => {
              const isSelected = value.toLowerCase() === src.toLowerCase();
              return (
                <div
                  key={src}
                  onClick={() => handleSelectSource(src)}
                  className={cn(
                    'group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors',
                    isSelected
                      ? 'bg-zinc-800/90 text-zinc-100 font-medium'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100'
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Store className="w-3 h-3 text-zinc-500 group-hover:text-zinc-400" />
                    <span className="truncate">{src}</span>
                  </span>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSource(e, src)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
                      title={`Remove "${src}" from saved sources`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-2.5 py-2 text-center text-xs text-zinc-500">
              No matching sources found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SourceCombobox;
