import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import {
  getCarrierFleetLive,
  getErrorDetail,
  getGeolocationRoute,
  type CarrierFleetLiveTrip,
} from '@/lib/api';
import { LoadingBlock } from '@/components/status-blocks';
import { Notice, StatusPill } from '@/components/ui';
import {
  RouteMap,
  useTrackingSocket,
  type MapStopPin,
  type MapTruckItem,
} from '@/features/maps';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function resolveLivePoint(
  trip: CarrierFleetLiveTrip,
  wsLoc?: {
    lat: number;
    lng: number;
    snappedLat?: number;
    snappedLng?: number;
    heading?: number;
    timestamp: string;
  },
) {
  if (wsLoc) {
    const wsTime = Date.parse(wsLoc.timestamp);
    const restTime = trip.latest ? Date.parse(trip.latest.recordedAt) : 0;
    if (!Number.isNaN(wsTime) && wsTime >= restTime) {
      return {
        lat: wsLoc.snappedLat ?? wsLoc.lat,
        lng: wsLoc.snappedLng ?? wsLoc.lng,
        heading: wsLoc.heading ?? null,
        recordedAt: wsLoc.timestamp,
      };
    }
  }
  if (trip.latest) {
    return {
      lat: trip.latest.lat,
      lng: trip.latest.lng,
      heading: null,
      recordedAt: trip.latest.recordedAt,
    };
  }
  return null;
}

