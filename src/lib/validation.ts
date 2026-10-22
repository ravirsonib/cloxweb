import { z } from 'zod';

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

/** True if offered class is same or larger than required minimum. */
export function isVehicleClassAdequate(
  offeredClass: string | null | undefined,
  minClass: string | null | undefined,
): boolean {
  if (!minClass) return true;
  return vehicleClassRank(offeredClass) >= vehicleClassRank(minClass);
}

export function abnSchema(requiredMessage: string, invalidMessage: string) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .regex(/^\d{11}$/, invalidMessage);
}

export function optionalPhoneSchema() {
  return z.string().trim().optional().or(z.literal(''));
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
