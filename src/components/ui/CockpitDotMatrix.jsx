import React, { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '../../lib/utils';

/**
 * CockpitDotMatrix
 *
 * Monochromatic high-density 30-degree animated dot matrix for the Ledger cockpit card.
 *
 * Engineered according to:
 * - AGENTS.md (monochromatic aesthetic, dual-theme support, offline resilience)
 * - Emil Kowalski's animation philosophy (calm purposeful motion, GPU-accelerated, tab-pause)
 * - Apple Design guidelines (sub-pixel Windows DPI scaling, harmonic sin² breathing,
 *   typography contrast clearance, smooth theme cross-fades, multi-signal accessibility)
 */
export function CockpitDotMatrix({ isRtl = false, className = '' }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const { resolvedTheme } = useTheme();

  // Animation & state tracking refs (survives re-renders without triggering RAF resets)
  const rafIdRef = useRef(null);
  const dotsRef = useRef([]);
  const activeDotsRef = useRef(new Map());
  const dimmedDotsRef = useRef(new Map());
  const dimensionsRef = useRef({ width: 0, height: 0, dpr: 1 });
  const currentRgbRef = useRef([255, 255, 255]);
  const lastTimeRef = useRef(performance.now());
  const isReducedMotionRef = useRef(false);
  const isHighContrastRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // 1. 30-Degree Dot Lattice Generation with Sub-pixel Windows DPI Snapping
    const ANGLE = (30 * Math.PI) / 180;
    const COS_T = Math.cos(ANGLE);
    const SIN_T = Math.sin(ANGLE);
    const PITCH = 22;
    const RADIUS = 1.4;
    const TAU = Math.PI * 2;

    const generateDots = (width, height, dpr) => {
      const cx = width / 2;
      const cy = height / 2;
      const diag = Math.hypot(width, height);
      const halfDiag = diag / 2;

      // Optical focal center around Total Earned balance
      const cx0 = isRtl ? Math.max(0, width - 125) : Math.min(width, 125);
      const cy0 = 55;
      const maxDist = Math.max(width * 0.85, 340);

      const dots = [];

      for (let u = -halfDiag - PITCH; u <= halfDiag + PITCH; u += PITCH) {
        for (let v = -halfDiag - PITCH; v <= halfDiag + PITCH; v += PITCH) {
          // World Cartesian coordinates rotated by 30°
          const x = cx + u * COS_T - v * SIN_T;
          const y = cy + u * SIN_T + v * COS_T;

          // Only keep points within visible card boundaries (with small padding)
          if (x >= -2 && x <= width + 2 && y >= -2 && y <= height + 2) {
            // Apple Craft §11: Sub-pixel snapping to device-pixel boundaries for Windows fractional scaling
            const px = Math.round(x * dpr) / dpr;
            const py = Math.round(y * dpr) / dpr;

            // Optical radial falloff from Total Earned focal point (higher base visibility across card)
            const dx = x - cx0;
            const dy = y - cy0;
            const dist = Math.hypot(dx * 0.75, dy * 1.15);
            const normDist = Math.min(1, dist / maxDist);
            const falloff = 0.45 + 0.55 * Math.pow(1 - normDist, 1.2);

            // Apple Materials & Hierarchy §12, §15: Typography vibrancy protection
            const isNearPrimaryText = Math.abs(dx) < 80 && dy >= -8 && dy <= 38;
            const textClearance = isNearPrimaryText ? 0.75 : 1.0;

            dots.push({
              x,
              y,
              px,
              py,
              falloff,
              textClearance,
            });
          }
        }
      }

      return { dots, cx0, cy0, maxDist };
    };

    let gridMeta = { cx0: 125, cy0: 55, maxDist: 340 };

    // 2. Frame Rendering Function
    const renderFrame = (now, isStatic = false) => {
      const { width, height, dpr } = dimensionsRef.current;
      const dots = dotsRef.current;
      if (width <= 0 || height <= 0 || dots.length === 0) return;

      ctx.save();
      // Scale canvas coordinate space to logical CSS pixels for razor-sharp rendering
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Determine active theme color (Dark vs Light)
      const isDark =
        resolvedTheme === 'dark' ||
        (!resolvedTheme && document.documentElement.classList.contains('dark'));
      const targetR = isDark ? 255 : 24;
      const targetG = isDark ? 255 : 24;
      const targetB = isDark ? 255 : 27;

      // Apple Continuity §16: Smooth 250ms exponential theme cross-fade
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      const lerpFactor = 1 - Math.exp(-dt * 12);
      currentRgbRef.current[0] += (targetR - currentRgbRef.current[0]) * lerpFactor;
      currentRgbRef.current[1] += (targetG - currentRgbRef.current[1]) * lerpFactor;
      currentRgbRef.current[2] += (targetB - currentRgbRef.current[2]) * lerpFactor;

      const r = Math.round(currentRgbRef.current[0]);
      const g = Math.round(currentRgbRef.current[1]);
      const b = Math.round(currentRgbRef.current[2]);

      // Base idle opacities (brighter faded dots for clear tactile matrix presence)
      let baseAlpha = isDark ? 0.13 : 0.11;
      if (isHighContrastRef.current) {
        baseAlpha += 0.04;
      }

      // 1st Layer: Pure Base Idle Dots (only dots not actively brightening or fading to black)
      const activeMap = activeDotsRef.current;
      const dimmedMap = dimmedDotsRef.current;

      ctx.beginPath();
      for (let i = 0; i < dots.length; i++) {
        if (activeMap.has(i) || dimmedMap.has(i)) continue;
        const dot = dots[i];
        ctx.moveTo(dot.px + RADIUS, dot.py);
        ctx.arc(dot.px, dot.py, RADIUS, 0, TAU);
      }

      // Fill idle grid with optical radial falloff gradient
      const baseGrad = ctx.createRadialGradient(
        gridMeta.cx0,
        gridMeta.cy0,
        8,
        gridMeta.cx0,
        gridMeta.cy0,
        gridMeta.maxDist
      );
      baseGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${baseAlpha * 1.25})`);
      baseGrad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${baseAlpha * 0.95})`);
      baseGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${baseAlpha * 0.65})`);

      ctx.fillStyle = baseGrad;
      ctx.fill();

      // If reduced motion is requested, render subtle static accent dots and exit
      if (isStatic) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${baseAlpha * 2.6})`;
        const staticIndices = [
          Math.floor(dots.length * 0.2),
          Math.floor(dots.length * 0.35),
          Math.floor(dots.length * 0.5),
          Math.floor(dots.length * 0.65),
          Math.floor(dots.length * 0.8),
        ];
        for (const idx of staticIndices) {
          if (dots[idx]) {
            ctx.beginPath();
            ctx.arc(dots[idx].px, dots[idx].py, RADIUS, 0, TAU);
            ctx.fill();
          }
        }
        ctx.restore();
        return;
      }

      // 2nd Layer: Active Stochastic Dots Animation Lifecycle (Apple Physicality §4, §16)
      // Active concurrent dots scaled to sparser grid (~10% of matrix, min 18 active simultaneously)
      const targetActiveCount = Math.max(18, Math.floor(dots.length * 0.10));

      // Stochastic dot ignition: responsive replenishment rate
      const needed = targetActiveCount - activeMap.size;
      if (needed > 0 && Math.random() < 0.38) {
        const candidateIdx = Math.floor(Math.random() * dots.length);
        const candidate = dots[candidateIdx];
        if (candidate && !activeMap.has(candidateIdx) && !dimmedMap.has(candidateIdx) && candidate.falloff > 0.45) {
          activeMap.set(candidateIdx, {
            startTime: now,
            duration: 2600 + Math.random() * 1200, // 2.6s to 3.8s total cycle
            peakAlpha: (isDark ? 0.68 : 0.58) + Math.random() * 0.22, // High contrast: 0.58 to 0.90!
            fadeInRatio: 0.22, // 22% quick gentle rise (~600ms), 78% slow graceful hiding decay (~2.4s)
          });
        }
      }

      // Render active dots with asymmetric curve (smooth rise + slow lingering hiding decay)
      for (const [dotIdx, anim] of activeMap.entries()) {
        const elapsed = now - anim.startTime;
        const progress = elapsed / anim.duration;

        if (progress >= 1) {
          activeMap.delete(dotIdx);
          continue;
        }

        const dot = dots[dotIdx];
        if (!dot) {
          activeMap.delete(dotIdx);
          continue;
        }

        // Asymmetric lighting curve: quick rise to peak, then slow, graceful decay
        const fadeInRatio = anim.fadeInRatio || 0.22;
        let decayFactor = 0;
        if (progress < fadeInRatio) {
          const riseT = progress / fadeInRatio;
          decayFactor = Math.sin(riseT * (Math.PI / 2));
        } else {
          const hideT = (progress - fadeInRatio) / (1 - fadeInRatio);
          const cosDecay = 0.5 * (1 + Math.cos(hideT * Math.PI));
          decayFactor = Math.pow(cosDecay, 1.2);
        }

        const dynamicAlpha =
          anim.peakAlpha * decayFactor * dot.falloff * dot.textClearance;

        ctx.beginPath();
        ctx.arc(dot.px, dot.py, RADIUS, 0, TAU);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${dynamicAlpha})`;
        ctx.fill();
      }

      // 3rd Layer: Completely Faded / Extinguished Dots (Opposite of Active Dots)
      // Occurs at same or slightly higher frequency as active dots
      const targetDimmedCount = Math.max(20, Math.floor(dots.length * 0.11));
      const dimmedNeeded = targetDimmedCount - dimmedMap.size;
      if (dimmedNeeded > 0 && Math.random() < 0.42) {
        const candidateIdx = Math.floor(Math.random() * dots.length);
        const candidate = dots[candidateIdx];
        if (candidate && !activeMap.has(candidateIdx) && !dimmedMap.has(candidateIdx) && candidate.falloff > 0.38) {
          dimmedMap.set(candidateIdx, {
            startTime: now,
            duration: 2400 + Math.random() * 1100, // 2.4s to 3.5s total cycle
            fadeOutRatio: 0.25, // 25% dips to complete fade (0% opacity), 75% slow gentle reappearance
          });
        }
      }

      for (const [dotIdx, anim] of dimmedMap.entries()) {
        const elapsed = now - anim.startTime;
        const progress = elapsed / anim.duration;

        if (progress >= 1) {
          dimmedMap.delete(dotIdx);
          continue;
        }

        const dot = dots[dotIdx];
        if (!dot) {
          dimmedMap.delete(dotIdx);
          continue;
        }

        // Opposite curve: drops to 0 (extinguished), then slowly restores to base
        const fadeOutRatio = anim.fadeOutRatio || 0.25;
        let dipFactor = 0;
        if (progress < fadeOutRatio) {
          const dipT = progress / fadeOutRatio;
          dipFactor = Math.sin(dipT * (Math.PI / 2));
        } else {
          const restoreT = (progress - fadeOutRatio) / (1 - fadeOutRatio);
          const cosRestore = 0.5 * (1 + Math.cos(restoreT * Math.PI));
          dipFactor = Math.pow(cosRestore, 1.2);
        }

        // Base opacity reduced towards 0 by dipFactor
        const normalAlpha = baseAlpha * dot.falloff * dot.textClearance;
        const dimmedAlpha = normalAlpha * (1 - dipFactor);

        // Only draw when above perceptual threshold; at peak dip (dipFactor = 1), it is 0 and completely invisible!
        if (dimmedAlpha > 0.005) {
          ctx.beginPath();
          ctx.arc(dot.px, dot.py, RADIUS, 0, TAU);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${dimmedAlpha})`;
          ctx.fill();
        }
      }

      ctx.restore();
    };

    // 3. Animation Loop with Tab Visibility Optimization
    const loop = (now) => {
      renderFrame(now, false);
      rafIdRef.current = requestAnimationFrame(loop);
    };

    // 4. Accessibility Media Queries (Apple Design §14)
    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastMedia = window.matchMedia('(prefers-contrast: more)');

    isReducedMotionRef.current = motionMedia.matches;
    isHighContrastRef.current = contrastMedia.matches;

    const onMotionChange = (e) => {
      isReducedMotionRef.current = e.matches;
      if (e.matches) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        renderFrame(performance.now(), true);
      } else {
        lastTimeRef.current = performance.now();
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(loop);
        }
      }
    };

    const onContrastChange = (e) => {
      isHighContrastRef.current = e.matches;
      renderFrame(performance.now(), isReducedMotionRef.current);
    };

    motionMedia.addEventListener('change', onMotionChange);
    contrastMedia.addEventListener('change', onContrastChange);

    // 5. Resize Observer for DPI-perfect canvas dimensions without CSS stretching
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      dimensionsRef.current = { width, height, dpr };

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const generated = generateDots(width, height, dpr);
      dotsRef.current = generated.dots;
      gridMeta = { cx0: generated.cx0, cy0: generated.cy0, maxDist: generated.maxDist };

      activeDotsRef.current.clear();
      dimmedDotsRef.current.clear();
      renderFrame(performance.now(), isReducedMotionRef.current);
    };

    // Initial size setup
    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    if (!isReducedMotionRef.current) {
      rafIdRef.current = requestAnimationFrame(loop);
    } else {
      renderFrame(performance.now(), true);
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      } else {
        lastTimeRef.current = performance.now();
        if (!rafIdRef.current && !isReducedMotionRef.current) {
          rafIdRef.current = requestAnimationFrame(loop);
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      resizeObserver.disconnect();
      motionMedia.removeEventListener('change', onMotionChange);
      contrastMedia.removeEventListener('change', onContrastChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isRtl, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        'absolute inset-0 pointer-events-none select-none overflow-hidden rounded-[inherit] z-0',
        className
      )}
    >
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
    </div>
  );
}

export default CockpitDotMatrix;
