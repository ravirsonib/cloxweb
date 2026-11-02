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
import { formatDate, formatDateTime } from '@/lib/datetime';
import { complianceDocStatusTone } from '@/lib/status-tone';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';
import { Building2, ChevronDown, Truck, Users } from 'lucide-react';

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
  const [mobileActiveTab, setMobileActiveTab] = useState<'company' | 'driver' | 'fleet' | null>('company');

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

  const carrierCategories = useMemo(
    () => [
      {
        key: 'company' as const,
        title: t('documentsUpload.groupCompany', { defaultValue: 'Company documents' }),
        icon: Building2,
        items: groupedDocs.company,
        emptyText: t('documentsUpload.noCompanyDocs', {
          defaultValue: 'No company documents uploaded yet.',
        }),
        description: t('documentsUpload.companyDocsDesc', {
          defaultValue: 'Public liability, cargo insurance, DG licence, and business registry.',
        }),
        badgeTone: 'info' as const,
      },
      {
        key: 'driver' as const,
        title: t('documentsUpload.groupDriver', { defaultValue: 'Driver documents' }),
        icon: Users,
        items: groupedDocs.driver,
        emptyText: t('documentsUpload.noDriverDocs', {
          defaultValue: 'No driver documents uploaded yet.',
        }),
        description: t('documentsUpload.driverDocsDesc', {
          defaultValue: 'Driver licences, NHVR certificates, and identity verification.',
        }),
        badgeTone: 'warn' as const,
      },
      {
        key: 'fleet' as const,
        title: t('documentsUpload.groupFleet', { defaultValue: 'Fleet / vehicle documents' }),
        icon: Truck,
        items: groupedDocs.fleet,
        emptyText: t('documentsUpload.noFleetDocs', {
          defaultValue: 'No fleet documents uploaded yet.',
        }),
        description: t('documentsUpload.fleetDocsDesc', {
          defaultValue: 'Vehicle registrations, roadworthiness certificates, and inspections.',
        }),
        badgeTone: 'ok' as const,
      },
    ],
    [groupedDocs, t],
  );

  function renderDocCard(d: ComplianceDocumentListItem) {
    const kind = ownerKind(d);
    return (
      <div
        key={d.id}
        className="rounded-clox-md border border-clox-border-soft bg-clox-surface p-3.5 shadow-clox-1 transition hover:border-clox-border hover:shadow-clox-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-clox-ink break-words">
                {d.docType}
              </span>
              {kind !== 'company' ? (
                <StatusPill tone={ownerTone(kind)}>
                  {kind === 'fleet'
                    ? t('documentsUpload.scopeFleet')
                    : t('documentsUpload.scopeDriver')}
                </StatusPill>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-medium text-clox-mute truncate">
              {ownerLabel(d)}
            </p>
          </div>
          <StatusPill tone={complianceDocStatusTone(d.status)}>
            {d.status}
          </StatusPill>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-clox-border-soft/70 pt-2.5 text-[11px] text-clox-faint">
          <div className="min-w-0 max-w-[65%]" title={d.originalFilename ?? undefined}>
            <span className="truncate block font-mono text-clox-mute">
              {d.originalFilename || (d.createdAt ? formatDate(d.createdAt) : t('dash'))}
            </span>
            {d.createdAt ? (
              <span className="text-[10px] text-clox-faint">
                {formatDate(d.createdAt)}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={openingId === d.id}
            onClick={() => void viewDocument(d.id)}
          >
            {openingId === d.id
              ? t('documentsUpload.opening')
              : t('documentsUpload.viewDocument')}
          </Button>
        </div>
      </div>
    );
  }

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
            {d.createdAt ? ` · ${formatDateTime(d.createdAt)}` : ''}
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

  return (
    <div className="w-full max-w-7xl">
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
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('documentsUpload.readyDocs')}
            </h2>
            {isCarrier ? (
              <p className="mt-0.5 text-xs text-clox-mute">
                Review company KYB, driver credentials, and fleet roadworthiness documents.
              </p>
            ) : null}
          </div>
          {storedDocs.length > 0 ? (
            <span className="rounded-full bg-clox-surface-alt px-3 py-1 font-mono text-xs font-medium text-clox-mute">
              {storedDocs.length} total
            </span>
          ) : null}
        </div>

        {docsQuery.isLoading ? (
          <p className="mt-2 text-sm text-clox-faint">{t('documentsUpload.loadingDocs')}</p>
        ) : null}
        {docsQuery.isError ? (
          <Notice tone="error" className="mt-2">
            {getErrorDetail(docsQuery.error)}
          </Notice>
        ) : null}

        {!docsQuery.isLoading && !docsQuery.isError ? (
          isCarrier ? (
            <>
              {/* Big screens: 3 columns (company, driver, fleet) */}
              <div className="hidden lg:grid lg:grid-cols-3 gap-6 items-start">
                {carrierCategories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div
                      key={cat.key}
                      className="flex flex-col rounded-clox-lg border border-clox-border bg-clox-surface p-4 shadow-clox-1 min-w-0"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-clox-border-soft pb-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clox-md bg-clox-surface-alt text-clox-orange">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-sm font-semibold text-clox-ink truncate">
                              {cat.title}
                            </h3>
                            <p className="text-[11px] text-clox-mute truncate">{cat.description}</p>
                          </div>
                        </div>
                        <StatusPill tone={cat.badgeTone}>
                          {cat.items.length}
                        </StatusPill>
                      </div>

                      <div className="mt-3.5 space-y-2.5">
                        {cat.items.length === 0 ? (
                          <div className="flex flex-col items-center justify-center rounded-clox-md border border-dashed border-clox-border-soft bg-clox-surface-alt/30 py-8 px-4 text-center">
                            <Icon className="h-7 w-7 text-clox-faint mb-2" />
                            <p className="text-xs font-medium text-clox-mute">{cat.emptyText}</p>
                            <p className="mt-1 text-[11px] text-clox-faint">{cat.description}</p>
                          </div>
                        ) : (
                          cat.items.map(renderDocCard)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Small screens: FAQ-style accordion to open only specific tab */}
              <div className="block lg:hidden space-y-3">
                {carrierCategories.map((cat) => {
                  const isOpen = mobileActiveTab === cat.key;
                  const Icon = cat.icon;
                  return (
                    <div
                      key={cat.key}
                      className="overflow-hidden rounded-clox-lg border border-clox-border bg-clox-surface shadow-clox-1 transition"
                    >
                      <button
                        type="button"
                        id={`faq-btn-${cat.key}`}
                        aria-expanded={isOpen}
                        aria-controls={`faq-panel-${cat.key}`}
                        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-clox-surface-alt/50"
                        onClick={() => setMobileActiveTab(isOpen ? null : cat.key)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clox-surface-alt text-clox-orange">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-clox-ink truncate">
                                {cat.title}
                              </h3>
                              <StatusPill tone={cat.badgeTone}>
                                {cat.items.length}
                              </StatusPill>
                            </div>
                            <p className="text-xs text-clox-mute truncate">{cat.description}</p>
                          </div>
                        </div>
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-clox-border text-clox-mute transition-transform duration-200 ${
                            isOpen ? 'rotate-180 bg-clox-surface-alt text-clox-ink' : ''
                          }`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </button>

                      {isOpen && (
                        <div
                          id={`faq-panel-${cat.key}`}
                          role="region"
                          aria-labelledby={`faq-btn-${cat.key}`}
                          className="border-t border-clox-border-soft bg-clox-surface-alt/30 p-4"
                        >
                          {cat.items.length === 0 ? (
                            <div className="py-6 text-center text-xs text-clox-mute">
                              <Icon className="mx-auto h-7 w-7 text-clox-faint mb-2" />
                              <p className="font-medium text-clox-mute">{cat.emptyText}</p>
                              <p className="mt-1 text-[11px] text-clox-faint">{cat.description}</p>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {cat.items.map(renderDocCard)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : storedDocs.length === 0 ? (
            <p className="mt-2 text-sm text-clox-faint">{t('documentsUpload.noneYet')}</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">{storedDocs.map(renderDocRow)}</ul>
          )
        ) : null}
      </section>
    </div>
  );
}
