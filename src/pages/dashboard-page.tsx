import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  DataCardList,
  DataTable,
  DistributionBars,
  Kpi,
  KpiStrip,
  Notice,
  ResponsiveDataView,
  Timeline,
  dataCardClassName,
} from '@/components/ui';
import { getDashboardStats, getErrorDetail } from '@/lib/api';
import { formatAuditAction } from '@/lib/audit-format';
import {
  formatDateTime,
  formatLeadStatus,
  formatLeadType,
} from '@/lib/leads';

export function DashboardPage() {
  const { t } = useTranslation('common');
  const query = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: ({ signal }) => getDashboardStats({ signal }),
  });

  const totals = query.data?.totals;
  const recentLeads = query.data?.recentLeads ?? [];
  const byStatus = query.data?.byStatus ?? {};
  const recentActivity = query.data?.recentActivity ?? [];

  const statusBars = Object.entries(byStatus).map(([status, count]) => ({
    id: status,
    label: formatLeadStatus(status),
    value: count,
  }));

  const activityItems = recentActivity.map((event, index) => ({
    id: event.id,
    title: formatAuditAction(event.action, t),
    subtitle: [
      event.lead?.companyName || event.lead?.email || null,
      event.actor?.email || t('system'),
      formatDateTime(event.createdAt),
    ]
      .filter(Boolean)
      .join(' · '),
    tone: (index === 0 ? 'now' : 'done') as 'now' | 'done',
  }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('admin.dashboardTitle')}
          </h1>
          <p className="mt-2 text-sm text-clox-mute">{t('admin.dashboardSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/leads" className="clox-btn clox-btn-primary">
            {t('admin.openQueue')}
          </Link>
          <Link to="/surcharges" className="clox-btn clox-btn-secondary">
            {t('surcharges.opsTitle')}
          </Link>
        </div>
      </div>

      {query.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {query.isError ? (
        <Notice tone="error" className="mt-8">
          {getErrorDetail(query.error)}
        </Notice>
      ) : null}

      {totals ? (
        <>
          <KpiStrip className="mt-8">
            <Kpi label={t('admin.statAll')} value={totals.all} />
            <Kpi
              label={t('admin.statToday')}
              value={totals.today}
              urgent={totals.today > 0}
            />
            <Kpi label={t('admin.statWeek')} value={totals.week} />
            <Kpi label={t('admin.statInvestors')} value={totals.investors} />
          </KpiStrip>
          <KpiStrip className="mt-3">
            <Kpi label={t('admin.statRegistrySenders')} value={totals.registrySenders} />
            <Kpi label={t('admin.statRegistryCarriers')} value={totals.registryCarriers} />
            <Kpi label={t('admin.statEoiState')} value={totals.eoiStateMasters} />
            <Kpi label={t('admin.statEoiLocal')} value={totals.eoiLocalBdes} />
          </KpiStrip>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <section className="clox-card p-5 lg:col-span-2">
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('admin.byStatus')}
              </h2>
              <p className="mt-1 text-sm text-clox-mute">{t('admin.dashboardSubtitle')}</p>
              <DistributionBars
                className="mt-5"
                items={statusBars}
                empty={
                  <p className="mt-4 text-sm text-clox-faint">{t('admin.noStatusData')}</p>
                }
              />
            </section>

            <section className="clox-card p-5">
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('admin.activity')}
              </h2>
              <Timeline
                className="mt-5"
                items={activityItems}
                empty={
                  <p className="mt-4 text-sm text-clox-faint">{t('admin.noEvents')}</p>
                }
              />
            </section>
          </div>

          <section className="mt-10">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('admin.recentLeads')}
            </h2>

            {recentLeads.length === 0 ? (
              <div className="mt-3">
                <EmptyBlock
                  title={t('admin.noLeadsYet')}
                  description={t('admin.noLeadsYetHint')}
                />
              </div>
            ) : (
              <ResponsiveDataView
                className="mt-3"
                cards={
                  <DataCardList
                    items={recentLeads}
                    getKey={(lead) => lead.id}
                    renderItem={(lead) => (
                      <Link to={`/leads/${lead.id}`} className={`block ${dataCardClassName}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-clox-ink">
                              {lead.companyName || lead.email}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-clox-faint">{lead.email}</p>
                          </div>
                          <span className="shrink-0 rounded-md bg-clox-surface-alt px-2 py-1 text-xs text-clox-mute">
                            {formatLeadStatus(lead.status)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-clox-mute">
                          <span>{formatLeadType(lead.type)}</span>
                          <span>{formatDateTime(lead.createdAt)}</span>
                        </div>
                      </Link>
                    )}
                  />
                }
                table={
                  <DataTable
                    minWidthClassName="min-w-[36rem]"
                    headers={[
                      t('admin.colCompany'),
                      t('admin.colType'),
                      t('admin.colStatus'),
                      t('admin.colCreated'),
                    ]}
                  >
                    {recentLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            to={`/leads/${lead.id}`}
                            className="font-medium text-clox-ink hover:text-clox-orange"
                          >
                            {lead.companyName || lead.email}
                          </Link>
                          <div className="text-xs text-clox-faint">{lead.email}</div>
                        </td>
                        <td className="px-4 py-2.5 text-clox-mute">{formatLeadType(lead.type)}</td>
                        <td className="px-4 py-2.5 text-clox-mute">
                          {formatLeadStatus(lead.status)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-clox-mute">
                          {formatDateTime(lead.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                }
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
