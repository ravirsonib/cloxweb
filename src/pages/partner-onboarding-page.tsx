import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import {
  confirmDocument,
  createUploadIntent,
  getErrorDetail,
  getPartnerOnboarding,
  submitPartnerOnboarding,
  updatePartnerOnboarding,
  uploadDocumentContent,
  type PartnerOnboarding,
} from '@/lib/api';
import { LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  Field,
  Notice,
  StepChips,
  TextArea,
  useToast,
} from '@/components/ui';
import { abnSchema } from '@/lib/validation';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const STEPS = ['profile', 'documents', 'declarations', 'submit', 'waiting'] as const;
type StepId = (typeof STEPS)[number];

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional(),
  companyName: z.string().trim().min(2).max(200),
  abn: abnSchema('ABN is required', 'ABN must be 11 digits'),
  acn: z.string().trim().max(20).optional(),
  corporateAddress: z.string().trim().min(5).max(500),
  networkExperience: z.string().trim().min(10).max(4000),
  executionStrategy: z.string().trim().min(10).max(4000),
});

type ProfileForm = z.infer<typeof profileSchema>;

const REQUIRED_DOCS = ['ABN_EXTRACT', 'GOVERNMENT_ID', 'MASTER_ADMIN_AGREEMENT'] as const;

function resolveStep(data: PartnerOnboarding): StepId {
  if (data.status === 'ACTIVE') return 'waiting';
  if (data.status === 'PENDING_REVIEW') return 'waiting';
  if (data.status === 'REJECTED') return 'waiting';
  const hasProfile =
    Boolean(data.name) &&
    Boolean(data.company?.abn) &&
    Boolean(data.profile.networkExperience) &&
    Boolean(data.profile.executionStrategy);
  if (!hasProfile) return 'profile';
  const uploadedTypes = new Set(
    data.documents
      .filter((d) => d.status === 'UPLOADED' || d.status === 'UNDER_REVIEW' || d.status === 'APPROVED')
      .map((d) => d.docType),
  );
  if (!REQUIRED_DOCS.every((t) => uploadedTypes.has(t))) return 'documents';
  return 'declarations';
}

