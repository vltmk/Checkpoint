import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Megaphone, Check, Keyboard } from 'lucide-react';
import { PROFILES, setActiveProfileId } from '../../lib/profiles';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import { FrostedGlass } from './FrostedGlass';

export function ProfilePopover({
  isOpen,
  onClose,
  activeProfileId = 'booster',
  onProfileChange,
  boosterEntriesCount = 0,
  advertiserEntriesCount = 0,
}) {
  const { language, isRtl, formatNumber } = useLanguage();
  const popoverRef = useRef(null);
  const isFa = language === 'fa';

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSelect = (profileId) => {
    if (profileId !== activeProfileId) {
      onProfileChange?.(profileId);
    }
    onClose?.();
  };

  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
  const shortcutHint = isMac ? '⌘⇧P' : 'Ctrl+Shift+P';

  return (
    <AnimatePresence>
      {isOpen && (
        <FrostedGlass
          as="motion.div"
          variant="popover"
          ref={popoverRef}
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={{ type: 'spring', duration: 0.25, bounce: 0 }}
          data-no-drag
          dir={isRtl ? 'rtl' : 'ltr'}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-1.5 w-64 p-2 shadow-2xl rounded-xl space-y-2 z-50 text-zinc-900 dark:text-zinc-100 select-none"
        >
          {/* Header label */}
          <div className="px-2 pt-1 pb-0.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            <span className={cn(isRtl && 'font-farsi')}>{isFa ? 'انتخاب پروفایل' : 'Active Profile'}</span>
          </div>

          {/* Profile options */}
          <div className="space-y-1">
            {/* 1. Booster */}
            <button
              type="button"
              onClick={() => handleSelect('booster')}
              className={cn(
                'w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer text-left',
                isRtl && 'text-right',
                activeProfileId === 'booster'
                  ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/70 hover:text-zinc-900 dark:hover:text-zinc-200'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center shrink-0 border',
                    activeProfileId === 'booster'
                      ? 'bg-zinc-900 text-zinc-100 dark:bg-white dark:text-zinc-900 border-zinc-700 dark:border-zinc-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                  )}
                >
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('font-medium', isRtl && 'font-farsi')}>
                      {isFa ? 'بوستر' : 'Booster'}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      ({formatNumber(boosterEntriesCount)})
                    </span>
                  </div>
                  <p className={cn('text-[10px] text-zinc-400 truncate', isRtl && 'font-farsi')}>
                    {isFa ? 'سفارش‌ها و سهم تیمی' : 'Personal ledger & team splits'}
                  </p>
                </div>
              </div>

              {activeProfileId === 'booster' && (
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 ml-1.5" />
              )}
            </button>

            {/* 2. Advertiser */}
            <button
              type="button"
              onClick={() => handleSelect('advertiser')}
              className={cn(
                'w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer text-left',
                isRtl && 'text-right',
                activeProfileId === 'advertiser'
                  ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/70 hover:text-zinc-900 dark:hover:text-zinc-200'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center shrink-0 border',
                    activeProfileId === 'advertiser'
                      ? 'bg-zinc-900 text-zinc-100 dark:bg-white dark:text-zinc-900 border-zinc-700 dark:border-zinc-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                  )}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('font-medium', isRtl && 'font-farsi')}>
                      {isFa ? 'ادورتایزر' : 'Advertiser'}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      ({formatNumber(advertiserEntriesCount)})
                    </span>
                  </div>
                  <p className={cn('text-[10px] text-zinc-400 truncate', isRtl && 'font-farsi')}>
                    {isFa ? 'مشتریان، سفارش‌ها و بوسترها' : 'Clients, Order IDs & payouts'}
                  </p>
                </div>
              </div>

              {activeProfileId === 'advertiser' && (
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 ml-1.5" />
              )}
            </button>
          </div>

          {/* Footer shortcut hint */}
          <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-end text-[10px] text-zinc-400 px-1">
            <span className="inline-flex items-center gap-1 font-mono text-[9px] text-zinc-400 dark:text-zinc-500">
              <Keyboard className="w-2.5 h-2.5" />
              <span>{shortcutHint}</span>
            </span>
          </div>
        </FrostedGlass>
      )}
    </AnimatePresence>
  );
}
