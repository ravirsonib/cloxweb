import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  deleteCompany,
  disableCompany,
  getCompanyReferrer,
  getErrorDetail,
  listCompanies,
  listLocalBdesForReassign,
  reactivateCompany,
  reassignCompanyReferrer,
  type CompanyListItem,
} from '@/lib/api';
import { formatDateTime } from '@/lib/leads';
import { companyStatusTone } from '@/lib/status-tone';
import {
  COMPANY_STATUS_KEYS,
  CompanyStatus,
  CompanyType,
  type AdminCompanyListQuery,
} from '@/shared/types';

const REGION_OPTIONS = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;

function parseCompanyType(value: string): AdminCompanyListQuery['type'] {
  if (value === CompanyType.SENDER || value === CompanyType.CARRIER) return value;
  return undefined;
}

function parseCompanyStatus(value: string): AdminCompanyListQuery['status'] {
  return (COMPANY_STATUS_KEYS as readonly string[]).includes(value)
    ? (value as CompanyStatus)
    : undefined;
}

export function CompaniesPage() {
  const { t } = useTranslation('common');
  const confirm = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') || '');
  const [disableTarget, setDisableTarget] = useState<CompanyListItem | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [disableNote, setDisableNote] = useState('');
  const [reassignTarget, setReassignTarget] = useState<CompanyListItem | null>(null);
  const [reassignLocalId, setReassignLocalId] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const page = Number(searchParams.get('page') || '1') || 1;
  const q = searchParams.get('q') || '';
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || '';
  const regionCode = searchParams.get('regionCode') || '';

  const query = useMemo(
    () => ({
      page,
      pageSize: 20,
      q: q || undefined,
      type: parseCompanyType(type),
      status: parseCompanyStatus(status),
      regionCode: regionCode || undefined,
    }),
    [page, q, type, status, regionCode],
  );

  const companiesQuery = useQuery({
    queryKey: ['admin', 'companies', query],
    queryFn: ({ signal }) => listCompanies(query, { signal }),
  });

  const localBdesQuery = useQuery({
    queryKey: ['ops', 'growth', 'local-bdes'],
    queryFn: listLocalBdesForReassign,
    enabled: Boolean(reassignTarget),
  });

  const referrerQuery = useQuery({
    queryKey: ['ops', 'growth', 'referrer', reassignTarget?.id],
    queryFn: () => getCompanyReferrer(reassignTarget!.id),
    enabled: Boolean(reassignTarget),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'companies'] });

  const disableMutation = useMutation({
    mutationFn: () =>
      disableCompany(disableTarget!.id, {
        reason: disableReason.trim(),
        note: disableNote.trim() || undefined,
      }),
    onSuccess: async () => {
      setDisableTarget(null);
      setDisableReason('');
      setDisableNote('');
      setActionError(null);
      toast.success(t('companies.disableSuccess'));
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateCompany(id),
    onSuccess: async () => {
      setActionError(null);
      toast.success(t('companies.reactivateSuccess'));
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: async () => {
      setActionError(null);
      toast.success(t('companies.deleteSuccess'));
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const reassignMutation = useMutation({
    mutationFn: () =>
      reassignCompanyReferrer(
        reassignTarget!.id,
        reassignLocalId ? reassignLocalId : null,
      ),
    onSuccess: async () => {
      setReassignTarget(null);
      setReassignLocalId('');
      setActionError(null);
      toast.success(t('growth.reassignSuccess'));
      await invalidate();
    },
    onError: (error) => setActionError(getErrorDetail(error)),
  });

  const items = companiesQuery.data?.items ?? [];
  const totalPages = companiesQuery.data?.totalPages ?? 1;
  const total = companiesQuery.data?.total ?? 0;
  const busy =
    disableMutation.isPending ||
    reactivateMutation.isPending ||
    deleteMutation.isPending ||
    reassignMutation.isPending;

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

  async function onDisable(row: CompanyListItem) {
    setActionError(null);
    setDisableReason('');
    setDisableNote('');
    setDisableTarget(row);
  }

  async function onReactivate(row: CompanyListItem) {
    const ok = await confirm({
      title: t('companies.reactivateTitle'),
      description: t('companies.reactivateBody', { name: row.legalName }),
      confirmLabel: t('companies.reactivateConfirm'),
      tone: 'default',
    });
    if (!ok) return;
    reactivateMutation.mutate(row.id);
  }

  async function onDelete(row: CompanyListItem) {
    const ok = await confirm({
      title: t('companies.deleteTitle'),
      description: t('companies.deleteBody', { name: row.legalName }),
      confirmLabel: t('companies.deleteConfirm'),
      tone: 'destructive',
    });
    if (!ok) return;
    deleteMutation.mutate(row.id);
  }

  function renderActions(row: CompanyListItem) {
    const reassignBtn = (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => {
          setActionError(null);
          setReassignLocalId('');
          setReassignTarget(row);
        }}
      >
        {t('growth.reassignConfirm')}
      </Button>
    );
    if (row.status === CompanyStatus.DRAFT) {
      return (
        <div className="flex flex-wrap justify-end gap-2">
          {reassignBtn}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void onDelete(row)}
          >
            {t('companies.delete')}
          </Button>
        </div>
      );
    }
    if (row.status === CompanyStatus.SUSPENDED) {
      return (
        <div className="flex flex-wrap justify-end gap-2">
          {reassignBtn}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void onReactivate(row)}
          >
            {t('companies.reactivate')}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {reassignBtn}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => void onDisable(row)}
        >
          {t('companies.disable')}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
          {t('companies.title')}
        </h1>
        <p className="mt-2 text-sm text-clox-mute">
          {t('companies.subtitle')} · {t('totalCount', { count: total })}
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 sm:items-end">
        <label className="mb-0 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
            {t('search')}
          </span>
          <input
            className="clox-field-control"
            placeholder={t('companies.searchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applySearch();
            }}
          />
        </label>
        <Select
          className="mb-0"
          label={t('companies.colType')}
          value={type}
          onChange={(event) => updateFilter('type', event.target.value)}
        >
          <option value="">{t('companies.allTypes')}</option>
          <option value={CompanyType.SENDER}>{t('companies.typeSender')}</option>
          <option value={CompanyType.CARRIER}>{t('companies.typeCarrier')}</option>
        </Select>
        <Select
          className="mb-0"
          label={t('companies.colStatus')}
          value={status}
          onChange={(event) => updateFilter('status', event.target.value)}
        >
          <option value="">{t('companies.allStatuses')}</option>
          {COMPANY_STATUS_KEYS.map((value) => (
            <option key={value} value={value}>
              {t(`companyStatuses.${value}`, { defaultValue: value })}
            </option>
          ))}
        </Select>
        <Select
          className="mb-0"
          label={t('companies.colRegion')}
          value={regionCode}
          onChange={(event) => updateFilter('regionCode', event.target.value)}
        >
          <option value="">{t('companies.allRegions')}</option>
          {REGION_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={applySearch}>
          {t('search')}
        </Button>
      </div>

      {actionError ? (
        <Notice tone="error" className="mt-4">
          {actionError}
        </Notice>
      ) : null}

      {companiesQuery.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {companiesQuery.isError ? (
        <Notice tone="error" className="mt-8">
          {getErrorDetail(companiesQuery.error)}
        </Notice>
      ) : null}

      {!companiesQuery.isLoading && !companiesQuery.isError ? (
        <>
          {items.length === 0 ? (
            <div className="mt-6">
              <EmptyBlock
                title={t('companies.emptyTitle')}
                description={t('companies.emptyHint')}
              />
            </div>
          ) : (
            <ResponsiveDataView
              className="mt-6"
              cards={
                <DataCardList
                  items={items}
                  getKey={(row) => row.id}
                  renderItem={(row) => (
                    <div className={dataCardClassName}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-clox-ink">{row.legalName}</p>
                          {row.tradingName ? (
                            <p className="truncate text-xs text-clox-faint">{row.tradingName}</p>
                          ) : null}
                          <p className="mt-0.5 truncate text-xs text-clox-faint">
                            {row.email ?? t('dash')}
                          </p>
                        </div>
                        <StatusPill tone={companyStatusTone(row.status)}>
                          {t(`companyStatuses.${row.status}`, { defaultValue: row.status })}
                        </StatusPill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-clox-mute">
                        <span>
                          {row.type === 'CARRIER'
                            ? t('companies.typeCarrier')
                            : t('companies.typeSender')}
                        </span>
                        <span>{row.homeRegion?.code ?? t('dash')}</span>
                        <span>{row.abn ? `ABN ${row.abn}` : t('dash')}</span>
                        <span>
                          {row.type === 'CARRIER'
                            ? t('companies.fleetCounts', {
                                vehicles: row.counts.vehicles,
                                drivers: row.counts.drivers,
                              })
                            : t('companies.fleetCountsSender', {
                                users: row.counts.users,
                              })}
                        </span>
                        <span>{formatDateTime(row.createdAt)}</span>
                      </div>
                      {row.status === CompanyStatus.SUSPENDED && row.suspendedReason ? (
                        <p className="mt-2 text-xs text-clox-mute">
                          {t('companies.suspendedReasonLabel')}: {row.suspendedReason}
                        </p>
                      ) : null}
                      {row.openCase ? (
                        <Link
                          to={`/compliance/${row.openCase.id}`}
                          className="mt-3 inline-block text-xs font-semibold text-clox-orange hover:underline"
                        >
                          {t('companies.openCaseLink', { status: row.openCase.status })}
                        </Link>
                      ) : null}
                      <div className="mt-3">{renderActions(row)}</div>
                    </div>
                  )}
                />
              }
              table={
                <DataTable
                  minWidthClassName="min-w-[64rem]"
                  headers={[
                    t('companies.colCompany'),
                    t('companies.colType'),
                    t('companies.colStatus'),
                    t('companies.colRegion'),
                    t('companies.colAbn'),
                    t('companies.colFleet'),
                    t('companies.colCreated'),
                    t('companies.colCase'),
                    t('companies.colActions'),
                  ]}
                >
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-clox-ink">{row.legalName}</p>
                        <div className="text-xs text-clox-faint">{row.email ?? t('dash')}</div>
                        {row.phone ? (
                          <div className="text-xs text-clox-faint">{row.phone}</div>
                        ) : null}
                        {row.status === CompanyStatus.SUSPENDED && row.suspendedReason ? (
                          <div className="mt-1 text-xs text-clox-mute">
                            {t('companies.suspendedReasonLabel')}: {row.suspendedReason}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-clox-mute">
                        {row.type === 'CARRIER'
                          ? t('companies.typeCarrier')
                          : t('companies.typeSender')}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={companyStatusTone(row.status)}>
                          {t(`companyStatuses.${row.status}`, { defaultValue: row.status })}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 text-clox-mute">
                        {row.homeRegion?.code ?? t('dash')}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-clox-mute">
                        {row.abn ?? t('dash')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-clox-mute">
                        {row.type === 'CARRIER'
                          ? t('companies.fleetCounts', {
                              vehicles: row.counts.vehicles,
                              drivers: row.counts.drivers,
                            })
                          : t('companies.fleetCountsSender', {
                              users: row.counts.users,
                            })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-clox-mute">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {row.openCase ? (
                          <Link
                            to={`/compliance/${row.openCase.id}`}
                            className="text-sm font-semibold text-clox-orange hover:underline"
                          >
                            {row.openCase.status}
                          </Link>
                        ) : (
                          <span className="text-clox-faint">{t('dash')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{renderActions(row)}</td>
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

      {disableTarget ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !disableMutation.isPending) {
              setDisableTarget(null);
            }
          }}
        >
          <div className="clox-dialog" role="dialog" aria-modal="true">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('companies.disableTitle')}
            </h2>
            <p className="mt-2 text-sm text-clox-mute">
              {t('companies.disableBody', { name: disableTarget.legalName })}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('companies.disableReason')}
              </span>
              <textarea
                className="clox-field-control min-h-[4.5rem]"
                value={disableReason}
                onChange={(event) => setDisableReason(event.target.value)}
                placeholder={t('companies.disableReasonPlaceholder')}
                maxLength={500}
                required
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('companies.disableNote')}
              </span>
              <textarea
                className="clox-field-control min-h-[3.5rem]"
                value={disableNote}
                onChange={(event) => setDisableNote(event.target.value)}
                placeholder={t('companies.disableNotePlaceholder')}
                maxLength={2000}
              />
            </label>
            {disableMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {getErrorDetail(disableMutation.error)}
              </Notice>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={disableMutation.isPending}
                onClick={() => setDisableTarget(null)}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={disableMutation.isPending || disableReason.trim().length < 3}
                onClick={() => disableMutation.mutate()}
              >
                {disableMutation.isPending ? t('loading') : t('companies.disableConfirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {reassignTarget ? (
        <div
          className="clox-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reassignMutation.isPending) {
              setReassignTarget(null);
            }
          }}
        >
          <div className="clox-dialog" role="dialog" aria-modal="true">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('growth.reassignTitle')}
            </h2>
            <p className="mt-2 text-sm text-clox-mute">
              {t('growth.reassignBody', { name: reassignTarget.legalName })}
            </p>
            <p className="mt-3 text-sm text-clox-ink">
              {t('growth.currentOwner')}:{' '}
              {referrerQuery.data?.referredByAdminUser
                ? `${referrerQuery.data.referredByAdminUser.name ?? ''} (${referrerQuery.data.referredByAdminUser.email})`
                : t('growth.hqOwner')}
            </p>
            <Select
              className="mt-4"
              label={t('growth.pickLocal')}
              value={reassignLocalId}
              onChange={(event) => setReassignLocalId(event.target.value)}
            >
              <option value="">{t('growth.hqOwner')}</option>
              {(localBdesQuery.data?.items ?? []).map((local) => (
                <option key={local.id} value={local.id}>
                  {[local.name, local.email, local.territoryCode].filter(Boolean).join(' · ')}
                </option>
              ))}
            </Select>
            {reassignMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {getErrorDetail(reassignMutation.error)}
              </Notice>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={reassignMutation.isPending}
                onClick={() => setReassignTarget(null)}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                type="button"
                disabled={reassignMutation.isPending}
                onClick={() => reassignMutation.mutate()}
              >
                {reassignMutation.isPending ? t('loading') : t('growth.reassignConfirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
