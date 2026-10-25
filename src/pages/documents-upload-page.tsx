import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  confirmDocument,
  createUploadIntent,
  getErrorDetail,
  getIdentityMe,
  listDocuments,
  openDocumentContent,
  submitCompliance,
  uploadDocumentContent,
} from '@/lib/api';
import { Button, FileInput, Notice, Select, StatusPill, useConfirm, useToast } from '@/components/ui';
import type { ComplianceDocumentListItem } from '@/lib/api';
import { resolveUploadMime } from '@/lib/upload-mime';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const SENDER_DOC_TYPES = ['ABN_EXTRACT', 'GOVERNMENT_ID', 'OTHER'] as const;
const CARRIER_DOC_TYPES = [
  'PUBLIC_LIABILITY',
  'CARGO_INSURANCE',
  'DG_LICENCE',
  'ABN_EXTRACT',
  'OTHER',
] as const;
/** Matches API assertUploadRoleAllowed for DRIVER. */
const DRIVER_DOC_TYPES = [
  'DRIVER_LICENCE',
  'GOVERNMENT_ID',
  'SELFIE',
  'NHVR',
  'OTHER',
] as const;

export function DocumentsUploadPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const confirm = useConfirm();
  const toast = useToast();
  const qc = useQueryClient();
  const isDriver = role === AppRole.DRIVER;
  const isSender = role === AppRole.SENDER;
  const isCarrier = role === AppRole.TRANSPORT_COMPANY;

  const docOptions = useMemo(() => {
    if (isDriver) return [...DRIVER_DOC_TYPES];
    if (isSender) return [...SENDER_DOC_TYPES];
    return [...CARRIER_DOC_TYPES];
  }, [isDriver, isSender]);

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>(docOptions[0]);
  /** Session uploads queued for compliance submit (sender/carrier KYB). */
  const [uploadedForSubmit, setUploadedForSubmit] = useState<
    Array<{ id: string; docType: string }>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    setDocType(docOptions[0]);
    setUploadedForSubmit([]);
    setMessage(null);
    setFile(null);
  }, [docOptions]);

  const me = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => getIdentityMe(),
  });

  const companyId = me.data?.company?.id ?? null;

  const docsQuery = useQuery({
    queryKey: ['documents', 'list', companyId, isDriver ? 'self' : 'company'],
    queryFn: () => listDocuments({ companyId: companyId! }),
    enabled: Boolean(companyId),
    // Always refresh so APPROVED docs after Ops review are not stuck behind a stale empty cache.
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const caseType = isSender
    ? ('SENDER_KYB' as const)
    : isCarrier
      ? ('CARRIER_KYB' as const)
      : null;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t('documentsUpload.errorChooseFile'));
      if (!companyId) throw new Error(t('documentsUpload.errorNoCompany'));
      const mime = resolveUploadMime(file);
      const intent = await createUploadIntent({
        companyId,
        docType,
        originalFilename:
          file.name || `capture.${mime === 'image/png' ? 'png' : mime === 'application/pdf' ? 'pdf' : 'jpg'}`,
        mimeType: mime,
        sizeBytes: file.size,
      });
      const uploadedRes = await uploadDocumentContent(intent.id, file);
      await confirmDocument(intent.id, uploadedRes.contentHash);
      return {
        id: intent.id,
        docType,
        contentHash: uploadedRes.contentHash,
      };
    },
    onSuccess: async (doc) => {
      setUploadedForSubmit((prev) => [
        ...prev.filter((d) => d.docType !== doc.docType),
        { id: doc.id, docType: doc.docType },
      ]);
      setMessage(
        t('documentsUpload.uploadedMessage', {
          docType: doc.docType,
          idPrefix: doc.id.slice(0, 8),
        }),
      );
      setFile(null);
      await qc.invalidateQueries({ queryKey: ['documents', 'list'] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!companyId || !caseType) {
        throw new Error(t('documentsUpload.errorSubmitNotAllowed'));
      }
      if (uploadedForSubmit.length === 0) {
        throw new Error(t('documentsUpload.errorChooseFile'));
      }
      return submitCompliance({
        companyId,
        caseType,
        documentIds: uploadedForSubmit.map((d) => d.id),
      });
    },
    onSuccess: async (res) => {
      setUploadedForSubmit([]);
      setMessage(
        t('documentsUpload.submittedMessage', {
          id: res.id.slice(0, 8),
          companyStatus: res.companyStatus,
        }),
      );
      await qc.invalidateQueries({ queryKey: ['documents', 'list'] });
    },
  });

  async function viewDocument(documentId: string) {
    setOpeningId(documentId);
    try {
      await openDocumentContent(documentId);
    } catch (err) {
      toast.error(getErrorDetail(err));
    } finally {
      setOpeningId(null);
    }
  }

  const title = isDriver ? t('documentsUpload.driverTitle') : t('documentsUpload.title');
  const subtitle = isDriver
    ? t('documentsUpload.driverSubtitle')
    : t('documentsUpload.subtitle');
  const storedDocs = docsQuery.data?.items ?? [];

  function ownerKind(doc: ComplianceDocumentListItem): 'company' | 'fleet' | 'driver' {
    if (doc.ownerKind === 'fleet' || doc.ownerKind === 'driver' || doc.ownerKind === 'company') {
      return doc.ownerKind;
    }
    if (doc.vehicleId) return 'fleet';
    if (doc.driverId) return 'driver';
    return 'company';
  }

  function ownerLabel(doc: ComplianceDocumentListItem): string {
    const kind = ownerKind(doc);
    if (kind === 'fleet') {
      return t('documentsUpload.ownerFleet', {
        rego: doc.vehicleRegistration?.trim() || t('dash'),
        label: doc.vehicleLabel?.trim() || t('dash'),
      });
    }
    if (kind === 'driver') {
      const who =
        doc.driverName?.trim() ||
        doc.driverEmail?.trim() ||
        (doc.driverId ? doc.driverId.slice(0, 8) : t('dash'));
      return t('documentsUpload.ownerDriver', { name: who });
    }
    return t('documentsUpload.ownerCompany');
  }

  function ownerTone(kind: 'company' | 'fleet' | 'driver'): 'info' | 'ok' | 'warn' {
    if (kind === 'fleet') return 'ok';
    if (kind === 'driver') return 'warn';
    return 'info';
  }

  const groupedDocs = (() => {
    const company: ComplianceDocumentListItem[] = [];
    const fleet: ComplianceDocumentListItem[] = [];
    const driver: ComplianceDocumentListItem[] = [];
    for (const doc of storedDocs) {
      const kind = ownerKind(doc);
      if (kind === 'fleet') fleet.push(doc);
      else if (kind === 'driver') driver.push(doc);
      else company.push(doc);
    }
    return { company, fleet, driver };
  })();

  function renderDocRow(d: ComplianceDocumentListItem) {
    const kind = ownerKind(d);
    return (
      <li
        key={d.id}
        className="flex flex-wrap items-center justify-between gap-2 rounded-clox-md border border-clox-border bg-clox-surface px-3 py-2"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={ownerTone(kind)}>
              {kind === 'company'
                ? t('documentsUpload.scopeCompany')
                : kind === 'fleet'
                  ? t('documentsUpload.scopeFleet')
                  : t('documentsUpload.scopeDriver')}
            </StatusPill>
            <span className="font-mono text-xs text-clox-ink">{d.docType}</span>
          </div>
          <p className="mt-1 text-xs text-clox-mute">{ownerLabel(d)}</p>
          <p className="mt-0.5 truncate text-[11px] text-clox-faint">
            {d.originalFilename ? `${d.originalFilename} · ` : ''}
            {d.status}
            {d.createdAt ? ` · ${new Date(d.createdAt).toLocaleString()}` : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={openingId === d.id}
          onClick={() => void viewDocument(d.id)}
        >
          {openingId === d.id
            ? t('documentsUpload.opening')
            : t('documentsUpload.viewDocument')}
        </Button>
      </li>
    );
  }

  function renderDocGroup(
    key: 'company' | 'fleet' | 'driver',
    items: ComplianceDocumentListItem[],
  ) {
    if (items.length === 0) return null;
    const titleKey =
      key === 'company'
        ? 'documentsUpload.groupCompany'
        : key === 'fleet'
          ? 'documentsUpload.groupFleet'
          : 'documentsUpload.groupDriver';
    return (
      <div key={key} className="mt-4">
        <h3 className="text-sm font-semibold text-clox-ink">
          {t(titleKey)}
          <span className="ml-2 font-normal text-clox-mute">({items.length})</span>
        </h3>
        <ul className="mt-2 space-y-2 text-sm">{items.map(renderDocRow)}</ul>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-clox-ink">{title}</h1>
      <p className="mt-2 text-sm text-clox-mute">{subtitle}</p>

      {isDriver ? (
        <Notice tone="info" className="mt-4">
          {t('documentsUpload.driverHint')}{' '}
          <Link to="/driver/onboarding" className="font-medium text-clox-orange hover:underline">
            {t('documentsUpload.driverOnboardingLink')}
          </Link>
        </Notice>
      ) : (
        <Notice tone="info" className="mt-4">
          companyId:{' '}
          <span className="font-mono text-clox-ink">{companyId ?? t('dash')}</span>
          {caseType ? (
            <>
              {' '}
              · caseType: <span className="font-mono text-clox-ink">{caseType}</span>
            </>
          ) : null}
        </Notice>
      )}

      {!companyId && !me.isLoading ? (
        <Notice tone="warn" className="mt-4">
          {t('documentsUpload.errorNoCompany')}
        </Notice>
      ) : null}

      <div className="mt-6">
        <Select
          label={t('documentsUpload.docTypeLabel')}
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        >
          {docOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <FileInput
          label={t('documentsUpload.fileLabel')}
          accept=".pdf,image/jpeg,image/png,image/webp"
          fileName={file?.name ?? null}
          onChange={(e) => {
            uploadMutation.reset();
            submitMutation.reset();
            setMessage(null);
            setFile(e.target.files?.[0] ?? null);
          }}
        />

        {uploadMutation.isError || submitMutation.isError ? (
          <Notice tone="error" className="mb-0">
            {getErrorDetail(uploadMutation.error ?? submitMutation.error)}
          </Notice>
        ) : null}
        {message ? (
          <Notice tone="success" className="mb-0">
            {message}
          </Notice>
        ) : null}

        <div className="clox-form-actions">
          <Button
            type="button"
            variant="cta"
            disabled={!file || !companyId || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending
              ? t('documentsUpload.uploading')
              : t('documentsUpload.uploadButton')}
          </Button>
          {!isDriver ? (
            <Button
              type="button"
              variant="secondary"
              disabled={
                uploadedForSubmit.length === 0 || submitMutation.isPending || !caseType
              }
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: t('confirm.submitComplianceTitle'),
                    description: t('confirm.submitComplianceBody'),
                    confirmLabel: t('documentsUpload.submitButton'),
                  });
                  if (ok) submitMutation.mutate();
                })();
              }}
            >
              {submitMutation.isPending
                ? t('documentsUpload.submitting')
                : t('documentsUpload.submitButton')}
            </Button>
          ) : null}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-clox-ink">
          {t('documentsUpload.readyDocs')}
        </h2>
        {docsQuery.isLoading ? (
          <p className="mt-2 text-sm text-clox-faint">{t('documentsUpload.loadingDocs')}</p>
        ) : null}
        {docsQuery.isError ? (
          <Notice tone="error" className="mt-2">
            {getErrorDetail(docsQuery.error)}
          </Notice>
        ) : null}
        {!docsQuery.isLoading && !docsQuery.isError && storedDocs.length === 0 ? (
          <p className="mt-2 text-sm text-clox-faint">{t('documentsUpload.noneYet')}</p>
        ) : null}
        {storedDocs.length > 0 ? (
          isCarrier ? (
            <div>
              {renderDocGroup('company', groupedDocs.company)}
              {renderDocGroup('fleet', groupedDocs.fleet)}
              {renderDocGroup('driver', groupedDocs.driver)}
            </div>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">{storedDocs.map(renderDocRow)}</ul>
          )
        ) : null}
      </section>
    </div>
  );
}
