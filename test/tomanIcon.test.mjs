import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const iconsCode = fs.readFileSync(path.join(rootDir, "src", "components", "ui", "Icons.jsx"), "utf8");
const moneyDisplayCode = fs.readFileSync(path.join(rootDir, "src", "components", "ui", "MoneyDisplay.jsx"), "utf8");
const svgAsset = fs.readFileSync(path.join(rootDir, "src", "assets", "toman.svg"), "utf8");

test("TomanIcon is exported from Icons.jsx with tight viewBox and 24px minimum size constraints with size prop support", () => {
  assert.ok(iconsCode.includes("export function TomanIcon("));
  assert.ok(iconsCode.includes("viewBox=\"9.5 10.5 71.2 48.2\""));
  assert.ok(iconsCode.includes("fill=\"currentColor\""));
  assert.ok(iconsCode.includes("fillRule=\"evenodd\""));
  assert.ok(iconsCode.includes("min-w-[24px] min-h-[24px]"));
  assert.ok(iconsCode.includes("minWidth: sizeStr || 24"));
  assert.ok(iconsCode.includes("minHeight: sizeStr || 24"));
});

test("MoneyDisplay uses TomanIcon for Toman currency with 24px default and iconSize prop support", () => {
  assert.ok(moneyDisplayCode.includes("import { TomanIcon } from './Icons';"));
  assert.ok(moneyDisplayCode.includes("size={iconSize}"));
  assert.ok(moneyDisplayCode.includes("w-[24px] h-[24px] min-w-[24px] min-h-[24px]"));
  assert.ok(moneyDisplayCode.includes("items-center"));
});

test("src/assets/toman.svg is valid tight SVG with 24x24 dimensions", () => {
  assert.ok(svgAsset.startsWith("<svg"));
  assert.ok(svgAsset.includes("viewBox=\"9.5 10.5 71.2 48.2\""));
  assert.ok(svgAsset.includes("width=\"24\""));
  assert.ok(svgAsset.includes("height=\"24\""));
  assert.ok(svgAsset.includes("fill=\"currentColor\""));
  assert.ok(svgAsset.includes("fill-rule=\"evenodd\""));
});

