import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Minimal Monochromatic Cockpit Ambient Gradient
 *
 * Provides a very slow, continuous GPU-accelerated rotation around
 * the Total Income section of the cockpit card.
 *
 * Designed according to Emil Kowalski's animation guidelines:
 * - Continuous circular motion uses 'linear' timing to guarantee zero hitches or snaps
 * - Off-main-thread GPU transform composition (translate + rotate)
 * - Calibrated monochromatic depth for both Dark and Light themes
 * - RTL-aware center of rotation positioned around the total income display
 * - Respects prefers-reduced-motion
 */
export function CockpitAmbientGradient({ isRtl = false, className = '' }) {
  const centerLeft = isRtl ? 'calc(100% - 135px)' : '135px';
  const centerTop = '70px';

  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute inset-0 pointer-events-none select-none overflow-hidden rounded-[inherit] z-0',
        className
      )}
    >
      {/* 1. Stationary Soft Ambient Core at Total Income */}
      <div
        className="hidden dark:block absolute w-[360px] h-[220px] -translate-x-1/2 -translate-y-1/2"
        style={{
          left: centerLeft,
          top: centerTop,
          background:
            'radial-gradient(ellipse 180px 110px at center, rgba(255, 255, 255, 0.025) 0%, transparent 70%)',
        }}
      />
      <div
        className="block dark:hidden absolute w-[360px] h-[220px] -translate-x-1/2 -translate-y-1/2"
        style={{
          left: centerLeft,
          top: centerTop,
          background:
            'radial-gradient(ellipse 180px 110px at center, rgba(24, 24, 27, 0.018) 0%, transparent 70%)',
        }}
      />

      {/* 2. Very Slow Orbiting Ambient Highlight rotating around Total Income */}
      {/* Dark mode */}
      <div
        className="hidden dark:block absolute w-[560px] h-[560px] animate-cockpit-rotate"
        style={{
          left: centerLeft,
          top: centerTop,
          background:
            'radial-gradient(ellipse 240px 170px at 66% 34%, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.016) 45%, transparent 75%)',
        }}
      />

      {/* Light mode */}
      <div
        className="block dark:hidden absolute w-[560px] h-[560px] animate-cockpit-rotate"
        style={{
          left: centerLeft,
          top: centerTop,
          background:
            'radial-gradient(ellipse 240px 170px at 66% 34%, rgba(24, 24, 27, 0.038) 0%, rgba(24, 24, 27, 0.011) 45%, transparent 75%)',
        }}
      />
    </div>
  );
}

