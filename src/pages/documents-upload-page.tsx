import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  confirmDocument,
  createUploadIntent,
  getErrorDetail,
  getIdentityMe,
  submitCompliance,
  uploadDocumentContent,
} from '@/lib/api';
import { Button, Notice, Select, useConfirm } from '@/components/ui';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type UploadedDoc = { id: string; docType: string; contentHash: string };

const SENDER_DOC_TYPES = ['ABN_EXTRACT', 'GOVERNMENT_ID', 'OTHER'] as const;
const CARRIER_DOC_TYPES = [
  'PUBLIC_LIABILITY',
  'CARGO_INSURANCE',
  'RWC',
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
  const [uploaded, setUploaded] = useState<UploadedDoc[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDocType(docOptions[0]);
    setUploaded([]);
    setMessage(null);
    setFile(null);
  }, [docOptions]);

  const me = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => getIdentityMe(),
  });

  const companyId = me.data?.company?.id ?? null;

  const caseType = isSender
    ? ('SENDER_KYB' as const)
    : isCarrier
      ? ('CARRIER_KYB' as const)
      : null;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t('documentsUpload.errorChooseFile'));
      if (!companyId) throw new Error(t('documentsUpload.errorNoCompany'));
      const mime = (file.type || 'application/pdf') as
        | 'application/pdf'
        | 'image/jpeg'
        | 'image/png'
        | 'image/webp';
      const intent = await createUploadIntent({
        companyId,
        docType,
        originalFilename: file.name,
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
    onSuccess: (doc) => {
      setUploaded((prev) => [...prev.filter((d) => d.docType !== doc.docType), doc]);
      setMessage(
        t('documentsUpload.uploadedMessage', {
          docType: doc.docType,
          idPrefix: doc.id.slice(0, 8),
        }),
      );
      setFile(null);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!companyId || !caseType) {
        throw new Error(t('documentsUpload.errorSubmitNotAllowed'));
      }
      return submitCompliance({
        companyId,
        caseType,
        documentIds: uploaded.map((d) => d.id),
      });
    },
    onSuccess: (res) => {
      setMessage(
        t('documentsUpload.submittedMessage', {
          id: res.id.slice(0, 8),
          companyStatus: res.companyStatus,
        }),
      );
    },
  });

  const title = isDriver ? t('documentsUpload.driverTitle') : t('documentsUpload.title');
  const subtitle = isDriver
    ? t('documentsUpload.driverSubtitle')
    : t('documentsUpload.subtitle');

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
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
            {t('documentsUpload.fileLabel')}
          </span>
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-clox-mute"
          />
        </label>

        {uploadMutation.isError || submitMutation.isError ? (
          <Notice tone="error" className="mb-4">
            {getErrorDetail(uploadMutation.error ?? submitMutation.error)}
          </Notice>
        ) : null}
        {message ? (
          <Notice tone="success" className="mb-4">
            {message}
          </Notice>
        ) : null}

        <div className="flex flex-wrap gap-2">
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
              disabled={uploaded.length === 0 || submitMutation.isPending || !caseType}
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
        {uploaded.length === 0 ? (
          <p className="mt-2 text-sm text-clox-faint">{t('documentsUpload.noneYet')}</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {uploaded.map((d) => (
              <li
                key={d.id}
                className="rounded-clox-md border border-clox-border bg-clox-surface px-3 py-2 font-mono text-xs"
              >
                {d.docType} · {d.id}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
