import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCardList,
  DataTable,
  Notice,
  ResponsiveDataView,
  Select,
  StatusPill,
  dataCardClassName,
} from '@/components/ui';
import { exportLeadsCsv, getErrorDetail, listLeads } from '@/lib/api';
import {
  LEAD_STATUS_KEYS,
  LEAD_TYPE_KEYS,
  formatDateTime,
  formatLeadStatus,
  formatLeadType,
} from '@/lib/leads';
import { LeadStatus, LeadType } from '@/shared/types';

export function LeadsPage() {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);

  const page = Number(searchParams.get('page') || '1') || 1;
  const q = searchParams.get('q') || '';
  const type = (searchParams.get('type') || '') as LeadType | '';
  const status = (searchParams.get('status') || '') as LeadStatus | '';

  const [searchDraft, setSearchDraft] = useState(q);

  const query = useMemo(
    () => ({
      page,
      pageSize: 20,
      q: q || undefined,
      type: type || undefined,
      status: status || undefined,
    }),
    [page, q, type, status],
  );

  const leadsQuery = useQuery({
    queryKey: ['admin', 'leads', query],
    queryFn: ({ signal }) => listLeads(query, { signal }),
  });

  const items = leadsQuery.data?.items ?? [];
  const totalPages = leadsQuery.data?.totalPages ?? 1;
  const total = leadsQuery.data?.total ?? 0;

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  }

  function applySearch() {
    updateFilter('q', searchDraft.trim());
  }

  async function onExport() {
    setExporting(true);
    try {
      await exportLeadsCsv({
        q: q || undefined,
        type: type || undefined,
        status: status || undefined,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('admin.leadsTitle')}
          </h1>
          <p className="mt-2 text-sm text-clox-mute">{t('totalCount', { count: total })}</p>
        </div>
        <Button variant="secondary" onClick={() => void onExport()} disabled={exporting}>
          {exporting ? t('loading') : t('admin.exportCsv')}
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
        <label className="mb-0 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
            {t('search')}
          </span>
          <input
            className="clox-field-control"
            placeholder={t('admin.searchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applySearch();
            }}
          />
        </label>
        <Select
          className="mb-0"
          label={t('admin.colType')}
          value={type}
          onChange={(event) => updateFilter('type', event.target.value)}
        >
          <option value="">{t('admin.allTypes')}</option>
          {LEAD_TYPE_KEYS.map((value) => (
            <option key={value} value={value}>
              {t(`leadTypes.${value}`)}
            </option>
          ))}
        </Select>
        <Select
          className="mb-0"
          label={t('admin.colStatus')}
          value={status}
          onChange={(event) => updateFilter('status', event.target.value)}
        >
          <option value="">{t('admin.allStatuses')}</option>
          {LEAD_STATUS_KEYS.map((value) => (
            <option key={value} value={value}>
              {t(`leadStatuses.${value}`)}
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={applySearch}>
          {t('search')}
        </Button>
      </div>

      {leadsQuery.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {leadsQuery.isError ? (
        <Notice tone="error" className="mt-8">
          {getErrorDetail(leadsQuery.error)}
        </Notice>
      ) : null}

      {!leadsQuery.isLoading && !leadsQuery.isError ? (
        <>
          {items.length === 0 ? (
            <div className="mt-6">
              <EmptyBlock title={t('admin.noLeads')} description={t('admin.noLeadsHint')} />
            </div>
          ) : (
            <ResponsiveDataView
              className="mt-6"
              cards={
                <DataCardList
                  items={items}
                  getKey={(lead) => lead.id}
                  renderItem={(lead) => (
                    <Link to={`/leads/${lead.id}`} className={`block ${dataCardClassName}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-clox-ink">
                            {lead.companyName || lead.email}
                            {lead.priority ? (
                              <span className="ml-2 text-xs text-clox-orange">★</span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-clox-faint">{lead.email}</p>
                          {lead.phone ? (
                            <p className="truncate text-xs text-clox-faint">{lead.phone}</p>
                          ) : null}
                        </div>
                        <StatusPill tone="neutral">{formatLeadStatus(lead.status)}</StatusPill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-clox-mute">
                        <span>{formatLeadType(lead.type)}</span>
                        <span>
                          {[lead.state, lead.territory].filter(Boolean).join(' · ') || t('dash')}
                        </span>
                        <span>{formatDateTime(lead.createdAt)}</span>
                      </div>
                    </Link>
                  )}
                />
              }
              table={
                <DataTable
                  minWidthClassName="min-w-[44rem]"
                  headers={[
                    t('admin.colLead'),
                    t('admin.colType'),
                    t('admin.colStatus'),
                    t('admin.colLocation'),
                    t('admin.colCreated'),
                  ]}
                >
                  {items.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/leads/${lead.id}`}
                          className="font-medium text-clox-ink hover:text-clox-orange"
                        >
                          {lead.companyName || lead.email}
                          {lead.priority ? (
                            <span className="ml-2 text-xs text-clox-orange">★</span>
                          ) : null}
                        </Link>
                        <div className="text-xs text-clox-faint">{lead.email}</div>
                        {lead.phone ? (
                          <div className="text-xs text-clox-faint">{lead.phone}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-clox-mute">{formatLeadType(lead.type)}</td>
                      <td className="px-4 py-3 text-clox-mute">{formatLeadStatus(lead.status)}</td>
                      <td className="px-4 py-3 text-clox-mute">
                        {[lead.state, lead.territory].filter(Boolean).join(' · ') || t('dash')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-clox-mute">
                        {formatDateTime(lead.createdAt)}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              }
            />
          )}
        </>
      ) : null}

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-clox-mute">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => updateFilter('page', String(page - 1))}
          >
            {t('previous')}
          </Button>
          <span className="order-first w-full text-center sm:order-none sm:w-auto">
            {t('pageOf', { page, totalPages })}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => updateFilter('page', String(page + 1))}
          >
            {t('next')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
