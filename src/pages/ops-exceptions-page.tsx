import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  DataCardList,
  Notice,
  StatusPill,
  dataCardClassName,
} from '@/components/ui';
import { getErrorDetail, listOpsTripExceptions, type TripExceptionRow } from '@/lib/api';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function exceptionTone(status: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'ESCALATED') return 'danger';
  if (status === 'AWAITING_CARRIER' || status === 'OPEN') return 'warn';
  return 'info';
}

export function OpsExceptionsPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const allowed =
    role === AdminRole.SUPER_ADMIN || role === AdminRole.STATE_MASTER;

  const list = useQuery({
    queryKey: ['exceptions', 'ops'],
    queryFn: ({ signal }) => listOpsTripExceptions({ signal }),
    enabled: allowed,
  });

  if (!allowed) return <Navigate to="/" replace />;
  if (list.isLoading) return <LoadingBlock label={t('exceptions.opsLoading')} />;

  const items = list.data?.items ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-clox-ink">
        {t('exceptions.opsTitle')}
      </h1>
      <p className="mt-2 text-sm text-clox-mute">{t('exceptions.opsSubtitle')}</p>
      {list.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(list.error)}
        </Notice>
      ) : null}
      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock
            title={t('exceptions.opsEmptyTitle')}
            description={t('exceptions.opsEmptyHint')}
          />
        </div>
      ) : (
        <DataCardList
          className="mt-6"
          items={items}
          getKey={(row) => row.id}
          renderItem={(row) => <OpsExceptionCard row={row} />}
        />
      )}
    </div>
  );
}

function OpsExceptionCard({ row }: { row: TripExceptionRow }) {
  const { t } = useTranslation('common');
  return (
    <div className={`h-full ${dataCardClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-clox-ink">
            {row.job?.title ?? row.jobId.slice(0, 8)}
          </p>
          <p className="mt-0.5 text-xs text-clox-mute">
            {row.company?.legalName ?? t('dash')} · {row.kind} · {row.phase}
          </p>
        </div>
        <StatusPill tone={exceptionTone(row.status)}>{row.status}</StatusPill>
      </div>
      {row.note ? <p className="mt-2 line-clamp-2 text-xs text-clox-mute">{row.note}</p> : null}
      <p className="mt-2 font-mono text-xs text-clox-faint">
        {t('exceptions.openedAt', { time: new Date(row.openedAt).toLocaleString() })}
        {row.escalatedAt
          ? ` · ${t('exceptions.escalatedAt', {
              time: new Date(row.escalatedAt).toLocaleString(),
            })}`
          : ''}
      </p>
      <p className="mt-1 text-xs text-clox-faint">{t('exceptions.opsReadOnly')}</p>
    </div>
  );
}
