import { surface } from "vgpu";
import { installStirInput } from "./pointer-input";
import {
  createFluid,
  destroyFluid,
  prepareFluid,
  renderFluid,
  resizeFluid,
  stepFluid,
} from "./simulation";

const FIXED_STEP = 1 / 60;

function fixedStepCount(accumulator, elapsed) {
  let next = accumulator + Math.min(elapsed, 1 / 30);
  let steps = 0;
  while (next >= FIXED_STEP && steps < 2) {
    next -= FIXED_STEP;
    steps++;
  }
  return { steps, accumulator: steps === 2 ? 0 : next };
}

// Battery saver detection via standard Web Battery API
let isBatterySaver = false;
if (typeof navigator !== "undefined" && typeof navigator.getBattery === "function") {
  navigator
    .getBattery()
    .then((battery) => {
      const updateBatteryState = () => {
        isBatterySaver = !battery.charging || battery.level <= 0.2;
      };
      updateBatteryState();
      battery.addEventListener("chargingchange", updateBatteryState);
      battery.addEventListener("levelchange", updateBatteryState);
    })
    .catch(() => {});
}

export function createRenderer(options) {
  let disposed = false;
  let isPaused = false;
  let isSleeping = false;
  let isFocused = true;
  let gpu = undefined;
  let canvasSurface = undefined;
  let fluid = undefined;
  let input = undefined;
  let animationFrame = 0;
  let accumulator = 0;
  let previous = 0;
  let lastRenderTime = 0;
  let lastInteractionTime = performance.now();
  let lastBlurTime = 0;

  let currentThemeMode = options.themeMode ?? 0.0;
  let currentIsRtl = Boolean(options.isRtl);
  let currentReducedMotion = Boolean(options.reducedMotion);

  const wake = () => {
    lastInteractionTime = performance.now();
    if (isSleeping) {
      isSleeping = false;
      if (!isPaused && !disposed && !animationFrame) {
        previous = performance.now();
        lastRenderTime = performance.now();
        accumulator = 0;
        animationFrame = requestAnimationFrame(tick);
      }
    }
  };

  const tick = (now) => {
    if (disposed || isPaused) return;

    // 1. Inactivity & Window-Blur Auto-Sleep Check
    if (isFocused) {
      const idleTimeout = isBatterySaver ? 15000 : 45000;
      if (now - lastInteractionTime > idleTimeout) {
        isSleeping = true;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        return;
      }
    } else {
      // Background / unfocused window: enter tranquil sleep after 5 seconds
      if (lastBlurTime > 0 && now - lastBlurTime > 5000) {
        isSleeping = true;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        return;
      }
    }

    // 2. High-Refresh Gaming Monitor Rate Limiter (Cadence Clamping)
    const targetFps = isBatterySaver ? 30 : 60;
    const minFrameInterval = 1000 / targetFps - 1.5; // allowance for timer jitter
    if (lastRenderTime > 0 && now - lastRenderTime < minFrameInterval) {
      animationFrame = requestAnimationFrame(tick);
      return;
    }

    // 3. Fluid Physics & Render Pass
    if (!document.hidden && fluid && input && canvasSurface) {
      if (input.active) {
        lastInteractionTime = now;
      }
      const fixed = fixedStepCount(accumulator, (now - previous) / 1000);
      accumulator = fixed.accumulator;
      for (let i = 0; i < fixed.steps; i++) {
        stepFluid(fluid, input, currentReducedMotion);
      }
      renderFluid(fluid, canvasSurface);
      lastRenderTime = now;
    }

    previous = now;
    animationFrame = requestAnimationFrame(tick);
  };

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    input?.dispose();
    if (fluid) {
      destroyFluid(fluid);
      fluid = undefined;
    }
    canvasSurface?.dispose?.();
    gpu?.dispose?.();
  }

  function fail(error) {
    dispose();
    console.warn("[WebGPU Fluid] Initialization failed or unsupported:", error);
  }

  const initialize = async () => {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      return null;
    }

    const { init } = await import("vgpu");
    if (disposed) return null;

    try {
      const nextGpu = await init();
      if (disposed) {
        nextGpu?.dispose?.();
        return null;
      }
      gpu = nextGpu;

      // DPR matching source renderer.ts
      canvasSurface = surface(gpu, options.canvas, { dpr: [1, 2] });
      fluid = createFluid(gpu);
      input = installStirInput(options.container || options.canvas, options.canvas, {
        isRtl: currentIsRtl,
      });

      await prepareFluid(fluid, canvasSurface, currentThemeMode);

      if (disposed) {
        dispose();
        return null;
      }

      canvasSurface.onResize(() => {
        if (disposed || !fluid || !canvasSurface) return;
        try {
          resizeFluid(fluid, canvasSurface, currentThemeMode);
        } catch (error) {
          fail(error);
        }
      });

      previous = performance.now();
      lastRenderTime = performance.now();
      lastInteractionTime = performance.now();

      if (!isPaused && !isSleeping) {
        animationFrame = requestAnimationFrame(tick);
      }
      return true;
    } catch (err) {
      fail(err);
      return null;
    }
  };

  const ready = initialize().catch((error) => {
    if (disposed) return;
    fail(error);
  });

  return {
    ready,
    wake,
    setThemeMode(themeMode) {
      currentThemeMode = themeMode;
      if (fluid && canvasSurface) {
        resizeFluid(fluid, canvasSurface, currentThemeMode);
      }
    },
    setIsRtl(isRtl) {
      currentIsRtl = Boolean(isRtl);
      input?.setIsRtl?.(currentIsRtl);
    },
    setReducedMotion(reduced) {
      currentReducedMotion = Boolean(reduced);
    },
    setFocused(focused) {
      const next = Boolean(focused);
      if (isFocused === next) return;
      isFocused = next;
      if (isFocused) {
        lastBlurTime = 0;
        wake();
      } else {
        lastBlurTime = performance.now();
      }
    },
    setPaused(paused) {
      const next = Boolean(paused);
      if (isPaused === next) return;
      isPaused = next;
      if (isPaused) {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      } else {
        if (!animationFrame && !disposed && !isSleeping) {
          previous = performance.now();
          lastRenderTime = performance.now();
          accumulator = 0;
          animationFrame = requestAnimationFrame(tick);
        }
      }
    },
    dispose,
  };
}
