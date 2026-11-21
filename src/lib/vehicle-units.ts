/**
 * Admin mirror of api/src/modules/carrier/vehicle-units.util.ts — keep in sync.
 * Multi-unit RWC / COI required roles by vehicle class + combination config.
 */

export type VehicleUnitRoleCode = 'POWERED' | 'TRAILER_1' | 'TRAILER_2' | 'TRAILER_3';

export type CombinationConfigCode =
  | 'NONE'
  | 'SEMI'
  | 'BDOUBLE'
  | 'RT_DOUBLE'
  | 'RT_TRIPLE';

export const VEHICLE_UNIT_ROLE_LABELS: Record<VehicleUnitRoleCode, string> = {
  POWERED: 'Powered unit (prime mover / truck)',
  TRAILER_1: 'Trailer 1',
  TRAILER_2: 'Trailer 2',
  TRAILER_3: 'Trailer 3',
};

const TWO_UNIT_CLASSES = new Set(['SEMI', 'CONTAINER']);

export function defaultCombinationConfigForClass(
  vehicleClass: string | null | undefined,
): CombinationConfigCode {
  const cls = (vehicleClass ?? '').trim().toUpperCase();
  if (TWO_UNIT_CLASSES.has(cls)) return 'SEMI';
  if (cls === 'BDOUBLE') return 'BDOUBLE';
  if (cls === 'ROAD_TRAIN') return 'RT_DOUBLE';
  return 'NONE';
}

export function requiredUnitsForVehicle(
  vehicleClass: string | null | undefined,
  combinationConfig?: CombinationConfigCode | null,
): VehicleUnitRoleCode[] {
  const cls = (vehicleClass ?? '').trim().toUpperCase();
  const config =
    combinationConfig && combinationConfig !== 'NONE'
      ? combinationConfig
      : defaultCombinationConfigForClass(cls);

  switch (config) {
    case 'SEMI':
      return ['POWERED', 'TRAILER_1'];
    case 'BDOUBLE':
      return ['POWERED', 'TRAILER_1', 'TRAILER_2'];
    case 'RT_DOUBLE':
      return ['POWERED', 'TRAILER_1', 'TRAILER_2'];
    case 'RT_TRIPLE':
      return ['POWERED', 'TRAILER_1', 'TRAILER_2', 'TRAILER_3'];
    case 'NONE':
    default:
      return ['POWERED'];
  }
}

export function isArticulatedClass(vehicleClass: string | null | undefined): boolean {
  const cls = (vehicleClass ?? '').trim().toUpperCase();
  return cls === 'SEMI' || cls === 'CONTAINER' || cls === 'BDOUBLE' || cls === 'ROAD_TRAIN';
}
