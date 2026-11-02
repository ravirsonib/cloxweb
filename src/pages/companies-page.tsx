import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
  IconButtonLink,
  Notice,
  PaginationBar,
  PhoneLink,
  ResponsiveDataView,
  Select,
  StatusPill,
  ViewModeToggle,
  dataCardClassName,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { Ban, Eye, RotateCcw, Trash2, UserCheck } from 'lucide-react';
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
import { companyStatusTone, complianceCaseStatusTone } from '@/lib/status-tone';
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
  const [viewMode, setViewMode] = useDataViewMode('companies', 'list');

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
    const isDraft = row.status === CompanyStatus.DRAFT;
    const isSuspended = row.status === CompanyStatus.SUSPENDED;

    return (
      <ActionGroup>
        <IconButtonLink
          to={`/companies/${row.id}`}
          icon={Eye}
          label={t('companies.viewDetails')}
          tooltip={t('companies.viewDetails')}
          variant="secondary"
          size="sm"
        />
        <IconButton
          icon={UserCheck}
          label={t('growth.reassignConfirm')}
          tooltip={t('growth.reassignConfirm')}
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => {
            setActionError(null);
            setReassignLocalId('');
            setReassignTarget(row);
          }}
        />
        {isDraft ? (
          <IconButton
            icon={Trash2}
            label={t('companies.delete')}
            tooltip={t('companies.delete')}
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void onDelete(row)}
          />
        ) : isSuspended ? (
          <IconButton
            icon={RotateCcw}
            label={t('companies.reactivate')}
            tooltip={t('companies.reactivate')}
            variant="success"
            size="sm"
            disabled={busy}
            onClick={() => void onReactivate(row)}
          />
        ) : (
          <IconButton
            icon={Ban}
            label={t('companies.disable')}
            tooltip={t('companies.disable')}
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void onDisable(row)}
          />
        )}
      </ActionGroup>
    );
  }

  function renderCompanyCard(row: CompanyListItem) {
    return (
      <div className={`${dataCardClassName} h-full flex flex-col justify-between`}>
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to={`/companies/${row.id}`}
                className="truncate font-medium text-clox-ink hover:text-clox-orange hover:underline block"
              >
                {row.legalName}
              </Link>
              {row.tradingName ? (
                <p className="truncate text-xs text-clox-faint">{row.tradingName}</p>
              ) : null}
              <div className="mt-1.5 flex flex-col gap-1">
                {row.phone ? <PhoneLink phone={row.phone} /> : null}
                {row.email ? <EmailLink email={row.email} /> : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusPill tone={companyStatusTone(row.status)}>
                {t(`companyStatuses.${row.status}`, { defaultValue: row.status })}
              </StatusPill>
              {row.type === 'CARRIER' && typeof row.reliabilityScore === 'number' ? (
                <StatusPill tone="info">
                  {t('companies.reliabilityScore', { score: row.reliabilityScore })}
                </StatusPill>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-clox-mute">
            <span className="font-medium text-clox-ink">
              {row.type === 'CARRIER'
                ? t('companies.typeCarrier')
                : t('companies.typeSender')}
            </span>
            {row.homeRegion?.code ? (
              <span className="rounded bg-clox-surface-alt px-1.5 py-0.5 font-mono font-medium text-clox-ink">
                {row.homeRegion.code}
              </span>
            ) : null}
            {row.abn ? <span className="font-mono">ABN {row.abn}</span> : null}
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
            <p className="mt-2 text-xs text-clox-mute bg-clox-surface-alt/70 p-2 rounded border border-clox-border-soft">
              <strong className="text-clox-danger">{t('companies.suspendedReasonLabel')}:</strong> {row.suspendedReason}
            </p>
          ) : null}
          {row.openCase ? (
            <Link
              to={`/compliance/${row.openCase.id}`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-clox-orange hover:underline"
            >
              <StatusPill tone={complianceCaseStatusTone(row.openCase.status)}>
                Case {row.openCase.status}
              </StatusPill>
            </Link>
          ) : null}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-clox-border-soft pt-3">
          <span className="text-xs text-clox-mute">{t('companies.colActions')}:</span>
          {renderActions(row)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('companies.title')}
          </h1>
          <p className="mt-2 text-sm text-clox-mute">
            {t('companies.subtitle')} · {t('totalCount', { count: total })}
          </p>
        </div>
        {items.length > 0 ? (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        ) : null}
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
          ) : viewMode === 'grid' ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((row) => (
                <div key={row.id} className="min-w-0 h-full">
                  {renderCompanyCard(row)}
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveDataView
              className="mt-6"
              cards={
                <DataCardList
                  items={items}
                  getKey={(row) => row.id}
                  mode="list"
                  renderItem={renderCompanyCard}
                />
              }
              table={
                <DataTable
                  minWidthClassName="min-w-[72rem]"
                  headers={[
                    t('companies.colCompany'),
                    t('companies.colType'),
                    t('companies.colStatus'),
                    t('companies.colReliability'),
                    t('companies.colRegion'),
                    t('companies.colAbn'),
                    t('companies.colFleet'),
                    t('companies.colCreated'),
                    t('companies.colCase'),
                    t('companies.colActions'),
                  ]}
                  headerClassNames={[
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    'text-right',
                  ]}
                >
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/companies/${row.id}`}
                          className="font-medium text-clox-ink hover:text-clox-orange hover:underline block"
                        >
                          {row.legalName}
                        </Link>
                        {row.tradingName ? (
                          <div className="text-xs text-clox-faint">{row.tradingName}</div>
                        ) : null}
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          {row.phone ? <PhoneLink phone={row.phone} /> : null}
                          {row.email ? <EmailLink email={row.email} maxWidthClassName="max-w-[200px]" /> : (
                            <span className="text-xs text-clox-faint">{t('dash')}</span>
                          )}
                        </div>
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
                      <td className="px-4 py-3">
                        {row.type === 'CARRIER' && typeof row.reliabilityScore === 'number' ? (
                          <StatusPill tone="info">
                            {t('companies.reliabilityScore', { score: row.reliabilityScore })}
                          </StatusPill>
                        ) : (
                          <span className="text-sm text-clox-faint">{t('dash')}</span>
                        )}
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
                            className="inline-flex items-center hover:opacity-85"
                          >
                            <StatusPill tone={complianceCaseStatusTone(row.openCase.status)}>
                              {row.openCase.status}
                            </StatusPill>
                          </Link>
                        ) : (
                          <span className="text-clox-faint">{t('dash')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{renderActions(row)}</td>
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
