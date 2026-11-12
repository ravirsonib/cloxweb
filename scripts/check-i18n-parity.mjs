#!/usr/bin/env node
/**
 * Admin locale key-parity: en is source of truth; hi and pa must have the same keys.
 * Does not touch web/.
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

function loadKeys(locale) {
  const file = path.join(localesDir, locale, 'common.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  return flatten(json);
}

const byLocale = Object.fromEntries(locales.map((l) => [l, loadKeys(l)]));
const enKeys = Object.keys(byLocale.en);
let failed = false;

for (const locale of locales.filter((l) => l !== 'en')) {
  const keys = byLocale[locale];
  const missing = enKeys.filter((k) => !(k in keys));
  const extra = Object.keys(keys).filter((k) => !(k in byLocale.en));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`[i18n-parity] ${locale}: missing=${missing.length} extra=${extra.length}`);
    if (missing.length) console.error('  missing:', missing.slice(0, 40).join(', '), missing.length > 40 ? '…' : '');
    if (extra.length) console.error('  extra:', extra.slice(0, 40).join(', '), extra.length > 40 ? '…' : '');
  } else {
    console.log(`[i18n-parity] ${locale}: OK (${enKeys.length} keys)`);
  }
}

if (failed) {
  process.exit(1);
}
console.log(`[i18n-parity] admin en/hi/pa key parity green (${enKeys.length} keys)`);
