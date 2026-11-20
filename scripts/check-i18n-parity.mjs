#!/usr/bin/env node
/**
 * Admin locale key-parity: en is source of truth; hi and pa must match.
 * Merges every `src/locales/{lang}/*.json` (domain split) into one tree per language.
 *
 * Run: npm run i18n:parity
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '..', 'src', 'locales');
const locales = ['en', 'hi', 'pa'];

function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, next, out);
    } else {
      out[next] = true;
    }
  }
  return out;
}

function listJsonFiles(locale) {
  const dir = path.join(localesDir, locale);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

function loadMerged(locale) {
  const dir = path.join(localesDir, locale);
  const files = listJsonFiles(locale);
  const merged = {};
  for (const file of files) {
    Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
  }
  return { merged, files };
}

const en = loadMerged('en');
const enKeys = Object.keys(flatten(en.merged)).sort();
let failed = false;

for (const locale of locales.filter((l) => l !== 'en')) {
  const { merged, files } = loadMerged(locale);

  if (files.join() !== en.files.join()) {
    failed = true;
    console.error(`[i18n-parity] ${locale}: domain file set differs from en`);
    console.error('  en:', en.files.join(', '));
    console.error(`  ${locale}:`, files.join(', '));
  }

  const keys = flatten(merged);
  const missing = enKeys.filter((k) => !(k in keys));
  const extra = Object.keys(keys).filter((k) => !(k in flatten(en.merged)));

  if (missing.length || extra.length) {
    failed = true;
    console.error(
      `[i18n-parity] ${locale}: missing=${missing.length} extra=${extra.length}`,
    );
    if (missing.length) {
      console.error(
        '  missing:',
        missing.slice(0, 40).join(', '),
        missing.length > 40 ? '…' : '',
      );
    }
    if (extra.length) {
      console.error(
        '  extra:',
        extra.slice(0, 40).join(', '),
        extra.length > 40 ? '…' : '',
      );
    }
  } else {
    console.log(`[i18n-parity] ${locale}: OK (${enKeys.length} keys, ${files.length} files)`);
  }
}

if (failed) {
  process.exit(1);
}
console.log(
  `[i18n-parity] admin en/hi/pa key parity green (${enKeys.length} keys across ${en.files.length} domain files)`,
);
