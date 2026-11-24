import { getDriverTrip, tripLocation, type TripSummary } from '@/lib/api/trips';

export type TripLocationResult = {
  geofence?: {
    activeStopId?: string | null;
    stopType?: string | null;
    inside?: boolean;
    entered?: boolean;
  };
};

type StopRow = NonNullable<NonNullable<TripSummary['job']>['stops']>[number];
type ProgressRow = NonNullable<TripSummary['stopsProgress']>[number];

function progressForStop(
  stop: StopRow,
  progress: ProgressRow[],
): ProgressRow | undefined {
  if (stop.id) {
    return progress.find((p) => p.jobStopId === stop.id);
  }
  return progress.find((p) => p.stop?.sequence === stop.sequence);
}

function isStopGeofenceDone(stop: StopRow, progress: ProgressRow[]): boolean {
  const p = progressForStop(stop, progress);
  return Boolean(p?.arrivalRecorded && p.exitedAt);
}

/** Dual ping — matches server antiBounceSamples default of 2. */
export async function pingLocationTwice(
  tripId: string,
  lat: number,
  lng: number,
): Promise<TripLocationResult> {
  await tripLocation(tripId, lat, lng);
  return tripLocation(tripId, lat, lng) as Promise<TripLocationResult>;
}

export function findNextDropoffTarget(
  trip: TripSummary,
): StopRow | null {
  const stops = [...(trip.job?.stops ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const progress = trip.stopsProgress ?? [];
  const dropoffs = stops.filter(
    (s) => String(s.stopType).toUpperCase() === 'DROPOFF',
  );
  return (
    dropoffs.find((s) => {
      const p = progressForStop(s, progress);
      return !p?.enteredAt && !p?.exitedAt;
    }) ??
    dropoffs.find((s) => s.lat != null && s.lng != null) ??
    dropoffs[0] ??
    null
  );
}

/**
 * Close every stop before the target drop-off (enter then leave if needed)
 * so geofence active-stop can advance. Needed when pickup was skipped/far away.
 */
export async function closeStopsBeforeDropoff(
  tripId: string,
  target: StopRow,
): Promise<TripSummary> {
  let trip = await getDriverTrip(tripId);
  const stops = [...(trip.job?.stops ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );

  for (const stop of stops) {
    if (target.id && stop.id === target.id) break;
    if (stop.sequence >= target.sequence) break;

    trip = await getDriverTrip(tripId);
    const progress = trip.stopsProgress ?? [];
    if (isStopGeofenceDone(stop, progress)) continue;

    if (stop.lat == null || stop.lng == null) {
      const place = stop.suburb?.trim() || String(stop.stopType);
      throw new Error(`PRIOR_STOP_NO_COORDS:${place}`);
    }

    const lat = Number(stop.lat);
    const lng = Number(stop.lng);
    const inside = { lat: lat + 0.00005, lng: lng + 0.00005 };
    const outside = { lat: lat + 0.01, lng: lng + 0.01 };
    const row = progressForStop(stop, progress);

    if (!row?.enteredAt) {
      await pingLocationTwice(tripId, inside.lat, inside.lng);
    }
    await pingLocationTwice(tripId, outside.lat, outside.lng);
  }

  return getDriverTrip(tripId);
}

export function isDropoffArrival(
  result: TripLocationResult | null | undefined,
): boolean {
  const g = result?.geofence;
  if (!g) return false;
  return (
    Boolean(g.entered) && String(g.stopType ?? '').toUpperCase() === 'DROPOFF'
  );
}

/**
 * Ensure prior stops are closed, then dual-ping at the drop-off (device GPS if near,
 * else drop pin). Throws coded errors for the UI to map to i18n.
 */
export async function arriveAtDropoffViaGeofence(
  tripId: string,
  device: { lat: number; lng: number } | null,
  distanceMetersFn: (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ) => number,
): Promise<TripLocationResult> {
  let trip = await getDriverTrip(tripId);
  const target = findNextDropoffTarget(trip);
  if (!target) {
    throw new Error('NO_DROPOFF');
  }
  if (target.lat == null || target.lng == null) {
    throw new Error('DROPOFF_NO_COORDS');
  }

  trip = await closeStopsBeforeDropoff(tripId, target);

  const stopPoint = { lat: Number(target.lat), lng: Number(target.lng) };
  const nearEnough =
    device != null && distanceMetersFn(device, stopPoint) <= 500;
  const point =
    nearEnough && device
      ? device
      : { lat: stopPoint.lat + 0.00005, lng: stopPoint.lng + 0.00005 };

  const result = await pingLocationTwice(tripId, point.lat, point.lng);
  if (!isDropoffArrival(result)) {
    const stopType = String(result.geofence?.stopType ?? 'UNKNOWN');
    throw new Error(`ARRIVAL_NOT_DROPOFF:${stopType}`);
  }
  return result;
}
