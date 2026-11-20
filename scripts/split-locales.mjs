/**
 * One-shot: peel domain keys out of locales/{en,hi,pa}/common.json
 * into sibling JSON files. Residual shared keys stay in common.json.
 *
 * Run: node admin/scripts/split-locales.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesRoot = path.resolve(__dirname, '../src/locales');
const langs = ['en', 'hi', 'pa'];

/** top-level key → domain file (without .json). Unlisted keys stay in common.json */
const DOMAIN_KEYS = {
  jobs: ['jobs', 'jobStatuses', 'loadTypes', 'market', 'assignments'],
  validation: ['validation'],
  senderOnboarding: ['senderOnboarding', 'senderRegister'],
  carrierOnboarding: ['carrierOnboarding', 'carrierRegister'],
  driverOnboarding: ['driverOnboarding', 'driverInvite', 'driverSchedule', 'drivers'],
  partnerOnboarding: [
    'partnerOnboarding',
    'partnerPerformance',
    'opsPartners',
    'growth',
    'leadStatuses',
    'leadTypes',
  ],
  finance: ['finance', 'surcharges', 'revenueSplit', 'platformSettings'],
  trips: ['trips', 'tripStatuses', 'exceptions', 'track'],
  fleet: ['fleet', 'fleetAnalytics', 'fleetPlus', 'adminVehicleClasses'],
  account: ['account', 'notifications', 'documentsUpload'],
  admin: [
    'admin',
    'adminInvite',
    'adminJobs',
    'adminUserStatuses',
    'companies',
    'companyStatuses',
    'compliance',
    'dataView',
  ],
};

const claimed = new Set(Object.values(DOMAIN_KEYS).flat());

function splitLocale(lang) {
  const commonPath = path.join(localesRoot, lang, 'common.json');
  const raw = JSON.parse(fs.readFileSync(commonPath, 'utf8'));
  const remaining = { ...raw };

  for (const [domain, keys] of Object.entries(DOMAIN_KEYS)) {
    const slice = {};
    for (const key of keys) {
      if (!(key in remaining)) {
        console.warn(`[${lang}] missing key "${key}" (skip)`);
        continue;
      }
      slice[key] = remaining[key];
      delete remaining[key];
    }
    const outPath = path.join(localesRoot, lang, `${domain}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(slice, null, 2)}\n`, 'utf8');
    console.log(`[${lang}] wrote ${domain}.json (${Object.keys(slice).length} roots)`);
  }

  const leftovers = Object.keys(remaining).filter((k) => claimed.has(k));
  if (leftovers.length) {
    throw new Error(`[${lang}] claimed keys still in remaining: ${leftovers.join(', ')}`);
  }

  fs.writeFileSync(commonPath, `${JSON.stringify(remaining, null, 2)}\n`, 'utf8');
  console.log(`[${lang}] common.json now ${Object.keys(remaining).length} shared roots`);
}

for (const lang of langs) {
  const probe = path.join(localesRoot, lang, 'jobs.json');
  if (fs.existsSync(probe)) {
    console.error(
      `Refusing to run: ${path.relative(process.cwd(), probe)} already exists.\n` +
        'Delete domain *.json files (keep a restored monolith common.json) before re-splitting.',
    );
    process.exit(1);
  }
}

for (const lang of langs) {
  splitLocale(lang);
}

console.log('Done. locales/index.ts merges domain JSON into the common namespace.');
