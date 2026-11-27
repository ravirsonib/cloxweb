import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';

export type TruckMarkerProps = {
  map: maplibregl.Map | null;
  lat: number;
  lng: number;
  heading?: number | null;
  paused?: boolean;
  label?: string | null;
  selected?: boolean;
  onClick?: () => void;
};

function computeBearingDeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number | null {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  // Ignore tiny GPS jitter (< ~15m) so parked trucks don't spin randomly
  if (Math.hypot(dLat, dLng) < 0.00015) return null;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const lonDiff = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(lonDiff) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lonDiff);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

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

function createTruckElement(
  paused: boolean,
  label?: string | null,
  selected?: boolean,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';
  wrapper.style.cursor = 'pointer';
  wrapper.setAttribute(
    'aria-label',
    label ? `${label} (${paused ? 'paused' : 'live'})` : paused ? 'Truck paused on break' : 'Live truck location',
  );

  const badge = document.createElement('div');
  badge.dataset.truckIcon = 'true';
  badge.style.width = selected ? '40px' : '36px';
  badge.style.height = selected ? '40px' : '36px';
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.borderRadius = '9999px';
  badge.style.background = paused ? '#64748b' : '#ff6a00';
  badge.style.border = selected ? '3px solid #0f172a' : '3px solid #ffffff';
  badge.style.boxShadow = selected
    ? '0 0 0 4px rgba(255, 106, 0, 0.35), 0 4px 12px rgba(15, 23, 42, 0.4)'
    : '0 4px 12px rgba(15, 23, 42, 0.35)';
  badge.style.transition = 'background-color 200ms ease, transform 200ms ease';
  badge.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 19 21 12 17 5 21 12 2" fill="#ffffff" />
    </svg>
  `;
  wrapper.appendChild(badge);

  if (label) {
    const tag = document.createElement('span');
    tag.dataset.truckLabel = 'true';
    tag.textContent = label;
    tag.style.marginTop = '3px';
    tag.style.padding = '1px 6px';
    tag.style.borderRadius = '6px';
    tag.style.fontSize = '10px';
    tag.style.fontWeight = '700';
    tag.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
    tag.style.color = '#ffffff';
    tag.style.background = selected ? '#0f172a' : 'rgba(15, 23, 42, 0.85)';
    tag.style.whiteSpace = 'nowrap';
    tag.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.25)';
    wrapper.appendChild(tag);
  }

  return wrapper;
}

const ANIMATION_MS = 750;

export function TruckMarker({
  map,
  lat,
  lng,
  heading,
  paused = false,
  label,
  selected = false,
  onClick,
}: TruckMarkerProps) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (!map || !isValidCoord(lat, lng)) return;

    const el = createTruckElement(paused, label, selected);
    el.style.zIndex = selected ? '10' : '1';
    const handleClick = () => onClickRef.current?.();
    el.addEventListener('click', handleClick);
    elRef.current = el;
    const marker = new maplibregl.Marker({
      element: el,
      rotationAlignment: label ? 'viewport' : 'map',
      pitchAlignment: 'map',
    })
      .setLngLat([lng, lat])
      .addTo(map);

    if (!label && typeof heading === 'number' && Number.isFinite(heading)) {
      marker.setRotation(heading);
    }

    markerRef.current = marker;
    posRef.current = { lat, lng };

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      el.removeEventListener('click', handleClick);
      marker.remove();
      markerRef.current = null;
      elRef.current = null;
      posRef.current = null;
    };
    // Only recreate marker when map instance or label presence changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, label]);

  useEffect(() => {
    const wrapper = elRef.current;
    if (!wrapper) return;
    wrapper.style.zIndex = selected ? '10' : '1';
    const badge = wrapper.querySelector<HTMLDivElement>('[data-truck-icon="true"]');
    if (badge) {
      badge.style.background = paused ? '#64748b' : '#ff6a00';
      badge.style.width = selected ? '40px' : '36px';
      badge.style.height = selected ? '40px' : '36px';
      badge.style.border = selected ? '3px solid #0f172a' : '3px solid #ffffff';
      badge.style.boxShadow = selected
        ? '0 0 0 4px rgba(255, 106, 0, 0.35), 0 4px 12px rgba(15, 23, 42, 0.4)'
        : '0 4px 12px rgba(15, 23, 42, 0.35)';
    }
    const tag = wrapper.querySelector<HTMLSpanElement>('[data-truck-label="true"]');
    if (tag) {
      tag.style.background = selected ? '#0f172a' : 'rgba(15, 23, 42, 0.85)';
    }
    wrapper.setAttribute(
      'aria-label',
      label ? `${label} (${paused ? 'paused' : 'live'})` : paused ? 'Truck paused on break' : 'Live truck location',
    );
  }, [paused, selected, label]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !isValidCoord(lat, lng)) return;

    const from = posRef.current ?? { lat, lng };
    const to = { lat, lng };

    const targetBearing =
      typeof heading === 'number' && Number.isFinite(heading)
        ? heading
        : computeBearingDeg(from, to);
    if (targetBearing != null) {
      if (label) {
        const badge = elRef.current?.querySelector<HTMLDivElement>('[data-truck-icon="true"]');
        if (badge) {
          badge.style.transform = `rotate(${Math.round(targetBearing)}deg)`;
        }
      } else {
        marker.setRotation(targetBearing);
      }
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
