import advectVelocityWgsl from "./shaders/advect-velocity.wgsl";
import curlWgsl from "./shaders/curl.wgsl";
import vorticityWgsl from "./shaders/vorticity.wgsl";
import divergenceWgsl from "./shaders/divergence.wgsl";
import pressureWgsl from "./shaders/pressure.wgsl";
import projectWgsl from "./shaders/project.wgsl";
import advectDyeWgsl from "./shaders/advect-dye.wgsl";
import displayWgsl from "./shaders/display.wgsl";
import { compute, effect, frame, pingPongStorage, storage } from "vgpu";

// Exact source resolution for isotropic, physically stable fluid dynamics
const GRID_SIZE = [128, 72];
const DYE_SIZE = [512, 288];
const CELLS = GRID_SIZE[0] * GRID_SIZE[1];
const DYE_CELLS = DYE_SIZE[0] * DYE_SIZE[1];

export function createFluid(gpu) {
  const allocated = [];
  try {
    const velocity = pingPongStorage(gpu, CELLS * 8);
    allocated.push(velocity.read, velocity.write);
    const dye = pingPongStorage(gpu, DYE_CELLS * 16);
    allocated.push(dye.read, dye.write);
    const pressure = pingPongStorage(gpu, CELLS * 4);
    allocated.push(pressure.read, pressure.write);
    const divergence = storage(gpu, CELLS * 4, "read-write");
    allocated.push(divergence);
    const curl = storage(gpu, CELLS * 4, "read-write");
    allocated.push(curl);
    const passes = createPasses(gpu);
    return {
      gpu,
      velocity,
      dye,
      pressure,
      divergence,
      curl,
      passes,
      step: 0,
      lastInputStep: -1000,
    };
  } catch (error) {
    for (const buffer of allocated) {
      destroyBuffer(buffer);
    }
    throw error;
  }
}

export function destroyFluid(fluid) {
  if (!fluid) return;
  const buffers = [
    fluid.velocity?.read,
    fluid.velocity?.write,
    fluid.dye?.read,
    fluid.dye?.write,
    fluid.pressure?.read,
    fluid.pressure?.write,
    fluid.divergence,
    fluid.curl,
  ];
  for (const buffer of buffers) {
    destroyBuffer(buffer);
  }
}

function destroyBuffer(buffer) {
  if (buffer && typeof buffer.destroy === 'function') {
    buffer.destroy();
  }
}

function createPasses(gpu) {
  const withGrid = (shader) =>
    compute(gpu, shader, {
      set: { grid: { size: GRID_SIZE, dye_size: DYE_SIZE } },
    });
  return {
    advectVelocity: withGrid(advectVelocityWgsl),
    curl: withGrid(curlWgsl),
    vorticity: withGrid(vorticityWgsl),
    divergence: withGrid(divergenceWgsl),
    pressure: withGrid(pressureWgsl),
    project: withGrid(projectWgsl),
    advectDye: withGrid(advectDyeWgsl),
    display: effect(gpu, displayWgsl),
  };
}

export async function prepareFluid(fluid, output, themeMode = 0.0) {
  resizeFluid(fluid, output, themeMode);
  await fluid.passes.display.compile({ colors: [output.format] });
}

export function resizeFluid(fluid, output, themeMode = 0.0) {
  if (!fluid?.passes?.display || !output?.size) return;
  fluid.passes.display.set({
    config: {
      output_size: output.size,
      theme_mode: themeMode,
      _pad: 0.0,
    },
  });
}

export function stepFluid(fluid, input, reducedMotion = false) {
  if (!fluid) return;
  if (input?.active) fluid.lastInputStep = fluid.step;
  const dynamic = inputUniforms(fluid, input, reducedMotion);
  const p = fluid.passes;

  // 128 / 8 = 16, 72 / 8 = 9 workgroups
  p.advectVelocity
    .set({
      input: dynamic,
      src: fluid.velocity.read,
      dst: fluid.velocity.write,
    })
    .dispatch(16, 9);
  fluid.velocity.swap();

  p.curl
    .set({ velocity: fluid.velocity.read, curl: fluid.curl })
    .dispatch(16, 9);
  p.vorticity
    .set({
      src: fluid.velocity.read,
      curl: fluid.curl,
      dst: fluid.velocity.write,
    })
    .dispatch(16, 9);
  fluid.velocity.swap();

  p.divergence
    .set({ velocity: fluid.velocity.read, divergence: fluid.divergence })
    .dispatch(16, 9);
  for (let i = 0; i < 3; i++) {
    p.pressure
      .set({
        params: { decay: i === 0 ? 0.8 : 1 },
        src: fluid.pressure.read,
        divergence: fluid.divergence,
        dst: fluid.pressure.write,
      })
      .dispatch(16, 9);
    fluid.pressure.swap();
  }

  p.project
    .set({
      src: fluid.velocity.read,
      pressure: fluid.pressure.read,
      dst: fluid.velocity.write,
    })
    .dispatch(16, 9);
  fluid.velocity.swap();

  // 512 / 8 = 64, 288 / 8 = 36 workgroups for high-density dye
  p.advectDye
    .set({
      input: dynamic,
      src: fluid.dye.read,
      velocity: fluid.velocity.read,
      dst: fluid.dye.write,
    })
    .dispatch(64, 36);
  fluid.dye.swap();
  fluid.step++;
  input?.consumeStep();
}

export function renderFluid(fluid, output) {
  if (!fluid || !output) return;
  fluid.passes.display.set({ dye: fluid.dye.read });
  frame(fluid.gpu, (currentFrame) => {
    currentFrame.pass(output, fluid.passes.display);
  });
}

function inputUniforms(fluid, input, reducedMotion = false) {
  const time = fluid.step / 60;
  const [a, b] = idleEmitters(fluid.step);
  const sinceInput = fluid.step - fluid.lastInputStep;
  const idle = reducedMotion
    ? 0.04
    : sinceInput < 90
    ? 0.15
    : 0.15 + 0.85 * Math.min(1, (sinceInput - 90) / 60);
  const ramp = Math.min(1, (fluid.step + 1) / 24);
  let pointerVelocity = input?.velocity ?? [0, 0];
  if (input?.active && Math.hypot(...pointerVelocity) < 0.02) {
    pointerVelocity = [0.16 * Math.cos(time * 5), 0.16 * Math.sin(time * 5)];
  }
  const speed = Math.hypot(...pointerVelocity);
  const direction =
    speed > 1e-4
      ? [pointerVelocity[0] / speed, pointerVelocity[1] / speed]
      : [0, 0];
  return {
    step: fluid.step,
    pointer_active: input?.active ? 1 : 0,
    pointer_from: input?.from ?? [0.5, 0.5],
    pointer_to: input?.to ?? [0.5, 0.5],
    pointer_velocity: pointerVelocity,
    // Source vibrant directional color with blue held high
    pointer_color: [0.5 + 0.5 * direction[0], 0.5 + 0.5 * direction[1], 1.0, 1.0],
    idle_a: [...a, ramp * idle, 0.006],
    idle_b: [...b, ramp * idle, 0.0055],
  };
}

function idleEmitters(step) {
  const t = step / 60;
  return [
    [0.5 + 0.28 * Math.sin(0.73 * t), 0.5 + 0.22 * Math.sin(1.09 * t + 0.4)],
    [
      0.5 + 0.26 * Math.sin(0.61 * t + Math.PI),
      0.5 + 0.24 * Math.sin(0.97 * t + 2.1),
    ],
  ];
}
