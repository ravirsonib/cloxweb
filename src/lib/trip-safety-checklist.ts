/**
 * Gate A pre-trip checklist — keep IDs in sync with api/src/shared/trip-safety-checklist.ts
 * Docs: UI-UX DRV-MOB-03 + technical-operational-specification pre-trip checklist.
 */

export const NHVR_VEHICLE_SAFETY_GUIDE_URL =
  'https://www.nhvr.gov.au/safety-accreditation-compliance/vehicle-standards-and-safety';

export const NHVR_FATIGUE_GUIDE_URL =
  'https://www.nhvr.gov.au/safety-accreditation-compliance/fatigue-management';

export const TRIP_SAFETY_CHECK_ITEM_IDS = [
  'WHEELS_TYRES',
  'BRAKES_AIR',
  'LIGHTS',
  'ENGINE_FLUIDS',
  'CABIN_SAFETY',
  'LOAD_COUPLINGS',
  'FIT_FOR_DUTY',
] as const;

export type TripSafetyCheckItemId = (typeof TRIP_SAFETY_CHECK_ITEM_IDS)[number];

export type TripSafetyCheckItemDef = {
  id: TripSafetyCheckItemId;
  /** i18n key under trips.safetyItems.* */
  labelKey: string;
  defaultLabel: string;
  hintKey: string;
  defaultHint: string;
};

export const TRIP_SAFETY_CHECK_ITEMS: readonly TripSafetyCheckItemDef[] = [
  {
    id: 'WHEELS_TYRES',
    labelKey: 'trips.safetyItems.wheelsTyres',
    defaultLabel: 'Wheels & tyres',
    hintKey: 'trips.safetyItems.wheelsTyresHint',
    defaultHint: 'Tread ≥ 1.5 mm, no cuts/bulges, wheel nuts secure',
  },
  {
    id: 'BRAKES_AIR',
    labelKey: 'trips.safetyItems.brakesAir',
    defaultLabel: 'Brakes & air',
    hintKey: 'trips.safetyItems.brakesAirHint',
    defaultHint: 'Service and parking brakes hold; no air leaks',
  },
  {
    id: 'LIGHTS',
    labelKey: 'trips.safetyItems.lights',
    defaultLabel: 'Lights & signals',
    hintKey: 'trips.safetyItems.lightsHint',
    defaultHint: 'Headlights, indicators, markers clear; no dash warnings',
  },
  {
    id: 'ENGINE_FLUIDS',
    labelKey: 'trips.safetyItems.engineFluids',
    defaultLabel: 'Engine & fluids',
    hintKey: 'trips.safetyItems.engineFluidsHint',
    defaultHint: 'No leaks; oil and coolant in range',
  },
  {
    id: 'CABIN_SAFETY',
    labelKey: 'trips.safetyItems.cabinSafety',
    defaultLabel: 'Cabin & safety gear',
    hintKey: 'trips.safetyItems.cabinSafetyHint',
    defaultHint: 'Windscreen, seatbelts, extinguisher; triangles if GVM > 12t',
  },
  {
    id: 'LOAD_COUPLINGS',
    labelKey: 'trips.safetyItems.loadCouplings',
    defaultLabel: 'Load restraints & couplings',
    hintKey: 'trips.safetyItems.loadCouplingsHint',
    defaultHint: 'Load restrained; couplings engaged and locked',
  },
  {
    id: 'FIT_FOR_DUTY',
    labelKey: 'trips.safetyItems.fitForDuty',
    defaultLabel: 'Fit for duty / rest',
    hintKey: 'trips.safetyItems.fitForDutyHint',
    defaultHint: 'I am fit to drive and have taken required rest under NHVR rules',
  },
] as const;

export function hasAllTripSafetyCheckItems(
  checked: ReadonlySet<string> | readonly string[],
): boolean {
  const set = checked instanceof Set ? checked : new Set(checked);
  return TRIP_SAFETY_CHECK_ITEM_IDS.every((id) => set.has(id));
}
