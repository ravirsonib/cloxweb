import { z } from 'zod';

/** Keep in sync with api/src/shared/job-cargo.limits.ts */
export const MAX_JOB_DEAD_WEIGHT_KG = 50_000;
export const MAX_JOB_CHARGEABLE_WEIGHT_KG = 50_000;
export const MAX_JOB_LENGTH_CM = 2_000;
export const MAX_JOB_WIDTH_CM = 500;
export const MAX_JOB_HEIGHT_CM = 500;

/** Chargeable kg = max(dead, L×W×Hcm / 4000). */
export function chargeableWeightKg(params: {
  deadWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}): number {
  const volumetric = (params.lengthCm * params.widthCm * params.heightCm) / 4000;
  return Math.max(params.deadWeightKg, volumetric);
}

export function isChargeableOverLimit(chargeableKg: number): boolean {
  return chargeableKg > MAX_JOB_CHARGEABLE_WEIGHT_KG;
}

export const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;

export const AU_STATE_NAMES: Record<(typeof AU_STATES)[number], string> = {
  NSW: 'New South Wales',
  VIC: 'Victoria',
  QLD: 'Queensland',
  SA: 'South Australia',
  WA: 'Western Australia',
  TAS: 'Tasmania',
  NT: 'Northern Territory',
  ACT: 'Australian Capital Territory',
};

export const AU_STATE_OPTIONS: ReadonlyArray<{
  code: (typeof AU_STATES)[number];
  name: string;
  label: string;
}> = AU_STATES.map((code) => ({
  code,
  name: AU_STATE_NAMES[code],
  label: `${code} — ${AU_STATE_NAMES[code]}`,
}));

const AU_STATE_POSTCODE_RANGES: Record<string, ReadonlyArray<[number, number]>> = {
  NSW: [
    [1000, 2599],
    [2619, 2899],
    [2921, 2999],
  ],
  ACT: [
    [200, 299],
    [2600, 2618],
    [2900, 2920],
  ],
  VIC: [
    [3000, 3999],
    [8000, 8999],
  ],
  QLD: [
    [4000, 4999],
    [9000, 9999],
  ],
  SA: [[5000, 5999]],
  WA: [
    [6000, 6797],
    [6800, 6999],
  ],
  TAS: [[7000, 7999]],
  NT: [[800, 999]],
};

export const AU_STATE_POSTCODE_HINTS: Record<string, string> = {
  NSW: '1000–2599, 2619–2899, 2921–2999',
  ACT: '0200–0299, 2600–2618, 2900–2920',
  VIC: '3000–3999, 8000–8999',
  QLD: '4000–4999, 9000–9999',
  SA: '5000–5999',
  WA: '6000–6797, 6800–6999',
  TAS: '7000–7999',
  NT: '0800–0999',
};

/** Validates 4-digit numeric Australian postcode within valid Australia Post ranges (0200–9999). */
export function isValidAuPostcode(postcode: string | null | undefined): boolean {
  const trimmed = String(postcode ?? '').trim();
  if (!/^\d{4}$/.test(trimmed)) return false;
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(num) || num < 200) return false;
  return Object.values(AU_STATE_POSTCODE_RANGES).some((ranges) =>
    ranges.some(([min, max]) => num >= min && num <= max),
  );
}

/** Validates 4-digit Australian postcode against the selected Australian state's postcode range. */
export function isValidAuPostcodeForState(
  postcode: string | null | undefined,
  state: string | null | undefined,
): boolean {
  const trimmed = String(postcode ?? '').trim();
  if (!/^\d{4}$/.test(trimmed)) return false;
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(num) || num < 200) return false;
  const st = String(state ?? '').trim().toUpperCase();
  const ranges = AU_STATE_POSTCODE_RANGES[st];
  if (!ranges) return isValidAuPostcode(trimmed);
  return ranges.some(([min, max]) => num >= min && num <= max);
}

export function auPostcodeErrorForState(state: string | null | undefined): string {
  const st = String(state ?? '').trim().toUpperCase();
  const hint = AU_STATE_POSTCODE_HINTS[st];
  if (hint) {
    return `Enter a valid 4-digit postcode for ${st} (${hint})`;
  }
  return 'Enter a valid 4-digit Australian postcode (e.g. 3000)';
}

