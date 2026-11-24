import { describe, expect, it } from 'vitest';
import { findNextDropoffTarget, isDropoffArrival } from './trip-arrive-dropoff';
import type { TripSummary } from '@/lib/api/trips';

function tripFixture(partial?: {
  pickupExited?: boolean;
  dropEntered?: boolean;
}): TripSummary {
  return {
    id: 'trip-1',
    jobId: 'job-1',
    status: 'IN_TRANSIT',
    safetyPassedAt: null,
    massCheckOk: true,
    massOverDeclared: false,
    declaredMassKg: 800,
    actualMassKg: 800,
    onBreak: false,
    startedAt: '2026-11-24T00:00:00.000Z',
    gates: {
      paid: true,
      safetyOk: true,
      massOk: true,
      canStart: true,
    },
    siteAccess: null,
    vehicle: null,
    latestLocation: null,
    job: {
      title: 'Test',
      status: 'LOCKED',
      deadWeightKg: 800,
      chargeableWeightKg: 800,
      stops: [
        {
          id: 'stop-pu',
          sequence: 0,
          stopType: 'PICKUP',
          suburb: 'Mumbai',
          lat: 19.07,
          lng: 72.87,
        },
        {
          id: 'stop-do',
          sequence: 1,
          stopType: 'DROPOFF',
          suburb: 'Tullamarine',
          lat: -37.7,
          lng: 144.87,
        },
      ],
    },
    stopsProgress: [
      {
        id: 'sp-pu',
        jobStopId: 'stop-pu',
        enteredAt: partial?.pickupExited ? '2026-11-24T01:00:00.000Z' : null,
        exitedAt: partial?.pickupExited ? '2026-11-24T01:05:00.000Z' : null,
        freeWaitEndsAt: null,
        waitOverageMinutes: 0,
        arrivalRecorded: Boolean(partial?.pickupExited),
        currentlyInside: false,
        stop: { sequence: 0, stopType: 'PICKUP', suburb: 'Mumbai' },
      },
      {
        id: 'sp-do',
        jobStopId: 'stop-do',
        enteredAt: partial?.dropEntered ? '2026-11-24T02:00:00.000Z' : null,
        exitedAt: null,
        freeWaitEndsAt: null,
        waitOverageMinutes: 0,
        arrivalRecorded: Boolean(partial?.dropEntered),
        currentlyInside: Boolean(partial?.dropEntered),
        stop: { sequence: 1, stopType: 'DROPOFF', suburb: 'Tullamarine' },
      },
    ],
  };
}

describe('trip-arrive-dropoff helpers', () => {
  it('findNextDropoffTarget prefers unfinished dropoff', () => {
    const target = findNextDropoffTarget(tripFixture());
    expect(target?.id).toBe('stop-do');
    expect(target?.suburb).toBe('Tullamarine');
  });

  it('isDropoffArrival requires entered DROPOFF geofence', () => {
    expect(
      isDropoffArrival({
        geofence: { entered: true, stopType: 'PICKUP' },
      }),
    ).toBe(false);
    expect(
      isDropoffArrival({
        geofence: { entered: false, stopType: 'DROPOFF' },
      }),
    ).toBe(false);
    expect(
      isDropoffArrival({
        geofence: { entered: true, stopType: 'DROPOFF' },
      }),
    ).toBe(true);
  });
});
