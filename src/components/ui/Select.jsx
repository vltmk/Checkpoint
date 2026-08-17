import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  className,
  disabled = false,
  dropUp = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize options to object format
  const normalizedOptions = useMemo(() => {
    if (!options) return [];
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: opt, label: String(opt) };
      }
      return {
        value: opt.value,
        label: opt.label || opt.name || String(opt.value),
        icon: opt.icon,
        flag: opt.flag,
        subtext: opt.subtext,
        group: opt.group,
      };
    });
  }, [options]);

  // Group options if any have a group property
  const groups = useMemo(() => {
    const groupMap = new Map();
    let hasGroups = false;

    normalizedOptions.forEach((opt) => {
      if (opt.group) hasGroups = true;
      const gName = opt.group || '';
      if (!groupMap.has(gName)) {
        groupMap.set(gName, []);
      }
      groupMap.get(gName).push(opt);
    });

    if (!hasGroups) return null;

    const result = [];
    groupMap.forEach((items, groupName) => {
      result.push({ groupName, items });
    });
    return result;
  }, [normalizedOptions]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange?.(optionValue);
    setIsOpen(false);
  };

  const renderOptionItem = (option) => {
    const isSelected = String(option.value) === String(value);

    return (
      <button
        key={String(option.value)}
        type="button"
        onClick={() => handleSelect(option.value)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left group select-none',
          isSelected
            ? 'bg-white/[0.09] text-white font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
            : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {option.flag && <span className="text-sm shrink-0">{option.flag}</span>}
          {option.icon && <span className="shrink-0 text-zinc-400 group-hover:text-zinc-200">{option.icon}</span>}
          <span className="truncate">{option.label}</span>
          {option.subtext && (
            <span className="text-[10px] text-zinc-400 truncate">({option.subtext})</span>
          )}
        </div>
        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1.5" />}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] hover:border-white/20 focus:outline-none focus:border-white/30 focus:bg-white/[0.07] focus:ring-1 focus:ring-white/20 transition-all duration-150',
          isOpen && 'border-white/30 bg-white/[0.07] ring-1 ring-white/20',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {selectedOption ? (
            <>
              {selectedOption.flag && <span className="text-sm">{selectedOption.flag}</span>}
              {selectedOption.icon && <span>{selectedOption.icon}</span>}
              <span className="truncate text-zinc-100">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-zinc-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180 text-zinc-200'
          )}
        />
      </button>

      {/* Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute left-0 right-0 z-50 min-w-[180px] max-h-64 overflow-y-auto bg-[#09090b]/95 backdrop-blur-2xl border border-white/[0.1] shadow-2xl rounded-xl p-1',
              dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            )}
          >
            {groups ? (
              groups.map((group, idx) => (
                <div key={group.groupName || idx} className="py-1">
                  {group.groupName && (
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {group.groupName}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map(renderOptionItem)}
                  </div>
                  {idx < groups.length - 1 && (
                    <div className="my-1 border-b border-white/[0.06]" />
                  )}
                </div>
              ))
            ) : normalizedOptions.length > 0 ? (
              <div className="space-y-0.5">
                {normalizedOptions.map(renderOptionItem)}
              </div>
            ) : (
              <div className="px-3 py-2 text-xs text-zinc-400 text-center">
                No options available
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Select;
