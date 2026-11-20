# Admin locales

i18n still uses a single namespace: **`common`**.

On disk, strings are split by domain so files stay editable:

| File | Contents (top-level roots) |
|------|----------------------------|
| `common.json` | Shared chrome — nav, home, login, toasts, statuses helpers, short verbs |
| `jobs.json` | `jobs`, `jobStatuses`, `loadTypes`, `market`, `assignments` |
| `validation.json` | `validation` |
| `senderOnboarding.json` | `senderOnboarding`, `senderRegister` |
| `carrierOnboarding.json` | `carrierOnboarding`, `carrierRegister` |
| `driverOnboarding.json` | `driverOnboarding`, `driverInvite`, `driverSchedule`, `drivers` |
| `partnerOnboarding.json` | `partnerOnboarding`, `partnerPerformance`, `opsPartners`, `growth`, leads |
| `finance.json` | `finance`, `surcharges`, `revenueSplit`, `platformSettings` |
| `trips.json` | `trips`, `tripStatuses`, `exceptions`, `track` |
| `fleet.json` | `fleet`, `fleetAnalytics`, `fleetPlus`, `adminVehicleClasses` |
| `account.json` | `account`, `notifications`, `documentsUpload` |
| `admin.json` | Ops/admin companies, compliance, invites, jobs admin |

`index.ts` merges every `*.json` in `en|hi|pa/` into `enCommon` / `hiCommon` / `paCommon`.

**Call sites:** keep `t('jobs.createHint')` and `useTranslation('common')` — no change.

**Scripts**

```bash
# only if you restore a monolith common.json again (refuses if domain files exist)
node admin/scripts/split-locales.mjs

# CI / local — merge all domain JSON per lang; deep key parity en → hi/pa
npm run i18n:parity
```
