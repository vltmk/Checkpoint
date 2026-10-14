import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';

let globalTooltipActive = false;
let globalTooltipWarmTimer = null;
const INITIAL_HOVER_DELAY = 220;
const WARM_GRACE_PERIOD = 350;

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  className,
  delay = INITIAL_HOVER_DELAY,
}) {
  const { isRtl } = useLanguage();
  const [visible, setVisible] = useState(false);
  const showTimerRef = React.useRef(null);

  const handleMouseEnter = () => {
    if (globalTooltipWarmTimer) {
      clearTimeout(globalTooltipWarmTimer);
      globalTooltipWarmTimer = null;
    }

    if (globalTooltipActive) {
      setVisible(true);
    } else {
      showTimerRef.current = setTimeout(() => {
        setVisible(true);
        globalTooltipActive = true;
      }, delay);
    }
  };

  const handleMouseLeave = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    setVisible(false);

    if (globalTooltipWarmTimer) {
      clearTimeout(globalTooltipWarmTimer);
    }
    globalTooltipWarmTimer = setTimeout(() => {
      globalTooltipActive = false;
      globalTooltipWarmTimer = null;
    }, WARM_GRACE_PERIOD);
  };

  const getAlignmentClasses = () => {
    if (side === 'top' || side === 'bottom') {
      const vOffset = side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
      if (align === 'start') return `${vOffset} ${isRtl ? 'right-0' : 'left-0'}`;
      if (align === 'end') return `${vOffset} ${isRtl ? 'left-0' : 'right-0'}`;
      return `${vOffset} left-1/2 -translate-x-1/2`;
    }
    const hOffset = side === 'left' ? 'right-full mr-1.5' : 'left-full ml-1.5';
    if (align === 'start') return `${hOffset} top-0`;
    if (align === 'end') return `${hOffset} bottom-0`;
    return `${hOffset} top-1/2 -translate-y-1/2`;
  };

  const getOriginClass = () => {
    if (side === 'top') {
      if (align === 'end') return isRtl ? 'origin-bottom-left' : 'origin-bottom-right';
      if (align === 'start') return isRtl ? 'origin-bottom-right' : 'origin-bottom-left';
      return 'origin-bottom';
    }
    if (side === 'bottom') {
      if (align === 'end') return isRtl ? 'origin-top-left' : 'origin-top-right';
      if (align === 'start') return isRtl ? 'origin-top-right' : 'origin-top-left';
      return 'origin-top';
    }
    if (side === 'left') {
      if (align === 'end') return 'origin-bottom-right';
      if (align === 'start') return 'origin-top-right';
      return 'origin-right';
    }
    if (align === 'end') return 'origin-bottom-left';
    if (align === 'start') return 'origin-top-left';
    return 'origin-left';
  };

  const hasCustomWrap = className && (className.includes('whitespace-') || className.includes('max-w-'));

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && content && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: globalTooltipActive ? 0.08 : 0.12, ease: [0.23, 1, 0.32, 1] }}
            dir={isRtl ? 'rtl' : 'ltr'}
            className={cn(
              'absolute z-50 px-2 py-1 text-[11px] font-medium text-zinc-900 bg-white/95 border border-zinc-200/80 dark:text-zinc-100 dark:bg-zinc-950/95 dark:border-zinc-800/80 rounded-md shadow-md pointer-events-none select-none',
              isRtl && 'font-farsi',
              !hasCustomWrap && 'whitespace-nowrap',
              getOriginClass(),
              getAlignmentClasses(),
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-mono font-medium text-zinc-600 bg-zinc-100 border border-zinc-200 dark:text-zinc-400 dark:bg-zinc-900 dark:border-zinc-800 rounded shadow-xs tracking-normal',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export default Tooltip;
