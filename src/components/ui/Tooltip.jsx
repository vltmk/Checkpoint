import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export function Tooltip({ content, children, side = 'top', className }) {
  const [visible, setVisible] = useState(false);

  const sidePositions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
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
            transition={{ duration: 0.1 }}
            className={cn(
              'absolute z-50 px-2 py-1 text-[11px] font-medium text-zinc-200 bg-zinc-900 border border-white/10 rounded shadow-xl whitespace-nowrap pointer-events-none',
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
        'inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-mono font-medium text-zinc-300 bg-white/[0.08] border border-white/[0.14] rounded shadow-[0_1px_0_1px_rgba(0,0,0,0.4)] tracking-normal',
        className
      )}
    >
      {children}
    </kbd>
  );
}
