import { http } from '@/lib/http';

export type GeolocationRouteResponse = {
  source: 'valhalla' | 'osrm' | 'direct';
  encodedPolyline: string;
  distanceKm: number;
  durationMin: number;
};

export type GeolocationStatusResponse = {
  module: string;
  status: 'ready' | 'degraded';
  valhalla: {
    enabled: boolean;
    reachable: boolean;
    version: string | null;
    tilesetLastModified: string | null;
  };
};

export function getGeolocationRoute(params: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  costing?: 'auto' | 'truck' | 'bicycle' | 'pedestrian';
}) {
  return http
    .get<GeolocationRouteResponse>('/geolocation/route', { params })
    .then((r) => r.data);
}

export function getGeolocationStatus() {
  return http
    .get<GeolocationStatusResponse>('/geolocation/_status')
    .then((r) => r.data);
}
