import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCard,
  DataCardList,
  Notice,
  Select,
  StatusPill,
  ViewModeToggle,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import {
  downloadBlob,
  fetchTripDocumentBlob,
  getCarrierAssignments,
  getErrorDetail,
  getTripPod,
  listCarrierDrivers,
  listCarrierExceptions,
  listCarrierVehicles,
  reassignCarrierAssignment,
  type CarrierAssignment,
} from '@/lib/api';
import type { SurchargeRow } from '@/lib/api/surcharges';
import type { TripDocumentKind } from '@/lib/api/trips';
import {
  carrierDriverSelectLabel,
  carrierVehicleSelectLabel,
} from '@/lib/fleet-select-labels';
import { isVehicleClassAdequate } from '@/lib/validation';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function ExceptionBadge({ exc }: { exc: SurchargeRow }) {
  const { t } = useTranslation('common');
  const label = exc.kind === 'WAITING' ? t('surcharges.kindWaiting') : t('surcharges.kindMass');
  const isPending = exc.status === 'PENDING_PAYMENT';
  return (
    <StatusPill tone={isPending ? 'warn' : 'neutral'}>
      {label} ${(exc.amountIncGstCents / 100).toFixed(2)}
    </StatusPill>
  );
}

function AssignmentPodPanel({ tripId }: { tripId: string }) {
  const { t } = useTranslation('common');
  const toast = useToast();
  const pod = useQuery({
    queryKey: ['trips', 'pod', tripId],
    queryFn: () => getTripPod(tripId),
    staleTime: 30_000,
  });

  const downloadDoc = useMutation({
    mutationFn: async (kind: TripDocumentKind) => {
      const blob = await fetchTripDocumentBlob(tripId, kind);
      const names: Record<TripDocumentKind, string> = {
        pod: `CLOX-pod-${tripId.slice(0, 8)}.pdf`,
        'tax-invoice': `CLOX-tax-invoice-${tripId.slice(0, 8)}.pdf`,
        'run-sheet': `CLOX-run-sheet-${tripId.slice(0, 8)}.pdf`,
      };
      downloadBlob(blob, names[kind]);
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (pod.isLoading || pod.isError || !pod.data) return null;
  const drop = pod.data.dropoffs[0];
  const hasDocs =
    Boolean(pod.data.podStorageKey) ||
    Boolean(pod.data.taxInvoiceStorageKey) ||
    Boolean(pod.data.runSheetStorageKey);
  if (!drop && !hasDocs) return null;

  return (
    <div className="mt-3 rounded-clox-md border border-clox-border bg-clox-canvas/40 px-3 py-2">
      <p className="text-xs font-semibold text-clox-ink">{t('trips.podPanelTitle')}</p>
      {drop ? (
        <p className="mt-0.5 text-xs text-clox-mute">
          {t('trips.podStatusLine', { status: drop.podStatus })}
          {drop.signerName ? ` · ${drop.signerName}` : ''}
        </p>
      ) : null}
      {hasDocs ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pod.data.podStorageKey ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={downloadDoc.isPending}
              onClick={() => downloadDoc.mutate('pod')}
            >
              {t('trips.downloadPod')}
            </Button>
          ) : null}
          {pod.data.taxInvoiceStorageKey ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={downloadDoc.isPending}
              onClick={() => downloadDoc.mutate('tax-invoice')}
            >
              {t('trips.downloadTaxInvoice')}
            </Button>
          ) : null}
          {pod.data.runSheetStorageKey ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={downloadDoc.isPending}
              onClick={() => downloadDoc.mutate('run-sheet')}
            >
              {t('trips.downloadRunSheet')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CarrierAssignmentsPage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const [viewMode, setViewMode] = useDataViewMode('assignments', 'list');
  const [reassignTarget, setReassignTarget] = useState<CarrierAssignment | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const list = useQuery({
    queryKey: ['payments', 'assignments'],
    queryFn: () => getCarrierAssignments(),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });

  const exceptions = useQuery({
    queryKey: ['payments', 'exceptions'],
    queryFn: () => listCarrierExceptions(),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });

  /** Prefetch so reassign dialog already has full ACTIVE fleet/driver lists. */
  const vehiclesQuery = useQuery({
    queryKey: ['carrier', 'vehicles'],
    queryFn: ({ signal }) => listCarrierVehicles({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });

  const driversQuery = useQuery({
    queryKey: ['carrier', 'drivers'],
    queryFn: ({ signal }) => listCarrierDrivers({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });

  const reassignMutation = useMutation({
    mutationFn: () =>
      reassignCarrierAssignment(reassignTarget!.id, {
        vehicleId,
        driverId,
        reason: reason.trim(),
        note: note.trim() || undefined,
      }),
    onSuccess: async (result) => {
      setReassignTarget(null);
      setVehicleId('');
      setDriverId('');
      setReason('');
      setNote('');
      toast.success(
        result.safetyReset
          ? t('assignments.reassignSuccessSafetyReset')
          : t('assignments.reassignSuccess'),
      );
      await queryClient.invalidateQueries({ queryKey: ['payments', 'assignments'] });
    },
  });

  if (role !== AppRole.TRANSPORT_COMPANY) return <Navigate to="/" replace />;
  if (list.isLoading) return <LoadingBlock label={t('assignments.loading')} />;

  const exceptionsByJob = (exceptions.data ?? []).reduce<Record<string, SurchargeRow[]>>(
    (acc, exc) => {
      const key = exc.jobId ?? exc.job?.id;
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(exc);
      return acc;
    },
    {},
  );

  const items = list.data ?? [];
  const activeVehicles = (vehiclesQuery.data?.items ?? []).filter((v) => v.status === 'ACTIVE');
  const activeDrivers = (driversQuery.data?.items ?? []).filter((d) => d.status === 'ACTIVE');
  /** Keep current assignment assets visible (and labeled) even before list load / if not ACTIVE. */
  const vehicleOptions: Array<{
    id: string;
    registration: string | null;
    label: string | null;
    vehicleClass: string | null;
  }> = (() => {
    const byId = new Map(
      activeVehicles.map((v) => [
        v.id,
        {
          id: v.id,
          registration: v.registration,
          label: v.label,
          vehicleClass: v.vehicleClass,
        },
      ]),
    );
    const current = reassignTarget?.vehicle;
    if (current && !byId.has(current.id)) {
      byId.set(current.id, {
        id: current.id,
        registration: current.registration,
        label: null,
        vehicleClass: current.vehicleClass,
      });
    }
    return [...byId.values()];
  })();
  const driverOptions: Array<{
    id: string;
    licenceClass: string | null;
    user: { name: string | null; email: string | null };
  }> = (() => {
    const byId = new Map(
      activeDrivers.map((d) => [
        d.id,
        {
          id: d.id,
          licenceClass: d.licenceClass,
          user: { name: d.user.name, email: d.user.email },
        },
      ]),
    );
    const current = reassignTarget?.driver;
    if (current && !byId.has(current.id)) {
      byId.set(current.id, {
        id: current.id,
        licenceClass: null,
        user: { name: current.user.name, email: current.user.email },
      });
    }
    return [...byId.values()];
  })();
  const fleetListsLoading = vehiclesQuery.isLoading || driversQuery.isLoading;
  const fleetListsError = vehiclesQuery.isError || driversQuery.isError;
  const selectedVehicleOk =
    !reassignTarget ||
    !vehicleId ||
    isVehicleClassAdequate(
      vehicleOptions.find((v) => v.id === vehicleId)?.vehicleClass,
      reassignTarget.job.minVehicleClass,
    );

  const openReassign = (a: CarrierAssignment) => {
    setReassignTarget(a);
    setVehicleId(a.vehicle?.id ?? '');
    setDriverId(a.driver?.id ?? '');
    setReason('');
    setNote('');
    reassignMutation.reset();
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink">{t('assignments.title')}</h1>
          <p className="mt-2 text-sm text-clox-mute">{t('assignments.subtitle')}</p>
        </div>
        {items.length > 0 ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : null}
      </div>
      {list.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(list.error)}
        </Notice>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-clox-faint">{t('assignments.empty')}</p>
      ) : (
        <DataCardList
          className="mt-6"
          items={items}
          getKey={(a) => a.id}
          mode={viewMode}
          renderItem={(a) => {
            const jobExceptions = exceptionsByJob[a.job.id] ?? [];
            return (
              <DataCard className="h-full">
                <p className="font-semibold text-clox-ink">{a.job.title ?? a.job.id.slice(0, 8)}</p>
                <p className="mt-1 font-mono text-xs text-clox-mute">
                  {a.status}
                  {a.paidAndConfirmed
                    ? ` · ${t('assignments.paidAndConfirmed')}`
                    : ` · ${t('assignments.awaitingPayment')}`}
                  {' · '}${(a.amountIncGstCents / 100).toFixed(2)}
                  {a.tripBlockedUntilPaid
                    ? ` · ${t('assignments.tripBlocked')}`
                    : ` · ${t('assignments.tripGateOpen')}`}
                </p>
                <p className="mt-2 text-xs text-clox-mute">
                  {t('assignments.assetLine', {
                    vehicle:
                      a.vehicle?.registration ??
                      a.vehicle?.id?.slice(0, 8) ??
                      t('dash'),
                    driver: a.driver?.user.name ?? a.driver?.user.email ?? t('dash'),
                    trip: a.trip?.status ?? t('dash'),
                  })}
                </p>
                {jobExceptions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {jobExceptions.map((exc) => (
                      <ExceptionBadge key={exc.id} exc={exc} />
                    ))}
                  </div>
                ) : null}
                {a.canReassign ? (
                  <div className="mt-3">
                    <Button type="button" variant="secondary" size="sm" onClick={() => openReassign(a)}>
                      {t('assignments.reassign')}
                    </Button>
                  </div>
                ) : null}
                {a.trip?.id ? <AssignmentPodPanel tripId={a.trip.id} /> : null}
              </DataCard>
            );
          }}
        />
      )}

      {(exceptions.data ?? []).length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">{t('assignments.exceptionsTitle')}</h2>
          <p className="mt-1 text-sm text-clox-mute">{t('assignments.exceptionsSubtitle')}</p>
          <DataCardList
            className="mt-4"
            items={exceptions.data ?? []}
            getKey={(exc) => exc.id}
            mode="list"
            renderItem={(exc) => (
              <DataCard className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-clox-ink">
                    {exc.kind === 'WAITING' ? t('surcharges.kindWaiting') : t('surcharges.kindMass')}
                  </span>
                  <span className="ml-2 break-all font-mono text-xs text-clox-mute">
                    ${(exc.amountIncGstCents / 100).toFixed(2)} · {exc.status}
                  </span>
                </div>
                <span className="text-xs text-clox-faint">
                  {exc.job?.title ?? (exc.jobId ?? exc.job?.id ?? '').slice(0, 8)}
                </span>
              </DataCard>
            )}
          />
        </section>
      ) : null}

      {reassignTarget ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reassignMutation.isPending) {
              setReassignTarget(null);
            }
          }}
        >
          <div className="clox-dialog" role="dialog" aria-modal="true">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('assignments.reassignTitle')}
            </h2>
            <p className="mt-2 text-sm text-clox-mute">
              {t('assignments.reassignBody', {
                job: reassignTarget.job.title ?? reassignTarget.job.id.slice(0, 8),
              })}
            </p>
            <p className="mt-1 text-xs text-clox-faint">
              {t('market.minClassLine', {
                minClass: reassignTarget.job.minVehicleClass ?? t('dash'),
              })}
            </p>
            <p className="mt-1 text-xs text-clox-mute">
              {t('assignments.reassignPickHint', {
                vehicles: activeVehicles.length,
                drivers: activeDrivers.length,
              })}
            </p>

            {fleetListsLoading ? (
              <Notice tone="info" className="mt-3">
                {t('assignments.reassignLoadingFleet')}
              </Notice>
            ) : null}
            {fleetListsError ? (
              <Notice tone="error" className="mt-3">
                {getErrorDetail(vehiclesQuery.error ?? driversQuery.error)}
              </Notice>
            ) : null}

            <Select
              className="mt-4"
              label={t('market.assignVehicle')}
              required
              value={vehicleId}
              disabled={fleetListsLoading}
              onChange={(event) => setVehicleId(event.target.value)}
            >
              <option value="">{t('market.selectVehicle')}</option>
              {vehicleOptions.map((v) => {
                const ok = isVehicleClassAdequate(
                  v.vehicleClass,
                  reassignTarget.job.minVehicleClass,
                );
                return (
                  <option key={v.id} value={v.id} disabled={!ok}>
                    {carrierVehicleSelectLabel(v, t('dash'))}
                    {ok ? '' : ` · ${t('market.notEligible')}`}
                  </option>
                );
              })}
            </Select>

            <Select
              className="mt-3"
              label={t('market.assignDriver')}
              required
              value={driverId}
              disabled={fleetListsLoading}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="">{t('market.selectDriver')}</option>
              {driverOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {carrierDriverSelectLabel(d)}
                </option>
              ))}
            </Select>

            {!fleetListsLoading && activeVehicles.length === 0 ? (
              <Notice tone="warn" className="mt-3">
                {t('assignments.reassignNoActiveVehicles')}
              </Notice>
            ) : null}
            {!fleetListsLoading && activeDrivers.length === 0 ? (
              <Notice tone="warn" className="mt-3">
                {t('assignments.reassignNoActiveDrivers')}
              </Notice>
            ) : null}

            {!selectedVehicleOk ? (
              <Notice tone="warn" className="mt-3">
                {t('market.errorVehicleUndersize')}
              </Notice>
            ) : null}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('assignments.reassignReason')}
              </span>
              <textarea
                className="clox-field-control min-h-[4.5rem]"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('assignments.reassignReasonPlaceholder')}
                maxLength={500}
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('fleet.noteLabel')}
              </span>
              <textarea
                className="clox-field-control min-h-[3.5rem]"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('fleet.notePlaceholder')}
                maxLength={2000}
              />
            </label>

            <Notice tone="info" className="mt-3">
              {t('assignments.reassignSafetyHint')}
            </Notice>

            {reassignMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {getErrorDetail(reassignMutation.error)}
              </Notice>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={reassignMutation.isPending}
                onClick={() => setReassignTarget(null)}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                type="button"
                disabled={
                  reassignMutation.isPending ||
                  fleetListsLoading ||
                  fleetListsError ||
                  !vehicleId ||
                  !driverId ||
                  reason.trim().length < 3 ||
                  !selectedVehicleOk ||
                  (vehicleId === reassignTarget.vehicle?.id &&
                    driverId === reassignTarget.driver?.id)
                }
                onClick={() => reassignMutation.mutate()}
              >
                {reassignMutation.isPending ? t('loading') : t('assignments.reassignConfirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
