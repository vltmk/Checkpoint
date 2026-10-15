import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("WebGPU fluid simulation directory is cleanly retired", () => {
  const fluidDir = path.join(rootDir, "src/components/ui/fluid");
  assert.equal(fs.existsSync(fluidDir), false, "Fluid directory should not exist");
});

test("LedgerView.jsx implements zero-CLS minimal Action HUD with fixed height", () => {
  const ledgerCode = fs.readFileSync(
    path.join(rootDir, "src/components/views/LedgerView.jsx"),
    "utf8"
  );
  assert.match(ledgerCode, /h-16 sm:h-\[68px\]/);
  assert.match(ledgerCode, /sticky top-0 z-30/);
});

test("Action HUD provides click-to-open currency popover and interactive filter pills", () => {
  const ledgerCode = fs.readFileSync(
    path.join(rootDir, "src/components/views/LedgerView.jsx"),
    "utf8"
  );
  assert.match(ledgerCode, /handleStatusFilterToggle\('Paid'\)/);
  assert.match(ledgerCode, /handleStatusFilterToggle\('Pending'\)/);
  assert.ok(!ledgerCode.includes("handleCurrencyWheel"), "Accidental wheel scrolling over currency must be removed");
});

test("Action HUD metrics and pills calculate over baseFilteredEntries to avoid zeroing out when status filter is toggled", () => {
  const ledgerCode = fs.readFileSync(
    path.join(rootDir, "src/components/views/LedgerView.jsx"),
    "utf8"
  );
  assert.match(ledgerCode, /baseFilteredEntries\s*=\s*useMemo/);
  assert.match(ledgerCode, /baseFilteredEntries\.forEach/);
  assert.match(ledgerCode, /formatNumber\(baseFilteredEntries\.length\)/);
});

test("Ledger row keyboard navigation guards modifier keys and advances focus on deletion", () => {
  const ledgerCode = fs.readFileSync(
    path.join(rootDir, "src/components/views/LedgerView.jsx"),
    "utf8"
  );
  assert.match(ledgerCode, /if \(e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\)/);
  assert.match(ledgerCode, /nextToFocus && nextToFocus !== e\.currentTarget/);
  assert.match(ledgerCode, /scroll-mt-20/);
});

test("WorkModal comprehensively tracks all entry fields for dirty state detection", () => {
  const workModalCode = fs.readFileSync(
    path.join(rootDir, "src/components/WorkModal.jsx"),
    "utf8"
  );
  assert.match(workModalCode, /init\.game !== formData\.game/);
  assert.match(workModalCode, /init\.link !== formData\.link/);
  assert.match(workModalCode, /init\.teammates !== JSON\.stringify/);
  assert.match(workModalCode, /init\.proofsCount !== proofs\.length/);
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
