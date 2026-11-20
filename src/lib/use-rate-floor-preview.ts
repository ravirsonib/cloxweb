import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  previewRateFloor,
  type RateFloorPreview,
  type RateFloorPreviewInput,
} from '@/lib/api/jobs';

function previewKey(input: RateFloorPreviewInput | null): string {
  if (!input) return 'none';
  return [
    input.vehicleClassCode,
    input.pricingModel,
    input.distanceKm ?? '',
    input.billableHours ?? '',
    input.at ?? '',
    input.pickupState ?? '',
    input.bodyCode ?? '',
    input.requiresReefer ? '1' : '0',
    input.requiresDg ? '1' : '0',
    input.backhaul ? '1' : '0',
  ].join('|');
}

/**
 * Debounced hard-floor preview (IT guide §7.1 ~400ms).
 * UI display only — server remains source of truth.
 */
export function useRateFloorPreview(
  input: RateFloorPreviewInput | null,
  options?: { enabled?: boolean; debounceMs?: number },
) {
  const enabled = Boolean(options?.enabled ?? true) && Boolean(input?.vehicleClassCode);
  const debounceMs = options?.debounceMs ?? 400;
  const inputKey = previewKey(input);
  const [debounced, setDebounced] = useState<RateFloorPreviewInput | null>(input);

  useEffect(() => {
    if (!enabled || !input) {
      setDebounced(null);
      return;
    }
    const timer = window.setTimeout(() => setDebounced(input), debounceMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on serialized key
  }, [enabled, debounceMs, inputKey]);

  return useQuery({
    queryKey: ['jobs', 'pricing', 'floor', previewKey(debounced)],
    queryFn: () => previewRateFloor(debounced!),
    enabled: enabled && Boolean(debounced?.vehicleClassCode),
    staleTime: 15_000,
    retry: 1,
  });
}

export type { RateFloorPreview };
