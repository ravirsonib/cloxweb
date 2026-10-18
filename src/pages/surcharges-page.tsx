import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import {
  getErrorDetail,
  listSenderSurcharges,
  paySurcharge,
  waiveSurcharge,
} from '@/lib/api';
import { Button, DataCard, Notice, StatusPill, useToast } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import type { SurchargeRow } from '@/lib/api/surcharges';
import { AdminRole, AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function kindLabel(kind: SurchargeRow['kind'], t: (k: string) => string) {
  return kind === 'WAITING' ? t('surcharges.kindWaiting') : t('surcharges.kindMass');
}

function statusBadge(status: SurchargeRow['status'], t: (k: string) => string) {
  if (status === 'PAID') return <StatusPill tone="ok">{t('surcharges.paid')}</StatusPill>;
  if (status === 'WAIVED') return <StatusPill tone="neutral">{t('surcharges.waived')}</StatusPill>;
  return <StatusPill tone="warn">{t('surcharges.pending')}</StatusPill>;
}

export function SurchargesPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();
  const isSender = role === AppRole.SENDER;
  const isSuper = role === AdminRole.SUPER_ADMIN;
  const canAccess = isSender || isSuper;

  const list = useQuery({
    queryKey: ['payments', 'surcharges', role],
    queryFn: () => listSenderSurcharges(),
    enabled: canAccess,
  });

  const pay = useMutation({
    mutationFn: (id: string) => paySurcharge(id),
    onSuccess: async () => {
      toast.success(t('surcharges.paySuccess'));
      await qc.invalidateQueries({ queryKey: ['payments', 'surcharges'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const waive = useMutation({
    mutationFn: (id: string) => waiveSurcharge(id),
    onSuccess: async () => {
      toast.success(t('surcharges.waiveSuccess'));
      await qc.invalidateQueries({ queryKey: ['payments', 'surcharges'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (!canAccess) return <Navigate to="/" replace />;
  if (list.isLoading) return <LoadingBlock label={t('surcharges.loading')} />;

  const rows = list.data ?? [];

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-clox-ink">
        {isSuper ? t('surcharges.opsTitle') : t('surcharges.title')}
      </h1>
      <p className="mt-2 text-sm text-clox-mute">
        {isSuper ? t('surcharges.opsSubtitle') : t('surcharges.subtitle')}
      </p>

      {list.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(list.error)}
        </Notice>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-clox-faint">{t('surcharges.empty')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <DataCard>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-clox-ink">{kindLabel(row.kind, t)}</span>
                      {statusBadge(row.status, t)}
                    </div>
                    <p className="mt-1 font-mono text-xs text-clox-mute">
                      {t('surcharges.amount', {
                        amount: (row.amountIncGstCents / 100).toFixed(2),
                      })}
                    </p>
                    {row.job ? (
                      isSender ? (
                        <Link
                          to={`/jobs/${row.jobId}/track`}
                          className="mt-1 block text-xs font-semibold text-clox-orange hover:underline"
                        >
                          {row.job.title ?? row.jobId.slice(0, 8)} →
                        </Link>
                      ) : (
                        <p className="mt-1 font-mono text-xs text-clox-faint">
                          {row.job.title ?? row.jobId.slice(0, 8)}
                        </p>
                      )
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    {isSender && row.status === 'PENDING_PAYMENT' && !row.readOnly ? (
                      <Button
                        type="button"
                        variant="cta"
                        size="sm"
                        disabled={pay.isPending}
                        onClick={() => pay.mutate(row.id)}
                      >
                        {t('surcharges.pay')}
                      </Button>
                    ) : null}
                    {isSuper && row.status === 'PENDING_PAYMENT' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={waive.isPending}
                        onClick={() => waive.mutate(row.id)}
                      >
                        {t('surcharges.waive')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </DataCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
