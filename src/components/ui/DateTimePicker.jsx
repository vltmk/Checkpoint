import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, Zap, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

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

// Helper to format for human readable display
export function formatReadableDateTime(isoString) {
  if (!isoString) return 'Select date & time';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
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
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click or Escape
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

  // Handlers for quick presets
  const handleSetNow = (e) => {
    e?.stopPropagation?.();
    const nowIso = toLocalISOString(new Date());
    onChange?.(nowIso);
  };

  const handleSetToday = (e) => {
    e?.stopPropagation?.();
    const today = new Date();
    onChange?.(toLocalISOString(today));
  };

  const handleSetYesterday = (e) => {
    e?.stopPropagation?.();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    onChange?.(toLocalISOString(yesterday));
  };

  const handleSetOneHourAgo = (e) => {
    e?.stopPropagation?.();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    onChange?.(toLocalISOString(oneHourAgo));
  };

  // Convert raw value to local ISO format for the native input
  const normalizedValue = value ? (value.length === 16 ? value : toLocalISOString(new Date(value))) : '';

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      {/* Trigger Bar */}
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] hover:border-white/20 focus-within:border-white/30 focus-within:bg-white/[0.07] focus-within:ring-1 focus-within:ring-white/20 transition-all duration-150 cursor-pointer select-none',
          isOpen && 'border-white/30 bg-white/[0.07] ring-1 ring-white/20',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className={cn('truncate', !value && 'text-zinc-400')}>
            {formatReadableDateTime(value)}
          </span>
        </div>

        {/* 1-Click "Now" quick badge on trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleSetNow}
            title="Set to current local time"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 hover:border-emerald-500/40 active:scale-95 transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)]"
          >
            <Zap className="w-2.5 h-2.5" />
            <span>Now</span>
          </button>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-zinc-400 transition-transform duration-200',
              isOpen && 'rotate-180 text-zinc-200'
            )}
          />
        </div>
      </div>

      {/* Glass Popover with Quick Presets & Native Datetime Input */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute left-0 right-0 z-50 min-w-[260px] bg-[#09090b]/95 backdrop-blur-2xl border border-white/[0.1] shadow-2xl rounded-xl p-3 space-y-3',
              dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            )}
          >
            {/* Quick Action Presets Header */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-400" />
                  Quick Presets
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={handleSetNow}
                  className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-medium border border-emerald-500/25 transition-all active:scale-95 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                >
                  <Zap className="w-3 h-3" />
                  <span>Now</span>
                </button>
                <button
                  type="button"
                  onClick={handleSetToday}
                  className="px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-zinc-300 hover:text-white text-[11px] font-medium border border-white/[0.08] transition-all active:scale-95 text-center"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleSetYesterday}
                  className="px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-zinc-300 hover:text-white text-[11px] font-medium border border-white/[0.08] transition-all active:scale-95 text-center"
                >
                  Yesterday
                </button>
              </div>
            </div>

            {/* Custom / Native Picker */}
            <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Custom Date & Time
              </label>
              <input
                type="datetime-local"
                value={normalizedValue}
                onChange={(e) => onChange?.(e.target.value)}
                className="w-full rounded-lg bg-white/[0.06] border border-white/[0.1] px-2.5 py-1.5 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={handleSetOneHourAgo}
                className="text-[10px] text-zinc-400 hover:text-zinc-300 underline underline-offset-2 transition-colors"
              >
                -1 hour ago
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white text-black text-[11px] font-semibold hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_0_12px_rgba(255,255,255,0.1)]"
              >
                <Check className="w-3 h-3" />
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DateTimePicker;
