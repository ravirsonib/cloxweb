import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

export type LiveVehicleLocation = {
  tripId: string;
  driverId: string;
  vehicleId?: string;
  lat: number;
  lng: number;
  snappedLat?: number;
  snappedLng?: number;
  speedKph?: number;
  heading?: number;
  timestamp: string;
};

export type LiveJobEta = {
  jobId: string;
  nextStopId: string;
  etaMinutes: number;
  timestamp: string;
};

export type UseTrackingSocketOptions = {
  tripId?: string | null;
  jobId?: string | null;
  /** Reusable Phase C seam for carrier fleet live maps. */
  fleetCompanyId?: string | null;
  enabled?: boolean;
};

export type TrackingSocketState = {
  connected: boolean;
  latestLocation: LiveVehicleLocation | null;
  latestEta: LiveJobEta | null;
  error: string | null;
};

function resolveSocketOrigin(): string {
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/v1';
  try {
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      return new URL(apiBase).origin;
    }
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
  } catch {
    // Fallback below
  }
  return 'http://localhost:3000';
}

export function useTrackingSocket(options: UseTrackingSocketOptions): TrackingSocketState {
  const { tripId, jobId, fleetCompanyId, enabled = true } = options;
  const accessToken = useAuthStore((s) => s.accessToken);

  const [connected, setConnected] = useState(false);
  const [latestLocation, setLatestLocation] = useState<LiveVehicleLocation | null>(null);
  const [latestEta, setLatestEta] = useState<LiveJobEta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hasTarget = Boolean(tripId || jobId || fleetCompanyId);
    if (!enabled || !accessToken || !hasTarget) {
      setConnected(false);
      return;
    }

    const origin = resolveSocketOrigin();
    const socket: Socket = io(`${origin}/tracking`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    const subscribe = () => {
      if (tripId) {
        socket.emit('subscribe:trip', { tripId });
      }
      if (jobId) {
        socket.emit('subscribe:job', { jobId });
      }
      if (fleetCompanyId) {
        socket.emit('subscribe:fleet', { companyId: fleetCompanyId });
      }
    };

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      subscribe();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err: Error) => {
      setConnected(false);
      setError(err.message || 'WebSocket connection failed');
    });

    socket.on('exception', (payload: { message?: string } | string) => {
      const msg = typeof payload === 'string' ? payload : payload?.message ?? 'Subscription rejected';
      setError(msg);
    });

    socket.on('vehicle:location', (payload: LiveVehicleLocation) => {
      if (tripId && payload.tripId !== tripId) return;
      setLatestLocation(payload);
    });

    socket.on('job:eta-update', (payload: LiveJobEta) => {
      if (jobId && payload.jobId !== jobId) return;
      setLatestEta(payload);
    });

    return () => {
      if (tripId && socket.connected) {
        socket.emit('unsubscribe:trip', { tripId });
      }
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [accessToken, enabled, tripId, jobId, fleetCompanyId]);

  return { connected, latestLocation, latestEta, error };
}
