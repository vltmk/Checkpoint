import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon,
  Clock,
  Zap,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage, formatShamsiDateTime, toPersianDigits, normalizeDigits } from '../../lib/i18n';
import {
  SHAMSI_MONTHS,
  GREGORIAN_MONTHS,
  SHAMSI_WEEKDAYS,
  GREGORIAN_WEEKDAYS,
  getShamsiMonthGrid,
  getGregorianMonthGrid,
  dateToJalali,
  getRelativeDayLabel,
} from '../../lib/persianCalendar';

// Helper to convert Date to local YYYY-MM-DDTHH:mm
export function toLocalISOString(date = new Date()) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Helper to format for human readable display on triggers and labels
export function formatReadableDateTime(isoString, language = 'fa') {
  if (!isoString) return language === 'fa' ? 'انتخاب تاریخ و ساعت' : 'Select date & time';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;

  if (language === 'fa') {
    return formatShamsiDateTime(d, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function DateTimePicker({
  value,
  onChange,
  className,
  disabled = false,
  dropUp = false,
  autoScrollOnOpen = true,
}) {
  const { language, t, isRtl } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isPulsingNow, setIsPulsingNow] = useState(false);
  const containerRef = useRef(null);
  const popoverBottomRef = useRef(null);
  const hourInputRef = useRef(null);
  const minuteInputRef = useRef(null);

  // Auto-scroll modal container down when calendar opens so 'Done' button is in view
  useEffect(() => {
    if (isOpen && autoScrollOnOpen) {
      const timer = setTimeout(() => {
        if (popoverBottomRef.current) {
          popoverBottomRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      }, 60);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoScrollOnOpen]);

  // Calendar Engine Type: 'shamsi' (Solar Hijri) or 'gregorian'
  const [calendarType, setCalendarType] = useState(() => (language === 'fa' ? 'shamsi' : 'gregorian'));

  // Sync default calendar type when language changes
  useEffect(() => {
    setCalendarType(language === 'fa' ? 'shamsi' : 'gregorian');
  }, [language]);

  // Current parsed Date object
  const currentDate = useMemo(() => {
    if (!value) return new Date();
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [value]);

  // View modes: 'days' | 'months' | 'years'
  const [viewMode, setViewMode] = useState('days');

  // Navigation View Year & Month (1-indexed month)
  const [viewShamsi, setViewShamsi] = useState(() => {
    const j = dateToJalali(currentDate);
    return { year: j.jy, month: j.jm };
  });

  const [viewGregorian, setViewGregorian] = useState(() => {
    return {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
    };
  });

  // Selected Time components (string for smooth typing)
  const [timeState, setTimeState] = useState(() => {
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    return { hours, minutes };
  });

  // Keep internal calendar view & time in sync when external value changes or popover opens
  useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const j = dateToJalali(d);
      setViewShamsi({ year: j.jy, month: j.jm });
      setViewGregorian({ year: d.getFullYear(), month: d.getMonth() + 1 });
      setTimeState({
        hours: String(d.getHours()).padStart(2, '0'),
        minutes: String(d.getMinutes()).padStart(2, '0'),
      });
    }
  }, [value, isOpen]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setViewMode('days');
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setViewMode('days');
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

  // Update ISO string with new date parts while keeping current time
  const applyDateChange = (gy, gm, gd, newHours = timeState.hours, newMinutes = timeState.minutes) => {
    const h = String(parseInt(normalizeDigits(newHours), 10) || 0).padStart(2, '0');
    const m = String(parseInt(normalizeDigits(newMinutes), 10) || 0).padStart(2, '0');
    const yStr = String(gy);
    const mStr = String(gm).padStart(2, '0');
    const dStr = String(gd).padStart(2, '0');
    const newIso = `${yStr}-${mStr}-${dStr}T${h}:${m}`;
    onChange?.(newIso);
  };

  // Handlers for Shamsi day click
  const handleShamsiDayClick = (cell) => {
    const { gy, gm, gd } = cell.gregorian;
    setViewShamsi({ year: cell.jy, month: cell.jm });
    applyDateChange(gy, gm, gd);
  };

  // Handlers for Gregorian day click
  const handleGregorianDayClick = (cell) => {
    setViewGregorian({ year: cell.gy, month: cell.gm });
    applyDateChange(cell.gy, cell.gm, cell.gd);
  };

  // Navigation: Prev / Next Month
  const handlePrevMonth = (e) => {
    e?.stopPropagation();
    if (calendarType === 'shamsi') {
      setViewShamsi((prev) => {
        if (prev.month === 1) return { year: prev.year - 1, month: 12 };
        return { year: prev.year, month: prev.month - 1 };
      });
    } else {
      setViewGregorian((prev) => {
        if (prev.month === 1) return { year: prev.year - 1, month: 12 };
        return { year: prev.year, month: prev.month - 1 };
      });
    }
  };

  const handleNextMonth = (e) => {
    e?.stopPropagation();
    if (calendarType === 'shamsi') {
      setViewShamsi((prev) => {
        if (prev.month === 12) return { year: prev.year + 1, month: 1 };
        return { year: prev.year, month: prev.month + 1 };
      });
    } else {
      setViewGregorian((prev) => {
        if (prev.month === 12) return { year: prev.year + 1, month: 1 };
        return { year: prev.year, month: prev.month + 1 };
      });
    }
  };

  // Navigation: Prev / Next Year
  const handlePrevYear = (e) => {
    e?.stopPropagation();
    if (calendarType === 'shamsi') {
      setViewShamsi((prev) => ({ ...prev, year: prev.year - 1 }));
    } else {
      setViewGregorian((prev) => ({ ...prev, year: prev.year - 1 }));
    }
  };

  const handleNextYear = (e) => {
    e?.stopPropagation();
    if (calendarType === 'shamsi') {
      setViewShamsi((prev) => ({ ...prev, year: prev.year + 1 }));
    } else {
      setViewGregorian((prev) => ({ ...prev, year: prev.year + 1 }));
    }
  };

  // Select Month from Month Selector Grid
  const handleSelectMonth = (monthIdx) => {
    if (calendarType === 'shamsi') {
      setViewShamsi((prev) => ({ ...prev, month: monthIdx + 1 }));
    } else {
      setViewGregorian((prev) => ({ ...prev, month: monthIdx + 1 }));
    }
    setViewMode('days');
  };

  // Select Year from Year Selector Grid
  const handleSelectYear = (year) => {
    if (calendarType === 'shamsi') {
      setViewShamsi((prev) => ({ ...prev, year }));
    } else {
      setViewGregorian((prev) => ({ ...prev, year }));
    }
    setViewMode('days');
  };

  // Handlers for Time inputs
  const handleHourChange = (e) => {
    const raw = normalizeDigits(e.target.value).replace(/[^0-9]/g, '');
    let num = parseInt(raw, 10);
    if (isNaN(num)) {
      setTimeState((prev) => ({ ...prev, hours: '' }));
      return;
    }
    if (num > 23) num = 23;
    if (num < 0) num = 0;
    const formatted = String(num).padStart(2, '0');
    setTimeState((prev) => ({ ...prev, hours: formatted }));
    
    // Auto-advance to minutes if 2 digits entered
    if (raw.length >= 2 && minuteInputRef.current) {
      minuteInputRef.current.focus();
      minuteInputRef.current.select();
    }

    // Apply to current ISO
    applyDateChange(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate(), formatted, timeState.minutes);
  };

  const handleMinuteChange = (e) => {
    const raw = normalizeDigits(e.target.value).replace(/[^0-9]/g, '');
    let num = parseInt(raw, 10);
    if (isNaN(num)) {
      setTimeState((prev) => ({ ...prev, minutes: '' }));
      return;
    }
    if (num > 59) num = 59;
    if (num < 0) num = 0;
    const formatted = String(num).padStart(2, '0');
    setTimeState((prev) => ({ ...prev, minutes: formatted }));

    // Apply to current ISO
    applyDateChange(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate(), timeState.hours, formatted);
  };

  const stepHours = (delta) => {
    let current = parseInt(normalizeDigits(timeState.hours), 10) || 0;
    current = (current + delta + 24) % 24;
    const formatted = String(current).padStart(2, '0');
    setTimeState((prev) => ({ ...prev, hours: formatted }));
    applyDateChange(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate(), formatted, timeState.minutes);
  };

  const stepMinutes = (delta) => {
    let current = parseInt(normalizeDigits(timeState.minutes), 10) || 0;
    current = (current + delta + 60) % 60;
    const formatted = String(current).padStart(2, '0');
    setTimeState((prev) => ({ ...prev, minutes: formatted }));
    applyDateChange(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate(), timeState.hours, formatted);
  };

  const setExactMinutePreset = (min) => {
    const formatted = String(min).padStart(2, '0');
    setTimeState((prev) => ({ ...prev, minutes: formatted }));
    applyDateChange(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate(), timeState.hours, formatted);
  };

  // Handlers for quick presets
  const handleSetNow = (e) => {
    e?.stopPropagation?.();
    const now = new Date();
    const nowIso = toLocalISOString(now);
    onChange?.(nowIso);
    const j = dateToJalali(now);
    setViewShamsi({ year: j.jy, month: j.jm });
    setViewGregorian({ year: now.getFullYear(), month: now.getMonth() + 1 });
    setTimeState({
      hours: String(now.getHours()).padStart(2, '0'),
      minutes: String(now.getMinutes()).padStart(2, '0'),
    });
    setIsPulsingNow(true);
    setTimeout(() => setIsPulsingNow(false), 600);
  };

  const handleSetToday = (e) => {
    e?.stopPropagation?.();
    const today = new Date();
    const j = dateToJalali(today);
    setViewShamsi({ year: j.jy, month: j.jm });
    setViewGregorian({ year: today.getFullYear(), month: today.getMonth() + 1 });
    applyDateChange(today.getFullYear(), today.getMonth() + 1, today.getDate());
  };

  const handleSetYesterday = (e) => {
    e?.stopPropagation?.();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const j = dateToJalali(yesterday);
    setViewShamsi({ year: j.jy, month: j.jm });
    setViewGregorian({ year: yesterday.getFullYear(), month: yesterday.getMonth() + 1 });
    applyDateChange(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate());
  };

  const handleSetOneHourAgo = (e) => {
    e?.stopPropagation?.();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const j = dateToJalali(oneHourAgo);
    setViewShamsi({ year: j.jy, month: j.jm });
    setViewGregorian({ year: oneHourAgo.getFullYear(), month: oneHourAgo.getMonth() + 1 });
    const h = String(oneHourAgo.getHours()).padStart(2, '0');
    const m = String(oneHourAgo.getMinutes()).padStart(2, '0');
    setTimeState({ hours: h, minutes: m });
    applyDateChange(oneHourAgo.getFullYear(), oneHourAgo.getMonth() + 1, oneHourAgo.getDate(), h, m);
  };

  // Selected date components for matching
  const currentJalali = useMemo(() => dateToJalali(currentDate), [currentDate]);

  // Calendar Grids
  const shamsiGrid = useMemo(
    () => getShamsiMonthGrid(viewShamsi.year, viewShamsi.month),
    [viewShamsi.year, viewShamsi.month]
  );

  const gregorianGrid = useMemo(
    () => getGregorianMonthGrid(viewGregorian.year, viewGregorian.month),
    [viewGregorian.year, viewGregorian.month]
  );

  // Year Picker Range (12-year window centered around current view year)
  const currentViewYear = calendarType === 'shamsi' ? viewShamsi.year : viewGregorian.year;
  const yearStart = Math.floor(currentViewYear / 12) * 12;
  const yearsList = useMemo(() => {
    const list = [];
    for (let y = yearStart - 1; y <= yearStart + 10; y++) {
      list.push(y);
    }
    return list;
  }, [yearStart]);

  // Current relative label
  const relativeLabel = getRelativeDayLabel(currentDate, calendarType === 'shamsi');

  return (
    <div ref={containerRef} className={cn('relative inline-block w-full', isOpen && 'z-50')}>
      {/* Trigger Bar */}
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'w-full h-9 flex items-center justify-between gap-2 rounded-lg bg-zinc-900/60 border border-zinc-800 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500 transition-all duration-150 cursor-pointer select-none',
          isOpen && 'border-zinc-500 ring-1 ring-zinc-500',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <CalendarIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className={cn('truncate text-xs', !value && 'text-zinc-500', isRtl && 'font-farsi')}>
            {formatReadableDateTime(value, language)}
          </span>
          {relativeLabel && (
            <span className="hidden sm:inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
              {relativeLabel}
            </span>
          )}
        </div>

        {/* 1-Click "Now" quick badge on trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleSetNow}
            title={t('common.now')}
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all active:scale-95 border',
              isRtl && 'font-farsi',
              isPulsingNow
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500 ring-2 ring-emerald-500/50 scale-105'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 border-zinc-700/50'
            )}
          >
            {isPulsingNow ? (
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <Zap className="w-2.5 h-2.5" />
            )}
            <span>{t('common.now')}</span>
          </button>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-zinc-400 transition-transform duration-150',
              isOpen && 'rotate-180 text-zinc-200'
            )}
          />
        </div>
      </div>

      {/* Popover with Custom Calendar & Time Picker */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              'absolute left-0 sm:left-auto right-0 z-50 w-full sm:w-[320px] bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl rounded-xl p-3 space-y-3',
              dropUp ? 'origin-bottom' : 'origin-top',
              dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            )}
          >
            {/* 1. Quick Presets Header */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider text-zinc-400', isRtl && 'font-farsi')}>
                  {t('common.quickPresets')}
                </span>
              </div>

              {/* Dual Calendar Switcher Pill (Shamsi / Gregorian) */}
              <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-md text-[10px]" dir="ltr">
                <button
                  type="button"
                  onClick={() => {
                    setCalendarType('shamsi');
                    setViewMode('days');
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                    calendarType === 'shamsi'
                      ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {t('calendar.shamsi')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalendarType('gregorian');
                    setViewMode('days');
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                    calendarType === 'gregorian'
                      ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {t('calendar.gregorian')}
                </button>
              </div>
            </div>

            {/* Quick Action Preset Pills */}
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={handleSetNow}
                className={cn(
                  'inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all active:scale-95 border',
                  isRtl && 'font-farsi',
                  isPulsingNow
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800'
                )}
              >
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                <span>{t('common.now')}</span>
              </button>
              <button
                type="button"
                onClick={handleSetToday}
                className={cn(
                  'px-1.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-[11px] font-medium border border-zinc-800 transition-all active:scale-95 text-center',
                  isRtl && 'font-farsi'
                )}
              >
                {t('common.today')}
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className={cn(
                  'px-1.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-[11px] font-medium border border-zinc-800 transition-all active:scale-95 text-center',
                  isRtl && 'font-farsi'
                )}
              >
                {t('common.yesterday')}
              </button>
              <button
                type="button"
                onClick={handleSetOneHourAgo}
                className={cn(
                  'px-1 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-[10px] font-medium border border-zinc-800 transition-all active:scale-95 text-center truncate',
                  isRtl && 'font-farsi'
                )}
              >
                {t('common.hourAgo')}
              </button>
            </div>

            {/* 2. Interactive Calendar Component */}
            <div className="space-y-2 bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-2">
              {/* Calendar Month & Year Navigation Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevYear}
                    title="Previous Year"
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Clickable Month & Year Header */}
                <div className="flex items-center gap-1.5 font-medium text-xs text-zinc-200 select-none">
                  <button
                    type="button"
                    onClick={() => setViewMode((prev) => (prev === 'months' ? 'days' : 'months'))}
                    className={cn(
                      'px-1.5 py-0.5 rounded hover:bg-zinc-800 text-zinc-200 hover:text-zinc-100 transition-colors cursor-pointer',
                      viewMode === 'months' && 'bg-zinc-800 text-amber-300 font-semibold',
                      calendarType === 'shamsi' && 'font-farsi'
                    )}
                  >
                    {calendarType === 'shamsi'
                      ? SHAMSI_MONTHS[viewShamsi.month - 1]
                      : GREGORIAN_MONTHS[viewGregorian.month - 1]}
                  </button>
                  <span className="text-zinc-600">/</span>
                  <button
                    type="button"
                    onClick={() => setViewMode((prev) => (prev === 'years' ? 'days' : 'years'))}
                    className={cn(
                      'px-1.5 py-0.5 rounded hover:bg-zinc-800 font-mono text-zinc-200 hover:text-zinc-100 transition-colors cursor-pointer',
                      viewMode === 'years' && 'bg-zinc-800 text-amber-300 font-semibold',
                      calendarType === 'shamsi' && 'font-farsi'
                    )}
                  >
                    {calendarType === 'shamsi'
                      ? toPersianDigits(viewShamsi.year)
                      : viewGregorian.year}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    title="Next Month"
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextYear}
                    title="Next Year"
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* View 1: Days Grid */}
              {viewMode === 'days' && (
                <div className="space-y-1">
                  {/* Weekday Headers */}
                  <div
                    className={cn(
                      'grid grid-cols-7 text-center text-[10px] font-semibold text-zinc-500 py-0.5 border-b border-zinc-800/60',
                      calendarType === 'shamsi' && 'font-farsi'
                    )}
                  >
                    {(calendarType === 'shamsi' ? SHAMSI_WEEKDAYS : GREGORIAN_WEEKDAYS).map((wd) => (
                      <div
                        key={wd.label}
                        className={cn('py-0.5', wd.isWeekend && 'text-rose-400/80')}
                        title={wd.full}
                      >
                        {wd.label}
                      </div>
                    ))}
                  </div>

                  {/* 7-column Days Grid */}
                  <div
                    className={cn(
                      'grid grid-cols-7 gap-1 text-center text-xs',
                      calendarType === 'shamsi' && 'font-farsi'
                    )}
                  >
                    {calendarType === 'shamsi'
                      ? shamsiGrid.map((cell, idx) => {
                          const isSelected =
                            currentJalali.jy === cell.jy &&
                            currentJalali.jm === cell.jm &&
                            currentJalali.jd === cell.jd;

                          return (
                            <button
                              key={`shamsi_${cell.jy}_${cell.jm}_${cell.jd}_${idx}`}
                              type="button"
                              onClick={() => handleShamsiDayClick(cell)}
                              className={cn(
                                'h-7 w-full flex items-center justify-center rounded-md text-[11px] font-medium transition-all cursor-pointer relative',
                                !cell.isCurrentMonth && 'text-zinc-600 hover:text-zinc-400',
                                cell.isCurrentMonth && !isSelected && 'text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100',
                                cell.isWeekend && cell.isCurrentMonth && !isSelected && 'text-rose-300/90',
                                cell.isToday && !isSelected && 'border border-zinc-600 font-bold',
                                isSelected && 'bg-zinc-200 text-zinc-900 font-bold shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-100'
                              )}
                            >
                              <span>{toPersianDigits(cell.jd)}</span>
                              {cell.isToday && !isSelected && (
                                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-400" />
                              )}
                            </button>
                          );
                        })
                      : gregorianGrid.map((cell, idx) => {
                          const isSelected =
                            currentDate.getFullYear() === cell.gy &&
                            currentDate.getMonth() + 1 === cell.gm &&
                            currentDate.getDate() === cell.gd;

                          return (
                            <button
                              key={`greg_${cell.gy}_${cell.gm}_${cell.gd}_${idx}`}
                              type="button"
                              onClick={() => handleGregorianDayClick(cell)}
                              className={cn(
                                'h-7 w-full flex items-center justify-center rounded-md text-[11px] font-medium transition-all cursor-pointer relative font-mono',
                                !cell.isCurrentMonth && 'text-zinc-600 hover:text-zinc-400',
                                cell.isCurrentMonth && !isSelected && 'text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100',
                                cell.isWeekend && cell.isCurrentMonth && !isSelected && 'text-rose-300/90',
                                cell.isToday && !isSelected && 'border border-zinc-600 font-bold',
                                isSelected && 'bg-zinc-200 text-zinc-900 font-bold shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-100'
                              )}
                            >
                              <span>{cell.gd}</span>
                              {cell.isToday && !isSelected && (
                                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-400" />
                              )}
                            </button>
                          );
                        })}
                  </div>
                </div>
              )}

              {/* View 2: Quick Month Selector Grid */}
              {viewMode === 'months' && (
                <div
                  className={cn(
                    'grid grid-cols-3 gap-1.5 p-1',
                    calendarType === 'shamsi' && 'font-farsi'
                  )}
                >
                  {(calendarType === 'shamsi' ? SHAMSI_MONTHS : GREGORIAN_MONTHS).map((mName, idx) => {
                    const activeMonth = calendarType === 'shamsi' ? viewShamsi.month : viewGregorian.month;
                    const isCurrent = activeMonth === idx + 1;
                    return (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => handleSelectMonth(idx)}
                        className={cn(
                          'py-2 px-1 rounded-md text-xs font-medium transition-all text-center cursor-pointer border',
                          isCurrent
                            ? 'bg-zinc-200 text-zinc-900 font-bold border-zinc-200'
                            : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border-zinc-800'
                        )}
                      >
                        {mName}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* View 3: Quick Year Selector Grid */}
              {viewMode === 'years' && (
                <div
                  className={cn(
                    'grid grid-cols-3 gap-1.5 p-1',
                    calendarType === 'shamsi' && 'font-farsi'
                  )}
                >
                  {yearsList.map((yr) => {
                    const activeYear = calendarType === 'shamsi' ? viewShamsi.year : viewGregorian.year;
                    const isCurrent = activeYear === yr;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => handleSelectYear(yr)}
                        className={cn(
                          'py-2 px-1 rounded-md text-xs font-mono font-medium transition-all text-center cursor-pointer border',
                          isCurrent
                            ? 'bg-zinc-200 text-zinc-900 font-bold border-zinc-200'
                            : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border-zinc-800'
                        )}
                      >
                        {calendarType === 'shamsi' ? toPersianDigits(yr) : yr}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Integrated High-Density Time Selector */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider text-zinc-400', isRtl && 'font-farsi')}>
                  {t('calendar.time')}
                </span>
              </div>

              <div className="flex items-center gap-1.5" dir="ltr">
                {/* Hours Box */}
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md px-1 py-0.5">
                  <input
                    ref={hourInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={timeState.hours}
                    onChange={handleHourChange}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        stepHours(1);
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        stepHours(-1);
                      }
                    }}
                    placeholder="12"
                    className="w-6 bg-transparent text-center text-xs font-mono font-semibold text-zinc-200 focus:outline-none focus:text-zinc-100"
                  />
                  <div className="flex flex-col ml-0.5">
                    <button
                      type="button"
                      onClick={() => stepHours(1)}
                      className="text-[8px] text-zinc-400 hover:text-zinc-100 p-0.5 leading-none"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => stepHours(-1)}
                      className="text-[8px] text-zinc-400 hover:text-zinc-100 p-0.5 leading-none"
                    >
                      ▼
                    </button>
                  </div>
                </div>

                <span className="text-zinc-500 font-mono font-bold">:</span>

                {/* Minutes Box */}
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md px-1 py-0.5">
                  <input
                    ref={minuteInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={timeState.minutes}
                    onChange={handleMinuteChange}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        stepMinutes(1);
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        stepMinutes(-1);
                      }
                    }}
                    placeholder="00"
                    className="w-6 bg-transparent text-center text-xs font-mono font-semibold text-zinc-200 focus:outline-none focus:text-zinc-100"
                  />
                  <div className="flex flex-col ml-0.5">
                    <button
                      type="button"
                      onClick={() => stepMinutes(1)}
                      className="text-[8px] text-zinc-400 hover:text-zinc-100 p-0.5 leading-none"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => stepMinutes(-1)}
                      className="text-[8px] text-zinc-400 hover:text-zinc-100 p-0.5 leading-none"
                    >
                      ▼
                    </button>
                  </div>
                </div>

                {/* Minute Quick Rounding Pills */}
                <div className="flex items-center gap-1 ml-1">
                  {[0, 15, 30, 45].map((mVal) => (
                    <button
                      key={mVal}
                      type="button"
                      onClick={() => setExactMinutePreset(mVal)}
                      className={cn(
                        'px-1 py-0.5 rounded text-[9px] font-mono transition-colors border',
                        parseInt(timeState.minutes, 10) === mVal
                          ? 'bg-zinc-800 text-zinc-100 border-zinc-700 font-bold'
                          : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800/80'
                      )}
                    >
                      :{String(mVal).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Bottom Action Bar with Confirmation */}
            <div ref={popoverBottomRef} className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <div className="text-[11px] text-zinc-400 font-medium truncate max-w-[180px]">
                <span className={cn(calendarType === 'shamsi' && 'font-farsi')}>
                  {formatReadableDateTime(value, calendarType === 'shamsi' ? 'fa' : 'en')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setViewMode('days');
                }}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1 rounded-md bg-zinc-200 text-zinc-900 text-[11px] font-semibold hover:bg-zinc-100 transition-all active:scale-95 cursor-pointer shadow-sm',
                  isRtl && 'font-farsi'
                )}
              >
                <Check className="w-3 h-3" />
                <span>{t('common.done')}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DateTimePicker;
