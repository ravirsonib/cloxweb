import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fieldClassName,
  secondaryButtonClassName,
} from '@/components/admin-shell';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
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
    return <span className="text-slate-500">{t('dash')}</span>;
  }
  return (
    <div className="space-y-0.5">
      {details.map((row) => (
        <p key={`${item.id}-${row.label}`} className="text-sm leading-snug text-slate-300">
          <span className="text-slate-500">{row.label}: </span>
          <span className="break-words text-slate-200">{row.value}</span>
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
          className="block truncate font-medium text-white hover:text-clox-orange"
        >
          {item.lead.companyName || item.lead.email}
        </Link>
        <p className="truncate text-xs text-slate-500">
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
  return <span className="text-slate-500">{t('dash')}</span>;
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
        <h1 className="text-2xl font-bold sm:text-3xl">{t('admin.auditTitle')}</h1>
        <p className="mt-1 text-sm text-slate-400 sm:mt-2">
          {t('admin.auditSubtitle', { count: total })}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:mt-6 sm:grid-cols-[1fr_1fr_auto] sm:gap-3">
        <select
          className={fieldClassName}
          value={action}
          onChange={(event) => updateFilter('action', event.target.value)}
        >
          <option value="">{t('admin.allActions')}</option>
          {ACTION_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {formatAuditAction(value, t)}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className={fieldClassName}
            placeholder={t('admin.leadIdPlaceholder')}
            value={leadIdDraft}
            onChange={(event) => setLeadIdDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') updateFilter('leadId', leadIdDraft.trim());
            }}
          />
          <button
            type="button"
            className={`${secondaryButtonClassName} shrink-0 px-3 sm:hidden`}
            onClick={() => updateFilter('leadId', leadIdDraft.trim())}
          >
            {t('filter')}
          </button>
        </div>
        <button
          type="button"
          className={`${secondaryButtonClassName} hidden sm:inline-flex`}
          onClick={() => updateFilter('leadId', leadIdDraft.trim())}
        >
          {t('filter')}
        </button>
      </div>

      {auditQuery.isLoading ? (
        <div className="mt-6">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {auditQuery.isError ? (
        <p className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {getErrorDetail(auditQuery.error)}
        </p>
      ) : null}

      {!auditQuery.isLoading && !auditQuery.isError && items.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock title={t('admin.noAudit')} />
        </div>
      ) : null}

      {!auditQuery.isLoading && !auditQuery.isError && items.length > 0 ? (
        <>
          {/* Mobile: compact cards */}
          <div className="mt-4 space-y-2 md:hidden">
            {items.map((item) => {
              const details = formatAuditMetadata(item.metadata, t);
              const actorLabel = item.actor?.name || item.actor?.email || t('system');
              const hasLead = Boolean(item.lead || item.leadId);

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <h2 className="text-sm font-semibold leading-snug text-white">
                    {formatAuditAction(item.action, t)}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(item.createdAt)}
                    <span className="text-slate-600"> · </span>
                    <span className="text-slate-300">{actorLabel}</span>
                  </p>

                  {hasLead || details.length > 0 ? (
                    <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
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
            })}
          </div>

          {/* Desktop: dense table */}
          <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {t('admin.colWhen')}
                  </th>
                  <th className="px-3 py-2.5 font-medium">{t('admin.colAction')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('admin.colActor')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('admin.colLead')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('admin.colDetails')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-white/10 align-top hover:bg-white/5">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-400">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-white">
                        {formatAuditAction(item.action, t)}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.65rem] text-slate-600">
                        {item.action}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      <p className="truncate">
                        {item.actor?.name || item.actor?.email || t('system')}
                      </p>
                      {item.actor?.name && item.actor?.email ? (
                        <p className="truncate text-xs text-slate-500">{item.actor.email}</p>
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
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-2 text-sm text-slate-400">
          <button
            type="button"
            className={`${secondaryButtonClassName} px-3 py-2`}
            disabled={page <= 1}
            onClick={() => updateFilter('page', String(page - 1))}
          >
            {t('previous')}
          </button>
          <span className="shrink-0 text-center text-xs sm:text-sm">
            {t('pageOf', { page, totalPages })}
          </span>
          <button
            type="button"
            className={`${secondaryButtonClassName} px-3 py-2`}
            disabled={page >= totalPages}
            onClick={() => updateFilter('page', String(page + 1))}
          >
            {t('next')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