export const LICENCE_CLASSES = ['C', 'LR', 'MR', 'HR', 'HC', 'MC'] as const;

export const VEHICLE_CLASSES = [
  'UTE',
  'VAN',
  'RIGID_1_2T',
  'RIGID_3_4T',
  'SEMI',
  'BDOUBLE',
] as const;

export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

export type VehicleClassSpec = {
  code: VehicleClass;
  name: string;
  subTitle: string;
  rank: number;
  maxChargeableWeightKg: number;
  maxLengthCm: number;
  maxWidthCm: number;
  maxHeightCm: number;
  minLicence: string;
};

export const CLOX_VEHICLE_SPECS: readonly VehicleClassSpec[] = [
  {
    code: 'UTE',
    name: 'Ute',
    subTitle: 'Up to 1.0t',
    rank: 1,
    maxChargeableWeightKg: 1000,
    maxLengthCm: 240,
    maxWidthCm: 180,
    maxHeightCm: 150,
    minLicence: 'C',
  },
  {
    code: 'VAN',
    name: 'Van',
    subTitle: 'Up to 1.5t',
    rank: 2,
    maxChargeableWeightKg: 1500,
    maxLengthCm: 340,
    maxWidthCm: 180,
    maxHeightCm: 190,
    minLicence: 'C',
  },
  {
    code: 'RIGID_1_2T',
    name: 'Rigid 1–2T',
    subTitle: 'Up to 2.5t',
    rank: 3,
    maxChargeableWeightKg: 2500,
    maxLengthCm: 450,
    maxWidthCm: 220,
    maxHeightCm: 220,
    minLicence: 'LR',
  },
  {
    code: 'RIGID_3_4T',
    name: 'Rigid 3–4T',
    subTitle: 'Up to 5.0t',
    rank: 4,
    maxChargeableWeightKg: 5000,
    maxLengthCm: 650,
    maxWidthCm: 245,
    maxHeightCm: 250,
    minLicence: 'MR',
  },
  {
    code: 'SEMI',
    name: 'Semi-Trailer',
    subTitle: 'Up to 15.0t',
    rank: 5,
    maxChargeableWeightKg: 15000,
    maxLengthCm: 1360,
    maxWidthCm: 250,
    maxHeightCm: 270,
    minLicence: 'HC',
  },
  {
    code: 'BDOUBLE',
    name: 'B-Double',
    subTitle: 'Up to 50.0t',
    rank: 6,
    maxChargeableWeightKg: 50000,
    maxLengthCm: 2000,
    maxWidthCm: 500,
    maxHeightCm: 500,
    minLicence: 'MC',
  },
] as const;

export const VEHICLE_CLASS_RANK: Record<string, number> = Object.fromEntries(
  CLOX_VEHICLE_SPECS.map((s) => [s.code, s.rank]),
);

export type CloxLoadTypeMeta = {
  code: string;
  nameKey: string;
  defaultName: string;
  descKey: string;
  defaultDesc: string;
  badgeTone: 'neutral' | 'warn' | 'info';
  requiresDoc?: boolean;
};

