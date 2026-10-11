import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fieldClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '@/components/admin-shell';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { deleteLead, exportLeadsCsv, getErrorDetail, listLeads, updateLead } from '@/lib/api';
import {
  LEAD_STATUS_KEYS,
  LEAD_TYPE_KEYS,
  formatDateTime,
  formatLeadStatus,
  formatLeadType,
  type LeadListItem,
} from '@/lib/leads';
import { LeadStatus, LeadType } from '@/shared/types';

type PendingStatusChange = {
  lead: LeadListItem;
  nextStatus: LeadStatus;
};

export function LeadsPage() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PendingStatusChange | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LeadListItem | null>(null);

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

  const statusMutation = useMutation({
    mutationFn: ({ leadId, nextStatus }: { leadId: string; nextStatus: LeadStatus }) =>
      updateLead(leadId, { status: nextStatus }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'lead', variables.leadId] });
      setPendingStatus(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (leadId: string) => deleteLead(leadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      setPendingDelete(null);
    },
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

  function requestStatusChange(lead: LeadListItem, nextStatus: LeadStatus) {
    if (nextStatus === lead.status) return;
    statusMutation.reset();
    setPendingStatus({ lead, nextStatus });
  }

  function confirmStatusChange() {
    if (!pendingStatus) return;
    statusMutation.mutate({
      leadId: pendingStatus.lead.id,
      nextStatus: pendingStatus.nextStatus,
    });
  }

  function leadDisplayName(lead: LeadListItem) {
    return lead.companyName || lead.email;
  }

  function requestDelete(lead: LeadListItem) {
    deleteMutation.reset();
    setPendingDelete(lead);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteMutation.mutate(pendingDelete.id);
  }

  function deleteButton(lead: LeadListItem) {
    const busy = deleteMutation.isPending && deleteMutation.variables === lead.id;

    return (
      <button
        type="button"
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
        disabled={busy || deleteMutation.isPending}
        aria-label={t('admin.deleteLead')}
        onClick={(event) => {
          event.stopPropagation();
          requestDelete(lead);
        }}
      >
        {busy ? t('loading') : t('admin.deleteLead')}
      </button>
    );
  }

  function statusSelect(lead: LeadListItem, className?: string) {
    const busy =
      statusMutation.isPending && statusMutation.variables?.leadId === lead.id;

    return (
      <select
        className={className ?? `${fieldClassName} min-w-[9.5rem] py-1.5`}
        value={lead.status}
        disabled={busy || statusMutation.isPending}
        aria-label={t('admin.status')}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          event.stopPropagation();
          requestStatusChange(lead, event.target.value as LeadStatus);
        }}
      >
        {LEAD_STATUS_KEYS.map((value) => (
          <option key={value} value={value}>
            {t(`leadStatuses.${value}`)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t('admin.leadsTitle')}</h1>
          <p className="mt-2 text-sm text-slate-400">{t('totalCount', { count: total })}</p>
        </div>
        <button
          type="button"
          onClick={() => void onExport()}
          disabled={exporting}
          className={secondaryButtonClassName}
        >
          {exporting ? t('loading') : t('admin.exportCsv')}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className={fieldClassName}
          placeholder={t('admin.searchPlaceholder')}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applySearch();
          }}
        />
        <select
          className={fieldClassName}
          value={type}
          onChange={(event) => updateFilter('type', event.target.value)}
        >
          <option value="">{t('admin.allTypes')}</option>
          {LEAD_TYPE_KEYS.map((value) => (
            <option key={value} value={value}>
              {t(`leadTypes.${value}`)}
            </option>
          ))}
        </select>
        <select
          className={fieldClassName}
          value={status}
          onChange={(event) => updateFilter('status', event.target.value)}
        >
          <option value="">{t('admin.allStatuses')}</option>
          {LEAD_STATUS_KEYS.map((value) => (
            <option key={value} value={value}>
              {t(`leadStatuses.${value}`)}
            </option>
          ))}
        </select>
        <button type="button" className={primaryButtonClassName} onClick={applySearch}>
          {t('search')}
        </button>
      </div>

      {leadsQuery.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {leadsQuery.isError ? (
        <p className="mt-8 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {getErrorDetail(leadsQuery.error)}
        </p>
      ) : null}

      {!leadsQuery.isLoading && !leadsQuery.isError ? (
        <>
          {items.length === 0 ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <EmptyBlock
                title={t('admin.noLeads')}
                description={t('admin.noLeadsHint')}
              />
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="mt-6 space-y-3 md:hidden">
                {items.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/leads/${lead.id}`} className="min-w-0">
                        <p className="truncate font-medium text-white hover:text-clox-orange">
                          {lead.companyName || lead.email}
                          {lead.priority ? (
                            <span className="ml-2 text-xs text-clox-orange">★</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{lead.email}</p>
                        {lead.phone ? (
                          <p className="truncate text-xs text-slate-500">{lead.phone}</p>
                        ) : null}
                      </Link>
                      <div className="shrink-0">{statusSelect(lead, `${fieldClassName} w-[9.5rem] py-1.5`)}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>{formatLeadType(lead.type)}</span>
                      <span>
                        {[lead.state, lead.territory].filter(Boolean).join(' · ') || t('dash')}
                      </span>
                      <span>{formatDateTime(lead.createdAt)}</span>
                    </div>
                    <div className="mt-3 flex justify-end">{deleteButton(lead)}</div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
                <table className="min-w-[44rem] w-full text-left text-sm">
                  <thead className="bg-white/5 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('admin.colLead')}</th>
                      <th className="px-3 py-2 font-medium">{t('admin.colType')}</th>
                      <th className="px-3 py-2 font-medium">{t('admin.colStatus')}</th>
                      <th className="px-3 py-2 font-medium">{t('admin.colLocation')}</th>
                      <th className="px-3 py-2 font-medium">{t('admin.colCreated')}</th>
                      <th className="px-3 py-2 font-medium">{t('admin.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((lead) => (
                      <tr key={lead.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-3 py-3">
                          <Link
                            to={`/leads/${lead.id}`}
                            className="font-medium text-white hover:text-clox-orange"
                          >
                            {lead.companyName || lead.email}
                            {lead.priority ? (
                              <span className="ml-2 text-xs text-clox-orange">★</span>
                            ) : null}
                          </Link>
                          <div className="text-xs text-slate-500">{lead.email}</div>
                          {lead.phone ? (
                            <div className="text-xs text-slate-500">{lead.phone}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-slate-300">{formatLeadType(lead.type)}</td>
                        <td className="px-3 py-3">{statusSelect(lead)}</td>
                        <td className="px-3 py-3 text-slate-400">
                          {[lead.state, lead.territory].filter(Boolean).join(' · ') || t('dash')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-400">
                          {formatDateTime(lead.createdAt)}
                        </td>
                        <td className="px-3 py-3">{deleteButton(lead)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : null}

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={page <= 1}
            onClick={() => updateFilter('page', String(page - 1))}
          >
            {t('previous')}
          </button>
          <span className="order-first w-full text-center sm:order-none sm:w-auto">
            {t('pageOf', { page, totalPages })}
          </span>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={page >= totalPages}
            onClick={() => updateFilter('page', String(page + 1))}
          >
            {t('next')}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={t('admin.confirmStatusTitle')}
        body={
          pendingStatus
            ? t('admin.confirmStatusBody', {
                from: formatLeadStatus(pendingStatus.lead.status),
                to: formatLeadStatus(pendingStatus.nextStatus),
              })
            : null
        }
        confirming={statusMutation.isPending}
        onCancel={() => {
          if (!statusMutation.isPending) {
            statusMutation.reset();
            setPendingStatus(null);
          }
        }}
        onConfirm={confirmStatusChange}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('admin.confirmDeleteTitle')}
        body={
          pendingDelete
            ? t('admin.confirmDeleteBody', { name: leadDisplayName(pendingDelete) })
            : null
        }
        confirmLabel={t('admin.deleteLead')}
        confirming={deleteMutation.isPending}
        onCancel={() => {
          if (!deleteMutation.isPending) {
            deleteMutation.reset();
            setPendingDelete(null);
          }
        }}
        onConfirm={confirmDelete}
      />

      {statusMutation.isError ? (
        <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {getErrorDetail(statusMutation.error)}
        </p>
      ) : null}

      {deleteMutation.isError ? (
        <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {getErrorDetail(deleteMutation.error)}
        </p>
      ) : null}
    </div>
  );
}
