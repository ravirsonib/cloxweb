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
