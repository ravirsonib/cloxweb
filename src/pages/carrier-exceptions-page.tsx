import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCardList,
  Notice,
  Select,
  StatusPill,
  dataCardClassName,
  useToast,
} from '@/components/ui';
import {
  continueTripException,
  escalateTripException,
  getErrorDetail,
  getTripException,
  listCarrierDrivers,
  listCarrierVehicles,
  listExceptionCandidates,
  listTripExceptions,
  reassignTripException,
  releaseTripException,
  type TripExceptionRow,
} from '@/lib/api';
import {
  carrierDriverSelectLabel,
  carrierVehicleSelectLabel,
} from '@/lib/fleet-select-labels';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function exceptionTone(status: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status.startsWith('RESOLVED') || status === 'CLOSED') return 'ok';
  if (status === 'ESCALATED') return 'danger';
  if (status === 'AWAITING_CARRIER' || status === 'OPEN') return 'warn';
  return 'info';
}

export function CarrierExceptionsPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const list = useQuery({
    queryKey: ['exceptions', 'carrier'],
    queryFn: ({ signal }) => listTripExceptions({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });

  if (role !== AppRole.TRANSPORT_COMPANY) return <Navigate to="/" replace />;
  if (list.isLoading) return <LoadingBlock label={t('exceptions.loading')} />;

  const items = list.data?.items ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-clox-ink">{t('exceptions.title')}</h1>
      <p className="mt-2 text-sm text-clox-mute">{t('exceptions.subtitle')}</p>
      {list.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(list.error)}
        </Notice>
      ) : null}
      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock title={t('exceptions.emptyTitle')} description={t('exceptions.emptyHint')} />
        </div>
      ) : (
        <DataCardList
          className="mt-6"
          items={items}
          getKey={(row) => row.id}
          renderItem={(row) => <ExceptionCard row={row} />}
        />
      )}
    </div>
  );
}

