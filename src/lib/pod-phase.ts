/**
 * POD finalized on every dropoff, but trip not yet COMPLETED (driver still needs
 * geofence exit). Used for carrier/admin “awaiting exit” clarity — not a JobStatus.
 */
export function isPodAwaitingDriverExit(params: {
  tripStatus?: string | null;
  dropoffs: Array<{ podStatus: string }>;
}): boolean {
  const status = params.tripStatus?.trim();
  if (!status || status === 'COMPLETED' || status === 'CANCELLED') {
    return false;
  }
  if (params.dropoffs.length < 1) return false;
  return params.dropoffs.every((d) => d.podStatus === 'FINALIZED');
}
