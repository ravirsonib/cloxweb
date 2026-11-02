import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataTable,
  DetailRow,
  EmailLink,
  Notice,
  PhoneLink,
  StatusPill,
  dataCardClassName,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  deleteCompany,
  disableCompany,
  getCompany,
  getErrorDetail,
  openDocumentContent,
  reactivateCompany,
  type CompanyDetailDriver,
  type CompanyDetailVehicle,
} from '@/lib/api';
import { formatDateTime } from '@/lib/leads';
import { companyStatusTone, complianceCaseStatusTone } from '@/lib/status-tone';
import { CompanyStatus, CompanyType } from '@/shared/types';

type TabKey = 'overview' | 'documents' | 'vehicles' | 'drivers' | 'team' | 'compliance';

function docStatusTone(status: string) {
  switch (status) {
    case 'VERIFIED':
      return 'ok' as const;
    case 'REJECTED':
      return 'danger' as const;
    case 'EXPIRED':
      return 'danger' as const;
    case 'UPLOADED':
    default:
      return 'info' as const;
  }
}

function expiryTone(expiresAt: string | null) {
  if (!expiresAt) return 'neutral' as const;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return 'danger' as const;
  if (ms <= 30 * 24 * 60 * 60 * 1000) return 'warn' as const;
  return 'ok' as const;
}

