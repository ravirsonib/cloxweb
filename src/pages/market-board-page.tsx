import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { z } from 'zod';
import {
  checkFleetDriversBid,
  getErrorDetail,
  getMarketBoard,
  listCarrierDrivers,
  listCarrierVehicles,
  listTripExceptions,
  openDocumentContent,
  submitBid,
  withdrawProposalByJobId,
  type MarketBoardJob,
} from '@/lib/api';
import {
  Button,
  DataCardList,
  Field,
  Notice,
  PaginationBar,
  Select,
  StatusFilterChips,
  StatusPill,
  ViewModeToggle,
  useClientPagination,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { cn } from '@/lib/cn';
import { formatDollars, formatDollarsAmount } from '@/lib/currency';
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
  const confirm = useConfirm();
  const board = useQuery({
    queryKey: ['matching', 'board'],
    queryFn: () => getMarketBoard(),
    enabled: role === AppRole.TRANSPORT_COMPANY,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });
  const vehiclesQuery = useQuery({
    queryKey: ['carrier', 'vehicles'],
    queryFn: ({ signal }) => listCarrierVehicles({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });
  const driversQuery = useQuery({
    queryKey: ['carrier', 'drivers'],
    queryFn: ({ signal }) => listCarrierDrivers({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });
  const exceptionsQuery = useQuery({
    queryKey: ['exceptions', 'carrier'],
    queryFn: ({ signal }) => listTripExceptions({ signal }),
    enabled: role === AppRole.TRANSPORT_COMPANY,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
  const openExceptionsCount = useMemo(
    () =>
      (exceptionsQuery.data?.items ?? []).filter(
        (ex) => ex.status === 'AWAITING_CARRIER' || ex.status === 'OPEN',
      ).length,
    [exceptionsQuery.data?.items],
  );

  const [jobId, setJobId] = useState<string | null>(null);

  const driverBidCheckQuery = useQuery({
    queryKey: ['carrier', 'drivers', 'bid-check', jobId],
    queryFn: () => checkFleetDriversBid(jobId!),
    enabled: role === AppRole.TRANSPORT_COMPANY && Boolean(jobId),
    staleTime: 5_000,
  });

  const driverEligibilityMap = useMemo(() => {
    const map = new Map<string, { isEligible: boolean; reason?: string | null }>();
    for (const d of driverBidCheckQuery.data?.drivers ?? []) {
      map.set(d.id, { isEligible: d.isEligible, reason: d.reason });
    }
    return map;
  }, [driverBidCheckQuery.data?.drivers]);
  const [statusFilter, setStatusFilter] = useState<MarketFilter>('available');
  const [viewMode, setViewMode] = useDataViewMode('market', 'list');
  const toast = useToast();

  const marketJobs = useMemo(() => {
    const seen = new Set<string>();
    const out: MarketBoardJob[] = [];
    for (const job of board.data?.jobs ?? []) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      out.push(job);
    }
    return out;
  }, [board.data?.jobs]);
  const filterCounts = useMemo(
    () => countByBucket(marketJobs, marketBucket, MARKET_FILTERS),
    [marketJobs],
  );
  const filteredJobs = useMemo(
    () => filterAndSortByBucket(marketJobs, marketBucket, statusFilter, MARKET_SORT),
    [marketJobs, statusFilter],
  );
  const {
    page,
    setPage,
    totalPages,
    pagedItems: pagedFilteredJobs,
  } = useClientPagination(filteredJobs, 10);

  const selectedJob = useMemo(
    () => marketJobs.find((j) => j.id === jobId) ?? null,
    [marketJobs, jobId],
  );

  useEffect(() => {
    if (jobId && !marketJobs.some((j) => j.id === jobId)) {
      setJobId(null);
    }
  }, [marketJobs, jobId]);

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
      selectableVehicles.find(
        (v) =>
          isVehicleAdequateForJob(
            v.vehicleClass,
            selectedJob.minVehicleClass,
            selectedJob.chargeableWeightKg,
          ) &&
          (!selectedJob.requiresDg || Boolean(v.hasDg && v.dgDocumentId)),
      ) ?? null;
    const nextVehicleId = eligibleVehicle?.id ?? '';
    const nextDriverId = selectableDrivers[0]?.id ?? '';
    const grossCents =
      selectedJob.minBidIncGstCents ?? selectedJob.estimateIncGstCents ?? null;
    const nextAmount =
      grossCents != null && grossCents > 0 ? Math.round(grossCents) / 100 : 150;
    const routeMins = selectedJob.routeDurationMinutes;
    const fatigue = selectedJob.routeFatigueBreakMinutes ?? 0;
    const nextEta =
      routeMins != null && routeMins > 0
        ? Math.max(1, Math.round(routeMins + fatigue))
        : 90;
    form.setValue('amountAud', nextAmount);
    form.setValue('etaMinutes', nextEta);
    form.setValue('vehicleId', nextVehicleId);
    form.setValue('driverId', nextDriverId);
    const t = window.setTimeout(() => {
      document
        .getElementById('market-bid-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
    return () => window.clearTimeout(t);
  }, [selectedJob, selectableVehicles, selectableDrivers, form]);

  const selectedVehicle = activeVehicles.find((v) => v.id === vehicleIdWatch);
  const selectedVehicleDgOk =
    !selectedJob?.requiresDg ||
    Boolean(selectedVehicle?.hasDg && selectedVehicle?.dgDocumentId);
  const vehicleEligible =
    !!selectedVehicle &&
    selectedVehicle.bidAvailable !== false &&
    selectedVehicleDgOk &&
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
      if (selectedJob?.requiresDg && (!vehicle?.hasDg || !vehicle?.dgDocumentId)) {
        throw new Error(
          t('market.errorVehicleNotDg', {
            defaultValue: 'Selected vehicle does not have a Dangerous Goods (DG) document attached.',
          }),
        );
      }
      if (vehicle?.bidAvailable === false) {
        throw new Error(t('market.errorVehicleBusy'));
      }
      if (driver?.bidAvailable === false) {
        throw new Error(t('market.errorDriverBusy'));
      }
      const driverCheck = driverEligibilityMap.get(values.driverId);
      if (driverCheck && !driverCheck.isEligible) {
        throw new Error(
          driverCheck.reason ||
            t('market.driverUnavailableScheduled', {
              defaultValue: 'Selected driver has scheduled leave during this job window.',
            }),
        );
      }
      return submitBid({
        jobId,
        vehicleId: values.vehicleId,
        driverId: values.driverId,
        amountIncGstCents: Math.round(values.amountAud * 100),
        etaMinutes: values.etaMinutes,
        dgDocumentId: selectedJob?.requiresDg ? (vehicle?.dgDocumentId ?? null) : null,
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

  const withdraw = useMutation({
    mutationFn: (targetJobId: string) => withdrawProposalByJobId(targetJobId),
    onSuccess: async () => {
      toast.success(
        t('market.bidWithdrawnSuccess', {
          defaultValue: 'Bid withdrawn successfully. Vehicle and driver have been released.',
        }),
      );
      if (jobId) setJobId(null);
      await qc.invalidateQueries({ queryKey: ['matching', 'board'] });
      await qc.invalidateQueries({ queryKey: ['carrier', 'vehicles'] });
      await qc.invalidateQueries({ queryKey: ['carrier', 'drivers'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const handleWithdrawBid = (targetJobId: string) => {
    void (async () => {
      const ok = await confirm({
        title: t('confirm.withdrawBidTitle', { defaultValue: 'Withdraw Bid' }),
        description: t('confirm.withdrawBidBody', {
          defaultValue:
            'Are you sure you want to withdraw this bid? Your vehicle and driver reservation will be released immediately so they can be assigned to other jobs.',
        }),
        confirmLabel: t('market.withdrawBid', { defaultValue: 'Withdraw bid' }),
      });
      if (ok) withdraw.mutate(targetJobId);
    })();
  };

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

      {openExceptionsCount > 0 ? (
        <Notice tone="warn" className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span>
            {t('market.openExceptionsNotice', {
              count: openExceptionsCount,
              defaultValue: `${openExceptionsCount} active trip issue(s) or breakdown(s) require your action.`,
            })}
          </span>
          <Link
            to="/carrier/exceptions"
            className="font-semibold text-clox-orange hover:underline shrink-0 text-xs"
          >
            {t('exceptions.viewAll', { defaultValue: 'View Exceptions →' })}
          </Link>
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
            <>
              <DataCardList
                className="mt-6"
                items={pagedFilteredJobs}
                getKey={(j) => j.id}
                mode={viewMode}
                renderItem={(j) => {
                  const bucket = marketBucket(j);
                  const tone = MARKET_TONE[bucket];
                  const selected = jobId === j.id;
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'h-full w-full cursor-pointer rounded-clox-md border p-4 text-left shadow-clox-1 transition',
                        statusAccentClass(tone),
                        selected
                          ? 'border-clox-orange ring-2 ring-clox-orange/30'
                          : 'hover:border-clox-orange',
                      )}
                      onClick={() => setJobId(j.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setJobId(j.id);
                        }
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-clox-ink">
                          {j.title ?? j.id.slice(0, 8)}
                        </p>
                        <StatusPill tone={tone}>{t(`market.bucket.${bucket}`)}</StatusPill>
                        {j.requiresDg ? (
                          <StatusPill tone="warn">DG</StatusPill>
                        ) : null}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-clox-faint">
                        {t('market.jobRef', { id: j.id.slice(0, 8) })}
                        {j.publishedAt
                          ? ` · ${new Date(j.publishedAt).toLocaleString()}`
                          : ''}
                        {j.pickupAt
                          ? ` · ${t('market.pickupAt', { when: new Date(j.pickupAt).toLocaleString() })}`
                          : ''}
                      </p>
                      <p className="mt-1 font-mono text-xs text-clox-mute">
                        {j.stopsSummary} · min {j.minVehicleClass}
                        {j.deadWeightKg != null ? ` · ${j.deadWeightKg}kg` : ''}
                        {j.lengthCm != null && j.widthCm != null && j.heightCm != null
                          ? ` · ${j.lengthCm}×${j.widthCm}×${j.heightCm}cm`
                          : ''}
                        {j.chargeableWeightKg != null
                          ? ` · ${t('market.weightKg', { kg: j.chargeableWeightKg })}`
                          : ''}
                        {j.requiresDg ? ` ${t('market.dgSuffix')}` : ''}
                        {j.routeFatigueBreakMinutes > 0
                          ? ` ${t('market.fatigueSuffix', { minutes: j.routeFatigueBreakMinutes })}`
                          : ''}
                        {j.estimateNetToCarrierCents != null
                          ? ` ${t('market.netApprox', { amount: formatDollars(j.estimateNetToCarrierCents) })}`
                          : ''}
                        {j.rescueDiscountPercent != null && j.rescueDiscountPercent > 0
                          ? ` · ${t('market.rescueDiscount', { percent: j.rescueDiscountPercent })}`
                          : ''}
                        {j.minBidIncGstCents != null
                          ? ` · ${t('market.minBidHint', { amount: formatDollars(j.minBidIncGstCents) })}`
                          : ''}
                      </p>
                      {j.requiresDg && j.dgDocumentId ? (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-clox-border bg-clox-surface p-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-clox-orange" />
                            <span
                              className="truncate font-medium text-clox-ink"
                              title={j.dgDocumentFilename || undefined}
                            >
                              {j.dgDocumentFilename ||
                                t('market.senderDgDocLabel', {
                                  defaultValue: 'Sender DG Document',
                                })}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 px-2 py-0.5 text-xs font-semibold"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openDocumentContent(j.dgDocumentId!).catch((err) =>
                                toast.error(getErrorDetail(err)),
                              );
                            }}
                          >
                            {t('market.viewDoc', { defaultValue: 'View' })}
                          </Button>
                        </div>
                      ) : null}
                      {j.alreadyBid ? (
                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-clox-border/60 pt-2 text-xs">
                          <span className="font-medium text-[var(--status-ok)]">
                            ✓ {t('market.bidPlaced', { defaultValue: 'Bid submitted' })}
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="text-xs text-clox-error border-clox-error/40 hover:bg-clox-error/5"
                            disabled={withdraw.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWithdrawBid(j.id);
                            }}
                          >
                            {withdraw.isPending
                              ? t('loading')
                              : t('market.withdrawBid', { defaultValue: 'Withdraw bid' })}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                }}
              />
              <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </>
      )}

      {jobId && selectedJob ? (
        selectedJob.alreadyBid ? (
          <div className="clox-card mt-8 max-w-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-clox-ink">
                {t('market.bidStatusTitle', { defaultValue: 'Submitted Bid' })}
              </h2>
              <StatusPill tone="ok">
                {t('market.bidSubmittedPill', { defaultValue: 'SUBMITTED' })}
              </StatusPill>
            </div>
            <p className="text-sm font-medium text-clox-ink">
              {selectedJob.title ?? selectedJob.id.slice(0, 8)}
            </p>
            <Notice tone="info">
              {t('market.alreadyBidNotice', {
                defaultValue:
                  'You have an active bid on this job. Your assigned vehicle and driver are reserved pending sender award.',
              })}
            </Notice>
            <div className="border-t border-clox-border pt-3">
              <p className="mb-2 text-xs text-clox-mute">
                {t('market.withdrawExplanation', {
                  defaultValue:
                    'Need to assign this vehicle or driver to another job? You can withdraw your bid at any time before the sender accepts.',
                })}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="block"
                className="text-clox-error border-clox-error/40 hover:bg-clox-error/5"
                disabled={withdraw.isPending}
                onClick={() => handleWithdrawBid(selectedJob.id)}
              >
                {withdraw.isPending
                  ? t('loading')
                  : t('market.withdrawBid', { defaultValue: 'Withdraw bid' })}
              </Button>
            </div>
          </div>
        ) : (
        <form
          id="market-bid-form"
          className="clox-card mt-8 max-w-md scroll-mt-24 p-4"
          onSubmit={form.handleSubmit((values) => bid.mutate(values))}
          noValidate
        >
          <h2 className="font-display font-semibold text-clox-ink">{t('market.placeBid')}</h2>
          <p className="mb-1 mt-1 text-sm font-medium text-clox-ink">
            {selectedJob.title ?? selectedJob.id.slice(0, 8)}
          </p>
          <p className="mb-2 font-mono text-[11px] text-clox-faint">
            {t('market.jobRef', { id: selectedJob.id.slice(0, 8) })}
            {' · '}
            {t('market.minClassLine', {
              minClass: selectedJob.minVehicleClass ?? t('dash'),
            })}
            {selectedJob.lengthCm != null &&
            selectedJob.widthCm != null &&
            selectedJob.heightCm != null
              ? ` · ${selectedJob.lengthCm}×${selectedJob.widthCm}×${selectedJob.heightCm} cm`
              : ''}
            {selectedJob.deadWeightKg != null ? ` · ${selectedJob.deadWeightKg} kg` : ''}
          </p>

          {selectedJob.requiresDg && selectedJob.dgDocumentId ? (
            <div className="mb-3 rounded-clox-sm border border-clox-border bg-clox-surface-alt p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-clox-ink" title={selectedJob.dgDocumentFilename || undefined}>
                    <span className="text-clox-mute">
                      {t('market.senderDgDocLabel', {
                        defaultValue: 'Sender DG Document:',
                      })}
                    </span>{' '}
                    {selectedJob.dgDocumentFilename || 'DG Declaration'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 text-xs px-2 py-1"
                  onClick={() =>
                    void openDocumentContent(selectedJob.dgDocumentId!).catch((err) =>
                      toast.error(getErrorDetail(err)),
                    )
                  }
                >
                  {t('market.viewDoc', { defaultValue: 'View Document' })}
                </Button>
              </div>
            </div>
          ) : null}

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
              const dgOk = !selectedJob.requiresDg || Boolean(v.hasDg && v.dgDocumentId);
              const busy = v.bidAvailable === false;
              const disabled = !classOk || !dgOk || busy;
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
                  {v.hasDg ? ' · DG' : ''}
                  {!classOk ? ` · ${t('market.notEligible')}` : ''}
                  {!dgOk
                    ? ` · ${t('market.notDgLicensed', { defaultValue: 'Not DG licensed' })}`
                    : ''}
                  {busy ? ` · ${busyHint}` : ''}
                </option>
              );
            })}
          </Select>

          {selectedJob.requiresDg && selectedVehicle?.dgDocumentId ? (
            <div className="mb-3 rounded-clox-sm border border-clox-border bg-clox-surface-alt p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-clox-orange" />
                  <span
                    className="truncate font-medium text-[var(--status-ok)]"
                    title={selectedVehicle.dgDocumentFilename || undefined}
                  >
                    ✓{' '}
                    {t('market.autoAttachedVehicleDgDoc', {
                      defaultValue: 'Vehicle DG Document:',
                    })}{' '}
                    {selectedVehicle.dgDocumentFilename || 'DG Licence'}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 px-2 py-0.5 text-xs font-semibold"
                  onClick={() =>
                    void openDocumentContent(selectedVehicle.dgDocumentId!).catch((err) =>
                      toast.error(getErrorDetail(err)),
                    )
                  }
                >
                  {t('market.viewDoc', { defaultValue: 'View' })}
                </Button>
              </div>
            </div>
          ) : null}

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
              const check = driverEligibilityMap.get(d.id);
              const scheduleUnavailable = check && !check.isEligible;
              const busy = d.bidAvailable === false || scheduleUnavailable;
              const busyHint = busy
                ? scheduleUnavailable
                  ? (check?.reason ??
                    t('market.driverUnavailableScheduled', {
                      defaultValue: 'Unavailable (scheduled leave)',
                    }))
                  : d.activityStatus === 'BID_COMMITTED'
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

          {driverIdWatch && driverEligibilityMap.get(driverIdWatch)?.isEligible === false ? (
            <Notice tone="warn" className="mb-3">
              {driverEligibilityMap.get(driverIdWatch)?.reason ??
                t('market.driverUnavailableScheduled', {
                  defaultValue: 'This driver has scheduled leave during the job execution window.',
                })}
            </Notice>
          ) : null}

          {vehicleIdWatch && selectedVehicle?.bidAvailable === false ? (
            <Notice tone="warn" className="mb-3">
              {t('market.errorVehicleBusy')}
            </Notice>
          ) : null}
          {vehicleIdWatch &&
          selectedVehicle?.bidAvailable !== false &&
          !selectedVehicleDgOk ? (
            <Notice tone="warn" className="mb-3">
              {t('market.errorVehicleNotDg', {
                defaultValue:
                  'This job requires a Dangerous Goods (DG) licensed vehicle with a DG document uploaded.',
              })}
            </Notice>
          ) : null}
          {vehicleIdWatch &&
          selectedVehicle?.bidAvailable !== false &&
          selectedVehicleDgOk &&
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
            {t('market.yourNetApprox', {
              amount: formatDollarsAmount((Number(amountWatch) || 0) * 0.7),
              percent: 70,
            })}
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
        )
      ) : null}
    </div>
  );
}
