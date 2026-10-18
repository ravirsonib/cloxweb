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
  dataCardClassName,
} from '@/components/ui';
import { formatAuditAction, formatAuditMetadata } from '@/lib/audit-format';
import { getErrorDetail, listAudit } from '@/lib/api';
import type { AuditListItem } from '@/lib/api/admin';
import { formatDateTime, formatLeadType } from '@/lib/leads';
import { AuditAction } from '@/shared/types';

const ACTION_OPTIONS = Object.values(AuditAction);
const PAGE_SIZE = 20;

function AuditDetailsInline({
  item,
}: {
  item: AuditListItem;
}) {
  const { t } = useTranslation('common');
  const details = formatAuditMetadata(item.metadata, t);
  if (details.length === 0) {
    return <span className="text-clox-faint">{t('dash')}</span>;
  }
  return (
    <div className="space-y-0.5">
      {details.map((row) => (
        <p key={`${item.id}-${row.label}`} className="text-sm leading-snug text-clox-mute">
          <span className="text-clox-faint">{row.label}: </span>
          <span className="break-words text-clox-text">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

function AuditLeadCell({ item }: { item: AuditListItem }) {
  const { t } = useTranslation('common');
  if (item.lead) {
    return (
      <div className="min-w-0">
        <Link
          to={`/leads/${item.lead.id}`}
          className="block truncate font-medium text-clox-ink hover:text-clox-orange"
        >
          {item.lead.companyName || item.lead.email}
        </Link>
        <p className="truncate text-xs text-clox-faint">
          {formatLeadType(item.lead.type)}
          {item.lead.companyName ? ` · ${item.lead.email}` : null}
        </p>
      </div>
    );
  }
  if (item.leadId) {
    return (
      <Link to={`/leads/${item.leadId}`} className="text-clox-orange hover:underline">
        {t('viewLead')}
      </Link>
    );
  }
  return <span className="text-clox-faint">{t('dash')}</span>;
}

export function AuditPage() {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const [leadIdDraft, setLeadIdDraft] = useState(searchParams.get('leadId') || '');

  const page = Number(searchParams.get('page') || '1') || 1;
  const action = searchParams.get('action') || '';
  const leadId = searchParams.get('leadId') || '';

  const query = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      action: action || undefined,
      leadId: leadId || undefined,
    }),
    [page, action, leadId],
  );

  const auditQuery = useQuery({
    queryKey: ['admin', 'audit', query],
    queryFn: ({ signal }) => listAudit(query, { signal }),
  });

  const items: AuditListItem[] = auditQuery.data?.items ?? [];
  const totalPages = auditQuery.data?.totalPages ?? 1;
  const total = auditQuery.data?.total ?? 0;

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  }

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
          {t('admin.auditTitle')}
        </h1>
        <p className="mt-1 text-sm text-clox-mute sm:mt-2">
          {t('admin.auditSubtitle', { count: total })}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:mt-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:gap-3">
        <Select
          className="mb-0"
          label={t('admin.colAction')}
          value={action}
          onChange={(event) => updateFilter('action', event.target.value)}
        >
          <option value="">{t('admin.allActions')}</option>
          {ACTION_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {formatAuditAction(value, t)}
            </option>
          ))}
        </Select>
        <label className="mb-0 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
            {t('admin.colLead')}
          </span>
          <div className="flex gap-2">
            <input
              className="clox-field-control"
              placeholder={t('admin.leadIdPlaceholder')}
              value={leadIdDraft}
              onChange={(event) => setLeadIdDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') updateFilter('leadId', leadIdDraft.trim());
              }}
            />
            <Button
              variant="secondary"
              className="shrink-0 px-3 sm:hidden"
              onClick={() => updateFilter('leadId', leadIdDraft.trim())}
            >
              {t('filter')}
            </Button>
          </div>
        </label>
        <Button
          variant="secondary"
          className="hidden sm:inline-flex"
          onClick={() => updateFilter('leadId', leadIdDraft.trim())}
        >
          {t('filter')}
        </Button>
      </div>

      {auditQuery.isLoading ? (
        <div className="mt-6">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {auditQuery.isError ? (
        <Notice tone="error" className="mt-6">
          {getErrorDetail(auditQuery.error)}
        </Notice>
      ) : null}

      {!auditQuery.isLoading && !auditQuery.isError && items.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock title={t('admin.noAudit')} />
        </div>
      ) : null}

      {!auditQuery.isLoading && !auditQuery.isError && items.length > 0 ? (
        <ResponsiveDataView
          className="mt-4"
          cards={
            <DataCardList
              items={items}
              getKey={(item) => item.id}
              renderItem={(item) => {
                const details = formatAuditMetadata(item.metadata, t);
                const actorLabel = item.actor?.name || item.actor?.email || t('system');
                const hasLead = Boolean(item.lead || item.leadId);

                return (
                  <article className={dataCardClassName}>
                    <h2 className="text-sm font-semibold leading-snug text-clox-ink">
                      {formatAuditAction(item.action, t)}
                    </h2>
                    <p className="mt-1 text-xs text-clox-mute">
                      {formatDateTime(item.createdAt)}
                      <span className="text-clox-faint"> · </span>
                      <span>{actorLabel}</span>
                    </p>

                    {hasLead || details.length > 0 ? (
                      <div className="mt-2 space-y-2 border-t border-clox-border pt-2">
                        {hasLead ? (
                          <div className="text-sm">
                            <AuditLeadCell item={item} />
                          </div>
                        ) : null}
                        {details.length > 0 ? <AuditDetailsInline item={item} /> : null}
                      </div>
                    ) : null}
                  </article>
                );
              }}
            />
          }
          table={
            <DataTable
              minWidthClassName="min-w-[56rem]"
              headers={[
                t('admin.colWhen'),
                t('admin.colAction'),
                t('admin.colActor'),
                t('admin.colLead'),
                t('admin.colDetails'),
              ]}
            >
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-clox-border-soft align-top hover:bg-clox-surface-alt/60"
                >
                  <td className="whitespace-nowrap px-3 py-3 text-clox-mute">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-clox-ink">
                      {formatAuditAction(item.action, t)}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.65rem] text-clox-faint">
                      {item.action}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-clox-mute">
                    <p className="truncate">
                      {item.actor?.name || item.actor?.email || t('system')}
                    </p>
                    {item.actor?.name && item.actor?.email ? (
                      <p className="truncate text-xs text-clox-faint">{item.actor.email}</p>
                    ) : null}
                  </td>
                  <td className="max-w-[14rem] px-3 py-3">
                    <AuditLeadCell item={item} />
                  </td>
                  <td className="max-w-[22rem] px-3 py-3">
                    <AuditDetailsInline item={item} />
                  </td>
                </tr>
              ))}
            </DataTable>
          }
        />
      ) : null}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-2 text-sm text-clox-mute">
          <Button
            variant="secondary"
            className="px-3 py-2"
            disabled={page <= 1}
            onClick={() => updateFilter('page', String(page - 1))}
          >
            {t('previous')}
          </Button>
          <span className="shrink-0 text-center text-xs sm:text-sm">
            {t('pageOf', { page, totalPages })}
          </span>
          <Button
            variant="secondary"
            className="px-3 py-2"
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