export const CLOX_LOAD_TYPES: readonly CloxLoadTypeMeta[] = [
  {
    code: 'GENERAL',
    nameKey: 'loadTypes.general',
    defaultName: 'General Freight',
    descKey: 'loadTypes.generalDesc',
    defaultDesc: 'Cartons, pallets, retail stock, FMCG, general merchandise.',
    badgeTone: 'neutral',
  },
  {
    code: 'DG',
    nameKey: 'loadTypes.dg',
    defaultName: 'Dangerous Goods (DG)',
    descKey: 'loadTypes.dgDesc',
    defaultDesc: 'Flammables, toxics, batteries, gas, chemicals (SDS document required).',
    badgeTone: 'warn',
    requiresDoc: true,
  },
  {
    code: 'LIQUID',
    nameKey: 'loadTypes.liquid',
    defaultName: 'Liquid / Bulk Liquid',
    descKey: 'loadTypes.liquidDesc',
    defaultDesc: 'Drums, IBCs, oils, bulk liquids (spill containment required).',
    badgeTone: 'info',
  },
  {
    code: 'OVERSIZE',
    nameKey: 'loadTypes.oversize',
    defaultName: 'Oversize / Over-dimension',
    descKey: 'loadTypes.oversizeDesc',
    defaultDesc: 'Long steel, pipes, beams (flatbed & permit warnings apply).',
    badgeTone: 'warn',
  },
  {
    code: 'STEEL',
    nameKey: 'loadTypes.steel',
    defaultName: 'Steel / Metal',
    descKey: 'loadTypes.steelDesc',
    defaultDesc: 'Coils, rebar, metal sheets (chains & NHVR restraints required).',
    badgeTone: 'neutral',
  },
  {
    code: 'REEFER',
    nameKey: 'loadTypes.reefer',
    defaultName: 'Temperature Controlled (Reefer)',
    descKey: 'loadTypes.reeferDesc',
    defaultDesc: 'Chilled, frozen, perishable food, pharma (refrigerated unit required).',
    badgeTone: 'info',
  },
  {
    code: 'HEAVY_MACHINERY',
    nameKey: 'loadTypes.heavyMachinery',
    defaultName: 'Machinery / Heavy Equipment',
    descKey: 'loadTypes.heavyMachineryDesc',
    defaultDesc: 'Engines, mining & industrial gear, ramps & high-capacity transport.',
    badgeTone: 'neutral',
  },
  {
    code: 'VEHICLES_PLANT',
    nameKey: 'loadTypes.vehiclesPlant',
    defaultName: 'Vehicles / Plant',
    descKey: 'loadTypes.vehiclesPlantDesc',
    defaultDesc: 'Cars, excavators, forklifts, tractors, tilt-tray/ramps required.',
    badgeTone: 'neutral',
  },
  {
    code: 'CONTAINERS',
    nameKey: 'loadTypes.containers',
    defaultName: 'Containers (Port / Wharf)',
    descKey: 'loadTypes.containersDesc',
    defaultDesc: '20ft/40ft shipping containers (wharf access required).',
    badgeTone: 'info',
  },
  {
    code: 'TIMBER',
    nameKey: 'loadTypes.timber',
    defaultName: 'Timber / Building Materials',
    descKey: 'loadTypes.timberDesc',
    defaultDesc: 'Timber packs, plywood, gyprock, bricks, roofing.',
    badgeTone: 'neutral',
  },
  {
    code: 'HIGH_VALUE',
    nameKey: 'loadTypes.highValue',
    defaultName: 'High-Value / Sensitive',
    descKey: 'loadTypes.highValueDesc',
    defaultDesc: 'Electronics, medical gear, high-security sensitive freight.',
    badgeTone: 'warn',
  },
  {
    code: 'WASTE',
    nameKey: 'loadTypes.waste',
    defaultName: 'Waste / Recycling',
    descKey: 'loadTypes.wasteDesc',
    defaultDesc: 'Industrial/construction waste, scrap, EPA compliance applies.',
    badgeTone: 'neutral',
  },
] as const;

/**
 * Indicative GVM (kg) by class for form defaults only — carrier must confirm
 * against the vehicle’s compliance plate / registration papers.
 */
const SUGGESTED_GVM_KG: Record<VehicleClass, number> = {
  UTE: 3500,
  VAN: 4500,
  RIGID_1_2T: 8000,
  RIGID_3_4T: 15_000,
  SEMI: 42_500,
  BDOUBLE: 62_500,
};

/** Indicative tare (kg) defaults paired with suggested GVM. */
const SUGGESTED_TARE_KG: Record<VehicleClass, number> = {
  UTE: 2000,
  VAN: 2500,
  RIGID_1_2T: 3500,
  RIGID_3_4T: 7000,
  SEMI: 15_000,
  BDOUBLE: 20_000,
};

export function suggestedGvmKgForClass(
  vehicleClass: string | null | undefined,
  map?: Record<string, number>,
): number {
  const key = String(vehicleClass ?? '').toUpperCase();
  if (map && map[key] != null) return map[key];
  return (SUGGESTED_GVM_KG as Record<string, number>)[key] ?? SUGGESTED_GVM_KG.RIGID_1_2T;
}

export function suggestedTareKgForClass(
  vehicleClass: string | null | undefined,
  map?: Record<string, number>,
): number {
  const key = String(vehicleClass ?? '').toUpperCase();
  if (map && map[key] != null) return map[key];
  return (SUGGESTED_TARE_KG as Record<string, number>)[key] ?? SUGGESTED_TARE_KG.RIGID_1_2T;
}

