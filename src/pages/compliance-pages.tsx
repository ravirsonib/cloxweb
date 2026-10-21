import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
  Button,
  DataCardList,
  DataTable,
  Notice,
  ResponsiveDataView,
  Select,
  StatusPill,
  TextArea,
  dataCardClassName,
  useConfirm,
  useToast,
} from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { AdminRole } from '@/shared/types';

export function ComplianceQueuePage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const [status, setStatus] = useState('OPEN');
  const [caseType, setCaseType] = useState('');
  const [regionCode, setRegionCode] = useState(
    role === AdminRole.SUPER_ADMIN ? '' : 'VIC',
  );

  const query = useQuery({
    queryKey: ['compliance', 'cases', status, caseType, regionCode],
    queryFn: ({ signal }) =>
      listComplianceCases({
        status: status || undefined,
        caseType: caseType || undefined,
        regionCode: regionCode || undefined,
        signal,
      }),
  });

  const rows = query.data?.data ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
        {t('compliance.queueTitle')}
      </h1>
      <p className="mt-2 text-sm text-clox-mute">{t('compliance.queueSubtitle')}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Select
          className="mb-0 w-full min-w-[10rem] sm:w-auto"
          label={t('compliance.colStatus')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
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
          onChange={(e) => setCaseType(e.target.value)}
        >
          <option value="">{t('compliance.caseTypeAll')}</option>
          <option value="SENDER_KYB">SENDER_KYB</option>
          <option value="SENDER_KYC">SENDER_KYC</option>
          <option value="CARRIER_KYB">CARRIER_KYB</option>
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
            onChange={(e) => setRegionCode(e.target.value.toUpperCase())}
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
        <ResponsiveDataView
          className="mt-6"
          cards={
            <DataCardList
              items={rows}
              getKey={(row) => row.id}
              renderItem={(row) => (
                <Link to={`/compliance/${row.id}`} className={`block ${dataCardClassName}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-clox-ink">
                        {row.company.legalName}
                      </p>
                      <p className="mt-0.5 text-xs text-clox-faint">{row.company.status}</p>
                    </div>
                    <span className="clox-status clox-status-info shrink-0">{row.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-clox-mute">
                    <span>{row.caseType}</span>
                    <span>{row.region?.code ?? t('dash')}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-clox-orange">
                    {t('compliance.open')} →
                  </p>
                </Link>
              )}
            />
          }
          table={
            <DataTable
              headers={[
                t('compliance.colCompany'),
                t('compliance.colType'),
                t('compliance.colStatus'),
                t('compliance.colRegion'),
                t('compliance.colAction'),
              ]}
              headerClassNames={[
                'w-[32%]',
                'w-[18%]',
                'w-[18%]',
                'w-[12%]',
                'w-[20%] text-right',
              ]}
            >
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-clox-ink">{row.company.legalName}</p>
                    <p className="text-xs text-clox-faint">{row.company.status}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.caseType}</td>
                  <td className="px-4 py-3">
                    <span className="clox-status clox-status-info">{row.status}</span>
                  </td>
                  <td className="px-4 py-3">{row.region?.code ?? t('dash')}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/compliance/${row.id}`} className="text-clox-orange hover:underline">
                      {t('compliance.open')}
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
          }
        />
      ) : null}
    </div>
  );
}

export function ComplianceCasePage({ caseId }: { caseId: string }) {
  const { t } = useTranslation('common');
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
    mutationFn: (action: 'approve' | 'reject' | 'request-info' | 'escalate') =>
      decideCompliance(caseId, action, note.trim() || undefined),
    onSuccess: async () => {
      setNoteError(null);
      toast.success(t('compliance.decisionApplied'));
      await qc.invalidateQueries({ queryKey: ['compliance'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const isPartnerKyb = query.data?.caseType === 'ADMIN_PARTNER_KYB';
  const canDecide =
    role === AdminRole.SUPER_ADMIN ||
    (role === AdminRole.STATE_MASTER && !isPartnerKyb);
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
        title: t('confirm.approveTitle'),
        description: t('confirm.approveBody'),
        confirmLabel: t('compliance.approve'),
        tone: 'default' as const,
      },
      reject: {
        title: t('confirm.rejectTitle'),
        description: t('confirm.rejectBody'),
        confirmLabel: t('compliance.reject'),
        tone: 'destructive' as const,
      },
      'request-info': {
        title: t('confirm.requestInfoTitle'),
        description: t('confirm.requestInfoBody'),
        confirmLabel: t('compliance.requestInfo'),
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
    decide.mutate(action);
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
      <Link to="/compliance" className="text-sm text-clox-mute hover:text-clox-ink">
        {t('compliance.backQueue')}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold text-clox-ink">{c.company.legalName}</h1>
      <p className="mt-1 font-mono text-sm text-clox-mute">
        {c.caseType} · {c.status} · company {c.company.status}
      </p>

      {c.caseType === 'ADMIN_PARTNER_KYB' ? (
        <Notice tone="info" className="mt-4">
          {t('compliance.partnerKybChecklist')}
        </Notice>
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
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-clox-md border border-clox-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-clox-orange">{d.docType}</span>
                    <span className="text-clox-mute">{d.status}</span>
                    {d.isNewSinceInfoRequest ? (
                      <StatusPill tone="warn">{t('compliance.docsNewBadge')}</StatusPill>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-clox-faint">{d.originalFilename}</p>
                  <p className="mt-0.5 text-xs text-clox-mute">
                    {t('compliance.docsUploadedAt', {
                      date: formatDateTime(d.createdAt),
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={!canView || openingDocId === d.id}
                  onClick={() => void viewDocument(d.id)}
                >
                  {openingDocId === d.id
                    ? t('compliance.openingDocument')
                    : t('compliance.viewDocument')}
                </Button>
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

        <div className="mt-2 flex flex-wrap gap-2">
          {canDecide ? (
            <>
              <Button
                type="button"
                variant="primary"
                disabled={decide.isPending}
                onClick={() => void runDecision('approve')}
              >
                {t('compliance.approve')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={decide.isPending}
                onClick={() => void runDecision('request-info')}
              >
                {t('compliance.requestInfo')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={decide.isPending}
                onClick={() => void runDecision('reject')}
              >
                {t('compliance.reject')}
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
          {!canDecide && !canEscalate ? (
            <p className="text-sm text-clox-mute">{t('compliance.noActions')}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
