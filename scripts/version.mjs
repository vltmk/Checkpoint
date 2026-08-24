#!/usr/bin/env node

/**
 * Checkpoint Version Management System
 *
 * Enforces Semantic Versioning (MAJOR.MINOR.PATCH) and keeps metadata files
 * synchronized with the canonical Tauri configuration:
 *   - src-tauri/tauri.conf.json (canonical)
 *   - package.json
 *   - src-tauri/Cargo.toml ([package].version)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const FILES = {
  tauri: path.join(ROOT_DIR, 'src-tauri', 'tauri.conf.json'),
  package: path.join(ROOT_DIR, 'package.json'),
  cargo: path.join(ROOT_DIR, 'src-tauri', 'Cargo.toml'),
};

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Parse and validate a strict Semantic Version string (MAJOR.MINOR.PATCH).
 * @param {string} versionStr
 * @returns {{ major: number, minor: number, patch: number, raw: string } | null}
 */
export function parseSemVer(versionStr) {
  if (typeof versionStr !== 'string') return null;
  const match = versionStr.trim().match(SEMVER_REGEX);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    raw: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

/**
 * Compare two parsed SemVer objects.
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemVer(v1, v2) {
  if (v1.major !== v2.major) return v1.major > v2.major ? 1 : -1;
  if (v1.minor !== v2.minor) return v1.minor > v2.minor ? 1 : -1;
  if (v1.patch !== v2.patch) return v1.patch > v2.patch ? 1 : -1;
  return 0;
}

/**
 * Read and parse JSON file.
 */
function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Extract [package].version from Cargo.toml content.
 */
function extractCargoPackageVersion(content, filePath = 'Cargo.toml') {
  const packageMatch = content.match(/\[package\]([\s\S]*?)(?=\n\[|$)/);
  if (!packageMatch) {
    throw new Error(`[package] section missing in ${filePath}`);
  }
  const versionMatch = packageMatch[1].match(/^\s*version\s*=\s*"([^"]+)"/m);
  if (!versionMatch) {
    throw new Error(`version field missing in [package] section of ${filePath}`);
  }
  return versionMatch[1];
}

/**
 * Read Cargo.toml and extract [package].version.
 */
function readCargoPackageVersion(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return extractCargoPackageVersion(content, filePath);
}

/**
 * Update [package].version in Cargo.toml content while preserving all other sections and dependencies.
 */
function updateCargoContent(content, newVersion) {
  const packageSectionRegex = /(\[package\][\s\S]*?)(?=\n\[|$)/;
  if (!packageSectionRegex.test(content)) {
    throw new Error('Could not find [package] section in Cargo.toml');
  }
  return content.replace(packageSectionRegex, (section) => {
    return section.replace(/^(\s*version\s*=\s*)"[^"]+"/m, `$1"${newVersion}"`);
  });
}

/**
 * Read the canonical version from src-tauri/tauri.conf.json.
 */
function getCanonicalVersion() {
  const tauriConfig = readJson(FILES.tauri);
  const versionStr = tauriConfig.version;
  const semver = parseSemVer(versionStr);
  if (!semver) {
    throw new Error(
      `Invalid SemVer in canonical file src-tauri/tauri.conf.json: "${versionStr}". Expected format: MAJOR.MINOR.PATCH (e.g. 2.1.0)`
    );
  }
  return semver;
}

/**
 * Perform version check across all project metadata files.
 */
function runCheck() {
  let canonical;
  try {
    canonical = getCanonicalVersion();
  } catch (err) {
    console.error(`Error reading canonical version:\n  ${err.message}`);
    process.exit(1);
  }

  const reports = [];
  let hasMismatch = false;

  // 1. Check package.json
  try {
    const pkg = readJson(FILES.package);
    const pkgVer = pkg.version;
    if (pkgVer !== canonical.raw) {
      hasMismatch = true;
      reports.push({
        file: 'package.json',
        field: 'package.json',
        current: pkgVer,
        expected: canonical.raw,
        valid: Boolean(parseSemVer(pkgVer)),
      });
    }
  } catch (err) {
    hasMismatch = true;
    reports.push({
      file: 'package.json',
      field: 'package.json',
      error: err.message,
    });
  }

  // 2. Check src-tauri/Cargo.toml
  try {
    const cargoVer = readCargoPackageVersion(FILES.cargo);
    if (cargoVer !== canonical.raw) {
      hasMismatch = true;
      reports.push({
        file: 'src-tauri/Cargo.toml',
        field: 'package.version',
        current: cargoVer,
        expected: canonical.raw,
        valid: Boolean(parseSemVer(cargoVer)),
      });
    }
  } catch (err) {
    hasMismatch = true;
    reports.push({
      file: 'src-tauri/Cargo.toml',
      field: 'package.version',
      error: err.message,
    });
  }

  if (hasMismatch) {
    console.error('Version mismatch detected:\n');
    console.error('Canonical:');
    console.error(`  src-tauri/tauri.conf.json → ${canonical.raw}\n`);

    for (const report of reports) {
      console.error(`${report.file}:`);
      if (report.error) {
        console.error(`  Error: ${report.error}`);
      } else {
        console.error(`  ${report.field} → ${report.current}`);
      }
      console.error('');
    }

    console.error('Run the version management command to synchronize versions.');
    process.exit(1);
  }

  console.log(`Version check passed: all files synchronized at v${canonical.raw}\n`);
  console.log('Canonical:');
  console.log(`  src-tauri/tauri.conf.json → ${canonical.raw}`);
  console.log('Synchronized:');
  console.log(`  package.json → ${canonical.raw}`);
  console.log(`  src-tauri/Cargo.toml → ${canonical.raw}`);
  process.exit(0);
}

/**
 * Apply version update across metadata files with in-memory validation and atomic rollback safety.
 */
function applyVersion(targetVersionStr) {
  const targetSemVer = parseSemVer(targetVersionStr);
  if (!targetSemVer) {
    console.error(`Error: Invalid semantic version "${targetVersionStr}".`);
    console.error('Expected format: MAJOR.MINOR.PATCH (e.g. 2.1.0, 2.2.0, 3.0.0).');
    process.exit(1);
  }

  const currentCanonical = getCanonicalVersion();
  const cmp = compareSemVer(targetSemVer, currentCanonical);

  if (cmp === 0) {
    console.error(
      `Error: Target version ${targetSemVer.raw} is identical to the current canonical version ${currentCanonical.raw}. Version changes must be strictly progressive.`
    );
    process.exit(1);
  }

  if (cmp < 0) {
    console.error(
      `Error: Cannot downgrade version from ${currentCanonical.raw} to ${targetSemVer.raw}. Version downgrades are strictly rejected.`
    );
    process.exit(1);
  }

  // --- Step 1: Read and validate all original files into memory ---
  const originalContents = new Map();
  try {
    for (const [key, filePath] of Object.entries(FILES)) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file does not exist: ${filePath}`);
      }
      originalContents.set(filePath, fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error reading target files:\n  ${err.message}`);
    process.exit(1);
  }

  // --- Step 2: Compute and validate all file updates in memory ---
  const updates = [];

  try {
    // 2a. tauri.conf.json
    const tauriData = JSON.parse(originalContents.get(FILES.tauri));
    tauriData.version = targetSemVer.raw;
    const newTauriContent = JSON.stringify(tauriData, null, 2) + '\n';
    JSON.parse(newTauriContent); // Verify parseable JSON
    updates.push({
      path: FILES.tauri,
      relative: 'src-tauri/tauri.conf.json',
      content: newTauriContent,
    });

    // 2b. package.json
    const pkgData = JSON.parse(originalContents.get(FILES.package));
    pkgData.version = targetSemVer.raw;
    const newPkgContent = JSON.stringify(pkgData, null, 2) + '\n';
    JSON.parse(newPkgContent); // Verify parseable JSON
    updates.push({
      path: FILES.package,
      relative: 'package.json',
      content: newPkgContent,
    });

    // 2c. Cargo.toml
    const cargoRaw = originalContents.get(FILES.cargo);
    const updatedCargoRaw = updateCargoContent(cargoRaw, targetSemVer.raw);
    const verifiedCargoVer = extractCargoPackageVersion(updatedCargoRaw, FILES.cargo);
    if (verifiedCargoVer !== targetSemVer.raw) {
      throw new Error(
        `Cargo.toml verification failed: expected ${targetSemVer.raw}, got ${verifiedCargoVer}`
      );
    }
    updates.push({
      path: FILES.cargo,
      relative: 'src-tauri/Cargo.toml',
      content: updatedCargoRaw,
    });
  } catch (err) {
    console.error(`Error computing file modifications:\n  ${err.message}`);
    process.exit(1);
  }

  // --- Step 3: Atomic write with rollback safety ---
  console.log(`Current version: ${currentCanonical.raw}`);
  console.log(`New version:     ${targetSemVer.raw}\n`);

  const writtenFiles = [];
  try {
    for (const update of updates) {
      fs.writeFileSync(update.path, update.content, 'utf-8');
      writtenFiles.push(update.path);
    }
  } catch (writeErr) {
    console.error(`Write failed: ${writeErr.message}`);
    console.error('Rolling back modified files to their original state...');
    for (const writtenPath of writtenFiles) {
      try {
        fs.writeFileSync(writtenPath, originalContents.get(writtenPath), 'utf-8');
      } catch (rollbackErr) {
        console.error(`Critical: Failed to roll back ${writtenPath}: ${rollbackErr.message}`);
      }
    }
    console.error('Rollback complete. Repository restored.');
    process.exit(1);
  }

  console.log('Version updated successfully:\n');
  console.log(`${currentCanonical.raw} → ${targetSemVer.raw}\n`);
  console.log('Updated:');
  for (const update of updates) {
    console.log(`- ${update.relative}`);
  }
}

/**
 * Print help/usage instructions.
 */
function printHelp() {
  console.log(`Checkpoint Version Management Utility

Usage:
  npm run version:check            Verify version consistency across all project files
  npm run version:patch            Bump patch version (e.g. 2.1.0 → 2.1.1)
  npm run version:minor            Bump minor version (e.g. 2.1.0 → 2.2.0)
  npm run version:major            Bump major version (e.g. 2.1.0 → 3.0.0)
  npm run version -- <version>     Set explicit version (e.g. npm run version -- 2.3.0)

Direct invocation:
  node scripts/version.mjs check
  node scripts/version.mjs patch
  node scripts/version.mjs minor
  node scripts/version.mjs major
  node scripts/version.mjs 2.3.0
`);
}

/**
 * Main CLI Entrypoint
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(1);
  }

  if (args.includes('--help') || args.includes('-h') || args[0] === 'help') {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  if (command === 'check' || command === '--check' || command === '-c') {
    if (args.length > 1) {
      console.error('Error: "check" command does not accept additional arguments.');
      process.exit(1);
    }
    runCheck();
    return;
  }

  let canonical;
  try {
    canonical = getCanonicalVersion();
  } catch (err) {
    console.error(`Error reading canonical version:\n  ${err.message}`);
    process.exit(1);
  }

  if (command === 'patch') {
    if (args.length > 1) {
      console.error('Error: "patch" command does not accept additional arguments.');
      process.exit(1);
    }
    const nextPatch = `${canonical.major}.${canonical.minor}.${canonical.patch + 1}`;
    applyVersion(nextPatch);
    return;
  }

  if (command === 'minor') {
    if (args.length > 1) {
      console.error('Error: "minor" command does not accept additional arguments.');
      process.exit(1);
    }
    const nextMinor = `${canonical.major}.${canonical.minor + 1}.0`;
    applyVersion(nextMinor);
    return;
  }

  if (command === 'major') {
    if (args.length > 1) {
      console.error('Error: "major" command does not accept additional arguments.');
      process.exit(1);
    }
    const nextMajor = `${canonical.major + 1}.0.0`;
    applyVersion(nextMajor);
    return;
  }

  // Explicit version argument
  if (args.length > 1) {
    console.error(`Error: Unexpected extra arguments: ${args.slice(1).join(' ')}`);
    process.exit(1);
  }

  applyVersion(command);
}

main();
