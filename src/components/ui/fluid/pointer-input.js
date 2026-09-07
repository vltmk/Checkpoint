export function installStirInput(targetElement, canvas, options = {}) {
  let activePointer = undefined;
  let from = [0.5, 0.5];
  let to = [0.5, 0.5];
  let velocity = [0, 0];
  let lastTime = 0;
  let decay = 0;
  let isRtl = Boolean(options.isRtl);

  const element = targetElement || canvas;
  const canvasTarget = canvas || targetElement;
  const previousTouchAction = canvasTarget?.style?.touchAction;
  if (canvasTarget?.style) {
    canvasTarget.style.touchAction = "none";
  }

  // Zero-Layout Rect Caching for 1000Hz-8000Hz gaming mice
  let cachedCanvasRect = canvasTarget.getBoundingClientRect();
  const updateRect = () => {
    if (canvasTarget) {
      cachedCanvasRect = canvasTarget.getBoundingClientRect();
    }
  };

  const resizeObserver = new ResizeObserver(() => {
    updateRect();
  });
  if (canvasTarget) resizeObserver.observe(canvasTarget);
  if (element && element !== canvasTarget) resizeObserver.observe(element);

  window.addEventListener("scroll", updateRect, { passive: true });
  window.addEventListener("resize", updateRect, { passive: true });

  const point = (event) => {
    if (cachedCanvasRect.width <= 1 || cachedCanvasRect.height <= 1) {
      updateRect();
    }
    const r = cachedCanvasRect;
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    return [
      Math.max(0, Math.min(1, (event.clientX - r.left) / w)),
      Math.max(0, Math.min(1, 1 - (event.clientY - r.top) / h)),
    ];
  };

  const down = (event) => {
    if (!event.isPrimary || activePointer !== undefined) return;
    updateRect();
    activePointer = event.pointerId;
    from = to = point(event);
    lastTime = event.timeStamp;
    velocity = [0, 0];
    decay = 2;
  };

  const move = (event) => {
    if (!event.isPrimary) return;
    const next = point(event);
    if (lastTime === 0) {
      from = to = next;
      lastTime = event.timeStamp;
      decay = 2;
      return;
    }
    const dt = Math.max(
      0.004,
      Math.min(0.05, (event.timeStamp - lastTime) / 1000)
    );
    from = to;
    to = next;
    velocity = [
      Math.max(-2.5, Math.min(2.5, (to[0] - from[0]) / dt)),
      Math.max(-2.5, Math.min(2.5, (to[1] - from[1]) / dt)),
    ];
    lastTime = event.timeStamp;
    decay = 2;
  };

  const up = (event) => {
    if (!event.isPrimary || event.pointerId !== activePointer) return;
    activePointer = undefined;
    decay = 2;
  };

  const leave = () => {
    if (activePointer === undefined) {
      lastTime = 0;
      decay = 0;
    }
  };

  element.addEventListener("pointerenter", updateRect, { passive: true });
  element.addEventListener("pointerdown", down, { passive: true });
  element.addEventListener("pointermove", move, { passive: true });
  element.addEventListener("pointerup", up, { passive: true });
  element.addEventListener("pointercancel", up, { passive: true });
  element.addEventListener("pointerleave", leave, { passive: true });

  return {
    get active() {
      return activePointer !== undefined || decay > 0;
    },
    get from() {
      return from;
    },
    get to() {
      return to;
    },
    get velocity() {
      return velocity;
    },
    setIsRtl(rtl) {
      isRtl = Boolean(rtl);
    },
    consumeStep() {
      from = to;
      if (activePointer === undefined && decay > 0) {
        velocity = [velocity[0] * 0.45, velocity[1] * 0.45];
        decay--;
      }
    },
    dispose() {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateRect);
      window.removeEventListener("resize", updateRect);
      element.removeEventListener("pointerenter", updateRect);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("pointerleave", leave);
      activePointer = undefined;
      if (canvasTarget?.style && previousTouchAction !== undefined) {
        canvasTarget.style.touchAction = previousTouchAction;
      }
    },
  };
}
