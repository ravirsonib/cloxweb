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

export function suggestedGvmKgForClass(vehicleClass: string | null | undefined): number {
  const key = String(vehicleClass ?? '').toUpperCase() as VehicleClass;
  return SUGGESTED_GVM_KG[key] ?? SUGGESTED_GVM_KG.RIGID_1_2T;
}

export function suggestedTareKgForClass(vehicleClass: string | null | undefined): number {
  const key = String(vehicleClass ?? '').toUpperCase() as VehicleClass;
  return SUGGESTED_TARE_KG[key] ?? SUGGESTED_TARE_KG.RIGID_1_2T;
}

/** Keep in sync with api/src/modules/jobs/job-pricing.util.ts (G0-12 ranks). */
const VEHICLE_CLASS_RANK: Record<string, number> = {
  UTE: 1,
  VAN: 2,
  RIGID_1_2T: 3,
  RIGID_3_4T: 4,
  SEMI: 5,
  BDOUBLE: 6,
};

export function vehicleClassRank(vehicleClass: string | null | undefined): number {
  if (!vehicleClass) return 0;
  return VEHICLE_CLASS_RANK[vehicleClass.toUpperCase()] ?? 0;
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
): boolean {
  if (!minClass) return true;
  return vehicleClassRank(offeredClass) >= vehicleClassRank(minClass);
}

/** Board/bid: rank adequate, or UTE/etc. payload covers chargeable kg for near minClass. */
export function isVehicleAdequateForJob(
  offeredClass: string | null | undefined,
  minClass: string | null | undefined,
  chargeableKg: number | null | undefined,
): boolean {
  if (isVehicleClassAdequate(offeredClass, minClass)) return true;
  if (chargeableKg == null || chargeableKg <= 0 || !offeredClass) return false;
  const offeredMax = VEHICLE_CLASS_MAX_CHARGEABLE_KG[offeredClass.toUpperCase()];
  if (offeredMax == null || chargeableKg > offeredMax) return false;
  const weightMin = recommendVehicleClass(chargeableKg);
  if (!minClass) return isVehicleClassAdequate(offeredClass, weightMin);
  if (vehicleClassRank(minClass) > vehicleClassRank(weightMin) + 1) return false;
  return isVehicleClassAdequate(offeredClass, weightMin);
}

export function abnSchema(requiredMessage: string, invalidMessage: string) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .regex(/^\d{11}$/, invalidMessage);
}

/** Optional AU phone — empty OK; rejects letters/junk; +61 or 0… digits. */
export function optionalPhoneSchema(invalidMessage: string) {
  return z
    .string()
    .trim()
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
