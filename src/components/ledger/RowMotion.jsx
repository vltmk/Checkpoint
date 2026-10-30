import React, { useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { ROW } from '../../lib/motion';

/**
 * The ids that appeared since the last render of the whole ledger (not of the filtered list), so adding an order
 * animates its row in while a filter change, a tab switch or "show more" does not. Nothing is new on first render.
 */
export function useNewRowIds(allIds) {
  const prev = useRef(null);
  const fresh = useMemo(() => {
    const out = new Set();
    if (prev.current) for (const id of allIds) if (!prev.current.has(id)) out.add(id);
    return out;
  }, [allIds]);
  useEffect(() => { prev.current = new Set(allIds); }, [allIds]);
  return fresh;
}

const CLOSED = { opacity: 0, height: 0 };

// The box clips its content while it grows or folds, then lets go so focus rings and popovers are not cut off
function growProps(tag, isNew, opacity) {
  return {
    initial: isNew ? { ...CLOSED, overflow: 'hidden' } : false,
    animate: { opacity, height: 'auto' },
    exit: { ...CLOSED, overflow: 'hidden' },
    transition: ROW,
    onAnimationStart: (def) => { if (def.height === 0) tag.current.style.overflow = 'hidden'; },
    onAnimationComplete: (def) => { if (def.height === 'auto') tag.current.style.overflow = ''; },
  };
}

/** A list row that grows open when it is new and folds shut when it is removed. Pair with AnimatePresence initial={false}. */
export function MotionRow({ isNew, dimmed = false, ...props }) {
  const ref = useRef(null);
  // dimmed rows rest at 0.6: an inline opacity would beat a class
  return <motion.li ref={ref} {...growProps(ref, isNew, dimmed ? 0.6 : 1)} {...props} />;
}

/** The day group around the rows: it opens and folds as one when a day gains its first row or loses its last. */
export function MotionDay({ isNew, ...props }) {
  const ref = useRef(null);
  return <motion.section ref={ref} {...growProps(ref, isNew, 1)} {...props} />;
}
