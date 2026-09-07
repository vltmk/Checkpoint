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

export function createRenderer(options) {
  let disposed = false;
  let isPaused = false;
  let gpu = undefined;
  let canvasSurface = undefined;
  let fluid = undefined;
  let input = undefined;
  let animationFrame = 0;
  let accumulator = 0;
  let previous = 0;

  let currentThemeMode = options.themeMode ?? 0.0;
  let currentIsRtl = Boolean(options.isRtl);
  let currentReducedMotion = Boolean(options.reducedMotion);

  const tick = (now) => {
    if (disposed) return;
    if (!document.hidden && !isPaused && fluid && input && canvasSurface) {
      const fixed = fixedStepCount(accumulator, (now - previous) / 1000);
      accumulator = fixed.accumulator;
      for (let i = 0; i < fixed.steps; i++) {
        stepFluid(fluid, input, currentReducedMotion);
      }
      renderFluid(fluid, canvasSurface);
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
      animationFrame = requestAnimationFrame(tick);
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
    setPaused(paused) {
      isPaused = Boolean(paused);
    },
    dispose,
  };
}