export function vehicleClassRank(
  vehicleClass: string | null | undefined,
  ranks?: Record<string, number>,
): number {
  if (!vehicleClass) return 0;
  const map = ranks ?? VEHICLE_CLASS_RANK;
  return map[vehicleClass.toUpperCase()] ?? 0;
}

/** Keep in sync with api VEHICLE_CLASS_MAX_CHARGEABLE_KG / recommendVehicleClass. */
const VEHICLE_CLASS_MAX_CHARGEABLE_KG: Record<string, number> = {
  UTE: 1000,
  VAN: 1500,
  RIGID_1_2T: 2500,
  RIGID_3_4T: 5000,
  SEMI: 15_000,
  BDOUBLE: 50_000,
};

export function recommendVehicleClass(chargeableKg: number): string {
  if (chargeableKg <= 1000) return 'UTE';
  if (chargeableKg <= 1500) return 'VAN';
  if (chargeableKg <= 2500) return 'RIGID_1_2T';
  if (chargeableKg <= 5000) return 'RIGID_3_4T';
  if (chargeableKg <= 15_000) return 'SEMI';
  return 'BDOUBLE';
}

/** True if offered class is same or larger than required minimum. */
export function isVehicleClassAdequate(
  offeredClass: string | null | undefined,
  minClass: string | null | undefined,
  ranks?: Record<string, number>,
): boolean {
  if (!minClass) return true;
  return vehicleClassRank(offeredClass, ranks) >= vehicleClassRank(minClass, ranks);
}

/** Board/bid: rank adequate, or UTE/etc. payload covers chargeable kg for near minClass. */
export function isVehicleAdequateForJob(
  offeredClass: string | null | undefined,
  minClass: string | null | undefined,
  chargeableKg: number | null | undefined,
  ranks?: Record<string, number>,
): boolean {
  if (isVehicleClassAdequate(offeredClass, minClass, ranks)) return true;
  if (chargeableKg == null || chargeableKg <= 0 || !offeredClass) return false;
  const offeredMax = VEHICLE_CLASS_MAX_CHARGEABLE_KG[offeredClass.toUpperCase()];
  if (offeredMax == null || chargeableKg > offeredMax) return false;
  const weightMin = recommendVehicleClass(chargeableKg);
  if (!minClass) return isVehicleClassAdequate(offeredClass, weightMin, ranks);
  if (vehicleClassRank(minClass, ranks) > vehicleClassRank(weightMin, ranks) + 1) return false;
  return isVehicleClassAdequate(offeredClass, weightMin, ranks);
}

/** Align with API carrier/sender ABN: strip spaces, then require 11 digits. */
export function abnSchema(requiredMessage: string, invalidMessage: string) {
  return z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, ''))
    .pipe(
      z
        .string()
        .min(1, requiredMessage)
        .regex(/^\d{11}$/, invalidMessage),
    );
}

/** Optional AU phone — empty OK; rejects letters/junk; +61 or 0… digits. */
export function optionalPhoneSchema(invalidMessage: string) {
  return z
    .string()
    .trim()
    .optional()
    .superRefine((value, ctx) => {
      if (!value) return;
      if (!/^[+\d\s().\-]+$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: invalidMessage });
        return;
      }
      const digits = value.replace(/\D/g, '');
      if (!/^61\d{8,10}$/.test(digits) && !/^0\d{8,10}$/.test(digits)) {
        ctx.addIssue({ code: 'custom', message: invalidMessage });
      }
    });
}

/** Required AU phone — same digit rules as optionalPhoneSchema. */
export function requiredPhoneSchema(requiredMessage: string, invalidMessage: string) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .superRefine((value, ctx) => {
      if (!/^[+\d\s().\-]+$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: invalidMessage });
        return;
      }
      const digits = value.replace(/\D/g, '');
      if (!/^61\d{8,10}$/.test(digits) && !/^0\d{8,10}$/.test(digits)) {
        ctx.addIssue({ code: 'custom', message: invalidMessage });
      }
    });
}

export function futureDateSchema(requiredMessage: string, futureMessage: string) {
  return z
    .string()
    .min(1, requiredMessage)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00`);
      if (Number.isNaN(date.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date.getTime() > today.getTime();
    }, futureMessage);
}
