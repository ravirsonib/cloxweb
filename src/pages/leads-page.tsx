import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type MouseEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  ActionGroup,
  Button,
  DataCardList,
  DataTable,
  EmailLink,
  IconButton,
  Notice,
  PaginationBar,
  PhoneLink,
  ResponsiveDataView,
  Select,
  ViewModeToggle,
  dataCardClassName,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { Trash2 } from 'lucide-react';
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

export function LeadsPage() {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const page = Number(searchParams.get('page') || '1') || 1;
  const q = searchParams.get('q') || '';
  const type = (searchParams.get('type') || '') as LeadType | '';
  const status = (searchParams.get('status') || '') as LeadStatus | '';

  const [viewMode, setViewMode] = useDataViewMode('leads', 'list');
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
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: LeadStatus }) =>
      updateLead(id, { status: nextStatus }),
    onSuccess: async () => {
      toast.success(t('admin.statusUpdated'));
      await qc.invalidateQueries({ queryKey: ['admin', 'leads'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: async () => {
      toast.success(t('admin.deleteLeadSuccess'));
      await qc.invalidateQueries({ queryKey: ['admin', 'leads'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const items = leadsQuery.data?.items ?? [];
  const totalPages = leadsQuery.data?.totalPages ?? 1;
  const total = leadsQuery.data?.total ?? 0;
  const busy = statusMutation.isPending || deleteMutation.isPending;

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

  async function onStatusChange(lead: LeadListItem, nextStatus: LeadStatus) {
    if (nextStatus === lead.status) return;
    const ok = await confirm({
      title: t('confirm.changeLeadStatusTitle'),
      description: t('confirm.changeLeadStatusBody', {
        from: formatLeadStatus(lead.status),
        to: formatLeadStatus(nextStatus),
      }),
      confirmLabel: t('admin.saveStatus'),
    });
    if (!ok) return;
    statusMutation.mutate({ id: lead.id, nextStatus });
  }

  async function onDelete(lead: LeadListItem) {
    const ok = await confirm({
      title: t('confirm.deleteLeadTitle'),
      description: t('confirm.deleteLeadBody'),
      confirmLabel: t('admin.deleteLead'),
      tone: 'destructive',
    });
    if (!ok) return;
    deleteMutation.mutate(lead.id);
  }

  function stopRowNav(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function statusSelect(lead: LeadListItem) {
    return (
      <div
        className="min-w-0 w-full sm:min-w-[9.5rem] sm:w-auto"
        onMouseDown={stopRowNav}
        onClick={stopRowNav}
      >
        <Select
          className="mb-0"
          aria-label={t('admin.colStatus')}
          value={lead.status}
          disabled={busy}
          onChange={(event) => {
            void onStatusChange(lead, event.target.value as LeadStatus);
          }}
        >
          {LEAD_STATUS_KEYS.map((value) => (
            <option key={value} value={value}>
              {t(`leadStatuses.${value}`)}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  function deleteButton(lead: LeadListItem) {
    return (
      <IconButton
        type="button"
        icon={Trash2}
        label={t('admin.deleteLead')}
        tooltip={t('admin.deleteLead')}
        variant="destructive"
        size="sm"
        disabled={busy}
        onMouseDown={stopRowNav}
        onClick={(event) => {
          stopRowNav(event);
          void onDelete(lead);
        }}
      />
    );
  }

  function renderLeadCard(lead: LeadListItem) {
    return (
      <div className={`${dataCardClassName} h-full flex flex-col justify-between`}>
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Link
                to={`/leads/${lead.id}`}
                className="truncate font-medium text-clox-ink hover:text-clox-orange block"
              >
                {lead.companyName || lead.email}
                {lead.priority ? (
                  <span className="ml-2 text-xs text-clox-orange">★</span>
                ) : null}
              </Link>
              <div className="mt-1 flex flex-col gap-0.5">
                <EmailLink email={lead.email} maxWidthClassName="max-w-[200px]" />
                {lead.phone ? <PhoneLink phone={lead.phone} /> : null}
              </div>
            </div>
            {statusSelect(lead)}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-clox-border-soft pt-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-clox-mute">
            <span>{formatLeadType(lead.type)}</span>
            <span>
              {[lead.state, lead.territory].filter(Boolean).join(' · ') || t('dash')}
            </span>
            <span>{formatDateTime(lead.createdAt)}</span>
          </div>
          <ActionGroup>{deleteButton(lead)}</ActionGroup>
        </div>
      </div>
    );
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
        <div className="flex items-center gap-2">
          {items.length > 0 ? (
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          ) : null}
          <Button variant="secondary" onClick={() => void onExport()} disabled={exporting}>
            {exporting ? t('loading') : t('admin.exportCsv')}
          </Button>
        </div>
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
          ) : viewMode === 'grid' ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((lead) => (
                <div key={lead.id} className="min-w-0 h-full">
                  {renderLeadCard(lead)}
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveDataView
              className="mt-6"
              cards={
                <DataCardList
                  items={items}
                  getKey={(lead) => lead.id}
                  renderItem={renderLeadCard}
                />
              }
              table={
                <DataTable
                  minWidthClassName="min-w-[52rem]"
                  headers={[
                    t('admin.colLead'),
                    t('admin.colType'),
                    t('admin.colStatus'),
                    t('admin.colLocation'),
                    t('admin.colCreated'),
                    t('admin.colActions'),
                  ]}
                  headerClassNames={[
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    'text-right',
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
                          className="font-medium text-clox-ink hover:text-clox-orange block"
                        >
                          {lead.companyName || lead.email}
                          {lead.priority ? (
                            <span className="ml-2 text-xs text-clox-orange">★</span>
                          ) : null}
                        </Link>
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          <EmailLink email={lead.email} maxWidthClassName="max-w-[200px]" />
                          {lead.phone ? <PhoneLink phone={lead.phone} /> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-clox-mute">{formatLeadType(lead.type)}</td>
                      <td className="px-4 py-3">{statusSelect(lead)}</td>
                      <td className="px-4 py-3 text-clox-mute">
                        {[lead.state, lead.territory].filter(Boolean).join(' · ') || t('dash')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-clox-mute">
                        {formatDateTime(lead.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ActionGroup>{deleteButton(lead)}</ActionGroup>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              }
            />
          )}
        </>
      ) : null}

      {items.length > 0 ? (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalCount={total}
          disabled={busy}
          onPageChange={(p) => updateFilter('page', String(p))}
        />
      ) : null}
    </div>
  );
}
