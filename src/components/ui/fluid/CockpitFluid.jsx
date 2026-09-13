import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { createRenderer } from "./renderer";
import { cn } from "../../../lib/utils";
import { subscribeWindowVisibility, subscribeWindowFocus } from "../../../lib/desktop";

/**
 * CockpitFluid
 *
 * Monochromatic high-performance WebGPU interactive fluid background for the Ledger Cockpit.
 *
 * Features:
 * - WebGPU Navier-Stokes solver with fixed timestep and vorticity confinement
 * - Monochromatic dual-theme calibration (dark zinc luminous fluid in Dark mode, graphite smoke in Light mode)
 * - Zero-latency theme switching without device recreation
 * - Zero-layout pointer tracking for high-polling gaming mice (1,000Hz-8,000Hz)
 * - Card-wide pointer event delegation with full pass-through for interactive controls
 * - Offscreen and in-tray zero-overhead culling
 * - Window blur 5-second fast-sleep and idle auto-settle
 * - Rate-limited to 60 FPS (30 FPS on battery saver)
 * - Full resource cleanup on unmount
 * - Graceful fallback when WebGPU is unsupported or disabled
 */
export function CockpitFluid({
  isRtl = false,
  containerRef: externalContainerRef,
  className = "",
  enabled = true,
}) {
  const localContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const { resolvedTheme } = useTheme();
  const [isSupported, setIsSupported] = useState(true);

  const containerRef = externalContainerRef || localContainerRef;

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    if (typeof navigator === "undefined" || !navigator.gpu) {
      setIsSupported(false);
      return;
    }

    // Dynamic 16:9 Cover sizing: guarantees the canvas and WebGPU surface maintain an exact 16:9 aspect ratio
    const updateCanvasSize = () => {
      const cw = container.clientWidth || container.offsetWidth || 800;
      const ch = container.clientHeight || container.offsetHeight || 450;
      const SIM_ASPECT = 16 / 9;
      let w = cw;
      let h = ch;
      if (cw / ch >= SIM_ASPECT) {
        w = Math.ceil(cw);
        h = Math.ceil(cw / SIM_ASPECT);
      } else {
        h = Math.ceil(ch);
        w = Math.ceil(ch * SIM_ASPECT);
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(container);

    const themeMode = resolvedTheme === "light" ? 1.0 : 0.0;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedMotion = mediaQuery.matches;

    const renderer = createRenderer({
      canvas,
      container,
      isRtl,
      themeMode,
      reducedMotion,
    });

    if (!renderer) {
      setIsSupported(false);
      resizeObserver.disconnect();
      return;
    }

    rendererRef.current = renderer;

    renderer.ready.then((success) => {
      if (success === false) {
        setIsSupported(false);
      }
    });

    // Lifecycle state management: pause when scrolled offscreen OR when window is hidden/minimized to tray
    let isIntersecting = true;
    let isVisible = true;

    const updatePausedState = () => {
      if (!rendererRef.current) return;
      const shouldPause = !isIntersecting || !isVisible;
      rendererRef.current.setPaused(shouldPause);
    };

    const unlistenVisibility = subscribeWindowVisibility((visible) => {
      isVisible = visible;
      updatePausedState();
    });

    const unlistenFocus = subscribeWindowFocus((focused) => {
      rendererRef.current?.setFocused(focused);
    });

    // IntersectionObserver for offscreen culling (0% GPU/CPU usage when scrolled out)
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        updatePausedState();
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Immediate wake up on pointer interaction
    const handleWake = () => {
      rendererRef.current?.wake();
    };
    container.addEventListener("pointermove", handleWake, { passive: true });
    container.addEventListener("pointerdown", handleWake, { passive: true });

    // prefers-reduced-motion listener
    const handleMotionChange = (e) => {
      renderer.setReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", handleMotionChange);

    const handleWindowResize = () => {
      updateCanvasSize();
    };
    window.addEventListener("resize", handleWindowResize, { passive: true });

    return () => {
      resizeObserver.disconnect();
      observer.disconnect();
      unlistenVisibility();
      unlistenFocus();
      container.removeEventListener("pointermove", handleWake);
      container.removeEventListener("pointerdown", handleWake);
      window.removeEventListener("resize", handleWindowResize);
      mediaQuery.removeEventListener("change", handleMotionChange);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [containerRef, enabled]);

  // Zero-latency theme mode update
  useEffect(() => {
    if (rendererRef.current) {
      const themeMode = resolvedTheme === "light" ? 1.0 : 0.0;
      rendererRef.current.setThemeMode(themeMode);
    }
  }, [resolvedTheme]);

  // RTL alignment update
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setIsRtl(isRtl);
    }
  }, [isRtl]);

  return (
    <div
      ref={localContainerRef}
      aria-hidden="true"
      className={cn(
        "absolute inset-0 pointer-events-none select-none overflow-hidden rounded-[inherit] z-0",
        className
      )}
    >
      {isSupported && enabled ? (
        <canvas
          ref={canvasRef}
          className="block absolute touch-none pointer-events-none max-w-none max-h-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      ) : (
        /* Graceful fallback surface when WebGPU is not available or disabled */
        <div className="absolute inset-0 bg-zinc-100/50 dark:bg-zinc-950/40" />
      )}
    </div>
  );
}

export default CockpitFluid;
