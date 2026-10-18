import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import {
  getCarrierOnboarding,
  getErrorDetail,
  getMarketBoard,
  submitBid,
} from '@/lib/api';
import {
  Button,
  DataCardList,
  Field,
  Notice,
  ViewModeToggle,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { cn } from '@/lib/cn';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type BidForm = {
  amountAud: number;
  etaMinutes: number;
};

export function MarketBoardPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const board = useQuery({
    queryKey: ['matching', 'board'],
    queryFn: () => getMarketBoard(),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });
  const fleet = useQuery({
    queryKey: ['carrier', 'onboarding'],
    queryFn: () => getCarrierOnboarding(),
    enabled: role === AppRole.TRANSPORT_COMPANY,
  });

  const [jobId, setJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useDataViewMode('market', 'list');
  const toast = useToast();

  const vehicleId = fleet.data?.vehicles[0]?.id;
  const driverId = fleet.data?.drivers[0]?.id;

  const schema = z.object({
    amountAud: z.number().positive(t('validation.bidAmountPositive')),
    etaMinutes: z.number().int().min(1, t('validation.etaPositive')),
  });

  const form = useForm<BidForm>({
    resolver: zodResolver(schema),
    defaultValues: { amountAud: 150, etaMinutes: 90 },
  });

  const amountWatch = form.watch('amountAud');

  const bid = useMutation({
    mutationFn: (values: BidForm) => {
      if (!jobId || !vehicleId || !driverId) {
        throw new Error(t('market.errorSelectJobFleet'));
      }
      return submitBid({
        jobId,
        vehicleId,
        driverId,
        amountIncGstCents: Math.round(values.amountAud * 100),
        etaMinutes: values.etaMinutes,
      });
    },
    onSuccess: async () => {
      toast.success(t('market.bidSubmitted'));
      await qc.invalidateQueries({ queryKey: ['matching', 'board'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (role !== AppRole.TRANSPORT_COMPANY) return <Navigate to="/" replace />;
  if (board.isLoading) return <LoadingBlock label={t('market.loading')} />;

  const marketJobs = board.data?.jobs ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink">{t('market.title')}</h1>
          <p className="mt-2 text-sm text-clox-mute">
            {board.data?.netPayoutHint ?? t('market.netPayoutHintDefault')}
          </p>
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>
      {board.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(board.error)}
        </Notice>
      ) : null}

      {!vehicleId || !driverId ? (
        <Notice tone="warn" className="mt-4">
          {t('market.errorSelectJobFleet')}
        </Notice>
      ) : null}

      <DataCardList
        className="mt-6"
        items={marketJobs}
        getKey={(j) => j.id}
        mode={viewMode}
        renderItem={(j) => (
          <button
            type="button"
            className={cn(
              'h-full w-full rounded-clox-md border p-4 text-left shadow-clox-1 transition',
              jobId === j.id
                ? 'border-clox-orange bg-clox-orange-tint'
                : 'border-clox-border bg-clox-surface hover:border-clox-orange',
            )}
            onClick={() => setJobId(j.id)}
          >
            <p className="font-semibold text-clox-ink">{j.title ?? j.id.slice(0, 8)}</p>
            <p className="mt-1 font-mono text-xs text-clox-mute">
              {j.stopsSummary} · min {j.minVehicleClass}
              {j.requiresDg ? ` ${t('market.dgSuffix')}` : ''}
              {j.routeFatigueBreakMinutes > 0
                ? ` ${t('market.fatigueSuffix', { minutes: j.routeFatigueBreakMinutes })}`
                : ''}
              {j.estimateNetToCarrierCents != null
                ? ` ${t('market.netApprox', { amount: (j.estimateNetToCarrierCents / 100).toFixed(2) })}`
                : ''}
              {j.alreadyBid ? ` · ${t('market.alreadyBid')}` : ''}
            </p>
          </button>
        )}
      />

      {jobId ? (
        <form
          className="clox-card mt-8 max-w-md p-4"
          onSubmit={form.handleSubmit((values) => bid.mutate(values))}
          noValidate
        >
          <h2 className="font-display font-semibold text-clox-ink">{t('market.placeBid')}</h2>
          <p className="mb-4 mt-1 text-xs text-clox-faint">
            {t('market.vehicleDriverLine', {
              registration: fleet.data?.vehicles[0]?.registration ?? t('dash'),
              email: fleet.data?.drivers[0]?.email ?? t('dash'),
            })}
          </p>
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
            disabled={bid.isPending || !vehicleId || !driverId}
          >
            {bid.isPending ? t('submitting') : t('market.submitProposal')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
