import React from 'react';
import { cn } from '../../lib/utils';

/**
 * CockpitStatusGradient
 *
 * Clean, ultra-minimal, language-aware, and theme-aware monochromatic linear gradient.
 * Preserves pure monochromatic surface for the dot matrix lattice and cockpit typography.
 *
 * Flow:
 * - LTR: Starts from Left -> Trailing Right
 * - RTL: Starts from Right -> Trailing Left
 */
export function CockpitStatusGradient({
  isRtl = false,
  status = 'neutral',
  className = '',
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute inset-0 pointer-events-none select-none overflow-hidden rounded-[inherit] z-0',
        className
      )}
    >
      {/* Base Monochromatic Linear Gradient (Directional: from start edge across to trailing edge) */}
      <div
        className={cn(
          'absolute inset-0',
          isRtl
            ? 'bg-gradient-to-l from-zinc-100/50 via-zinc-100/20 to-transparent dark:from-zinc-900/40 dark:via-zinc-900/15 dark:to-transparent'
            : 'bg-gradient-to-r from-zinc-100/50 via-zinc-100/20 to-transparent dark:from-zinc-900/40 dark:via-zinc-900/15 dark:to-transparent'
        )}
      />
    </div>
  );
}

export default CockpitStatusGradient;
