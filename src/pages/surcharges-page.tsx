import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import {
  createDispute,
  getErrorDetail,
  listSenderSurcharges,
  paySurcharge,
  waiveSurcharge,
} from '@/lib/api';
import {
  Button,
  DataCard,
  Notice,
  PaginationBar,
  StatusPill,
  useClientPagination,
  useConfirm,
  useToast,
} from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { formatDollars } from '@/lib/currency';
import type { SurchargeRow } from '@/lib/api/surcharges';
import { AdminRole, AppRole, DisputeType } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function kindLabel(kind: SurchargeRow['kind'], t: (k: string) => string) {
  return kind === 'WAITING' ? t('surcharges.kindWaiting') : t('surcharges.kindMass');
}

function statusBadge(status: SurchargeRow['status'], t: (k: string) => string) {
  if (status === 'PAID') return <StatusPill tone="ok">{t('surcharges.paid')}</StatusPill>;
  if (status === 'WAIVED') return <StatusPill tone="neutral">{t('surcharges.waived')}</StatusPill>;
  if (status === 'DISPUTED') return <StatusPill tone="info">Disputed</StatusPill>;
  return <StatusPill tone="warn">{t('surcharges.pending')}</StatusPill>;
}

export function SurchargesPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
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

  const [disputeRow, setDisputeRow] = useState<SurchargeRow | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');

  const disputeMutation = useMutation({
    mutationFn: async () => {
      if (!disputeRow) return;
      return createDispute({
        jobId: disputeRow.jobId,
        surchargeId: disputeRow.id,
        type:
          disputeRow.kind === 'WAITING'
            ? DisputeType.WAITING_SURCHARGE
            : DisputeType.MASS_SURCHARGE,
        reason: disputeReason.trim(),
        description: disputeDescription.trim(),
        evidenceUrls: [],
      });
    },
    onSuccess: async () => {
      toast.success('Dispute submitted successfully');
      setDisputeRow(null);
      setDisputeReason('');
      setDisputeDescription('');
      await qc.invalidateQueries({ queryKey: ['payments', 'surcharges'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const rows = list.data ?? [];
  const {
    page,
    setPage,
    totalPages,
    pagedItems: pagedRows,
  } = useClientPagination(rows, 10);

  if (!canAccess) return <Navigate to="/" replace />;
  if (list.isLoading) return <LoadingBlock label={t('surcharges.loading')} />;

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
        <>
          <ul className="mt-6 space-y-3">
            {pagedRows.map((row) => (
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
                          amount: formatDollars(row.amountIncGstCents),
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
                        <>
                          <Button
                            type="button"
                            variant="cta"
                            size="sm"
                            disabled={pay.isPending}
                            onClick={() => {
                              void (async () => {
                                const ok = await confirm({
                                  title: t('confirm.paySurchargeTitle'),
                                  description: t('confirm.paySurchargeBody'),
                                  confirmLabel: t('surcharges.pay'),
                                });
                                if (ok) pay.mutate(row.id);
                              })();
                            }}
                          >
                            {t('surcharges.pay')}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={disputeMutation.isPending}
                            onClick={() => {
                              setDisputeRow(row);
                              setDisputeReason('');
                              setDisputeDescription('');
                            }}
                          >
                            Dispute
                          </Button>
                        </>
                      ) : null}
                      {isSuper && row.status === 'PENDING_PAYMENT' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={waive.isPending}
                          onClick={() => {
                            void (async () => {
                              const ok = await confirm({
                                title: t('confirm.waiveSurchargeTitle'),
                                description: t('confirm.waiveSurchargeBody'),
                                confirmLabel: t('surcharges.waive'),
                                tone: 'destructive',
                              });
                              if (ok) waive.mutate(row.id);
                            })();
                          }}
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
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Dispute Modal */}
      {disputeRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-clox-ink">
              Dispute {kindLabel(disputeRow.kind, t)}
            </h3>
            <p className="mt-1 text-xs text-clox-mute">
              Disputing this charge of {formatDollars(disputeRow.amountIncGstCents)} will open a review ticket with operations.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-clox-faint uppercase tracking-wider">
                  Reason for Dispute *
                </label>
                <input
                  type="text"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="e.g. Site was accessible, driver arrived early"
                  className="mt-1 w-full rounded-lg border border-clox-border p-2.5 text-xs text-clox-ink focus:border-clox-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-clox-faint uppercase tracking-wider">
                  Detailed Explanation *
                </label>
                <textarea
                  rows={4}
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Provide timestamps, dock evidence or explanation..."
                  className="mt-1 w-full rounded-lg border border-clox-border p-2.5 text-xs text-clox-ink focus:border-clox-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDisputeRow(null)}
              >
                Cancel
              </Button>
              <Button
                variant="cta"
                size="sm"
                disabled={!disputeReason.trim() || !disputeDescription.trim() || disputeMutation.isPending}
                onClick={() => disputeMutation.mutate()}
              >
                {disputeMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
