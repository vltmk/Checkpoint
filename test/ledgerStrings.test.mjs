// Every string the ledger screens ask for must exist in English and Farsi, and the two tables must match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LEDGER_STRINGS } from '../src/lib/ledger/strings.js';

const dir = path.join(import.meta.dirname, '../src/components/ledger');

function usedKeys() {
  const keys = new Set();
  for (const file of fs.readdirSync(dir)) {
    if (!/\.jsx?$/.test(file)) continue;
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of src.matchAll(/\.t\(\s*'([^']+)'/g)) keys.add(m[1]);
    for (const m of src.matchAll(/\.t\(\s*`([^`$]+)`/g)) keys.add(m[1]);
  }
  return keys;
}

test('English and Farsi tables have exactly the same keys', () => {
  const en = Object.keys(LEDGER_STRINGS.en).sort();
  const fa = Object.keys(LEDGER_STRINGS.fa).sort();
  assert.deepEqual(en, fa);
});

test('every key used by a ledger component exists in the table (common.* live in i18n.jsx)', () => {
  const i18n = fs.readFileSync(path.join(import.meta.dirname, '../src/lib/i18n.jsx'), 'utf8');
  const missing = [...usedKeys()].filter((k) => !(k in LEDGER_STRINGS.en) && !i18n.includes(`'${k}'`));
  assert.deepEqual(missing, []);
});

test('dynamic keys (lifecycle and share states) are all defined in both languages', () => {
  for (const k of ['pending', 'working', 'on_hold', 'done', 'failed', 'disputed', 'refunded']) {
    assert.ok(LEDGER_STRINGS.en[`lg.life.${k}`] && LEDGER_STRINGS.fa[`lg.life.${k}`], k);
  }
  for (const k of ['paid', 'partly', 'due', 'progress']) {
    assert.ok(LEDGER_STRINGS.en[`lg.share.${k}`] && LEDGER_STRINGS.fa[`lg.share.${k}`], k);
  }
});

test('placeholders match between languages, so no translation drops or invents a {token}', () => {
  const tokens = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of Object.keys(LEDGER_STRINGS.en)) {
    assert.equal(tokens(LEDGER_STRINGS.fa[k]), tokens(LEDGER_STRINGS.en[k]), `placeholder mismatch in ${k}`);
  }
});
