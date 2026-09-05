import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';

export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  className,
  disabled = false,
  dropUp = false,
  align = 'auto', // 'auto' | 'start' | 'end' | 'left' | 'right'
}) {
  const { isRtl } = useLanguage();
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

  const renderScaledText = (text) => {
    if (typeof text !== 'string' || !text.includes('تومان')) return text;
    const parts = text.split('تومان');
    return (
      <>
        {parts.map((p, idx) => (
          <React.Fragment key={idx}>
            {p}
            {idx < parts.length - 1 && (
              <span className="text-[0.78em] font-farsi opacity-90 mx-0.5">تومان</span>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  const renderOptionItem = (option) => {
    const isSelected = String(option.value) === String(value);

    return (
      <button
        key={String(option.value)}
        type="button"
        onClick={() => handleSelect(option.value)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left select-none',
          isSelected
            ? 'bg-zinc-800 text-zinc-100 font-medium'
            : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {option.flag && <span className="text-sm shrink-0">{option.flag}</span>}
          {option.icon && <span className="shrink-0 text-zinc-400 flex items-center justify-center">{option.icon}</span>}
          <span className="truncate">{renderScaledText(option.label)}</span>
          {option.subtext && (
            <span className="text-[10px] text-zinc-500 truncate">({renderScaledText(option.subtext)})</span>
          )}
        </div>
        {isSelected && <Check className="w-3.5 h-3.5 text-zinc-100 shrink-0 ml-1.5" />}
      </button>
    );
  };

  return (
    <div ref={containerRef} className={cn('relative inline-block w-full', isOpen && 'z-50')}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'w-full h-9 flex items-center justify-between gap-2 rounded-lg bg-zinc-900/60 border border-zinc-800 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-150',
          isOpen && 'border-zinc-500 ring-1 ring-zinc-500',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {selectedOption ? (
            <>
              {selectedOption.flag && <span className="text-sm">{selectedOption.flag}</span>}
              {selectedOption.icon && <span className="shrink-0 text-zinc-400 flex items-center justify-center">{selectedOption.icon}</span>}
              <span className="truncate text-zinc-100">{renderScaledText(selectedOption.label)}</span>
            </>
          ) : (
            <span className="text-zinc-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-150',
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
            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
            dir={isRtl ? 'rtl' : 'ltr'}
            className={cn(
              'absolute z-[100] min-w-[180px] max-h-64 overflow-y-auto bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl rounded-lg p-1',
              dropUp ? 'origin-bottom' : 'origin-top',
              // Alignment handling for RTL and LTR
              align === 'left'
                ? 'left-0 right-auto text-left'
                : align === 'right'
                ? 'right-0 left-auto text-right'
                : align === 'end'
                ? isRtl
                  ? 'left-0 right-auto text-left'
                  : 'right-0 left-auto text-right'
                : isRtl
                ? 'right-0 left-auto text-right font-farsi'
                : 'left-0 right-auto text-left',
              dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            )}
          >
            {groups ? (
              groups.map((group, idx) => (
                <div key={group.groupName || idx} className="py-1">
                  {group.groupName && (
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {group.groupName}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map(renderOptionItem)}
                  </div>
                  {idx < groups.length - 1 && (
                    <div className="my-1 border-b border-zinc-800/80" />
                  )}
                </div>
              ))
            ) : normalizedOptions.length > 0 ? (
              <div className="space-y-0.5">
                {normalizedOptions.map(renderOptionItem)}
              </div>
            ) : (
              <div className="px-3 py-2 text-xs text-zinc-500 text-center">
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
