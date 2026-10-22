import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IdentitySummary } from '@/components/identity-summary';
import {
  getCarrierCompanyProfile,
  getErrorDetail,
  getIdentityMe,
  getSenderCompanyProfile,
  listSessions,
  requestCarrierCompanyProfileChange,
  requestSenderCompanyProfileChange,
  revokeSession,
  updateCarrierCompanyProfileSelf,
  updateSenderCompanyProfileSelf,
  type CompanyProfileResponse,
} from '@/lib/api';
import { LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCard,
  Field,
  Notice,
  RoleBadge,
  useConfirm,
  useToast,
} from '@/components/ui';
import { AU_STATES } from '@/lib/validation';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function CompanyProfileSection({
  kind,
}: {
  kind: 'carrier' | 'sender';
}) {
  const { t } = useTranslation('common');
  const qc = useQueryClient();
  const toast = useToast();

  const profile = useQuery({
    queryKey: ['company-profile', kind],
    queryFn: () => (kind === 'carrier' ? getCarrierCompanyProfile() : getSenderCompanyProfile()),
  });

  const [tradingName, setTradingName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceRegions, setServiceRegions] = useState<string[]>([]);
  const [legalName, setLegalName] = useState('');
  const [abn, setAbn] = useState('');
  const [acn, setAcn] = useState('');
  const [homeRegionCode, setHomeRegionCode] = useState('VIC');
  const [invoiceLegalName, setInvoiceLegalName] = useState('');
  const [invoiceAddressLine1, setInvoiceAddressLine1] = useState('');
  const [invoiceSuburb, setInvoiceSuburb] = useState('');
  const [invoiceState, setInvoiceState] = useState('VIC');
  const [invoicePostcode, setInvoicePostcode] = useState('');
  const [gstRegistered, setGstRegistered] = useState(false);
  const [changeNote, setChangeNote] = useState('');

  useEffect(() => {
    const c = profile.data?.company;
    if (!c) return;
    setTradingName(c.tradingName ?? '');
    setPhone(c.phone ?? '');
    setServiceRegions(c.serviceRegionCodes ?? []);
    setLegalName(c.legalName);
    setAbn(c.abn ?? '');
    setAcn(c.acn ?? '');
    setHomeRegionCode(c.homeRegionCode ?? 'VIC');
    setInvoiceLegalName(c.invoiceLegalName ?? '');
    setInvoiceAddressLine1(c.invoiceAddressLine1 ?? '');
    setInvoiceSuburb(c.invoiceSuburb ?? '');
    setInvoiceState(c.invoiceState ?? 'VIC');
    setInvoicePostcode(c.invoicePostcode ?? '');
    setGstRegistered(c.gstRegistered);
  }, [profile.data]);

  const saveSelf = useMutation({
    mutationFn: () => {
      if (kind === 'carrier') {
        return updateCarrierCompanyProfileSelf({
          tradingName: tradingName.trim() || null,
          phone: phone.trim() || null,
          serviceRegionCodes: serviceRegions.length ? serviceRegions : undefined,
        });
      }
      return updateSenderCompanyProfileSelf({
        tradingName: tradingName.trim() || null,
        phone: phone.trim() || null,
      });
    },
    onSuccess: async () => {
      toast.success(t('account.profileSelfSaved'));
      await qc.invalidateQueries({ queryKey: ['company-profile', kind] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const requestChange = useMutation({
    mutationFn: () => {
      const c = profile.data?.company;
      if (!c) throw new Error('No company');
      const payload: Record<string, unknown> = { note: changeNote.trim() || undefined };
      if (legalName.trim() && legalName.trim() !== c.legalName) {
        payload.legalName = legalName.trim();
      }
      if (abn.trim() && abn.replace(/\s/g, '') !== (c.abn ?? '')) {
        payload.abn = abn.replace(/\s/g, '');
      }
      if ((acn.trim() || null) !== (c.acn ?? null)) {
        payload.acn = acn.trim() || null;
      }
      if (homeRegionCode && homeRegionCode !== (c.homeRegionCode ?? '')) {
        payload.homeRegionCode = homeRegionCode;
      }
      if (kind === 'sender') {
        if (invoiceLegalName.trim() && invoiceLegalName.trim() !== (c.invoiceLegalName ?? '')) {
          payload.invoiceLegalName = invoiceLegalName.trim();
        }
        if (
          invoiceAddressLine1.trim() &&
          invoiceAddressLine1.trim() !== (c.invoiceAddressLine1 ?? '')
        ) {
          payload.invoiceAddressLine1 = invoiceAddressLine1.trim();
        }
        if (invoiceSuburb.trim() && invoiceSuburb.trim() !== (c.invoiceSuburb ?? '')) {
          payload.invoiceSuburb = invoiceSuburb.trim();
        }
        if (invoiceState && invoiceState !== (c.invoiceState ?? '')) {
          payload.invoiceState = invoiceState;
        }
        if (invoicePostcode.trim() && invoicePostcode.trim() !== (c.invoicePostcode ?? '')) {
          payload.invoicePostcode = invoicePostcode.trim();
        }
        if (gstRegistered !== c.gstRegistered) {
          payload.gstRegistered = gstRegistered;
        }
      }
      return kind === 'carrier'
        ? requestCarrierCompanyProfileChange(payload)
        : requestSenderCompanyProfileChange(payload);
    },
    onSuccess: async () => {
      toast.success(t('account.profileChangeRequested'));
      setChangeNote('');
      await qc.invalidateQueries({ queryKey: ['company-profile', kind] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  function toggleRegion(code: string) {
    setServiceRegions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  if (profile.isLoading) {
    return (
      <div className="mt-8">
        <LoadingBlock label={t('account.profileLoading')} />
      </div>
    );
  }

  if (profile.isError) {
    const detail = getErrorDetail(profile.error);
    const notReady =
      /bid-eligible|after KYB|self-serve is available/i.test(detail) ||
      detail.toLowerCase().includes('not found');
    if (notReady) {
      return (
        <Notice tone="info" className="mt-8">
          {t('account.profileNotReady')}
        </Notice>
      );
    }
    return (
      <Notice tone="error" className="mt-8">
        {detail}
      </Notice>
    );
  }

  const data = profile.data as CompanyProfileResponse;
  const pending = data.pendingChange;
  const postApproval =
    (kind === 'carrier' && data.company.status === 'BID_ELIGIBLE') ||
    (kind === 'sender' &&
      (data.company.status === 'ACTIVE' || data.company.status === 'PENDING_PAYMENT'));

  if (!postApproval) {
    return (
      <Notice tone="info" className="mt-8">
        {t('account.profileNotReady')}
      </Notice>
    );
  }

  return (
    <div className="mt-10 space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold text-clox-ink">
          {t('account.profileTitle')}
        </h2>
        <p className="mt-1 text-sm text-clox-mute">{t('account.profileSubtitle')}</p>
      </div>

      {pending ? (
        <Notice tone="warn">
          {t('account.profilePending', {
            status: pending.status,
            fields: Object.keys(pending.proposedChanges ?? {}).join(', ') || '—',
          })}
        </Notice>
      ) : null}

      <section className="clox-card p-5">
        <h3 className="font-display text-base font-semibold text-clox-ink">
          {t('account.selfServeTitle')}
        </h3>
        <p className="mt-1 text-xs text-clox-mute">{t('account.selfServeHint')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label={t('account.tradingName')}
            value={tradingName}
            onChange={(e) => setTradingName(e.target.value)}
          />
          <Field
            label={t('account.phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {kind === 'carrier' ? (
          <div className="mt-4">
            <p className="mb-2 text-[12.5px] font-semibold text-clox-ink">
              {t('account.serviceRegions')}
            </p>
            <div className="flex flex-wrap gap-2">
              {AU_STATES.map((code) => {
                const on = serviceRegions.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    title={on ? t('account.regionActive') : t('account.regionInactive')}
                    className={
                      on
                        ? 'rounded-clox-md border border-clox-orange bg-clox-orange/10 px-2.5 py-1 text-xs font-semibold text-clox-ink shadow-sm'
                        : 'rounded-clox-md border border-clox-border/60 bg-clox-canvas/40 px-2.5 py-1 text-xs text-clox-faint opacity-45 blur-[1.5px] transition hover:opacity-70 hover:blur-[0.5px]'
                    }
                    onClick={() => toggleRegion(code)}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <Button
            type="button"
            disabled={saveSelf.isPending}
            onClick={() => saveSelf.mutate()}
          >
            {saveSelf.isPending ? t('account.saving') : t('account.saveSelfServe')}
          </Button>
        </div>
      </section>

      <section className="clox-card p-5">
        <h3 className="font-display text-base font-semibold text-clox-ink">
          {t('account.opsGatedTitle')}
        </h3>
        <p className="mt-1 text-xs text-clox-mute">{t('account.opsGatedHint')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label={t('account.legalName')}
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            disabled={Boolean(pending)}
          />
          <Field
            label={t('account.abn')}
            value={abn}
            onChange={(e) => setAbn(e.target.value)}
            disabled={Boolean(pending)}
          />
          <Field
            label={t('account.acn')}
            value={acn}
            onChange={(e) => setAcn(e.target.value)}
            disabled={Boolean(pending)}
          />
          <label className="mb-0 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
              {t('account.homeRegion')}
            </span>
            <select
              className="clox-field-control w-full"
              value={homeRegionCode}
              disabled={Boolean(pending)}
              onChange={(e) => setHomeRegionCode(e.target.value)}
            >
              {AU_STATES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
        </div>
        {kind === 'sender' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label={t('account.invoiceLegalName')}
              value={invoiceLegalName}
              onChange={(e) => setInvoiceLegalName(e.target.value)}
              disabled={Boolean(pending)}
            />
            <Field
              label={t('account.invoiceAddress')}
              value={invoiceAddressLine1}
              onChange={(e) => setInvoiceAddressLine1(e.target.value)}
              disabled={Boolean(pending)}
            />
            <Field
              label={t('account.invoiceSuburb')}
              value={invoiceSuburb}
              onChange={(e) => setInvoiceSuburb(e.target.value)}
              disabled={Boolean(pending)}
            />
            <label className="mb-0 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
                {t('account.invoiceState')}
              </span>
              <select
                className="clox-field-control w-full"
                value={invoiceState}
                disabled={Boolean(pending)}
                onChange={(e) => setInvoiceState(e.target.value)}
              >
                {AU_STATES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label={t('account.invoicePostcode')}
              value={invoicePostcode}
              onChange={(e) => setInvoicePostcode(e.target.value)}
              disabled={Boolean(pending)}
            />
            <label className="flex items-center gap-2 pt-6 text-sm text-clox-ink">
              <input
                type="checkbox"
                checked={gstRegistered}
                disabled={Boolean(pending)}
                onChange={(e) => setGstRegistered(e.target.checked)}
              />
              {t('account.gstRegistered')}
            </label>
          </div>
        ) : null}
        <Field
          className="mt-4"
          label={t('account.changeNote')}
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          disabled={Boolean(pending)}
        />
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={requestChange.isPending || Boolean(pending)}
            onClick={() => requestChange.mutate()}
          >
            {requestChange.isPending
              ? t('account.submittingChange')
              : t('account.requestOpsChange')}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function AccountPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const me = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => getIdentityMe(),
  });

  const sessions = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => listSessions(),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: async () => {
      toast.success(t('account.revokeSuccess'));
      await qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const showCompanyProfile =
    role === AppRole.TRANSPORT_COMPANY || role === AppRole.SENDER;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-clox-ink">{t('account.title')}</h1>
        <RoleBadge role={role} />
      </div>
      <p className="mt-2 text-sm text-clox-mute">{t('account.subtitle')}</p>

      {me.isLoading || sessions.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('account.loading')} />
        </div>
      ) : null}

      {me.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(me.error)}
        </Notice>
      ) : null}

      {me.data ? <IdentitySummary me={me.data} className="clox-card mt-6 p-5" /> : null}

      {showCompanyProfile ? (
        <CompanyProfileSection
          kind={role === AppRole.TRANSPORT_COMPANY ? 'carrier' : 'sender'}
        />
      ) : null}

      <h2 className="mt-10 font-display text-lg font-semibold text-clox-ink">
        {t('account.activeSessions')}
      </h2>
      {sessions.isError ? (
        <Notice tone="error" className="mt-2">
          {getErrorDetail(sessions.error)}
        </Notice>
      ) : null}

      <ul className="mt-3 space-y-2">
        {(sessions.data?.data ?? []).map((s) => (
          <li key={s.id}>
            <DataCard className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-clox-ink">
                  {s.deviceLabel || t('account.session')}{' '}
                  {s.isCurrent ? t('account.current') : ''}
                </p>
                <p className="text-xs text-clox-faint">
                  {t('account.lastUsed', { date: new Date(s.lastUsedAt).toLocaleString() })}
                </p>
              </div>
              {!s.isCurrent ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: t('confirm.revokeSessionTitle'),
                        description: t('confirm.revokeSessionBody'),
                        confirmLabel: t('account.revoke'),
                        tone: 'destructive',
                      });
                      if (ok) revoke.mutate(s.id);
                    })();
                  }}
                >
                  {t('account.revoke')}
                </Button>
              ) : null}
            </DataCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