function ExceptionCard({ row }: { row: TripExceptionRow }) {
  const { t } = useTranslation('common');
  return (
    <Link to={`/carrier/exceptions/${row.id}`} className={`block h-full ${dataCardClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-clox-ink">
            {row.job?.title ?? row.jobId.slice(0, 8)}
          </p>
          <p className="mt-0.5 font-mono text-xs text-clox-faint">
            {row.kind} · {row.phase}
          </p>
        </div>
        <StatusPill tone={exceptionTone(row.status)}>{row.status}</StatusPill>
      </div>
      {row.note ? <p className="mt-2 line-clamp-2 text-xs text-clox-mute">{row.note}</p> : null}
      <p className="mt-2 text-xs text-clox-faint">
        {t('exceptions.openedAt', { time: new Date(row.openedAt).toLocaleString() })}
      </p>
    </Link>
  );
}

export function CarrierExceptionDetailPage() {
  const { t } = useTranslation('common');
  const { id = '' } = useParams();
  const role = useAuthStore((s) => s.role);
  const toast = useToast();
  const qc = useQueryClient();
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [note, setNote] = useState('');
  const [continueNote, setContinueNote] = useState('');
  const [etaNote, setEtaNote] = useState('');
  const [escalateNote, setEscalateNote] = useState('');
  const [releaseNote, setReleaseNote] = useState('');
  const [prefilledSuggested, setPrefilledSuggested] = useState(false);

  const detail = useQuery({
    queryKey: ['exceptions', id],
    queryFn: () => getTripException(id),
    enabled: role === AppRole.TRANSPORT_COMPANY && Boolean(id),
    refetchInterval: (q) =>
      q.state.data?.status === 'AWAITING_CARRIER' ? 15_000 : false,
  });

  const [slaNowMs, setSlaNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (detail.data?.status !== 'AWAITING_CARRIER') return;
    setSlaNowMs(Date.now());
    const timer = window.setInterval(() => setSlaNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [detail.data?.status, detail.data?.openedAt]);

  const openStatus =
    detail.data?.status === 'OPEN' ||
    detail.data?.status === 'AWAITING_CARRIER' ||
    detail.data?.status === 'REASSIGN_IN_PROGRESS' ||
    detail.data?.status === 'ESCALATED';

  const candidates = useQuery({
    queryKey: ['exceptions', id, 'candidates'],
    queryFn: () => listExceptionCandidates(id),
    enabled: role === AppRole.TRANSPORT_COMPANY && Boolean(id) && openStatus,
  });

  const vehicles = useQuery({
    queryKey: ['carrier', 'vehicles'],
    queryFn: ({ signal }) => listCarrierVehicles({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY && Boolean(detail.data),
  });
  const drivers = useQuery({
    queryKey: ['carrier', 'drivers'],
    queryFn: ({ signal }) => listCarrierDrivers({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY && Boolean(detail.data),
  });

  useEffect(() => {
    const recommended = candidates.data?.recommended;
    if (!recommended || prefilledSuggested) return;
    setVehicleId(recommended.vehicleId);
    setDriverId(recommended.driverId);
    setPrefilledSuggested(true);
  }, [candidates.data, prefilledSuggested]);

  async function refreshExceptionQueries() {
    await qc.invalidateQueries({ queryKey: ['exceptions'] });
    await qc.invalidateQueries({ queryKey: ['payments', 'assignments'] });
  }

  const reassign = useMutation({
    mutationFn: () =>
      reassignTripException(id, {
        vehicleId,
        driverId,
        note: note.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('exceptions.reassignSuccess'));
      await refreshExceptionQueries();
    },
  });

  const continueMut = useMutation({
    mutationFn: () =>
      continueTripException(id, {
        note: continueNote.trim(),
        etaNote: etaNote.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('exceptions.continueSuccess'));
      setContinueNote('');
      setEtaNote('');
      await refreshExceptionQueries();
    },
  });

  const escalateMut = useMutation({
    mutationFn: () => {
      const note = escalateNote.trim();
      return escalateTripException(id, {
        note: note.length >= 3 ? note : undefined,
      });
    },
    onSuccess: async (res) => {
      toast.success(
        res.alreadyEscalated
          ? t('exceptions.escalateAlready')
          : t('exceptions.escalateSuccess'),
      );
      setEscalateNote('');
      await refreshExceptionQueries();
    },
  });

  const releaseMut = useMutation({
    mutationFn: () => releaseTripException(id, { note: releaseNote.trim() }),
    onSuccess: async () => {
      toast.success(t('exceptions.releaseSuccess'));
      setReleaseNote('');
      await refreshExceptionQueries();
    },
  });

  if (role !== AppRole.TRANSPORT_COMPANY) return <Navigate to="/" replace />;
  if (detail.isLoading) return <LoadingBlock label={t('exceptions.loadingDetail')} />;
  if (detail.isError || !detail.data) {
    return (
      <Notice tone="error" className="mt-4">
        {getErrorDetail(detail.error)}
      </Notice>
    );
  }

  const row = detail.data;
  const open =
    row.status === 'OPEN' ||
    row.status === 'AWAITING_CARRIER' ||
    row.status === 'REASSIGN_IN_PROGRESS' ||
    row.status === 'ESCALATED';
  const canEscalate = open && row.status !== 'ESCALATED';
  const activeVehicles = (vehicles.data?.items ?? []).filter((v) => v.status === 'ACTIVE');
  const activeDrivers = (drivers.data?.items ?? []).filter((d) => d.status === 'ACTIVE');
  const actionBusy =
    reassign.isPending ||
    continueMut.isPending ||
    escalateMut.isPending ||
    releaseMut.isPending;
  const recommended = candidates.data?.recommended ?? null;
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
    for (const c of candidates.data?.items ?? []) {
      if (!byId.has(c.vehicleId)) {
        byId.set(c.vehicleId, {
          id: c.vehicleId,
          registration: c.vehicle.registration,
          label: null,
          vehicleClass: c.vehicle.vehicleClass,
        });
      }
    }
    return [...byId.values()];
  })();
  type DriverOption = {
    id: string;
    licenceClass: string | null;
    user: { name: string | null; email: string | null };
  };
  const driverOptions: DriverOption[] = (() => {
    const byId = new Map<string, DriverOption>(
      activeDrivers.map((d) => [
        d.id,
        {
          id: d.id,
          licenceClass: d.licenceClass,
          user: { name: d.user.name, email: d.user.email },
        },
      ]),
    );
    for (const c of candidates.data?.items ?? []) {
      if (!byId.has(c.driverId)) {
        byId.set(c.driverId, {
          id: c.driverId,
          licenceClass: c.driver.licenceClass,
          user: { name: c.driver.name, email: c.driver.email },
        });
      }
    }
    return [...byId.values()];
  })();

  return (
    <div>
      <Link
        to="/carrier/exceptions"
        className="text-sm font-semibold text-clox-orange hover:underline"
      >
        ← {t('exceptions.back')}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink">
            {row.job?.title ?? row.jobId.slice(0, 8)}
          </h1>
          <p className="mt-1 font-mono text-sm text-clox-mute">
            {row.kind} · {row.phase}
          </p>
        </div>
        <StatusPill tone={exceptionTone(row.status)}>{row.status}</StatusPill>
      </div>

      {row.status === 'AWAITING_CARRIER' && row.phase === 'PRE_TRIP' ? (
        <Notice tone="warn" className="mt-4">
          {(() => {
            const slaMs = row.marketplaceRelistSlaMs ?? 300_000;
            const deadline = new Date(row.openedAt).getTime() + slaMs;
            const remainingSec = Math.max(0, Math.floor((deadline - slaNowMs) / 1000));
            if (remainingSec <= 0) return t('exceptions.slaElapsed');
            const m = Math.floor(remainingSec / 60);
            const s = remainingSec % 60;
            return t('exceptions.slaCountdown', {
              remaining: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
            });
          })()}
        </Notice>
      ) : null}

      <ul className="mt-4 space-y-1 text-sm text-clox-mute">
        <li>
          {t('exceptions.currentCrew', {
            vehicle: row.vehicle?.registration ?? t('dash'),
            driver: row.driver?.name ?? row.driver?.email ?? t('dash'),
          })}
        </li>
        {row.reasonCode ? <li>{t('exceptions.reasonCode')}: {row.reasonCode}</li> : null}
        {row.note ? <li>{row.note}</li> : null}
        {row.photoDocumentId ? (
          <li className="font-mono text-xs">
            {t('exceptions.photoAttached')}: {row.photoDocumentId.slice(0, 8)}…
          </li>
        ) : null}
        {row.gpsLat != null && row.gpsLng != null ? (
          <li className="font-mono text-xs">
            GPS {row.gpsLat.toFixed(4)}, {row.gpsLng.toFixed(4)}
          </li>
        ) : null}
        {row.resolutionNote ? (
          <li>
            {t('exceptions.resolution')}: {row.resolutionNote}
          </li>
        ) : null}
      </ul>

      <Notice tone="info" className="mt-4">
        {t('exceptions.notifyHint')}
      </Notice>

      {open && recommended ? (
        <Notice
          tone={candidates.data?.unambiguous ? 'success' : 'info'}
          className="mt-4"
          title={
            candidates.data?.unambiguous
              ? t('exceptions.suggestUnambiguousTitle')
              : t('exceptions.suggestTitle')
          }
        >
          <p className="text-sm">
            {t('exceptions.suggestLine', {
              vehicle:
                recommended.vehicle.registration?.trim() ||
                recommended.vehicle.vehicleClass ||
                'Fleet vehicle',
              vehicleClass: recommended.vehicle.vehicleClass ?? t('dash'),
              driver: carrierDriverSelectLabel(recommended.driver),
              score: recommended.score,
            })}
          </p>
          {(candidates.data?.items.length ?? 0) > 1 ? (
            <ul className="mt-2 space-y-1 text-xs text-clox-mute">
              {candidates.data!.items.slice(0, 5).map((c) => (
                <li key={`${c.vehicleId}-${c.driverId}`}>
                  <button
                    type="button"
                    className="text-left font-semibold text-clox-orange hover:underline"
                    onClick={() => {
                      setVehicleId(c.vehicleId);
                      setDriverId(c.driverId);
                    }}
                  >
                    {c.score} · {carrierVehicleSelectLabel(c.vehicle, t('dash'))} ·{' '}
                    {carrierDriverSelectLabel(c.driver)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}

      {open ? (
        <div className="mt-6 grid max-w-3xl gap-4 lg:grid-cols-1">
          <form
            className="clox-card space-y-3 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!vehicleId || !driverId || actionBusy) return;
              reassign.mutate();
            }}
            noValidate
          >
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('exceptions.reassignTitle')}
            </h2>
            <p className="text-sm text-clox-mute">{t('exceptions.reassignHint')}</p>
            <Select
              label={t('market.assignVehicle')}
              required
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
            >
              <option value="">{t('market.selectVehicle')}</option>
              {vehicleOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {carrierVehicleSelectLabel(v, t('dash'))}
                </option>
              ))}
            </Select>
            <Select
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
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('exceptions.reassignNote')}
              </span>
              <textarea
                className="clox-field-control min-h-[3.5rem]"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
              />
            </label>
            {reassign.isError ? (
              <Notice tone="error">{getErrorDetail(reassign.error)}</Notice>
            ) : null}
            <Button
              type="submit"
              variant="cta"
              disabled={!vehicleId || !driverId || actionBusy}
            >
              {reassign.isPending ? t('loading') : t('exceptions.reassignConfirm')}
            </Button>
          </form>

          <form
            className="clox-card space-y-3 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (continueNote.trim().length < 3 || actionBusy) return;
              continueMut.mutate();
            }}
            noValidate
          >
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('exceptions.continueTitle')}
            </h2>
            <p className="text-sm text-clox-mute">{t('exceptions.continueHint')}</p>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('exceptions.continueNote')}
              </span>
              <textarea
                className="clox-field-control min-h-[3.5rem]"
                value={continueNote}
                onChange={(event) => setContinueNote(event.target.value)}
                maxLength={2000}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('exceptions.continueEta')}
              </span>
              <input
                className="clox-field-control"
                value={etaNote}
                onChange={(event) => setEtaNote(event.target.value)}
                placeholder={t('exceptions.continueEtaPlaceholder')}
                maxLength={500}
              />
            </label>
            {continueMut.isError ? (
              <Notice tone="error">{getErrorDetail(continueMut.error)}</Notice>
            ) : null}
            <Button
              type="submit"
              variant="secondary"
              disabled={continueNote.trim().length < 3 || actionBusy}
            >
              {continueMut.isPending ? t('loading') : t('exceptions.continueConfirm')}
            </Button>
          </form>

          {canEscalate ? (
            <form
              className="clox-card space-y-3 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (actionBusy) return;
                escalateMut.mutate();
              }}
              noValidate
            >
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('exceptions.escalateTitle')}
              </h2>
              <p className="text-sm text-clox-mute">{t('exceptions.escalateHint')}</p>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                  {t('exceptions.escalateNote')}
                </span>
                <textarea
                  className="clox-field-control min-h-[3.5rem]"
                  value={escalateNote}
                  onChange={(event) => setEscalateNote(event.target.value)}
                  maxLength={2000}
                />
              </label>
              {escalateMut.isError ? (
                <Notice tone="error">{getErrorDetail(escalateMut.error)}</Notice>
              ) : null}
              <Button type="submit" variant="destructive" disabled={actionBusy}>
                {escalateMut.isPending ? t('loading') : t('exceptions.escalateConfirm')}
              </Button>
            </form>
          ) : null}

          <form
            className="clox-card space-y-3 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (releaseNote.trim().length < 3 || actionBusy) return;
              releaseMut.mutate();
            }}
            noValidate
          >
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('exceptions.releaseTitle')}
            </h2>
            <p className="text-sm text-clox-mute">{t('exceptions.releaseHint')}</p>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('exceptions.releaseNote')}
              </span>
              <textarea
                className="clox-field-control min-h-[3.5rem]"
                value={releaseNote}
                onChange={(event) => setReleaseNote(event.target.value)}
                maxLength={2000}
                required
              />
            </label>
            {releaseMut.isError ? (
              <Notice tone="error">{getErrorDetail(releaseMut.error)}</Notice>
            ) : null}
            <Button
              type="submit"
              variant="destructive"
              disabled={releaseNote.trim().length < 3 || actionBusy}
            >
              {releaseMut.isPending ? t('loading') : t('exceptions.releaseConfirm')}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
