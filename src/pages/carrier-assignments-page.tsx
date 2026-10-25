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
  getCarrierAssignments,
  getErrorDetail,
  listCarrierDrivers,
  listCarrierExceptions,
  listCarrierVehicles,
  reassignCarrierAssignment,
  type CarrierAssignment,
} from '@/lib/api';
import type { SurchargeRow } from '@/lib/api/surcharges';
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

  const vehiclesQuery = useQuery({
    queryKey: ['carrier', 'vehicles'],
    queryFn: ({ signal }) => listCarrierVehicles({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY && !!reassignTarget,
  });

  const driversQuery = useQuery({
    queryKey: ['carrier', 'drivers'],
    queryFn: ({ signal }) => listCarrierDrivers({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY && !!reassignTarget,
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
    user: { name: string | null; email: string };
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
              <DataCard className="flex items-center justify-between gap-3 py-3">
                <div>
                  <span className="text-sm font-medium text-clox-ink">
                    {exc.kind === 'WAITING' ? t('surcharges.kindWaiting') : t('surcharges.kindMass')}
                  </span>
                  <span className="ml-2 font-mono text-xs text-clox-mute">
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

            <Select
              className="mt-4"
              label={t('market.assignVehicle')}
              required
              value={vehicleId}
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
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="">{t('market.selectDriver')}</option>
              {driverOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {carrierDriverSelectLabel(d)}
                </option>
              ))}
            </Select>

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
