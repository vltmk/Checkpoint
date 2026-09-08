import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const frostedGlassCode = fs.readFileSync(path.join(rootDir, "src", "components", "ui", "FrostedGlass.jsx"), "utf8");
const contextMenuCode = fs.readFileSync(path.join(rootDir, "src", "components", "ui", "ContextMenu.jsx"), "utf8");

test("FrostedGlass does not force overflow-hidden on the base container or menu variant", () => {
  // Base class should not force overflow-hidden, so flyouts/popovers/tooltips are not clipped
  assert.ok(
    frostedGlassCode.includes("'checkpoint-frosted-base relative',"),
    "FrostedGlass should have relative positioning on base without hardcoded overflow-hidden"
  );
  assert.ok(
    !frostedGlassCode.includes("'checkpoint-frosted-base relative overflow-hidden',"),
    "FrostedGlass must not have overflow-hidden in base class"
  );

  // Modal and drawer should retain overflow-hidden for layout containment
  assert.ok(
    frostedGlassCode.includes("modal: 'checkpoint-frosted-modal border-t sm:border border-zinc-200/80 dark:border-zinc-800/80 rounded-t-2xl sm:rounded-xl overflow-hidden'"),
    "modal variant must have overflow-hidden"
  );
  assert.ok(
    frostedGlassCode.includes("drawer: 'checkpoint-frosted-drawer border-l border-zinc-200/90 dark:border-zinc-800/90 overflow-hidden'"),
    "drawer variant must have overflow-hidden"
  );

  // Menu variant must NOT have overflow-hidden so submenus can fly out
  assert.ok(
    frostedGlassCode.includes("menu: 'checkpoint-frosted-menu border border-zinc-200/90 dark:border-zinc-800/80 rounded-xl'"),
    "menu variant must not have overflow-hidden"
  );
});

test("ContextMenu explicitly sets overflow-visible when not constrained", () => {
  assert.ok(
    contextMenuCode.includes("isConstrained"),
    "ContextMenu handles isConstrained state"
  );
  assert.ok(
    contextMenuCode.includes(": 'overflow-visible'"),
    "ContextMenu sets overflow-visible when not constrained"
  );
});

test("SubmenuFlyout includes hover bridge to ensure seamless diagonal cursor transition across the gap", () => {
  assert.ok(
    contextMenuCode.includes("before:content-[''] before:absolute before:top-0 before:bottom-0 before:w-3 before:-right-3 before:pointer-events-auto"),
    "SubmenuFlyout includes bridge for left-flipped flyouts"
  );
  assert.ok(
    contextMenuCode.includes("before:content-[''] before:absolute before:top-0 before:bottom-0 before:w-3 before:-left-3 before:pointer-events-auto"),
    "SubmenuFlyout includes bridge for right flyouts"
  );
});
