import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  decideCompliance,
  getComplianceCase,
  getErrorDetail,
  listComplianceCases,
  openDocumentContent,
  type ComplianceCaseDocument,
} from '@/lib/api';
import { formatDateTime } from '@/lib/leads';
import { cn } from '@/lib/cn';
import { statusAccentClass } from '@/lib/status-list';
import {
  companyStatusTone,
  complianceCaseStatusTone,
  complianceDocStatusTone,
} from '@/lib/status-tone';
import {
  Button,
  DataCardList,
  DataTable,
  Notice,
  PaginationBar,
  ResponsiveDataView,
  Select,
  StatusPill,
  TextArea,
  ViewModeToggle,
  dataCardClassName,
  useConfirm,
  useDataViewMode,
  useToast,
} from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { AdminRole } from '@/shared/types';

const COMPLIANCE_PAGE_SIZE = 10;

export function ComplianceQueuePage() {
  const { t } = useTranslation('common');
  const [viewMode, setViewMode] = useDataViewMode('compliance', 'list');
  const [status, setStatus] = useState('');
  const [caseType, setCaseType] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['compliance', 'cases', status, caseType, regionCode, search, page],
    queryFn: ({ signal }) =>
      listComplianceCases({
        status: status || undefined,
        caseType: caseType || undefined,
        regionCode: regionCode || undefined,
        search: search.trim() || undefined,
        page,
        pageSize: COMPLIANCE_PAGE_SIZE,
        signal,
      }),
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? rows.length;
  const totalPages = query.data?.meta?.totalPages ?? 1;

  const renderCaseCard = (row: (typeof rows)[number]) => {
    const caseTone = complianceCaseStatusTone(row.status);
    return (
      <Link
        to={`/compliance/${row.id}`}
        className={cn(
          'flex h-full flex-col justify-between',
          dataCardClassName,
          statusAccentClass(caseTone),
        )}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-clox-ink">{row.company.legalName}</p>
              <div className="mt-1">
                <StatusPill tone={companyStatusTone(row.company.status)}>
                  {t(`companyStatuses.${row.company.status}`, {
                    defaultValue: row.company.status,
                  })}
                </StatusPill>
              </div>
            </div>
            <StatusPill tone={caseTone} className="shrink-0">
              {row.status}
            </StatusPill>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-clox-mute">
            <span>{row.caseType}</span>
            <span>{row.region?.code ?? t('dash')}</span>
            <span>{formatDateTime(row.createdAt)}</span>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-clox-orange">{t('compliance.open')} →</p>
      </Link>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('compliance.queueTitle')}
          </h1>
          <p className="mt-2 text-sm text-clox-mute">
            {t('compliance.queueSubtitle')} · {t('totalCount', { count: total })}
          </p>
        </div>
        {rows.length > 0 ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : null}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="mb-0 block w-full sm:w-auto sm:min-w-[16rem] flex-1">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
            {t('search', { defaultValue: 'Search' })}
          </span>
          <input
            type="search"
            className="clox-field-control w-full"
            placeholder={t('compliance.searchPlaceholder', {
              defaultValue: 'Search company, ABN, or case ID…',
            })}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <Select
          className="mb-0 w-full min-w-[10rem] sm:w-auto"
          label={t('compliance.colStatus')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('compliance.statusAll')}</option>
          <option value="OPEN">{t('compliance.statusOpen')}</option>
          <option value="ESCALATED">{t('compliance.statusEscalated')}</option>
          <option value="INFO_REQUESTED">{t('compliance.statusInfoRequested')}</option>
          <option value="APPROVED">{t('compliance.statusApproved')}</option>
          <option value="REJECTED">{t('compliance.statusRejected')}</option>
        </Select>
        <Select
          className="mb-0 w-full min-w-[12rem] sm:w-auto"
          label={t('compliance.colType')}
          value={caseType}
          onChange={(e) => {
            setCaseType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('compliance.caseTypeAll')}</option>
          <option value="SENDER_KYB">SENDER_KYB</option>
          <option value="SENDER_KYC">SENDER_KYC</option>
          <option value="CARRIER_KYB">CARRIER_KYB</option>
          <option value="CARRIER_FLEET_RWC">CARRIER_FLEET_RWC</option>
          <option value="CARRIER_DRIVER_LICENCE">CARRIER_DRIVER_LICENCE</option>
          <option value="COMPANY_PROFILE_CHANGE">COMPANY_PROFILE_CHANGE</option>
          <option value="ADMIN_PARTNER_KYB">ADMIN_PARTNER_KYB</option>
        </Select>
        <label className="mb-0 block w-full sm:w-auto">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
            {t('compliance.colRegion')}
          </span>
          <input
            className="clox-field-control w-full sm:w-28"
            placeholder={t('compliance.regionPlaceholder')}
            value={regionCode}
            onChange={(e) => {
              setRegionCode(e.target.value.toUpperCase());
              setPage(1);
            }}
          />
        </label>
      </div>

      {query.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('compliance.loadingCases')} />
        </div>
      ) : null}

      {query.isError ? (
        <Notice tone="error" className="mt-8">
          {getErrorDetail(query.error)}
        </Notice>
      ) : null}

      {!query.isLoading && !query.isError && rows.length === 0 ? (
        <div className="mt-8">
          <EmptyBlock
            title={t('compliance.noCasesTitle')}
            description={t('compliance.noCasesDesc')}
          />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <DataCardList
              className="mt-6"
              items={rows}
              getKey={(row) => row.id}
              mode="grid"
              renderItem={renderCaseCard}
            />
          ) : (
            <ResponsiveDataView
              className="mt-6"
              cards={
                <DataCardList
                  items={rows}
                  getKey={(row) => row.id}
                  mode="list"
                  renderItem={renderCaseCard}
                />
              }
              table={
                <DataTable
                  headers={[
                    t('compliance.colCompany'),
                    t('compliance.colType'),
                    t('compliance.colStatus'),
                    t('compliance.colRegion'),
                    t('admin.colCreated'),
                    t('compliance.colAction'),
                  ]}
                  headerClassNames={[
                    'w-[26%]',
                    'w-[18%]',
                    'w-[16%]',
                    'w-[10%]',
                    'w-[18%]',
                    'w-[12%] text-right',
                  ]}
                >
                  {rows.map((row) => {
                    const caseTone = complianceCaseStatusTone(row.status);
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-t border-clox-border-soft hover:bg-clox-surface-alt/60',
                          statusAccentClass(caseTone),
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-clox-ink">{row.company.legalName}</p>
                          <div className="mt-1">
                            <StatusPill tone={companyStatusTone(row.company.status)}>
                              {t(`companyStatuses.${row.company.status}`, {
                                defaultValue: row.company.status,
                              })}
                            </StatusPill>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{row.caseType}</td>
                        <td className="px-4 py-3">
                          <StatusPill tone={caseTone}>{row.status}</StatusPill>
                        </td>
                        <td className="px-4 py-3">{row.region?.code ?? t('dash')}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-clox-mute">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/compliance/${row.id}`}
                            className="text-clox-orange hover:underline"
                          >
                            {t('compliance.open')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>
              }
            />
          )}
          <PaginationBar
            page={page}
            totalPages={totalPages}
            disabled={query.isFetching}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}

export function ComplianceCasePage({ caseId }: { caseId: string }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['compliance', 'case', caseId],
    queryFn: ({ signal }) => getComplianceCase(caseId, { signal }),
  });

  const decide = useMutation({
    mutationFn: (vars: {
      action: 'approve' | 'reject' | 'request-info' | 'escalate';
      note?: string;
      driverId?: string;
      vehicleId?: string;
      documentId?: string;
    }) =>
      decideCompliance(caseId, vars.action, (vars.note ?? note).trim() || undefined, {
        driverId: vars.driverId,
        vehicleId: vars.vehicleId,
        documentId: vars.documentId,
      }),
    onSuccess: async () => {
      setNoteError(null);
      toast.success(t('compliance.decisionApplied'));
      await qc.invalidateQueries({ queryKey: ['compliance'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const isPartnerKyb = query.data?.caseType === 'ADMIN_PARTNER_KYB';
  const isAssetReview =
    query.data?.caseType === 'CARRIER_FLEET_RWC' ||
    query.data?.caseType === 'CARRIER_DRIVER_LICENCE';
  const isSuperOnlyDecide = isPartnerKyb || isAssetReview;
  const canDecide =
    role === AdminRole.SUPER_ADMIN ||
    (role === AdminRole.STATE_MASTER && !isSuperOnlyDecide);
  // Local may escalate asset cases to Super; partner KYB stays Super-only (no Local escalate).
  const canEscalate = role === AdminRole.LOCAL_BDE && !isPartnerKyb;

  async function runDecision(action: 'approve' | 'reject' | 'request-info' | 'escalate') {
    const trimmed = note.trim();
    if (action === 'reject' && !trimmed) {
      setNoteError(t('validation.noteRejectRequired'));
      return;
    }
    if (action === 'request-info' && !trimmed) {
      setNoteError(t('validation.noteInfoRequired'));
      return;
    }
    const prompts = {
      approve: {
        title: isAssetReview
          ? t('confirm.approveAllTitle', { defaultValue: 'Approve all assets?' })
          : t('confirm.approveTitle'),
        description: isAssetReview
          ? t('confirm.approveAllBody', {
              defaultValue:
                'This will approve all remaining unreviewed documents and activate all pending assets.',
            })
          : t('confirm.approveBody'),
        confirmLabel: isAssetReview
          ? t('compliance.approveAll', { defaultValue: 'Approve All' })
          : t('compliance.approve'),
        tone: 'default' as const,
      },
      reject: {
        title: isAssetReview
          ? t('confirm.rejectAllTitle', { defaultValue: 'Reject all assets?' })
          : t('confirm.rejectTitle'),
        description: isAssetReview
          ? t('confirm.rejectAllBody', {
              defaultValue: 'This will reject all unreviewed documents in this case.',
            })
          : t('confirm.rejectBody'),
        confirmLabel: isAssetReview
          ? t('compliance.rejectAll', { defaultValue: 'Reject All' })
          : t('compliance.reject'),
        tone: 'destructive' as const,
      },
      'request-info': {
        title: t('confirm.requestInfoTitle'),
        description: t('confirm.requestInfoBody'),
        confirmLabel: isAssetReview
          ? t('compliance.requestInfoAll', { defaultValue: 'Request Info All' })
          : t('compliance.requestInfo'),
        tone: 'default' as const,
      },
      escalate: {
        title: t('confirm.escalateTitle'),
        description: t('confirm.escalateBody'),
        confirmLabel: t('compliance.escalate'),
        tone: 'default' as const,
      },
    } as const;
    const ok = await confirm(prompts[action]);
    if (!ok) return;
    setNoteError(null);
    decide.mutate({ action });
  }

  async function runItemDecision(
    itemType: 'driver' | 'vehicle',
    itemId: string,
    action: 'approve' | 'reject' | 'request-info',
    itemName: string,
    documentId?: string,
  ) {
    const isReject = action === 'reject';
    const isInfo = action === 'request-info';
    let itemNote = note.trim();

    if ((isReject || isInfo) && !itemNote) {
      const promptLabel = isReject
        ? t('confirm.rejectReasonPrompt', {
            defaultValue: `Reason for rejecting ${itemType} (${itemName}):`,
          })
        : t('confirm.infoReasonPrompt', {
            defaultValue: `Details requested for ${itemType} (${itemName}):`,
          });
      const res = window.prompt(promptLabel);
      if (!res || !res.trim()) {
        toast.error(
          isReject
            ? t('validation.noteRejectRequired')
            : t('validation.noteInfoRequired'),
        );
        return;
      }
      itemNote = res.trim();
    } else {
      const itemTitle =
        action === 'approve'
          ? itemType === 'driver'
            ? t('confirm.approveDriverTitle', { defaultValue: 'Approve Driver?' })
            : t('confirm.approveVehicleTitle', { defaultValue: 'Approve Vehicle?' })
          : action === 'reject'
          ? itemType === 'driver'
            ? t('confirm.rejectDriverTitle', { defaultValue: 'Reject Driver?' })
            : t('confirm.rejectVehicleTitle', { defaultValue: 'Reject Vehicle?' })
          : itemType === 'driver'
          ? t('confirm.requestInfoDriverTitle', { defaultValue: 'Request Info for Driver?' })
          : t('confirm.requestInfoVehicleTitle', { defaultValue: 'Request Info for Vehicle?' });

      const ok = await confirm({
        title: itemTitle,
        description: `${action.toUpperCase()} — ${itemName}`,
        confirmLabel:
          action === 'approve'
            ? t('compliance.approve')
            : action === 'reject'
            ? t('compliance.reject')
            : t('compliance.requestInfo'),
        tone: isReject ? 'destructive' : 'default',
      });
      if (!ok) return;
    }

    decide.mutate({
      action,
      note: itemNote || undefined,
      driverId: itemType === 'driver' ? itemId : undefined,
      vehicleId: itemType === 'vehicle' ? itemId : undefined,
      documentId,
    });
  }

  async function viewDocument(documentId: string) {
    setOpeningDocId(documentId);
    try {
      await openDocumentContent(documentId);
    } catch (err) {
      toast.error(getErrorDetail(err));
    } finally {
      setOpeningDocId(null);
    }
  }

  if (query.isLoading) {
    return <LoadingBlock label={t('compliance.loadingCase')} />;
  }

  if (query.isError || !query.data) {
    return <Notice tone="error">{getErrorDetail(query.error)}</Notice>;
  }

  const c = query.data;

  return (
    <div>
      <div className="mb-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate('/compliance')}
        >
          ← {t('compliance.backQueue')}
        </Button>
      </div>
      <h1 className="mt-3 font-display text-2xl font-bold text-clox-ink">{c.company.legalName}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm text-clox-mute">
        <span>{c.caseType}</span>
        <span>·</span>
        <StatusPill tone={complianceCaseStatusTone(c.status)}>{c.status}</StatusPill>
        <span>· company</span>
        <StatusPill tone={companyStatusTone(c.company.status)}>
          {t(`companyStatuses.${c.company.status}`, { defaultValue: c.company.status })}
        </StatusPill>
      </div>

      {c.caseType === 'ADMIN_PARTNER_KYB' ? (
        <Notice tone="info" className="mt-4">
          {t('compliance.partnerKybChecklist')}
        </Notice>
      ) : null}

      {c.caseType === 'CARRIER_FLEET_RWC' ? (
        <Notice tone="info" className="mt-4">
          {t('compliance.fleetRwcChecklist')}
        </Notice>
      ) : null}

      {c.caseType === 'CARRIER_DRIVER_LICENCE' ? (
        <Notice tone="info" className="mt-4">
          {t('compliance.driverLicenceChecklist')}
        </Notice>
      ) : null}

      {c.caseType === 'COMPANY_PROFILE_CHANGE' ? (
        <div className="clox-card mt-4 p-4 text-sm">
          <p className="font-semibold text-clox-ink">{t('compliance.proposedChangesTitle')}</p>
          <p className="mt-1 text-xs text-clox-mute">{t('compliance.proposedChangesHint')}</p>
          <pre className="mt-3 overflow-x-auto rounded-clox-md bg-clox-canvas p-3 font-mono text-xs text-clox-ink">
            {JSON.stringify(c.proposedChanges ?? {}, null, 2)}
          </pre>
          {c.decisionNote ? (
            <p className="mt-2 text-xs text-clox-mute">
              {t('compliance.submitterNote')}: {c.decisionNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {c.abrAssist ? (
        <div className="clox-card mt-4 p-4 text-sm">
          <p className="font-semibold text-clox-ink">{t('compliance.abrTitle')}</p>
          <p className="mt-1 text-clox-mute">{c.abrAssist.message}</p>
          <p className="mt-1 text-xs text-clox-faint">
            active={String(c.abrAssist.active)} · {c.abrAssist.entityName ?? t('dash')}
          </p>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">{t('compliance.docsTitle')}</h2>
        {c.infoRequestedAt ? (
          <p className="mt-1 text-xs text-clox-mute">
            {t('compliance.docsInfoRequestedAt', {
              date: formatDateTime(c.infoRequestedAt),
            })}
          </p>
        ) : null}
        {(() => {
          const hasSplit = Boolean(c.infoRequestedAt);
          const newDocs = hasSplit
            ? c.documents.filter((d) => d.isNewSinceInfoRequest)
            : [];
          const priorDocs = hasSplit
            ? c.documents.filter((d) => !d.isNewSinceInfoRequest)
            : c.documents;

          const renderDoc = (d: ComplianceCaseDocument) => {
            const canView = d.status !== 'UPLOAD_PENDING';
            const isDriverDoc =
              (c.caseType === 'CARRIER_DRIVER_LICENCE' || c.caseType === 'CARRIER_KYB') &&
              Boolean(d.driverId);
            const isVehicleDoc =
              (c.caseType === 'CARRIER_FLEET_RWC' || c.caseType === 'CARRIER_KYB') &&
              Boolean(d.vehicleId);
            const canItemDecide = canDecide && (isDriverDoc || isVehicleDoc);
            const isPendingItem = d.status !== 'APPROVED' && d.status !== 'REJECTED';

            return (
              <li
                key={d.id}
                className="flex flex-col gap-3 rounded-clox-md border border-clox-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-clox-orange">{d.docType}</span>
                    <StatusPill tone={complianceDocStatusTone(d.status)}>{d.status}</StatusPill>
                    {d.isNewSinceInfoRequest ? (
                      <StatusPill tone="warn">{t('compliance.docsNewBadge')}</StatusPill>
                    ) : null}
                  </div>
                  {d.vehicleRegistration || d.vehicleLabel ? (
                    <p className="mt-0.5 text-xs font-medium text-clox-ink">
                      {t('compliance.docsVehicle', {
                        rego: d.vehicleRegistration ?? t('dash'),
                        label: d.vehicleLabel ?? t('dash'),
                      })}
                      {d.vehicleStatus ? ` · ${d.vehicleStatus}` : ''}
                    </p>
                  ) : null}
                  {d.driverEmail || d.driverName ? (
                    <p className="mt-0.5 text-xs font-medium text-clox-ink">
                      {t('compliance.docsDriver', {
                        name: d.driverName ?? t('dash'),
                        email: d.driverEmail ?? t('dash'),
                        licence: d.driverLicenceClass ?? t('dash'),
                      })}
                      {d.driverStatus ? ` · ${d.driverStatus}` : ''}
                    </p>
                  ) : null}
                  <p className="mt-0.5 truncate text-xs text-clox-faint">{d.originalFilename}</p>
                  <p className="mt-0.5 text-[11px] text-clox-mute">
                    {t('compliance.docsUploadedAt', {
                      date: formatDateTime(d.createdAt),
                    })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!canView || openingDocId === d.id}
                    onClick={() => void viewDocument(d.id)}
                  >
                    {openingDocId === d.id
                      ? t('compliance.openingDocument')
                      : t('compliance.viewDocument')}
                  </Button>

                  {canItemDecide ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-clox-border pt-2 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-2">
                      {d.status !== 'APPROVED' ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() =>
                            void runItemDecision(
                              isDriverDoc ? 'driver' : 'vehicle',
                              (isDriverDoc ? d.driverId : d.vehicleId)!,
                              'approve',
                              (isDriverDoc
                                ? d.driverName || d.driverEmail
                                : d.vehicleRegistration || d.vehicleLabel) || 'item',
                              d.id,
                            )
                          }
                        >
                          ✓ {isDriverDoc ? t('compliance.approveDriver', { defaultValue: 'Approve Driver' }) : t('compliance.approveVehicle', { defaultValue: 'Approve Vehicle' })}
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-ok)]">
                          ✓ {t('compliance.statusApproved', { defaultValue: 'Approved' })}
                        </span>
                      )}

                      {isPendingItem ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={decide.isPending}
                            onClick={() =>
                              void runItemDecision(
                                isDriverDoc ? 'driver' : 'vehicle',
                                (isDriverDoc ? d.driverId : d.vehicleId)!,
                                'request-info',
                                (isDriverDoc
                                  ? d.driverName || d.driverEmail
                                  : d.vehicleRegistration || d.vehicleLabel) || 'item',
                                d.id,
                              )
                            }
                          >
                            ⚠ {t('compliance.requestInfoShort', { defaultValue: 'Info' })}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={decide.isPending}
                            onClick={() =>
                              void runItemDecision(
                                isDriverDoc ? 'driver' : 'vehicle',
                                (isDriverDoc ? d.driverId : d.vehicleId)!,
                                'reject',
                                (isDriverDoc
                                  ? d.driverName || d.driverEmail
                                  : d.vehicleRegistration || d.vehicleLabel) || 'item',
                                d.id,
                              )
                            }
                          >
                            ✕ {t('compliance.rejectShort', { defaultValue: 'Reject' })}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          };

          if (!hasSplit) {
            return <ul className="mt-2 space-y-2">{c.documents.map(renderDoc)}</ul>;
          }

          return (
            <div className="mt-3 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-clox-ink">
                  {t('compliance.docsNewSinceRequest')}
                  <span className="ml-2 font-normal text-clox-mute">({newDocs.length})</span>
                </h3>
                {newDocs.length > 0 ? (
                  <ul className="mt-2 space-y-2">{newDocs.map(renderDoc)}</ul>
                ) : (
                  <p className="mt-2 text-sm text-clox-mute">{t('compliance.docsNoneInGroup')}</p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-clox-ink">
                  {t('compliance.docsPreviouslySubmitted')}
                  <span className="ml-2 font-normal text-clox-mute">({priorDocs.length})</span>
                </h3>
                {priorDocs.length > 0 ? (
                  <ul className="mt-2 space-y-2">{priorDocs.map(renderDoc)}</ul>
                ) : (
                  <p className="mt-2 text-sm text-clox-mute">{t('compliance.docsNoneInGroup')}</p>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      <section className="mt-8 max-w-xl">
        <TextArea
          label={t('compliance.decisionNote')}
          placeholder={t('compliance.noteHint')}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (noteError) setNoteError(null);
          }}
          error={noteError ?? undefined}
          hint={t('compliance.noteHint')}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canDecide ? (
            <>
              <Button
                type="button"
                variant="primary"
                disabled={decide.isPending}
                onClick={() => void runDecision('approve')}
              >
                {isAssetReview
                  ? t('compliance.approveAll', { defaultValue: 'Approve All' })
                  : t('compliance.approve')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={decide.isPending}
                onClick={() => void runDecision('request-info')}
              >
                {isAssetReview
                  ? t('compliance.requestInfoAll', { defaultValue: 'Request Info All' })
                  : t('compliance.requestInfo')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={decide.isPending}
                onClick={() => void runDecision('reject')}
              >
                {isAssetReview
                  ? t('compliance.rejectAll', { defaultValue: 'Reject All' })
                  : t('compliance.reject')}
              </Button>
            </>
          ) : null}
          {canEscalate ? (
            <Button
              type="button"
              variant="cta"
              disabled={decide.isPending}
              onClick={() => void runDecision('escalate')}
            >
              {t('compliance.escalate')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/compliance')}
          >
            ← {t('compliance.backQueue')}
          </Button>
          {!canDecide && !canEscalate ? (
            <p className="text-sm text-clox-mute">{t('compliance.noActions')}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
