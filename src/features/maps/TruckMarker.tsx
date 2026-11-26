import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';

export type TruckMarkerProps = {
  map: maplibregl.Map | null;
  lat: number;
  lng: number;
  heading?: number | null;
  paused?: boolean;
};

function computeBearingDeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number | null {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  if (Math.abs(dLat) < 1e-6 && Math.abs(dLng) < 1e-6) return null;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const lonDiff = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(lonDiff) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lonDiff);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function createTruckElement(paused: boolean): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', paused ? 'Truck paused on break' : 'Live truck location');
  el.style.width = '36px';
  el.style.height = '36px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.borderRadius = '9999px';
  el.style.background = paused ? '#64748b' : '#ff6a00';
  el.style.border = '3px solid #ffffff';
  el.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.35)';
  el.style.transition = 'background-color 200ms ease';
  el.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 19 21 12 17 5 21 12 2" fill="#ffffff" />
    </svg>
  `;
  return el;
}

const ANIMATION_MS = 750;

export function TruckMarker({ map, lat, lng, heading, paused = false }: TruckMarkerProps) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map) return;

    const el = createTruckElement(paused);
    elRef.current = el;
    const marker = new maplibregl.Marker({
      element: el,
      rotationAlignment: 'map',
      pitchAlignment: 'map',
    })
      .setLngLat([lng, lat])
      .addTo(map);

    if (typeof heading === 'number' && Number.isFinite(heading)) {
      marker.setRotation(heading);
    }

    markerRef.current = marker;
    posRef.current = { lat, lng };

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      marker.remove();
      markerRef.current = null;
      elRef.current = null;
      posRef.current = null;
    };
    // Only recreate marker when map instance changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (elRef.current) {
      elRef.current.style.background = paused ? '#64748b' : '#ff6a00';
      elRef.current.setAttribute(
        'aria-label',
        paused ? 'Truck paused on break' : 'Live truck location',
      );
    }
  }, [paused]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = posRef.current ?? { lat, lng };
    const to = { lat, lng };

    const targetBearing =
      typeof heading === 'number' && Number.isFinite(heading)
        ? heading
        : computeBearingDeg(from, to);
    if (targetBearing != null) {
      marker.setRotation(targetBearing);
    }

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const dLat = to.lat - from.lat;
    const dLng = to.lng - from.lng;
    if (Math.abs(dLat) < 1e-7 && Math.abs(dLng) < 1e-7) {
      marker.setLngLat([to.lng, to.lat]);
      posRef.current = to;
      return;
    }

    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / ANIMATION_MS);
      // Ease-out cubic for natural deceleration between GPS pings
      const eased = 1 - (1 - progress) ** 3;
      const curLat = from.lat + dLat * eased;
      const curLng = from.lng + dLng * eased;
      marker.setLngLat([curLng, curLat]);
      posRef.current = { lat: curLat, lng: curLng };
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [lat, lng, heading]);

  return null;
}
