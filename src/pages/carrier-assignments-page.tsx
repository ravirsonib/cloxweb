import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { getCarrierAssignments, getErrorDetail, listCarrierExceptions } from '@/lib/api';
import { LoadingBlock } from '@/components/status-blocks';
import {
  DataCard,
  DataCardList,
  Notice,
  StatusPill,
  ViewModeToggle,
  useDataViewMode,
} from '@/components/ui';
import type { SurchargeRow } from '@/lib/api/surcharges';
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
  const role = useAuthStore((s) => s.role);
  const [viewMode, setViewMode] = useDataViewMode('assignments', 'list');
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
                {jobExceptions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {jobExceptions.map((exc) => (
                      <ExceptionBadge key={exc.id} exc={exc} />
                    ))}
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
    </div>
  );
}
