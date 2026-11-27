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
  label?: string | null;
};

export type MapTruckItem = MapTruckPosition & {
  id: string;
  selected?: boolean;
};

export type RouteMapProps = {
  /** Valhalla precision-6 encoded polyline. */
  encodedPolyline?: string | null;
  stops?: MapStopPin[];
  /** Single truck (sender / driver track). */
  truck?: MapTruckPosition | null;
  /** Multiple trucks (carrier fleet live map). */
  trucks?: MapTruckItem[];
  onSelectTruck?: (id: string) => void;
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

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

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
  trucks = [],
  onSelectTruck,
  followTruck = false,
  className,
  ariaLabel = 'Route map',
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const hasFitInitialBoundsRef = useRef(false);
  const lastFitPolylineRef = useRef<string | null | undefined>(undefined);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [userPannedAway, setUserPannedAway] = useState(false);

  const routeCoordinates = useMemo<Array<[number, number]>>(() => {
    if (!encodedPolyline) return [];
    try {
      const decoded = polyline.decode(encodedPolyline, 6);
      return decoded
        .filter(([lat, lng]) => isValidCoord(lat, lng))
        .map(([lat, lng]) => [lng, lat]);
    } catch {
      return [];
    }
  }, [encodedPolyline]);

  const validStops = useMemo(
    () => stops.filter((s) => isValidCoord(s.lat, s.lng)),
    [stops],
  );

  const validTruck = useMemo(
    () => (truck && isValidCoord(truck.lat, truck.lng) ? truck : null),
    [truck],
  );

  const validTrucks = useMemo(
    () => trucks.filter((item) => isValidCoord(item.lat, item.lng)),
    [trucks],
  );

  // Initialize MapLibre once + ResizeObserver for responsive sidebar/orientation changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialCenter: [number, number] = validTruck
      ? [validTruck.lng, validTruck.lat]
      : validTrucks[0]
        ? [validTrucks[0].lng, validTrucks[0].lat]
        : validStops[0]
          ? [validStops[0].lng, validStops[0].lat]
          : [144.9631, -37.8136]; // Melbourne default

    const isTouchDevice =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: OSM_RASTER_STYLE,
        center: initialCenter,
        zoom: 11,
        attributionControl: { compact: true },
        cooperativeGestures: isTouchDevice,
      });
    } catch {
      setMapError('Interactive map is unavailable on this browser (WebGL disabled).');
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => {
      setStyleReady(true);
      setMapError(null);
    });

    map.on('dragstart', () => {
      setUserPannedAway(true);
    });

    const canvas = map.getCanvas();
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setMapError('Map rendering paused (WebGL context lost).');
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    // Keep map tiles aligned when sidebar collapses/expands or screen rotates
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        map.resize();
      });
      ro.observe(container);
    }

    mapRef.current = map;
    setMapInstance(map);

    return () => {
      ro?.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      stopMarkersRef.current.forEach((m) => m.remove());
      stopMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
      setStyleReady(false);
      hasFitInitialBoundsRef.current = false;
      lastFitPolylineRef.current = undefined;
    };
    // Mount map once per component lifecycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw or update road polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features:
        routeCoordinates.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoordinates,
                },
              },
            ]
          : [],
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

  // Fit bounds on initial data paint, or when a new road route polyline arrives (not on every GPS ping)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const polylineChanged =
      Boolean(encodedPolyline) && encodedPolyline !== lastFitPolylineRef.current;
    if (hasFitInitialBoundsRef.current && !polylineChanged) return;

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
    if (validTruck) {
      bounds.extend([validTruck.lng, validTruck.lat]);
      count += 1;
    }
    for (const item of validTrucks) {
      bounds.extend([item.lng, item.lat]);
      count += 1;
    }

    if (count >= 2) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 500 });
      hasFitInitialBoundsRef.current = true;
      lastFitPolylineRef.current = encodedPolyline;
    } else if (count === 1) {
      const single: [number, number] = validTruck
        ? [validTruck.lng, validTruck.lat]
        : validTrucks[0]
          ? [validTrucks[0].lng, validTrucks[0].lat]
          : validStops[0]
            ? [validStops[0].lng, validStops[0].lat]
            : routeCoordinates[0];
      map.easeTo({ center: single, zoom: 13, duration: 400 });
      hasFitInitialBoundsRef.current = true;
      lastFitPolylineRef.current = encodedPolyline;
    }
  }, [encodedPolyline, routeCoordinates, validStops, validTruck, validTrucks, styleReady]);

  // Loosely follow truck when followTruck is enabled (unless user manually panned away)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !followTruck || !validTruck || validTruck.paused) return;
    if (!hasFitInitialBoundsRef.current || userPannedAway) return;

    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const padLng = (east - west) * 0.2;
    const padLat = (north - south) * 0.2;

    const insideInnerBox =
      validTruck.lng >= west + padLng &&
      validTruck.lng <= east - padLng &&
      validTruck.lat >= south + padLat &&
      validTruck.lat <= north - padLat;

    if (!insideInnerBox) {
      map.easeTo({ center: [validTruck.lng, validTruck.lat], duration: 600 });
    }
  }, [validTruck, followTruck, userPannedAway, styleReady]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map || !validTruck) return;
    setUserPannedAway(false);
    map.easeTo({ center: [validTruck.lng, validTruck.lat], zoom: Math.max(map.getZoom(), 13), duration: 500 });
  };

  if (mapError) {
    return (
      <div
        role="region"
        aria-label={ariaLabel}
        className={cn(
          'flex h-48 w-full items-center justify-center rounded-clox-lg border border-clox-border bg-clox-surface px-4 text-center text-xs text-clox-mute',
          className,
        )}
      >
        {mapError}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={cn(
        'relative isolate z-0 h-72 w-full overflow-hidden rounded-clox-lg border border-clox-border bg-clox-surface sm:h-80',
        className,
      )}
    >
      <div ref={containerRef} className="h-full w-full" />
      {followTruck && userPannedAway && validTruck && !validTruck.paused ? (
        <button
          type="button"
          onClick={handleRecenter}
          className="absolute bottom-3 left-3 z-10 rounded-full border border-clox-border bg-white/95 px-3 py-1.5 text-xs font-semibold text-clox-ink shadow-md hover:bg-white"
        >
          Re-center on truck
        </button>
      ) : null}
      {validTruck && styleReady ? (
        <TruckMarker
          map={mapInstance}
          lat={validTruck.lat}
          lng={validTruck.lng}
          heading={validTruck.heading}
          paused={validTruck.paused}
          label={validTruck.label}
        />
      ) : null}
      {styleReady
        ? validTrucks.map((item) => (
            <TruckMarker
              key={item.id}
              map={mapInstance}
              lat={item.lat}
              lng={item.lng}
              heading={item.heading}
              paused={item.paused}
              label={item.label}
              selected={item.selected}
              onClick={onSelectTruck ? () => onSelectTruck(item.id) : undefined}
            />
          ))
        : null}
    </div>
  );
}
