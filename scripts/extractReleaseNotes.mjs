#!/usr/bin/env node

/**
 * extractReleaseNotes.mjs - CLI utility to generate Markdown release descriptions
 * from src/lib/releaseNotes.js for GitHub Actions and Tauri Updater artifacts.
 */

import { RELEASE_NOTES_REGISTRY } from '../src/lib/releaseNotes.js';

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

function formatMarkdown(notes, lang) {
  if (!notes) return '';

  const lines = [];

  if (notes.summary) {
    lines.push(notes.summary);
    lines.push('');
  }

  if (Array.isArray(notes.items) && notes.items.length > 0) {
    lines.push(lang === 'fa' ? '### نکات و تغییرات' : '### Highlights & Changes');
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

  // A release must never go out without its notes, and never without the Farsi ones: fail the workflow instead of
  // publishing a generic body.
  const entry = RELEASE_NOTES_REGISTRY[cleanVer];
  if (!entry) {
    console.error(`No release notes for v${cleanVer}. Add an entry to RELEASE_NOTES_REGISTRY in src/lib/releaseNotes.js (Farsi and English).`);
    process.exit(1);
  }
  // read the registry itself: the in-app helper always answers in Farsi, but the GitHub page also carries English
  const notesFa = { summary: entry.summary.fa, items: entry.items.fa };
  const notesEn = { summary: entry.summary.en, items: entry.items.en };
  const farsiOk = ARABIC_SCRIPT.test(notesFa.summary) && notesFa.items.length > 0 && notesFa.items.every((i) => ARABIC_SCRIPT.test(i.text));
  if (!farsiOk || notesFa.items.length !== notesEn.items.length) {
    console.error(`The Farsi notes for v${cleanVer} are missing or do not match the English ones item for item.`);
    process.exit(1);
  }

  // Farsi first (the app shows only that part), then English for the GitHub release page
  console.log([formatMarkdown(notesFa, 'fa'), formatMarkdown(notesEn, 'en')].join('\n\n---\n\n'));
}

main();
