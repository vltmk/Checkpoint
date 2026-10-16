import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { TomanIcon } from './Icons';

export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  className,
  disabled = false,
  dropUp = false,
  align = 'auto', // 'auto' | 'start' | 'end' | 'left' | 'right'
  prefixIcon = null,
  ariaLabel,
}) {
  const { isRtl } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [effectiveAlign, setEffectiveAlign] = useState(isRtl ? 'right' : 'left');
  const [effectiveDropUp, setEffectiveDropUp] = useState(dropUp);
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  // Measure boundaries on open to prevent modal or viewport overflow
  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    const minWidth = 180;
    const popoverWidth = Math.max(minWidth, popoverRef.current?.offsetWidth || minWidth);
    const padding = 8;

    // Check boundary of closest dialog/modal if inside one, or window viewport
    const dialogEl = el.closest('.overflow-hidden, [role="dialog"]');
    const scrollParent = el.closest('.overflow-y-auto, [role="dialog"]');
    const boundaryLeft = dialogEl ? dialogEl.getBoundingClientRect().left + padding : padding;
    const boundaryRight = dialogEl ? dialogEl.getBoundingClientRect().right - padding : window.innerWidth - padding;

    let targetAlign = 'left';
    if (align === 'left') {
      targetAlign = 'left';
    } else if (align === 'right') {
      targetAlign = 'right';
    } else if (align === 'end') {
      targetAlign = isRtl ? 'left' : 'right';
    } else {
      // align === 'auto' or 'start'
      targetAlign = isRtl ? 'right' : 'left';
    }

    // Dynamic collision detection to prevent overflow out of dialog/viewport
    if (targetAlign === 'right' && rect.right - popoverWidth < boundaryLeft) {
      if (rect.left + popoverWidth <= boundaryRight || (boundaryRight - rect.left > rect.right - boundaryLeft)) {
        targetAlign = 'left';
      }
    } else if (targetAlign === 'left' && rect.left + popoverWidth > boundaryRight) {
      if (rect.right - popoverWidth >= boundaryLeft || (rect.right - boundaryLeft > boundaryRight - rect.left)) {
        targetAlign = 'right';
      }
    }

    setEffectiveAlign(targetAlign);

    // Dynamic vertical collision detection
    const boundaryBottom = scrollParent
      ? scrollParent.getBoundingClientRect().bottom - padding
      : window.innerHeight - padding;
    const boundaryTop = scrollParent
      ? scrollParent.getBoundingClientRect().top + padding
      : padding;
    const popoverHeight = 256;
    const spaceBelow = boundaryBottom - rect.bottom;
    const spaceAbove = rect.top - boundaryTop;

    setEffectiveDropUp(dropUp || (spaceBelow < popoverHeight && spaceAbove > spaceBelow));
  }, [isOpen, align, isRtl, dropUp]);

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
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
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
              <span className="inline-flex items-center self-center mx-0.5" title="تومان">
                <TomanIcon className="w-[24px] h-[24px] min-w-[24px] min-h-[24px] inline-block align-middle text-current opacity-90" />
              </span>
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
          'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors select-none',
          isRtl ? 'text-right font-farsi' : 'text-left',
          isSelected
            ? 'bg-zinc-100 text-zinc-800 font-medium dark:bg-zinc-800 dark:text-zinc-200'
            : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
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
        {isSelected && <Check className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200 shrink-0 ms-1.5" />}
      </button>
    );
  };

  return (
    <div ref={containerRef} className={cn('relative inline-block w-full', isOpen && 'z-50')}>
      {/* Trigger Button */}
      <button
        type="button"
        aria-label={ariaLabel}
        dir={isRtl ? 'rtl' : 'ltr'}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'w-full h-9 flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 px-3 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all duration-150',
          isRtl && 'font-farsi',
          isOpen && 'border-zinc-400 dark:border-zinc-500 ring-1 ring-zinc-400 dark:ring-zinc-500',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {prefixIcon && <span className="shrink-0 flex items-center justify-center text-zinc-400 dark:text-zinc-500">{prefixIcon}</span>}
          {selectedOption ? (
            <>
              {selectedOption.flag && <span className="text-sm">{selectedOption.flag}</span>}
              {!prefixIcon && selectedOption.icon && <span className="shrink-0 text-zinc-400 flex items-center justify-center">{selectedOption.icon}</span>}
              <span className="truncate text-zinc-800 dark:text-zinc-200">{renderScaledText(selectedOption.label)}</span>
            </>
          ) : (
            <span className="text-zinc-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-150',
            isOpen && 'rotate-180 text-zinc-600 dark:text-zinc-200'
          )}
        />
      </button>

      {/* Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: effectiveDropUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: effectiveDropUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
            dir={isRtl ? 'rtl' : 'ltr'}
            className={cn(
              'absolute z-[100] min-w-[180px] max-h-64 overflow-y-auto p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl',
              effectiveDropUp ? 'origin-bottom' : 'origin-top',
              // Boundary and alignment handling
              effectiveAlign === 'left'
                ? 'left-0 right-auto'
                : 'right-0 left-auto',
              isRtl ? 'text-right font-farsi' : 'text-left',
              effectiveDropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            )}
          >
            {groups ? (
              groups.map((group, idx) => (
                <div key={group.groupName || idx} className="py-1">
                  {group.groupName && (
                    <div className={cn('px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                      {group.groupName}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map(renderOptionItem)}
                  </div>
                  {idx < groups.length - 1 && (
                    <div className="my-1 border-b border-zinc-200 dark:border-zinc-800/80" />
                  )}
                </div>
              ))
            ) : normalizedOptions.length > 0 ? (
              <div className="space-y-0.5">
                {normalizedOptions.map(renderOptionItem)}
              </div>
            ) : (
              <div className={cn('px-3 py-2 text-xs text-zinc-500 text-center', isRtl && 'font-farsi')}>
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
