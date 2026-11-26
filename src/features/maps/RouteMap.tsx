import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import polyline from '@mapbox/polyline';
import { cn } from '@/lib/cn';
import { TruckMarker } from './TruckMarker';

export type MapStopPin = {
  id?: string;
  sequence?: number;
  stopType: string;
  label?: string | null;
  suburb?: string | null;
  lat: number;
  lng: number;
  isNext?: boolean;
};

export type MapTruckPosition = {
  lat: number;
  lng: number;
  heading?: number | null;
  paused?: boolean;
};

export type RouteMapProps = {
  /** Valhalla precision-6 encoded polyline. */
  encodedPolyline?: string | null;
  stops?: MapStopPin[];
  truck?: MapTruckPosition | null;
  /** Gently pan camera when truck moves near viewport edge. */
  followTruck?: boolean;
  className?: string;
  /** Accessible label for the map region. */
  ariaLabel?: string;
};

const ROUTE_SOURCE_ID = 'clox-route-source';
const ROUTE_OUTLINE_LAYER_ID = 'clox-route-outline';
const ROUTE_LINE_LAYER_ID = 'clox-route-line';

const OSM_RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

function createStopMarkerEl(stop: MapStopPin, index: number): HTMLDivElement {
  const isPickup = stop.stopType === 'PICKUP';
  const badgeNumber = stop.sequence != null ? stop.sequence + 1 : index + 1;
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.width = stop.isNext ? '30px' : '26px';
  el.style.height = stop.isNext ? '30px' : '26px';
  el.style.borderRadius = '9999px';
  el.style.fontSize = '11px';
  el.style.fontWeight = '700';
  el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  el.style.color = '#ffffff';
  el.style.background = stop.isNext
    ? '#ff6a00'
    : isPickup
      ? '#0f766e'
      : '#1e293b';
  el.style.border = stop.isNext ? '3px solid #fff7ed' : '2px solid #ffffff';
  el.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.35)';
  el.textContent = String(badgeNumber);
  el.title = [
    `#${badgeNumber} ${stop.stopType}`,
    stop.suburb ?? stop.label ?? '',
    stop.isNext ? '(Next stop)' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return el;
}

export function RouteMap({
  encodedPolyline,
  stops = [],
  truck = null,
  followTruck = false,
  className,
  ariaLabel = 'Route map',
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const hasFitInitialBoundsRef = useRef(false);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const routeCoordinates = useMemo<Array<[number, number]>>(() => {
    if (!encodedPolyline) return [];
    try {
      const decoded = polyline.decode(encodedPolyline, 6);
      return decoded.map(([lat, lng]) => [lng, lat]);
    } catch {
      return [];
    }
  }, [encodedPolyline]);

  const validStops = useMemo(
    () =>
      stops.filter(
        (s) =>
          typeof s.lat === 'number' &&
          typeof s.lng === 'number' &&
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lng),
      ),
    [stops],
  );

  // Initialize MapLibre once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialCenter: [number, number] = truck
      ? [truck.lng, truck.lat]
      : validStops[0]
        ? [validStops[0].lng, validStops[0].lat]
        : [144.9631, -37.8136]; // Melbourne default

    const map = new maplibregl.Map({
      container,
      style: OSM_RASTER_STYLE,
      center: initialCenter,
      zoom: 11,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => {
      setStyleReady(true);
    });

    mapRef.current = map;
    setMapInstance(map);

    return () => {
      stopMarkersRef.current.forEach((m) => m.remove());
      stopMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
      setStyleReady(false);
      hasFitInitialBoundsRef.current = false;
    };
    // Mount map once per component lifecycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw or update road polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates,
      },
    };

    const existing = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: geojson,
      });
      map.addLayer({
        id: ROUTE_OUTLINE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 7,
          'line-opacity': 0.85,
        },
      });
      map.addLayer({
        id: ROUTE_LINE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ff6a00',
          'line-width': 4,
          'line-opacity': 0.95,
        },
      });
    }
  }, [routeCoordinates, styleReady]);

  // Render stop markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = validStops.map((stop, idx) => {
      const el = createStopMarkerEl(stop, idx);
      const popupText = [
        `#${stop.sequence != null ? stop.sequence + 1 : idx + 1} ${stop.stopType}`,
        stop.suburb ?? stop.label ?? '',
      ]
        .filter(Boolean)
        .join(' · ');
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(popupText))
        .addTo(map);
      return marker;
    });
  }, [validStops, mapInstance]);

  // Fit bounds when route or stops load/change (initial paint or non-following mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    if (followTruck && hasFitInitialBoundsRef.current) return;

    const bounds = new maplibregl.LngLatBounds();
    let count = 0;
    for (const coord of routeCoordinates) {
      bounds.extend(coord);
      count += 1;
    }
    for (const s of validStops) {
      bounds.extend([s.lng, s.lat]);
      count += 1;
    }
    if (truck) {
      bounds.extend([truck.lng, truck.lat]);
      count += 1;
    }

    if (count >= 2) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 500 });
      hasFitInitialBoundsRef.current = true;
    } else if (count === 1) {
      const single: [number, number] = truck
        ? [truck.lng, truck.lat]
        : validStops[0]
          ? [validStops[0].lng, validStops[0].lat]
          : routeCoordinates[0];
      map.easeTo({ center: single, zoom: 13, duration: 400 });
      hasFitInitialBoundsRef.current = true;
    }
  }, [routeCoordinates, validStops, truck, followTruck, styleReady]);

  // Loosely follow truck when followTruck is enabled
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !followTruck || !truck || truck.paused) return;
    if (!hasFitInitialBoundsRef.current) return;

    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const padLng = (east - west) * 0.2;
    const padLat = (north - south) * 0.2;

    const insideInnerBox =
      truck.lng >= west + padLng &&
      truck.lng <= east - padLng &&
      truck.lat >= south + padLat &&
      truck.lat <= north - padLat;

    if (!insideInnerBox) {
      map.easeTo({ center: [truck.lng, truck.lat], duration: 600 });
    }
  }, [truck, followTruck, styleReady]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={ariaLabel}
      className={cn(
        'relative h-72 w-full overflow-hidden rounded-clox-lg border border-clox-border bg-clox-surface sm:h-80',
        className,
      )}
    >
      {truck && styleReady ? (
        <TruckMarker
          map={mapInstance}
          lat={truck.lat}
          lng={truck.lng}
          heading={truck.heading}
          paused={truck.paused}
        />
      ) : null}
    </div>
  );
}