export function PartnerOnboardingPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const toast = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState<StepId | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [declAccuracy, setDeclAccuracy] = useState(false);
  const [declNda, setDeclNda] = useState(false);
  const [declNonCompete, setDeclNonCompete] = useState(false);

  const isPartner = role === AdminRole.STATE_MASTER || role === AdminRole.LOCAL_BDE;

  const query = useQuery({
    queryKey: ['ops', 'partner-onboarding'],
    queryFn: () => getPartnerOnboarding(),
    enabled: isPartner,
  });

  const data = query.data;
  const derived = data ? resolveStep(data) : 'profile';
  const current = step ?? derived;

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: data
      ? {
          name: data.name ?? '',
          phone: data.phone ?? '',
          companyName: data.company?.legalName ?? '',
          abn: data.company?.abn ?? '',
          acn: data.company?.acn ?? '',
          corporateAddress: data.profile.corporateAddress ?? '',
          networkExperience: data.profile.networkExperience ?? '',
          executionStrategy: data.profile.executionStrategy ?? '',
        }
      : undefined,
  });

  const canEdit =
    data?.status === 'INVITED' ||
    data?.status === 'PENDING_DOCS' ||
    (data?.status === 'PENDING_REVIEW' && Boolean(data.openCase?.status === 'INFO_REQUESTED'));

  const editable =
    data?.status === 'INVITED' ||
    data?.status === 'PENDING_DOCS';

  const saveProfile = useMutation({
    mutationFn: (values: ProfileForm) =>
      updatePartnerOnboarding({
        name: values.name,
        phone: values.phone || undefined,
        companyName: values.companyName,
        abn: values.abn,
        acn: values.acn || undefined,
        corporateAddress: values.corporateAddress,
        networkExperience: values.networkExperience,
        executionStrategy: values.executionStrategy,
      }),
    onSuccess: async () => {
      toast.success(t('saved'));
      await qc.invalidateQueries({ queryKey: ['ops', 'partner-onboarding'] });
      setStep('documents');
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error('missing');
      const ids = REQUIRED_DOCS.map((docType) => {
        const doc = data.documents.find(
          (d) =>
            d.docType === docType &&
            (d.status === 'UPLOADED' || d.status === 'UNDER_REVIEW'),
        );
        if (!doc) throw new Error(`Missing ${docType}`);
        return doc.id;
      });
      return submitPartnerOnboarding({
        documentIds: ids,
        declarationAccuracy: true,
        declarationNda: true,
        declarationNonCompete: true,
      });
    },
    onSuccess: async () => {
      toast.success(t('partnerOnboarding.submitSuccess'));
      await qc.invalidateQueries({ queryKey: ['ops', 'partner-onboarding'] });
      setStep('waiting');
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const docStatusByType = useMemo(() => {
    const map = new Map<string, PartnerOnboarding['documents'][number]>();
    for (const doc of data?.documents ?? []) {
      const prev = map.get(doc.docType);
      if (!prev || new Date(doc.createdAt) > new Date(prev.createdAt)) {
        map.set(doc.docType, doc);
      }
    }
    return map;
  }, [data?.documents]);

  async function uploadDoc(docType: string, file: File) {
    if (!data?.companyId) return;
    setUploading(docType);
    try {
      const mime = file.type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
      const intent = await createUploadIntent({
        companyId: data.companyId,
        docType,
        originalFilename: file.name,
        mimeType: mime,
        sizeBytes: file.size,
      });
      const up = await uploadDocumentContent(intent.id, file);
      await confirmDocument(intent.id, up.contentHash);
      toast.success(t('partnerOnboarding.uploadSuccess'));
      await qc.invalidateQueries({ queryKey: ['ops', 'partner-onboarding'] });
    } catch (err) {
      toast.error(getErrorDetail(err));
    } finally {
      setUploading(null);
    }
  }

  if (!isPartner) {
    return <Navigate to="/" replace />;
  }

  if (query.isLoading) {
    return <LoadingBlock label={t('partnerOnboarding.loading')} />;
  }

  if (query.isError || !data) {
    return <Notice tone="error">{getErrorDetail(query.error)}</Notice>;
  }

  if (data.status === 'ACTIVE') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-clox-ink">
        {t('partnerOnboarding.title')}
      </h1>
      <p className="mt-2 text-sm text-clox-mute">{t('partnerOnboarding.subtitle')}</p>
      <p className="mt-1 font-mono text-xs text-clox-faint">
        {data.role} · {data.status}
        {data.scopes[0]?.regionCode ? ` · ${data.scopes[0].regionCode}` : ''}
        {data.scopes[0]?.territoryCode ? ` / ${data.scopes[0].territoryCode}` : ''}
      </p>

      <StepChips
        className="mt-4"
        current={current}
        steps={STEPS.map((id) => ({
          id,
          label: t(`partnerOnboarding.step.${id}`),
        }))}
        onStepSelect={(id) => {
          if (STEPS.includes(id as StepId)) setStep(id as StepId);
        }}
      />

      {data.openCase?.decisionNote ? (
        <Notice tone="warn" className="mt-4">
          {t('partnerOnboarding.opsNote')}: {data.openCase.decisionNote}
        </Notice>
      ) : null}

      {current === 'profile' ? (
        <form
          className="mt-6 space-y-3"
          onSubmit={form.handleSubmit((values) => saveProfile.mutate(values))}
        >
          <Field label={t('partnerOnboarding.fullName')} error={form.formState.errors.name?.message} {...form.register('name')} disabled={!editable} />
          <Field label={t('partnerOnboarding.phone')} {...form.register('phone')} disabled={!editable} />
          <Field label={t('partnerOnboarding.companyName')} error={form.formState.errors.companyName?.message} {...form.register('companyName')} disabled={!editable} />
          <Field label={t('partnerOnboarding.abn')} error={form.formState.errors.abn?.message} {...form.register('abn')} disabled={!editable} />
          <Field label={t('partnerOnboarding.acn')} {...form.register('acn')} disabled={!editable} />
          <TextArea label={t('partnerOnboarding.address')} error={form.formState.errors.corporateAddress?.message} {...form.register('corporateAddress')} disabled={!editable} />
          <TextArea label={t('partnerOnboarding.networkExperience')} error={form.formState.errors.networkExperience?.message} rows={4} {...form.register('networkExperience')} disabled={!editable} />
          <TextArea label={t('partnerOnboarding.executionStrategy')} error={form.formState.errors.executionStrategy?.message} rows={4} {...form.register('executionStrategy')} disabled={!editable} />
          {editable ? (
            <Button type="submit" variant="cta" disabled={saveProfile.isPending}>
              {saveProfile.isPending ? t('loading') : t('partnerOnboarding.saveContinue')}
            </Button>
          ) : null}
        </form>
      ) : null}

      {current === 'documents' ? (
        <div className="mt-6 space-y-4">
          <Notice tone="info">{t('partnerOnboarding.docsHint')}</Notice>
          {REQUIRED_DOCS.map((docType) => {
            const existing = docStatusByType.get(docType);
            return (
              <div key={docType} className="rounded-clox-md border border-clox-border p-4">
                <p className="font-mono text-xs text-clox-orange">{docType}</p>
                <p className="mt-1 text-sm text-clox-mute">
                  {existing
                    ? `${existing.status} · ${existing.originalFilename ?? t('dash')}`
                    : t('partnerOnboarding.docMissing')}
                </p>
                {editable ? (
                  <input
                    className="mt-3 block w-full text-sm"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={uploading === docType}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadDoc(docType, file);
                      e.target.value = '';
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          <Button type="button" variant="secondary" onClick={() => setStep('declarations')}>
            {t('partnerOnboarding.continue')}
          </Button>
        </div>
      ) : null}

      {current === 'declarations' || current === 'submit' ? (
        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-2 text-sm text-clox-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={declAccuracy}
              disabled={!editable}
              onChange={(e) => setDeclAccuracy(e.target.checked)}
            />
            <span>{t('partnerOnboarding.declAccuracy')}</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-clox-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={declNda}
              disabled={!editable}
              onChange={(e) => setDeclNda(e.target.checked)}
            />
            <span>{t('partnerOnboarding.declNda')}</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-clox-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={declNonCompete}
              disabled={!editable}
              onChange={(e) => setDeclNonCompete(e.target.checked)}
            />
            <span>{t('partnerOnboarding.declNonCompete')}</span>
          </label>
          {editable ? (
            <Button
              type="button"
              variant="cta"
              disabled={
                !declAccuracy ||
                !declNda ||
                !declNonCompete ||
                submitMutation.isPending ||
                !canEdit
              }
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? t('loading') : t('partnerOnboarding.submit')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {current === 'waiting' ? (
        <Notice tone="info" className="mt-6">
          {data.status === 'REJECTED'
            ? t('partnerOnboarding.rejected')
            : t('partnerOnboarding.waitingOps')}
        </Notice>
      ) : null}
    </div>
  );
}
