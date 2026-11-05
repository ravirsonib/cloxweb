import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { RefreshCw, Scale } from 'lucide-react';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCardList,
  Notice,
  PaginationBar,
  StatusPill,
  dataCardClassName,
  useClientPagination,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  getErrorDetail,
  listOpsTripExceptions,
  releaseTripException,
  type TripExceptionRow,
} from '@/lib/api';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/cn';

function exceptionTone(status: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'ESCALATED') return 'danger';
  if (status === 'AWAITING_CARRIER' || status === 'OPEN') return 'warn';
  if (status === 'RESOLVED' || status === 'RESOLVED_RELISTED') return 'ok';
  return 'info';
}

export function OpsExceptionsPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ESCALATED' | 'AWAITING_CARRIER' | 'RESOLVED'>('ALL');

  const allowed =
    role === AdminRole.SUPER_ADMIN || role === AdminRole.STATE_MASTER;

  const list = useQuery({
    queryKey: ['exceptions', 'ops'],
    queryFn: ({ signal }) => listOpsTripExceptions({ signal }),
    enabled: allowed,
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) =>
      releaseTripException(id, { note: 'Released to marketplace by Super Admin Ops' }),
    onSuccess: () => {
      toast.success(t('exceptions.relistSuccess', { defaultValue: 'Job released to marketplace with priority' }));
      void qc.invalidateQueries({ queryKey: ['exceptions', 'ops'] });
    },
    onError: (err) => {
      toast.error(getErrorDetail(err));
    },
  });

  const allItems = list.data?.items ?? [];

  const filteredItems = useMemo(() => {
    if (statusFilter === 'ALL') return allItems;
    if (statusFilter === 'RESOLVED') {
      return allItems.filter(
        (x) => x.status === 'RESOLVED' || x.status === 'RESOLVED_RELISTED' || x.status === 'CLOSED',
      );
    }
    return allItems.filter((x) => x.status === statusFilter);
  }, [allItems, statusFilter]);

  const pager = useClientPagination(filteredItems, 10);

  if (!allowed) return <Navigate to="/" replace />;
  if (list.isLoading) return <LoadingBlock label={t('exceptions.opsLoading')} />;

  const handleRelease = (id: string, jobTitle?: string) => {
    void (async () => {
      const ok = await confirm({
        title: t('exceptions.confirmReleaseTitle', { defaultValue: 'Release Job to Marketplace?' }),
        description: t('exceptions.confirmReleaseDesc', {
          defaultValue: `This will unassign the current carrier and re-list job "${jobTitle || id}" to the live marketplace with priority rescue discount.`,
        }),
        confirmLabel: t('exceptions.releaseAction', { defaultValue: 'Release to Marketplace' }),
      });
      if (ok) releaseMutation.mutate(id);
    })();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink">
            {t('exceptions.opsTitle')}
          </h1>
          <p className="mt-2 text-sm text-clox-mute">{t('exceptions.opsSubtitle')}</p>
        </div>
        <Link
          to="/ops/disputes"
          className="inline-flex items-center gap-1.5 rounded-clox-md border border-clox-border bg-clox-surface px-3 py-1.5 text-xs font-semibold text-clox-ink shadow-clox-1 hover:border-clox-orange"
        >
          <Scale className="h-4 w-4 text-clox-orange" />
          <span>{t('nav.disputes', { defaultValue: 'Settlement Disputes' })} →</span>
        </Link>
      </div>

      {list.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(list.error)}
        </Notice>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold transition',
            statusFilter === 'ALL'
              ? 'bg-clox-orange text-white'
              : 'bg-clox-surface-alt text-clox-mute hover:text-clox-ink',
          )}
        >
          {t('filter.all', { defaultValue: 'All' })} ({allItems.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('ESCALATED')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold transition',
            statusFilter === 'ESCALATED'
              ? 'bg-rose-600 text-white'
              : 'bg-clox-surface-alt text-clox-mute hover:text-clox-ink',
          )}
        >
          {t('exceptions.statusEscalated', { defaultValue: 'Escalated' })} (
          {allItems.filter((x) => x.status === 'ESCALATED').length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('AWAITING_CARRIER')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold transition',
            statusFilter === 'AWAITING_CARRIER'
              ? 'bg-amber-600 text-white'
              : 'bg-clox-surface-alt text-clox-mute hover:text-clox-ink',
          )}
        >
          {t('exceptions.statusAwaitingCarrier', { defaultValue: 'Awaiting Carrier' })} (
          {allItems.filter((x) => x.status === 'AWAITING_CARRIER').length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('RESOLVED')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold transition',
            statusFilter === 'RESOLVED'
              ? 'bg-emerald-600 text-white'
              : 'bg-clox-surface-alt text-clox-mute hover:text-clox-ink',
          )}
        >
          {t('exceptions.statusResolved', { defaultValue: 'Resolved' })} (
          {allItems.filter((x) => x.status === 'RESOLVED' || x.status === 'RESOLVED_RELISTED').length})
        </button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock
            title={t('exceptions.opsEmptyTitle')}
            description={t('exceptions.opsEmptyHint')}
          />
        </div>
      ) : (
        <>
          <DataCardList
            className="mt-6"
            items={pager.pagedItems}
            getKey={(row) => row.id}
            renderItem={(row) => (
              <OpsExceptionCard
                row={row}
                canRelease={role === AdminRole.SUPER_ADMIN && (row.status === 'ESCALATED' || row.status === 'AWAITING_CARRIER')}
                onRelease={() => handleRelease(row.id, row.job?.title ?? undefined)}
                isReleasing={releaseMutation.isPending && releaseMutation.variables === row.id}
              />
            )}
          />
          <PaginationBar
            page={pager.page}
            totalPages={pager.totalPages}
            onPageChange={pager.setPage}
          />
        </>
      )}
    </div>
  );
}

function OpsExceptionCard({
  row,
  canRelease,
  onRelease,
  isReleasing,
}: {
  row: TripExceptionRow;
  canRelease?: boolean;
  onRelease?: () => void;
  isReleasing?: boolean;
}) {
  const { t } = useTranslation('common');
  return (
    <div className={`h-full ${dataCardClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-clox-ink">
            {row.job?.title ?? row.jobId.slice(0, 8)}
          </p>
          <p className="mt-0.5 text-xs text-clox-mute">
            {row.company?.legalName ?? t('dash')} · <span className="font-semibold text-clox-ink">{row.kind}</span> · {row.phase}
          </p>
        </div>
        <StatusPill tone={exceptionTone(row.status)}>{row.status}</StatusPill>
      </div>
      {row.note ? <p className="mt-2 line-clamp-2 text-xs text-clox-mute">{row.note}</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-clox-border/40 pt-2 text-xs text-clox-faint">
        <span className="font-mono">
          {t('exceptions.openedAt', { time: new Date(row.openedAt).toLocaleString() })}
        </span>
        <div className="flex items-center gap-2">
          {canRelease && onRelease ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isReleasing}
              onClick={onRelease}
              className="text-xs font-semibold text-clox-orange border-clox-orange/40 hover:bg-orange-50 dark:hover:bg-orange-950/20"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', isReleasing && 'animate-spin')} />
              {isReleasing ? t('common.loading') : t('exceptions.releaseAction', { defaultValue: 'Release to Market' })}
            </Button>
          ) : null}
          <Link
            to="/ops/disputes"
            className="inline-flex items-center gap-1 font-semibold text-clox-mute hover:text-clox-orange"
            title="Check dispute status"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Disputes</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
