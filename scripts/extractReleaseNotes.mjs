#!/usr/bin/env node

/**
 * extractReleaseNotes.mjs - CLI utility to generate Markdown release descriptions
 * from src/lib/releaseNotes.js for GitHub Actions and Tauri Updater artifacts.
 */

import { getReleaseNotesForVersion } from '../src/lib/releaseNotes.js';

function formatMarkdown(notes) {
  if (!notes) return '';

  const lines = [];

  if (notes.summary) {
    lines.push(notes.summary);
    lines.push('');
  }

  if (Array.isArray(notes.items) && notes.items.length > 0) {
    lines.push('### Highlights & Changes');
    for (const item of notes.items) {
      const tag = item.tag ? `[${item.tag.toUpperCase()}] ` : '';
      const text = item.text || String(item);
      lines.push(`- ${tag}${text}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function main() {
  const targetVersion = process.argv[2] || process.env.GITHUB_REF_NAME || '';
  if (!targetVersion) {
    console.error('Usage: node scripts/extractReleaseNotes.mjs <version>');
    process.exit(1);
  }

  const cleanVer = targetVersion.replace(/^v/i, '').trim();
  const notes = getReleaseNotesForVersion(cleanVer, 'en');

  const md = formatMarkdown(notes);
  console.log(md || `See release details for Checkpoint v${cleanVer}.`);
}

main();
