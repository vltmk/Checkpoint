import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

let globalTooltipActive = false;
let globalTooltipWarmTimer = null;
const INITIAL_HOVER_DELAY = 220;
const WARM_GRACE_PERIOD = 350;

export function Tooltip({ content, children, side = 'top', className, delay = INITIAL_HOVER_DELAY }) {
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

  const sidePositions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: globalTooltipActive ? 0.08 : 0.12, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              'absolute z-50 px-2 py-1 text-[11px] font-medium text-zinc-800 bg-white border border-zinc-200 dark:text-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-md shadow-lg whitespace-nowrap pointer-events-none',
              side === 'top' ? 'origin-bottom' : side === 'bottom' ? 'origin-top' : side === 'left' ? 'origin-right' : 'origin-left',
              sidePositions[side],
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
        'inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-mono font-medium text-zinc-700 bg-zinc-100 border border-zinc-300 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-700/60 rounded shadow-xs tracking-normal',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export default Tooltip;
