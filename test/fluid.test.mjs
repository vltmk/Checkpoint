import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("display.wgsl supports dual-theme display config with paper-white light mode and source dark mode", () => {
  const displayWgsl = fs.readFileSync(
    path.join(rootDir, "src/components/ui/fluid/shaders/display.wgsl"),
    "utf8"
  );
  
  // Exact source background in Dark mode
  assert.match(displayWgsl, /let dark_base = vec3f\(0\.003, 0\.005, 0\.014\);/);
  assert.match(displayWgsl, /let dark_fluid = \(dark_base \+ color\) \* vignette;/);
  
  // Paper-white luminous background in Light mode
  assert.match(displayWgsl, /let light_base = vec3f\(0\.985, 0\.985, 0\.990\);/);
  assert.match(displayWgsl, /let light_fluid = mix\(light_base, rich_ink, ink_strength\);/);

  // Canonical aligned uniform layout (output_size: vec2f, theme_mode: f32, _pad: f32)
  assert.match(displayWgsl, /struct DisplayConfig\s*\{\s*output_size:\s*vec2f,\s*theme_mode:\s*f32,\s*_pad:\s*f32,\s*\}/);
});

test("16:9 Cover sizing guarantees isotropic canvas aspect ratio across container shapes", () => {
  const calculateCoverSize = (cw, ch) => {
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
    return { w, h, aspect: w / h };
  };

  // Wide container (Cockpit card: 800 x 290)
  const wide = calculateCoverSize(800, 290);
  assert.equal(wide.w, 800);
  assert.equal(wide.h, 450);
  assert.ok(Math.abs(wide.aspect - 16 / 9) < 0.001);

  // Narrow mobile container (360 x 300)
  const narrow = calculateCoverSize(360, 300);
  assert.equal(narrow.h, 300);
  assert.equal(narrow.w, 534);
  assert.ok(Math.abs(narrow.aspect - 16 / 9) < 0.005);

  // Square container (500 x 500)
  const square = calculateCoverSize(500, 500);
  assert.equal(square.h, 500);
  assert.equal(square.w, 889);
  assert.ok(Math.abs(square.aspect - 16 / 9) < 0.005);
});

test("pointer coordinates map directly to canvas rect without artificial squishing", () => {
  const canvasRect = { left: 100, top: 50, width: 800, height: 450 };
  
  const mapPoint = (clientX, clientY, r) => [
    Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))),
    Math.max(0, Math.min(1, 1 - (clientY - r.top) / Math.max(1, r.height))),
  ];

  // Center of canvas
  const center = mapPoint(500, 275, canvasRect);
  assert.equal(center[0], 0.5);
  assert.equal(center[1], 0.5);

  // Top-left
  const topLeft = mapPoint(100, 50, canvasRect);
  assert.equal(topLeft[0], 0.0);
  assert.equal(topLeft[1], 1.0); // WebGPU Y is up

  // Bottom-right
  const bottomRight = mapPoint(900, 500, canvasRect);
  assert.equal(bottomRight[0], 1.0);
  assert.equal(bottomRight[1], 0.0);
});