export function CompanyDetailPage() {
  const { t } = useTranslation('common');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Disable modal state
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableReason, setDisableReason] = useState('');
  const [disableNote, setDisableNote] = useState('');

  const companyQuery = useQuery({
    queryKey: ['admin', 'company', id],
    queryFn: ({ signal }) => getCompany(id, { signal }),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'company', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'companies'] });
  };

  const disableMutation = useMutation({
    mutationFn: (input: { reason: string; note?: string }) => disableCompany(id, input),
    onSuccess: async () => {
      setShowDisableModal(false);
      setDisableReason('');
      setDisableNote('');
      toast.success(t('companies.disableSuccess'));
      await invalidate();
    },
    onError: (err) => setActionError(getErrorDetail(err)),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateCompany(id),
    onSuccess: async () => {
      toast.success(t('companies.reactivateSuccess'));
      await invalidate();
    },
    onError: (err) => setActionError(getErrorDetail(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCompany(id),
    onSuccess: () => {
      toast.success(t('companies.deleteSuccess'));
      navigate('/companies');
    },
    onError: (err) => setActionError(getErrorDetail(err)),
  });

  async function handleViewDoc(docId: string) {
    setOpeningDocId(docId);
    try {
      await openDocumentContent(docId);
    } catch (err) {
      toast.error(getErrorDetail(err));
    } finally {
      setOpeningDocId(null);
    }
  }

  async function handleReactivate() {
    const data = companyQuery.data?.company;
    if (!data) return;
    const ok = await confirm({
      title: t('companies.reactivateTitle'),
      description: t('companies.reactivateBody', { name: data.legalName }),
      confirmLabel: t('companies.reactivateConfirm'),
    });
    if (!ok) return;
    reactivateMutation.mutate();
  }

  async function handleDelete() {
    const data = companyQuery.data?.company;
    if (!data) return;
    const ok = await confirm({
      title: t('companies.deleteTitle'),
      description: t('companies.deleteBody', { name: data.legalName }),
      confirmLabel: t('companies.deleteConfirm'),
      tone: 'destructive',
    });
    if (!ok) return;
    deleteMutation.mutate();
  }

  const detail = companyQuery.data;
  const company = detail?.company;
  const isCarrier = company?.type === CompanyType.CARRIER;

  const totalVehicleDocs = useMemo(() => {
    return (detail?.vehicles ?? []).reduce((acc, v) => acc + (v.documents?.length ?? 0), 0);
  }, [detail?.vehicles]);

  const totalDriverDocs = useMemo(() => {
    return (detail?.drivers ?? []).reduce((acc, d) => acc + (d.documents?.length ?? 0), 0);
  }, [detail?.drivers]);

  if (companyQuery.isLoading) {
    return (
      <div className="py-8">
        <LoadingBlock label={t('loading')} />
      </div>
    );
  }

  if (companyQuery.isError || !company) {
    return (
      <div className="py-8">
        <Notice tone="error">
          {companyQuery.error ? getErrorDetail(companyQuery.error) : 'Company not found'}
        </Notice>
        <div className="mt-4">
          <Link to="/companies" className="clox-btn clox-btn-secondary inline-flex items-center text-sm">
            &larr; {t('companies.backToCompanies')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top back navigation */}
      <div>
        <Link
          to="/companies"
          className="inline-flex items-center text-sm font-semibold text-clox-orange hover:underline"
        >
          &larr; {t('companies.backToCompanies')}
        </Link>
      </div>

      {/* Header bar */}
      <div className="clox-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
                {company.legalName}
              </h1>
              {company.tradingName ? (
                <span className="text-sm text-clox-mute">({company.tradingName})</span>
              ) : null}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
              <StatusPill tone="info">
                {company.type === CompanyType.CARRIER
                  ? t('companies.typeCarrier')
                  : t('companies.typeSender')}
              </StatusPill>
              <StatusPill tone={companyStatusTone(company.status)}>
                {t(`companyStatuses.${company.status}`, { defaultValue: company.status })}
              </StatusPill>
              {typeof company.reliabilityScore === 'number' ? (
                <StatusPill tone="info">
                  {t('companies.reliabilityScore', { score: company.reliabilityScore })}
                </StatusPill>
              ) : null}
              {company.homeRegion?.code ? (
                <span className="rounded bg-clox-surface-alt px-2 py-0.5 font-medium text-clox-mute">
                  {company.homeRegion.code}
                </span>
              ) : null}
              {company.abn ? (
                <span className="font-mono text-clox-mute">ABN {company.abn}</span>
              ) : null}
            </div>

            {/* Tap-to-call / email quick contact chips on mobile and desktop */}
            {company.phone || company.email ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PhoneLink phone={company.phone} badge />
                <EmailLink email={company.email} badge maxWidthClassName="max-w-[200px] sm:max-w-none" />
              </div>
            ) : null}
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {company.status === CompanyStatus.DRAFT ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => void handleDelete()}
              >
                {t('companies.delete')}
              </Button>
            ) : null}

            {company.status === CompanyStatus.SUSPENDED ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={reactivateMutation.isPending}
                onClick={() => void handleReactivate()}
              >
                {t('companies.reactivate')}
              </Button>
            ) : null}

            {company.status !== CompanyStatus.DRAFT &&
            company.status !== CompanyStatus.SUSPENDED ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={disableMutation.isPending}
                onClick={() => {
                  setActionError(null);
                  setShowDisableModal(true);
                }}
              >
                {t('companies.disable')}
              </Button>
            ) : null}
          </div>
        </div>

        {company.status === CompanyStatus.SUSPENDED && company.suspendedReason ? (
          <div className="mt-4 rounded-md border border-clox-border-soft bg-clox-surface-alt/70 p-3 text-xs text-clox-mute">
            <span className="font-semibold text-clox-danger">
              {t('companies.suspendedReasonLabel')}:
            </span>{' '}
            {company.suspendedReason}
            {company.suspendedNote ? ` — ${company.suspendedNote}` : ''}
          </div>
        ) : null}

        {actionError ? (
          <Notice tone="error" className="mt-4">
            {actionError}
          </Notice>
        ) : null}
      </div>

      {/* Tabs bar */}
      <div className="border-b border-clox-border-soft">
        <nav className="-mb-px flex flex-wrap gap-2 sm:gap-4 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`border-b-2 py-2 px-1 transition-colors ${
              activeTab === 'overview'
                ? 'border-clox-orange text-clox-orange'
                : 'border-transparent text-clox-mute hover:text-clox-ink'
            }`}
          >
            {t('companies.tabOverview')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`border-b-2 py-2 px-1 transition-colors ${
              activeTab === 'documents'
                ? 'border-clox-orange text-clox-orange'
                : 'border-transparent text-clox-mute hover:text-clox-ink'
            }`}
          >
            {t('companies.tabDocuments')} ({detail.documents?.length ?? 0})
          </button>
          {isCarrier ? (
            <button
              type="button"
              onClick={() => setActiveTab('vehicles')}
              className={`border-b-2 py-2 px-1 transition-colors ${
                activeTab === 'vehicles'
                  ? 'border-clox-orange text-clox-orange'
                  : 'border-transparent text-clox-mute hover:text-clox-ink'
              }`}
            >
              {t('companies.tabVehicles')} ({detail.vehicles?.length ?? 0})
            </button>
          ) : null}
          {isCarrier ? (
            <button
              type="button"
              onClick={() => setActiveTab('drivers')}
              className={`border-b-2 py-2 px-1 transition-colors ${
                activeTab === 'drivers'
                  ? 'border-clox-orange text-clox-orange'
                  : 'border-transparent text-clox-mute hover:text-clox-ink'
              }`}
            >
              {t('companies.tabDrivers')} ({detail.drivers?.length ?? 0})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`border-b-2 py-2 px-1 transition-colors ${
              activeTab === 'team'
                ? 'border-clox-orange text-clox-orange'
                : 'border-transparent text-clox-mute hover:text-clox-ink'
            }`}
          >
            {t('companies.tabTeam')} ({detail.users?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`border-b-2 py-2 px-1 transition-colors ${
              activeTab === 'compliance'
                ? 'border-clox-orange text-clox-orange'
                : 'border-transparent text-clox-mute hover:text-clox-ink'
            }`}
          >
            {t('companies.tabCompliance')} ({detail.complianceCases?.length ?? 0})
          </button>
        </nav>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Business Information */}
          <div className="clox-card p-5">
            <h2 className="font-display text-base font-semibold text-clox-ink">
              {t('companies.businessInfo')}
            </h2>
            <dl className="mt-4 text-sm">
              <DetailRow label={t('companies.legalName')}>
                <span>{company.legalName}</span>
              </DetailRow>
              {company.tradingName ? (
                <DetailRow label={t('companies.tradingName')}>
                  <span>{company.tradingName}</span>
                </DetailRow>
              ) : null}
              <DetailRow label={t('companies.abn')}>
                <span className="font-mono">{company.abn ?? t('dash')}</span>
              </DetailRow>
              <DetailRow label={t('companies.acn')}>
                <span className="font-mono">{company.acn ?? t('dash')}</span>
              </DetailRow>
              <DetailRow label={t('email')}>
                <EmailLink email={company.email} />
              </DetailRow>
              <DetailRow label={t('phone')}>
                <PhoneLink phone={company.phone} />
              </DetailRow>
              <DetailRow label={t('companies.address')}>
                <span>{company.address ?? t('dash')}</span>
              </DetailRow>
              <DetailRow label={t('companies.homeRegion')}>
                <span>
                  {company.homeRegion ? `${company.homeRegion.name} (${company.homeRegion.code})` : t('dash')}
                </span>
              </DetailRow>
              {company.serviceRegionCodes?.length > 0 ? (
                <DetailRow label={t('companies.serviceRegions')}>
                  <span>{company.serviceRegionCodes.join(', ')}</span>
                </DetailRow>
              ) : null}
            </dl>
          </div>

          {/* Operational & Payment Details */}
          <div className="clox-card p-5">
            <h2 className="font-display text-base font-semibold text-clox-ink">
              Platform & Finance Details
            </h2>
            <dl className="mt-4 text-sm">
              <DetailRow label={t('companies.colReliability')}>
                <span className="font-semibold">
                  {typeof company.reliabilityScore === 'number'
                    ? `${company.reliabilityScore} / 100`
                    : t('dash')}
                </span>
              </DetailRow>
              <DetailRow label={t('companies.payoutStatus')}>
                <StatusPill tone={company.stripeConnectPayoutsEnabled ? 'ok' : 'warn'}>
                  {company.stripeConnectPayoutsEnabled
                    ? t('companies.payoutEnabled')
                    : t('companies.payoutDisabled')}
                </StatusPill>
              </DetailRow>
              {company.stripeConnectAccountId ? (
                <DetailRow label={t('companies.payoutAccountId')}>
                  <span className="font-mono text-xs text-clox-mute">
                    {company.stripeConnectAccountId}
                  </span>
                </DetailRow>
              ) : null}
              <DetailRow label={t('companies.referredBy')}>
                {company.referredByAdminUser ? (
                  <span>
                    {company.referredByAdminUser.name || company.referredByAdminUser.email}{' '}
                    <span className="text-xs text-clox-mute">({company.referredByAdminUser.role})</span>
                  </span>
                ) : (
                  'HQ / Organic'
                )}
              </DetailRow>
              {company.referredAt ? (
                <DetailRow label={t('companies.referredAt')}>
                  <span className="text-clox-mute">{formatDateTime(company.referredAt)}</span>
                </DetailRow>
              ) : null}
              <DetailRow label={t('companies.colCreated')}>
                <span className="text-clox-mute">{formatDateTime(company.createdAt)}</span>
              </DetailRow>
              <DetailRow label="Last Updated">
                <span className="text-clox-mute">{formatDateTime(company.updatedAt)}</span>
              </DetailRow>
            </dl>

            {/* Quick Summary Counts */}
            <div className="mt-6 border-t border-clox-border-soft pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-clox-mute">
                Fleet & Document Summary
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
                <div className="rounded bg-clox-surface-alt p-2.5">
                  <div className="text-lg font-bold text-clox-ink">{detail.documents?.length ?? 0}</div>
                  <div className="text-[11px] text-clox-mute">Company Docs</div>
                </div>
                {isCarrier ? (
                  <>
                    <div className="rounded bg-clox-surface-alt p-2.5">
                      <div className="text-lg font-bold text-clox-ink">{detail.vehicles?.length ?? 0}</div>
                      <div className="text-[11px] text-clox-mute">Vehicles ({totalVehicleDocs} docs)</div>
                    </div>
                    <div className="rounded bg-clox-surface-alt p-2.5">
                      <div className="text-lg font-bold text-clox-ink">{detail.drivers?.length ?? 0}</div>
                      <div className="text-[11px] text-clox-mute">Drivers ({totalDriverDocs} docs)</div>
                    </div>
                  </>
                ) : null}
                <div className="rounded bg-clox-surface-alt p-2.5">
                  <div className="text-lg font-bold text-clox-ink">{detail.users?.length ?? 0}</div>
                  <div className="text-[11px] text-clox-mute">Team Users</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tab: Company Documents */}
      {activeTab === 'documents' ? (
        <div className="clox-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('companies.tabDocuments')}
            </h2>
            <span className="text-xs text-clox-mute">
              {detail.documents?.length ?? 0} {t('companies.tabDocuments').toLowerCase()}
            </span>
          </div>

          {!detail.documents || detail.documents.length === 0 ? (
            <div className="mt-4">
              <EmptyBlock
                title={t('companies.noDocuments')}
                description="No organization-level compliance documents (COI, Public Liability, etc.) have been uploaded."
              />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <DataTable
                headers={[
                  t('companies.docType'),
                  t('companies.fileName'),
                  t('companies.colStatus'),
                  t('companies.expires'),
                  t('companies.uploaded'),
                  t('companies.colActions'),
                ]}
              >
                {detail.documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3 font-semibold text-clox-ink">{doc.docType}</td>
                    <td className="px-4 py-3 text-xs text-clox-mute font-mono">
                      {doc.originalFilename ?? t('dash')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={docStatusTone(doc.status)}>{doc.status}</StatusPill>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {doc.expiresAt ? (
                        <StatusPill tone={expiryTone(doc.expiresAt)}>
                          {new Date(doc.expiresAt).toLocaleDateString()}
                        </StatusPill>
                      ) : (
                        <span className="text-clox-mute">{t('dash')}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-clox-mute">
                      {formatDateTime(doc.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={openingDocId === doc.id}
                        onClick={() => void handleViewDoc(doc.id)}
                      >
                        {openingDocId === doc.id
                          ? t('companies.viewingDoc')
                          : t('companies.viewDocument')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}
        </div>
      ) : null}

      {/* Tab: Fleet & Vehicles */}
      {activeTab === 'vehicles' && isCarrier ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('companies.tabVehicles')} ({detail.vehicles?.length ?? 0})
            </h2>
          </div>

          {!detail.vehicles || detail.vehicles.length === 0 ? (
            <div className="clox-card p-5">
              <EmptyBlock
                title={t('companies.noVehicles')}
                description="This carrier has not registered any vehicles yet."
              />
            </div>
          ) : (
            detail.vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                openingDocId={openingDocId}
                onViewDoc={handleViewDoc}
                t={t}
              />
            ))
          )}
        </div>
      ) : null}

      {/* Tab: Drivers */}
      {activeTab === 'drivers' && isCarrier ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('companies.tabDrivers')} ({detail.drivers?.length ?? 0})
            </h2>
          </div>

          {!detail.drivers || detail.drivers.length === 0 ? (
            <div className="clox-card p-5">
              <EmptyBlock
                title={t('companies.noDrivers')}
                description="This carrier has not added any drivers yet."
              />
            </div>
          ) : (
            detail.drivers.map((d) => (
              <DriverCard
                key={d.id}
                driver={d}
                openingDocId={openingDocId}
                onViewDoc={handleViewDoc}
                t={t}
              />
            ))
          )}
        </div>
      ) : null}

      {/* Tab: Team & Users */}
      {activeTab === 'team' ? (
        <div className="clox-card p-5">
          <h2 className="font-display text-lg font-semibold text-clox-ink">
            {t('companies.tabTeam')} ({detail.users?.length ?? 0})
          </h2>

          {!detail.users || detail.users.length === 0 ? (
            <div className="mt-4">
              <EmptyBlock title={t('companies.noTeam')} description="No users assigned." />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <DataTable
                headers={[
                  t('drivers.colName'),
                  t('drivers.colEmail'),
                  t('phone'),
                  t('identity.role'),
                  t('identity.accountStatus'),
                  t('companies.colCreated'),
                ]}
              >
                {detail.users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3 font-medium text-clox-ink">
                      {u.name ?? t('dash')}
                    </td>
                    <td className="px-4 py-3 text-clox-mute">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-clox-mute">
                      <PhoneLink phone={u.phone} />
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-clox-ink">{u.role}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={u.status === 'ACTIVE' ? 'ok' : 'warn'}>
                        {u.status}
                      </StatusPill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-clox-mute">
                      {formatDateTime(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}
        </div>
      ) : null}

      {/* Tab: Compliance Cases */}
      {activeTab === 'compliance' ? (
        <div className="clox-card p-5">
          <h2 className="font-display text-lg font-semibold text-clox-ink">
            {t('companies.tabCompliance')} ({detail.complianceCases?.length ?? 0})
          </h2>

          {!detail.complianceCases || detail.complianceCases.length === 0 ? (
            <div className="mt-4">
              <EmptyBlock
                title={t('companies.noCases')}
                description="No compliance audits or review cases on record for this company."
              />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <DataTable
                headers={[
                  'Case ID',
                  'Type',
                  t('companies.colStatus'),
                  'Decision Note',
                  t('companies.colCreated'),
                  t('companies.colActions'),
                ]}
              >
                {detail.complianceCases.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-clox-ink">
                      {c.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 font-semibold text-clox-ink">{c.caseType}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={complianceCaseStatusTone(c.status)}>{c.status}</StatusPill>
                    </td>
                    <td className="max-w-[16rem] px-4 py-3 text-xs text-clox-mute truncate">
                      {c.decisionNote ?? t('dash')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-clox-mute">
                      {formatDateTime(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/compliance/${c.id}`}
                        className="clox-btn clox-btn-secondary inline-flex items-center text-xs"
                      >
                        Open Case &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}
        </div>
      ) : null}

      {/* Disable confirmation dialog */}
      {showDisableModal ? (
        <div className="clox-dialog-backdrop" role="presentation">
          <div
            className="clox-dialog-content max-w-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="disable-title"
          >
            <h2 id="disable-title" className="font-display text-lg font-bold text-clox-ink">
              {t('companies.disableTitle')}
            </h2>
            <p className="mt-1 text-sm text-clox-mute">
              {t('companies.disableBody', { name: company.legalName })}
            </p>

            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!disableReason.trim() || disableMutation.isPending) return;
                disableMutation.mutate({
                  reason: disableReason.trim(),
                  note: disableNote.trim() || undefined,
                });
              }}
            >
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-clox-ink">
                  {t('companies.disableReason')} *
                </span>
                <input
                  type="text"
                  required
                  className="clox-field-control"
                  placeholder={t('companies.disableReasonPlaceholder')}
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-clox-ink">
                  {t('companies.disableNote')}
                </span>
                <textarea
                  rows={3}
                  className="clox-field-control"
                  placeholder={t('companies.disableNotePlaceholder')}
                  value={disableNote}
                  onChange={(e) => setDisableNote(e.target.value)}
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={disableMutation.isPending}
                  onClick={() => setShowDisableModal(false)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!disableReason.trim() || disableMutation.isPending}
                >
                  {disableMutation.isPending ? t('saving') : t('companies.disableConfirm')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Component for rendering a single Vehicle card with all its documents attached */
function VehicleCard({
  vehicle,
  openingDocId,
  onViewDoc,
  t,
}: {
  vehicle: CompanyDetailVehicle;
  openingDocId: string | null;
  onViewDoc: (id: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const isParked = vehicle.status === 'SUSPENDED' || vehicle.status === 'RETIRED';

  return (
    <div className={`${dataCardClassName} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-clox-border-soft pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold text-clox-ink">
              {vehicle.registration}
            </h3>
            {vehicle.label ? (
              <span className="text-xs text-clox-mute">({vehicle.label})</span>
            ) : null}
            <StatusPill tone={isParked ? 'danger' : 'ok'}>{vehicle.status}</StatusPill>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-clox-mute">
            <span>
              <strong>{t('companies.vehicleClass')}:</strong> {vehicle.vehicleClass}
            </span>
            <span>
              <strong>Tare:</strong> {vehicle.tareKg.toLocaleString()} kg
            </span>
            <span>
              <strong>GVM:</strong> {vehicle.gvmKg.toLocaleString()} kg
            </span>
            {vehicle.gcmKg ? (
              <span>
                <strong>GCM:</strong> {vehicle.gcmKg.toLocaleString()} kg
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-xs text-clox-mute font-mono">
          Registered: {formatDateTime(vehicle.createdAt)}
        </div>
      </div>

      {/* Vehicle Documents Table */}
      <div className="mt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-clox-mute mb-2">
          Vehicle Documents ({vehicle.documents?.length ?? 0})
        </h4>

        {!vehicle.documents || vehicle.documents.length === 0 ? (
          <p className="text-xs italic text-clox-mute">No documents uploaded for this vehicle.</p>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              headers={[
                t('companies.docType'),
                t('companies.fileName'),
                t('companies.colStatus'),
                t('companies.expires'),
                t('companies.colActions'),
              ]}
            >
              {vehicle.documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                >
                  <td className="px-3 py-2 font-medium text-xs text-clox-ink">{doc.docType}</td>
                  <td className="px-3 py-2 text-xs font-mono text-clox-mute">
                    {doc.originalFilename ?? t('dash')}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <StatusPill tone={docStatusTone(doc.status)}>{doc.status}</StatusPill>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {doc.expiresAt ? (
                      <StatusPill tone={expiryTone(doc.expiresAt)}>
                        {new Date(doc.expiresAt).toLocaleDateString()}
                      </StatusPill>
                    ) : (
                      <span className="text-clox-mute">{t('dash')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={openingDocId === doc.id}
                      onClick={() => onViewDoc(doc.id)}
                    >
                      {openingDocId === doc.id
                        ? t('companies.viewingDoc')
                        : t('companies.viewDocument')}
                    </Button>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
      </div>
    </div>
  );
}

/** Component for rendering a single Driver card with all their documents attached */
function DriverCard({
  driver,
  openingDocId,
  onViewDoc,
  t,
}: {
  driver: CompanyDetailDriver;
  openingDocId: string | null;
  onViewDoc: (id: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const isSuspended = driver.status === 'SUSPENDED' || driver.status === 'DISABLED';

  return (
    <div className={`${dataCardClassName} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-clox-border-soft pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold text-clox-ink">
              {driver.user.name || driver.user.email}
            </h3>
            <StatusPill tone={isSuspended ? 'danger' : 'ok'}>{driver.status}</StatusPill>
            {typeof driver.reliabilityScore === 'number' ? (
              <StatusPill tone="info">
                {t('companies.reliabilityScore', { score: driver.reliabilityScore })}
              </StatusPill>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-clox-mute">
            <span>
              <strong>Email:</strong> {driver.user.email}
            </span>
            {driver.user.phone ? (
              <span className="inline-flex items-center gap-1">
                <strong>Phone:</strong> <PhoneLink phone={driver.user.phone} />
              </span>
            ) : null}
            <span>
              <strong>{t('companies.driverLicence')}:</strong> {driver.licenceNo ?? t('dash')}
              {driver.licenceClass ? ` (${driver.licenceClass})` : ''}
            </span>
            {driver.licenceExpiry ? (
              <span>
                <strong>{t('companies.expires')}:</strong>{' '}
                <StatusPill tone={expiryTone(driver.licenceExpiry)}>
                  {new Date(driver.licenceExpiry).toLocaleDateString()}
                </StatusPill>
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-xs text-clox-mute font-mono">
          Joined: {formatDateTime(driver.createdAt)}
        </div>
      </div>

      {/* Driver Documents Table */}
      <div className="mt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-clox-mute mb-2">
          Driver Documents ({driver.documents?.length ?? 0})
        </h4>

        {!driver.documents || driver.documents.length === 0 ? (
          <p className="text-xs italic text-clox-mute">No documents uploaded for this driver.</p>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              headers={[
                t('companies.docType'),
                t('companies.fileName'),
                t('companies.colStatus'),
                t('companies.expires'),
                t('companies.colActions'),
              ]}
            >
              {driver.documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                >
                  <td className="px-3 py-2 font-medium text-xs text-clox-ink">{doc.docType}</td>
                  <td className="px-3 py-2 text-xs font-mono text-clox-mute">
                    {doc.originalFilename ?? t('dash')}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <StatusPill tone={docStatusTone(doc.status)}>{doc.status}</StatusPill>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {doc.expiresAt ? (
                      <StatusPill tone={expiryTone(doc.expiresAt)}>
                        {new Date(doc.expiresAt).toLocaleDateString()}
                      </StatusPill>
                    ) : (
                      <span className="text-clox-mute">{t('dash')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={openingDocId === doc.id}
                      onClick={() => onViewDoc(doc.id)}
                    >
                      {openingDocId === doc.id
                        ? t('companies.viewingDoc')
                        : t('companies.viewDocument')}
                    </Button>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
      </div>
    </div>
  );
}
