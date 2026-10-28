import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  getErrorDetail,
  getMarketBoard,
  listCarrierDrivers,
  listCarrierVehicles,
  submitBid,
  type MarketBoardJob,
} from '@/lib/api';
import {
  Button,
  DataCardList,
  Field,
  Notice,
  Select,
  StatusFilterChips,
  StatusPill,
  ViewModeToggle,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { cn } from '@/lib/cn';
import {
  carrierDriverSelectLabel,
  carrierVehicleSelectLabel,
} from '@/lib/fleet-select-labels';
import {
  countByBucket,
  filterAndSortByBucket,
  statusAccentClass,
  type ListStatusTone,
} from '@/lib/status-list';
import { isVehicleAdequateForJob } from '@/lib/validation';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type BidForm = {
  amountAud: number;
  etaMinutes: number;
  vehicleId: string;
  driverId: string;
};

/** Board only lists open marketplace jobs — buckets help carriers prioritise bids. */
type MarketBucket = 'available' | 'priority' | 'bid';
type MarketFilter = 'all' | MarketBucket;

const MARKET_FILTERS = [
  'all',
  'available',
  'priority',
  'bid',
] as const satisfies readonly MarketFilter[];

const MARKET_SORT: Record<MarketBucket, number> = {
  priority: 0,
  available: 1,
  bid: 2,
};

const MARKET_TONE: Record<MarketBucket, ListStatusTone> = {
  priority: 'warn',
  available: 'info',
  bid: 'ok',
};

function marketBucket(job: MarketBoardJob): MarketBucket {
  if (job.marketplacePriority) return 'priority';
  if (job.alreadyBid) return 'bid';
  return 'available';
}

export function MarketBoardPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const board = useQuery({
    queryKey: ['matching', 'board'],
    queryFn: () => getMarketBoard(),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });
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

  const [jobId, setJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MarketFilter>('available');
  const [viewMode, setViewMode] = useDataViewMode('market', 'list');
  const toast = useToast();

  const marketJobs = board.data?.jobs;
  const filterCounts = useMemo(
    () => countByBucket(marketJobs ?? [], marketBucket, MARKET_FILTERS),
    [marketJobs],
  );
  const filteredJobs = useMemo(
    () =>
      filterAndSortByBucket(marketJobs ?? [], marketBucket, statusFilter, MARKET_SORT),
    [marketJobs, statusFilter],
  );

  const selectedJob = useMemo(
    () => filteredJobs.find((j) => j.id === jobId) ?? null,
    [filteredJobs, jobId],
  );

  useEffect(() => {
    if (jobId && !filteredJobs.some((j) => j.id === jobId)) {
      setJobId(null);
    }
  }, [filteredJobs, jobId]);

  const activeVehicles = useMemo(
    () => (vehiclesQuery.data?.items ?? []).filter((v) => v.status === 'ACTIVE'),
    [vehiclesQuery.data?.items],
  );
  const activeDrivers = useMemo(
    () => (driversQuery.data?.items ?? []).filter((d) => d.status === 'ACTIVE'),
    [driversQuery.data?.items],
  );
  const selectableVehicles = useMemo(
    () => activeVehicles.filter((v) => v.bidAvailable !== false),
    [activeVehicles],
  );
  const selectableDrivers = useMemo(
    () => activeDrivers.filter((d) => d.bidAvailable !== false),
    [activeDrivers],
  );

  const schema = z.object({
    amountAud: z.number().positive(t('validation.bidAmountPositive')),
    etaMinutes: z.number().int().min(1, t('validation.etaPositive')),
    vehicleId: z.string().uuid(t('market.errorSelectVehicle')),
    driverId: z.string().uuid(t('market.errorSelectDriver')),
  });

  const form = useForm<BidForm>({
    resolver: zodResolver(schema),
    defaultValues: { amountAud: 150, etaMinutes: 90, vehicleId: '', driverId: '' },
  });

  const amountWatch = form.watch('amountAud');
  const vehicleIdWatch = form.watch('vehicleId');
  const driverIdWatch = form.watch('driverId');

  useEffect(() => {
    if (!selectedJob) return;
    const eligibleVehicle =
      selectableVehicles.find((v) =>
        isVehicleAdequateForJob(
          v.vehicleClass,
          selectedJob.minVehicleClass,
          selectedJob.chargeableWeightKg,
        ),
      ) ?? null;
    const nextVehicleId = eligibleVehicle?.id ?? '';
    const nextDriverId = selectableDrivers[0]?.id ?? '';
    form.setValue('vehicleId', nextVehicleId);
    form.setValue('driverId', nextDriverId);
  }, [selectedJob, selectableVehicles, selectableDrivers, form]);

  const selectedVehicle = activeVehicles.find((v) => v.id === vehicleIdWatch);
  const vehicleEligible =
    !!selectedVehicle &&
    selectedVehicle.bidAvailable !== false &&
    isVehicleAdequateForJob(
      selectedVehicle.vehicleClass,
      selectedJob?.minVehicleClass,
      selectedJob?.chargeableWeightKg,
    );
  const selectedDriver = activeDrivers.find((d) => d.id === driverIdWatch);
  const driverEligible = !!selectedDriver && selectedDriver.bidAvailable !== false;

  const bid = useMutation({
    mutationFn: (values: BidForm) => {
      if (!jobId) {
        throw new Error(t('market.errorSelectJob'));
      }
      const vehicle = activeVehicles.find((v) => v.id === values.vehicleId);
      const driver = activeDrivers.find((d) => d.id === values.driverId);
      if (
        !isVehicleAdequateForJob(
          vehicle?.vehicleClass,
          selectedJob?.minVehicleClass,
          selectedJob?.chargeableWeightKg,
        )
      ) {
        throw new Error(t('market.errorVehicleUndersize'));
      }
      if (vehicle?.bidAvailable === false) {
        throw new Error(t('market.errorVehicleBusy'));
      }
      if (driver?.bidAvailable === false) {
        throw new Error(t('market.errorDriverBusy'));
      }
      return submitBid({
        jobId,
        vehicleId: values.vehicleId,
        driverId: values.driverId,
        amountIncGstCents: Math.round(values.amountAud * 100),
        etaMinutes: values.etaMinutes,
      });
    },
    onSuccess: async () => {
      toast.success(t('market.bidSubmitted'));
      form.reset({
        amountAud: 150,
        etaMinutes: 90,
        vehicleId: '',
        driverId: '',
      });
      setJobId(null);
      await qc.invalidateQueries({ queryKey: ['matching', 'board'] });
      await qc.invalidateQueries({ queryKey: ['carrier', 'vehicles'] });
      await qc.invalidateQueries({ queryKey: ['carrier', 'drivers'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (role !== AppRole.TRANSPORT_COMPANY) return <Navigate to="/" replace />;
  if (board.isLoading || vehiclesQuery.isLoading || driversQuery.isLoading) {
    return <LoadingBlock label={t('market.loading')} />;
  }

  const hasFleet = activeVehicles.length > 0 && activeDrivers.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink">{t('market.title')}</h1>
          <p className="mt-2 text-sm text-clox-mute">
            {board.data?.netPayoutHint ?? t('market.netPayoutHintDefault')}
          </p>
        </div>
        {(marketJobs?.length ?? 0) > 0 ? (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        ) : null}
      </div>
      {board.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(board.error)}
        </Notice>
      ) : null}

      {!hasFleet ? (
        <Notice tone="warn" className="mt-4">
          {t('market.errorNeedActiveFleet')}{' '}
          <Link to="/carrier/fleet" className="font-semibold text-clox-orange hover:underline">
            {t('nav.fleet')}
          </Link>
          {' · '}
          <Link to="/carrier/drivers" className="font-semibold text-clox-orange hover:underline">
            {t('nav.drivers')}
          </Link>
        </Notice>
      ) : null}

      {!marketJobs?.length ? (
        <div className="mt-6">
          <EmptyBlock title={t('market.emptyTitle')} description={t('market.emptyHint')} />
        </div>
      ) : (
        <>
          <StatusFilterChips
            className="mt-4"
            options={MARKET_FILTERS}
            value={statusFilter}
            counts={filterCounts}
            onChange={setStatusFilter}
            getLabel={(key) => t(`market.filter.${key}`)}
            aria-label={t('market.filterLabel')}
          />

          {filteredJobs.length === 0 ? (
            <p className="mt-6 text-sm text-clox-faint">{t('market.emptyFilter')}</p>
          ) : (
            <DataCardList
              className="mt-6"
              items={filteredJobs}
              getKey={(j) => j.id}
              mode={viewMode}
              renderItem={(j) => {
                const bucket = marketBucket(j);
                const tone = MARKET_TONE[bucket];
                const selected = jobId === j.id;
                return (
                  <button
                    type="button"
                    className={cn(
                      'h-full w-full cursor-pointer rounded-clox-md border p-4 text-left shadow-clox-1 transition',
                      statusAccentClass(tone),
                      selected
                        ? 'border-clox-orange ring-2 ring-clox-orange/30'
                        : 'hover:border-clox-orange',
                    )}
                    onClick={() => setJobId(j.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-clox-ink">
                        {j.title ?? j.id.slice(0, 8)}
                      </p>
                      <StatusPill tone={tone}>{t(`market.bucket.${bucket}`)}</StatusPill>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-clox-faint">
                      {j.id.slice(0, 8)}
                      {j.publishedAt
                        ? ` · ${new Date(j.publishedAt).toLocaleString()}`
                        : ''}
                    </p>
                    <p className="mt-1 font-mono text-xs text-clox-mute">
                      {j.stopsSummary} · min {j.minVehicleClass}
                      {j.requiresDg ? ` ${t('market.dgSuffix')}` : ''}
                      {j.routeFatigueBreakMinutes > 0
                        ? ` ${t('market.fatigueSuffix', { minutes: j.routeFatigueBreakMinutes })}`
                        : ''}
                      {j.estimateNetToCarrierCents != null
                        ? ` ${t('market.netApprox', { amount: (j.estimateNetToCarrierCents / 100).toFixed(2) })}`
                        : ''}
                      {j.rescueDiscountPercent != null && j.rescueDiscountPercent > 0
                        ? ` · ${t('market.rescueDiscount', { percent: j.rescueDiscountPercent })}`
                        : ''}
                      {j.minBidIncGstCents != null
                        ? ` · ${t('market.minBidHint', { amount: (j.minBidIncGstCents / 100).toFixed(2) })}`
                        : ''}
                    </p>
                  </button>
                );
              }}
            />
          )}
        </>
      )}

      {jobId && selectedJob ? (
        <form
          className="clox-card mt-8 max-w-md p-4"
          onSubmit={form.handleSubmit((values) => bid.mutate(values))}
          noValidate
        >
          <h2 className="font-display font-semibold text-clox-ink">{t('market.placeBid')}</h2>
          <p className="mb-4 mt-1 text-xs text-clox-faint">
            {t('market.minClassLine', { minClass: selectedJob.minVehicleClass ?? t('dash') })}
          </p>

          <Select
            className="mb-3"
            label={t('market.assignVehicle')}
            required
            error={form.formState.errors.vehicleId?.message}
            value={vehicleIdWatch}
            {...form.register('vehicleId')}
          >
            <option value="">{t('market.selectVehicle')}</option>
            {activeVehicles.map((v) => {
              const classOk = isVehicleAdequateForJob(
                v.vehicleClass,
                selectedJob.minVehicleClass,
                selectedJob.chargeableWeightKg,
              );
              const busy = v.bidAvailable === false;
              const disabled = !classOk || busy;
              const busyHint = busy
                ? v.activityStatus === 'BID_COMMITTED'
                  ? t('market.busyOpenBid')
                  : v.activityStatus === 'PENDING_ASSIGNMENT'
                    ? t('market.busyPendingAssign')
                    : t('market.busyOnTrip')
                : '';
              return (
                <option key={v.id} value={v.id} disabled={disabled}>
                  {carrierVehicleSelectLabel(v, t('dash'))}
                  {!classOk ? ` · ${t('market.notEligible')}` : ''}
                  {busy ? ` · ${busyHint}` : ''}
                </option>
              );
            })}
          </Select>

          <Select
            className="mb-3"
            label={t('market.assignDriver')}
            required
            error={form.formState.errors.driverId?.message}
            value={driverIdWatch}
            {...form.register('driverId')}
          >
            <option value="">{t('market.selectDriver')}</option>
            {activeDrivers.map((d) => {
              const busy = d.bidAvailable === false;
              const busyHint = busy
                ? d.activityStatus === 'BID_COMMITTED'
                  ? t('market.busyOpenBid')
                  : d.activityStatus === 'PENDING_ASSIGNMENT'
                    ? t('market.busyPendingAssign')
                    : t('market.busyOnTrip')
                : '';
              return (
                <option key={d.id} value={d.id} disabled={busy}>
                  {carrierDriverSelectLabel(d)}
                  {busy ? ` · ${busyHint}` : ''}
                </option>
              );
            })}
          </Select>

          {vehicleIdWatch && selectedVehicle?.bidAvailable === false ? (
            <Notice tone="warn" className="mb-3">
              {t('market.errorVehicleBusy')}
            </Notice>
          ) : null}
          {vehicleIdWatch &&
          selectedVehicle?.bidAvailable !== false &&
          !vehicleEligible ? (
            <Notice tone="warn" className="mb-3">
              {t('market.errorVehicleUndersize')}
            </Notice>
          ) : null}
          {driverIdWatch && !driverEligible ? (
            <Notice tone="warn" className="mb-3">
              {t('market.errorDriverBusy')}
            </Notice>
          ) : null}
          {selectableVehicles.length === 0 || selectableDrivers.length === 0 ? (
            <Notice tone="info" className="mb-3">
              {t('market.noFleetAvailable')}
            </Notice>
          ) : null}

          <Field
            type="number"
            step="0.01"
            label={t('validation.grossAudLabel')}
            required
            error={form.formState.errors.amountAud?.message}
            {...form.register('amountAud', { valueAsNumber: true })}
          />
          <Field
            type="number"
            label={t('validation.etaMinutesLabel')}
            required
            error={form.formState.errors.etaMinutes?.message}
            {...form.register('etaMinutes', { valueAsNumber: true })}
          />
          <p className="mb-4 text-xs text-clox-mute">
            {t('market.yourNetApprox', { amount: ((Number(amountWatch) || 0) * 0.7).toFixed(2) })}
          </p>
          <Button
            type="submit"
            variant="cta"
            size="block"
            disabled={
              bid.isPending ||
              !hasFleet ||
              !vehicleEligible ||
              !driverEligible ||
              selectableVehicles.length === 0 ||
              selectableDrivers.length === 0
            }
          >
            {bid.isPending ? t('submitting') : t('market.submitProposal')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