export function CarrierFleetMapPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const fleet = useQuery({
    queryKey: ['trips', 'fleet', 'live'],
    queryFn: () => getCarrierFleetLive(),
    enabled: role === AppRole.TRANSPORT_COMPANY,
    refetchInterval: wsConnected ? 20_000 : 5_000,
  });

  const companyId = fleet.data?.companyId ?? null;
  const trips = fleet.data?.trips ?? [];

  const socket = useTrackingSocket({
    fleetCompanyId: companyId,
    enabled: role === AppRole.TRANSPORT_COMPANY && Boolean(companyId),
  });

  useEffect(() => {
    setWsConnected(socket.connected);
  }, [socket.connected]);

  const selectedTrip = useMemo(
    () => trips.find((tr) => tr.tripId === selectedTripId) ?? null,
    [trips, selectedTripId],
  );

  const selectedLivePoint = useMemo(() => {
    if (!selectedTrip) return null;
    return resolveLivePoint(selectedTrip, socket.locationsByTrip[selectedTrip.tripId]);
  }, [selectedTrip, socket.locationsByTrip]);

  // Fetch road polyline from selected truck to its next stop when a truck is focused
  const selectedRoute = useQuery({
    queryKey: [
      'geolocation',
      'fleet-route',
      selectedTrip?.tripId,
      selectedLivePoint ? Math.round(selectedLivePoint.lat * 1000) : null,
      selectedLivePoint ? Math.round(selectedLivePoint.lng * 1000) : null,
      selectedTrip?.nextStop?.id ?? null,
    ],
    queryFn: () =>
      getGeolocationRoute({
        fromLat: selectedLivePoint!.lat,
        fromLng: selectedLivePoint!.lng,
        toLat: selectedTrip!.nextStop!.lat,
        toLng: selectedTrip!.nextStop!.lng,
        costing: 'truck',
      }),
    enabled: Boolean(selectedTrip && selectedLivePoint && selectedTrip.nextStop),
    staleTime: 30_000,
  });

  const fleetTrucks = useMemo<MapTruckItem[]>(() => {
    const items: MapTruckItem[] = [];
    for (const trip of trips) {
      const pt = resolveLivePoint(trip, socket.locationsByTrip[trip.tripId]);
      if (!pt) continue;
      items.push({
        id: trip.tripId,
        lat: pt.lat,
        lng: pt.lng,
        heading: pt.heading,
        paused: trip.onBreak,
        label: trip.vehicle?.registration || trip.vehicle?.label || trip.jobTitle || trip.tripId.slice(0, 6),
        selected: trip.tripId === selectedTripId,
      });
    }
    return items;
  }, [trips, socket.locationsByTrip, selectedTripId]);

  const mapStops = useMemo<MapStopPin[]>(() => {
    if (!selectedTrip) return [];
    return selectedTrip.stops
      .filter(
        (s): s is typeof s & { lat: number; lng: number } =>
          typeof s.lat === 'number' && typeof s.lng === 'number',
      )
      .map((s) => ({
        id: s.id,
        sequence: s.sequence,
        stopType: s.stopType,
        suburb: s.suburb,
        lat: s.lat,
        lng: s.lng,
        isNext: Boolean(selectedTrip.nextStop && s.id === selectedTrip.nextStop.id),
      }));
  }, [selectedTrip]);

  if (role !== AppRole.TRANSPORT_COMPANY) return <Navigate to="/" replace />;
  if (fleet.isLoading) {
    return (
      <LoadingBlock
        label={t('fleet.loadingLiveMap', { defaultValue: 'Loading live fleet map…' })}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink">
            {t('fleet.liveMapTitle', { defaultValue: 'Live Fleet Map' })}
          </h1>
          <p className="mt-1 text-sm text-clox-mute">
            {t('fleet.liveMapSubtitle', {
              defaultValue: 'Real-time positions for your active trips. Click a truck to inspect its route and stops.',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-clox-border bg-clox-surface px-2.5 py-0.5 font-mono text-clox-ink">
            {t('fleet.activeCount', {
              defaultValue: '{{count}} active',
              count: trips.length,
            })}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${
              socket.connected
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-clox-border bg-clox-surface text-clox-mute'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                socket.connected ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {socket.connected
              ? t('track.liveConnected', { defaultValue: 'Live' })
              : t('track.pollingFallback', { defaultValue: 'Updating every 5s' })}
          </span>
        </div>
      </div>

      {fleet.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(fleet.error)}
        </Notice>
      ) : null}

      {trips.length === 0 ? (
        <Notice tone="info" className="mt-6">
          {t('fleet.noActiveTrips', {
            defaultValue: 'No active trips on the road right now. Once a driver starts a trip, their truck will appear here live.',
          })}{' '}
          <Link to="/assignments" className="font-semibold text-clox-orange hover:underline">
            {t('nav.assignments')} →
          </Link>
        </Notice>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RouteMap
              encodedPolyline={selectedRoute.data?.encodedPolyline ?? null}
              stops={mapStops}
              trucks={fleetTrucks}
              onSelectTruck={(id) => setSelectedTripId((prev) => (prev === id ? null : id))}
              className="h-[26rem] sm:h-[32rem]"
              ariaLabel={t('fleet.liveMapTitle', { defaultValue: 'Live Fleet Map' })}
            />
            {selectedTrip && selectedRoute.data ? (
              <p className="mt-2 text-xs text-clox-mute">
                <span className="font-semibold text-clox-ink">
                  {selectedTrip.vehicle?.registration ?? selectedTrip.jobTitle ?? selectedTrip.tripId.slice(0, 8)}
                </span>{' '}
                → {selectedTrip.nextStop?.suburb ?? selectedTrip.nextStop?.stopType ?? 'Next stop'}:{' '}
                <span className="font-mono">
                  ~{selectedRoute.data.durationMin} min ({selectedRoute.data.distanceKm} km)
                </span>
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-clox-ink">
              {t('fleet.activeVehiclesHeading', { defaultValue: 'Active trips' })}
            </h2>
            <ul className="space-y-2">
              {trips.map((trip) => {
                const pt = resolveLivePoint(trip, socket.locationsByTrip[trip.tripId]);
                const isSelected = trip.tripId === selectedTripId;
                return (
                  <li key={trip.tripId}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTripId((prev) => (prev === trip.tripId ? null : trip.tripId))
                      }
                      className={`w-full rounded-clox-md border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-clox-orange bg-orange-50/50'
                          : 'border-clox-border bg-clox-surface hover:border-clox-ink/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-clox-ink">
                          {trip.vehicle?.registration ?? trip.vehicle?.label ?? 'Vehicle'}
                          {trip.vehicle?.vehicleClass ? ` · ${trip.vehicle.vehicleClass}` : ''}
                        </span>
                        <StatusPill tone={trip.onBreak ? 'warn' : 'info'}>
                          {trip.onBreak ? t('track.driverOnBreak') : trip.tripStatus}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-xs text-clox-mute">
                        {trip.jobTitle ?? trip.jobId.slice(0, 8)}
                        {trip.driver?.name ? ` · ${trip.driver.name}` : ''}
                      </p>
                      {trip.nextStop ? (
                        <p className="mt-0.5 text-xs text-clox-faint">
                          Next: #{trip.nextStop.sequence + 1} {trip.nextStop.stopType}
                          {trip.nextStop.suburb ? ` · ${trip.nextStop.suburb}` : ''}
                        </p>
                      ) : null}
                      <p className="mt-1 font-mono text-[11px] text-clox-faint">
                        {pt
                          ? `${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)} · ${new Date(pt.recordedAt).toLocaleTimeString()}`
                          : t('track.noPingsYet')}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
