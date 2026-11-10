import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { IdentitySummary } from '@/components/identity-summary';
import {
  getCarrierCompanyProfile,
  getErrorDetail,
  getIdentityMe,
  getRegionsMeta,
  getSenderCompanyProfile,
  listSessions,
  requestCarrierCompanyProfileChange,
  requestSenderCompanyProfileChange,
  revokeSession,
  updateCarrierCompanyProfileSelf,
  updateSenderCompanyProfileSelf,
  type CompanyProfileResponse,
  type CompanyProfileHistoryItem,
} from '@/lib/api';
import { LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCard,
  Field,
  Notice,
  RoleBadge,
  Select,
  StatusPill,
  type StatusPillTone,
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

  const regionsMeta = useQuery({
    queryKey: ['jobs', 'meta', 'regions'],
    queryFn: () => getRegionsMeta(),
    staleTime: 60_000,
  });
  const enabledRegionSet = regionsMeta.data?.enabledCodes
    ? new Set(regionsMeta.data.enabledCodes.map((c) => c.toUpperCase()))
    : null;
  const fallbackRegionCode = regionsMeta.data?.enabledCodes?.[0] || 'VIC';

  const [tradingName, setTradingName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceRegions, setServiceRegions] = useState<string[]>([]);
  const [legalName, setLegalName] = useState('');
  const [abn, setAbn] = useState('');
  const [acn, setAcn] = useState('');
  const [homeRegionCode, setHomeRegionCode] = useState(fallbackRegionCode);
  const [invoiceLegalName, setInvoiceLegalName] = useState('');
  const [invoiceAddressLine1, setInvoiceAddressLine1] = useState('');
  const [invoiceSuburb, setInvoiceSuburb] = useState('');
  const [invoiceState, setInvoiceState] = useState(fallbackRegionCode);
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
    setHomeRegionCode(c.homeRegionCode ?? fallbackRegionCode);
    setInvoiceLegalName(c.invoiceLegalName ?? '');
    setInvoiceAddressLine1(c.invoiceAddressLine1 ?? '');
    setInvoiceSuburb(c.invoiceSuburb ?? '');
    setInvoiceState(c.invoiceState ?? c.homeRegionCode ?? fallbackRegionCode);
    setInvoicePostcode(c.invoicePostcode ?? '');
    setGstRegistered(c.gstRegistered);
  }, [profile.data, fallbackRegionCode]);

  const c = profile.data?.company;
  const pending = (profile.data as CompanyProfileResponse | undefined)?.pendingChange;

  const isSelfServeDirty = Boolean(
    c &&
      (tradingName.trim() !== (c.tradingName ?? '').trim() ||
        phone.trim() !== (c.phone ?? '').trim() ||
        (kind === 'carrier' &&
          [...serviceRegions].sort().join(',') !==
            [...(c.serviceRegionCodes ?? [])].sort().join(','))),
  );

  const isOpsChangeDirty = Boolean(
    c &&
      ((legalName.trim() !== '' && legalName.trim() !== c.legalName.trim()) ||
        (abn.trim() !== '' && abn.replace(/\s/g, '') !== (c.abn ?? '').replace(/\s/g, '')) ||
        (acn.trim() !== (c.acn ?? '').trim()) ||
        (homeRegionCode !== (c.homeRegionCode ?? fallbackRegionCode)) ||
        (kind === 'sender' &&
          ((invoiceLegalName.trim() !== '' &&
            invoiceLegalName.trim() !== (c.invoiceLegalName ?? '').trim()) ||
            (invoiceAddressLine1.trim() !== '' &&
              invoiceAddressLine1.trim() !== (c.invoiceAddressLine1 ?? '').trim()) ||
            (invoiceSuburb.trim() !== '' &&
              invoiceSuburb.trim() !== (c.invoiceSuburb ?? '').trim()) ||
            (invoiceState !== (c.invoiceState ?? c.homeRegionCode ?? fallbackRegionCode)) ||
            (invoicePostcode.trim() !== '' &&
              invoicePostcode.trim() !== (c.invoicePostcode ?? '').trim()) ||
            gstRegistered !== Boolean(c.gstRegistered)))),
  );

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
      if (!c) throw new Error('No company');
      if (pending) {
        throw new Error(
          t('account.reviewAlreadySubmitted', {
            defaultValue: 'A review is already pending CLOX approval.',
          }),
        );
      }
      if (!isOpsChangeDirty) {
        throw new Error(
          t('account.noChangesToSubmit', {
            defaultValue: 'No changes detected to submit.',
          }),
        );
      }
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
        <Notice
          tone="warn"
          title={t('account.reviewPendingTitle', { defaultValue: 'Review already submitted' })}
        >
          <p>
            {t('account.profilePending', {
              status: pending.status,
              fields: Object.keys(pending.proposedChanges ?? {}).join(', ') || '—',
            })}
          </p>
          <p className="mt-1 text-xs text-clox-mute">
            {t('account.reviewPendingLockHint', {
              defaultValue:
                'Your profile changes are currently under review by CLOX Ops. Multiple requests cannot be submitted while a review is pending.',
            })}
          </p>
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
            hint={t('account.tradingNameHint')}
            value={tradingName}
            onChange={(e) => setTradingName(e.target.value)}
          />
          <Field
            label={t('account.phone')}
            hint={t('account.phoneHint')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {kind === 'carrier' ? (
          <div className="mt-4">
            <div className="mb-2">
              <p className="text-[12.5px] font-semibold text-clox-ink">
                {t('account.serviceRegions')}
              </p>
              <p className="text-xs text-clox-mute">
                {t('account.serviceRegionsHint')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {AU_STATES.map((code) => {
                const on = serviceRegions.includes(code);
                const disabled = enabledRegionSet != null && !enabledRegionSet.has(code) && !on;
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    disabled={disabled}
                    title={
                      disabled
                        ? 'Region not active on platform'
                        : on
                          ? t('account.regionActive')
                          : t('account.regionInactive')
                    }
                    className={
                      on
                        ? 'rounded-clox-md border border-clox-orange bg-clox-orange/10 px-3 py-1.5 text-xs font-semibold text-clox-orange shadow-sm transition'
                        : disabled
                          ? 'cursor-not-allowed rounded-clox-md border border-clox-border/50 bg-clox-surface-alt px-3 py-1.5 text-xs font-medium text-clox-faint opacity-50'
                          : 'rounded-clox-md border border-clox-border bg-clox-canvas px-3 py-1.5 text-xs font-medium text-clox-mute hover:border-clox-ink hover:text-clox-ink transition'
                    }
                    onClick={() => {
                      if (disabled) return;
                      toggleRegion(code);
                    }}
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
            disabled={saveSelf.isPending || !isSelfServeDirty}
            onClick={() => saveSelf.mutate()}
          >
            {saveSelf.isPending
              ? t('account.saving')
              : !isSelfServeDirty
                ? t('account.noChangesToSave')
                : t('account.saveSelfServe')}
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
            hint={t('account.legalNameHint')}
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            disabled={Boolean(pending)}
          />
          <Field
            label={t('account.abn')}
            hint={t('account.abnHint')}
            value={abn}
            onChange={(e) => setAbn(e.target.value)}
            disabled={Boolean(pending)}
          />
          <Field
            label={t('account.acn')}
            hint={t('account.acnHint')}
            value={acn}
            onChange={(e) => setAcn(e.target.value)}
            disabled={Boolean(pending)}
          />
          <Select
            className="mb-0"
            label={t('account.homeRegion')}
            hint={t('account.homeRegionHint')}
            value={homeRegionCode}
            disabled={Boolean(pending)}
            onChange={(e) => setHomeRegionCode(e.target.value)}
          >
            {AU_STATES.map((code) => {
              const disabled =
                enabledRegionSet != null && !enabledRegionSet.has(code) && homeRegionCode !== code;
              return (
                <option key={code} value={code} disabled={disabled}>
                  {code}
                  {disabled ? ' (Not active)' : ''}
                </option>
              );
            })}
          </Select>
        </div>
        {kind === 'sender' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label={t('account.invoiceLegalName')}
              hint={t('account.invoiceLegalNameHint')}
              value={invoiceLegalName}
              onChange={(e) => setInvoiceLegalName(e.target.value)}
              disabled={Boolean(pending)}
            />
            <Field
              label={t('account.invoiceAddress')}
              hint={t('account.invoiceAddressHint')}
              value={invoiceAddressLine1}
              onChange={(e) => setInvoiceAddressLine1(e.target.value)}
              disabled={Boolean(pending)}
            />
            <Field
              label={t('account.invoiceSuburb')}
              hint={t('account.invoiceSuburbHint')}
              value={invoiceSuburb}
              onChange={(e) => setInvoiceSuburb(e.target.value)}
              disabled={Boolean(pending)}
            />
            <Select
              className="mb-0"
              label={t('account.invoiceState')}
              hint={t('account.invoiceStateHint')}
              value={invoiceState}
              disabled={Boolean(pending)}
              onChange={(e) => setInvoiceState(e.target.value)}
            >
              {AU_STATES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
            <Field
              label={t('account.invoicePostcode')}
              hint={t('account.invoicePostcodeHint')}
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
          hint={t('account.changeNoteHint')}
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          disabled={Boolean(pending)}
        />
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={requestChange.isPending || Boolean(pending) || !isOpsChangeDirty}
            onClick={() => requestChange.mutate()}
          >
            {requestChange.isPending
              ? t('account.submittingChange')
              : pending
                ? t('account.reviewAlreadySubmitted')
                : !isOpsChangeDirty
                  ? t('account.noChangesToSubmit')
                  : t('account.requestOpsChange')}
          </Button>
        </div>
      </section>

      <ProfileActivityHistory history={data.history} />
    </div>
  );
}

function ProfileActivityHistory({
  history,
}: {
  history?: CompanyProfileHistoryItem[];
}) {
  const { t } = useTranslation('common');

  const formatFieldLabel = (field: string) => {
    switch (field) {
      case 'legalName':
        return t('account.legalName');
      case 'tradingName':
        return t('account.tradingName');
      case 'abn':
        return t('account.abn');
      case 'acn':
        return t('account.acn');
      case 'homeRegionCode':
        return t('account.homeRegion');
      case 'serviceRegionCodes':
        return t('account.serviceRegions');
      case 'phone':
        return t('account.phone');
      case 'invoiceLegalName':
        return t('account.invoiceLegalName');
      case 'invoiceAddressLine1':
        return t('account.invoiceAddress');
      case 'invoiceSuburb':
        return t('account.invoiceSuburb');
      case 'invoiceState':
        return t('account.invoiceState');
      case 'invoicePostcode':
        return t('account.invoicePostcode');
      case 'gstRegistered':
        return t('account.gstRegistered');
      default:
        return field;
    }
  };

  const formatFieldValue = (val: unknown) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : 'None';
    return String(val);
  };

  return (
    <section className="clox-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-clox-ink">
            {t('account.activityTitle')}
          </h3>
          <p className="mt-1 text-xs text-clox-mute">{t('account.activitySubtitle')}</p>
        </div>
        {history && history.length > 0 ? (
          <span className="rounded-full bg-clox-surface px-2.5 py-0.5 text-xs font-medium text-clox-mute border border-clox-line">
            {history.length} {history.length === 1 ? 'event' : 'events'}
          </span>
        ) : null}
      </div>

      {!history || history.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-clox-line p-6 text-center">
          <p className="text-sm font-medium text-clox-ink">{t('account.activityEmpty')}</p>
          <p className="mt-1 text-xs text-clox-faint">{t('account.activityEmptyHint')}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {history.map((item) => {
            const isChangeRequest = item.category === 'PROFILE_CHANGE_REQUEST';
            const isApproved = item.status === 'APPROVED';
            const isRejected = item.status === 'REJECTED';
            const isUnderReview =
              item.status === 'OPEN' ||
              item.status === 'INFO_REQUESTED' ||
              item.status === 'ESCALATED';

            let pillTone: StatusPillTone = 'neutral';
            let pillLabel = item.status;
            if (isApproved || item.status === 'APPLIED') {
              pillTone = 'ok';
              pillLabel = isChangeRequest
                ? t('account.requestStatusApproved')
                : t('account.requestStatusDirect');
            } else if (isRejected) {
              pillTone = 'danger';
              pillLabel = t('account.requestStatusRejected');
            } else if (isUnderReview) {
              pillTone = 'warn';
              pillLabel = t('account.requestStatusUnderReview');
            }

            const changes = (item.proposedChanges ?? {}) as Record<string, unknown>;
            const changeKeys = Object.keys(changes);

            return (
              <li
                key={item.id}
                className="rounded-lg border border-clox-line bg-clox-surface/40 p-4 transition-colors hover:bg-clox-surface/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clox-line/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-clox-ink">
                      {isChangeRequest
                        ? t('account.categoryChangeRequest')
                        : t('account.categorySelfUpdate')}
                    </span>
                    <StatusPill tone={pillTone}>{pillLabel}</StatusPill>
                  </div>
                  <span className="text-xs text-clox-faint">
                    {t('account.requestedOn', {
                      date: new Date(item.createdAt).toLocaleString(),
                    })}
                  </span>
                </div>

                {changeKeys.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {changeKeys.map((k) => (
                      <div
                        key={k}
                        className="rounded border border-clox-line/50 bg-white/60 p-2 text-xs"
                      >
                        <span className="font-medium text-clox-mute">
                          {formatFieldLabel(k)}:
                        </span>{' '}
                        <span className="font-medium text-clox-ink font-mono">
                          {formatFieldValue(changes[k])}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {item.note ? (
                  <p className="mt-2.5 rounded bg-clox-surface p-2 text-xs text-clox-ink">
                    <span className="font-semibold text-clox-mute">
                      {isRejected || isApproved
                        ? t('account.opsFeedback')
                        : t('account.yourNote')}
                      :
                    </span>{' '}
                    {item.note}
                  </p>
                ) : null}

                {item.decidedAt && (isApproved || isRejected) ? (
                  <p className="mt-2 text-[11px] text-clox-faint">
                    {t('account.decidedOn', {
                      date: new Date(item.decidedAt).toLocaleString(),
                    })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
      <p className="mt-1 text-xs text-clox-mute">{t('account.activeSessionsHint')}</p>
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
                <div className="flex items-center gap-2">
                  <p className="font-medium text-clox-ink">
                    {s.deviceLabel || t('account.session')}
                  </p>
                  {s.isCurrent ? (
                    <StatusPill tone="ok" className="text-[11px] py-0">
                      {t('account.current')}
                    </StatusPill>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-clox-faint">
                  {s.createdAt ? (
                    <span>
                      {t('account.sessionLoggedIn', {
                        date: new Date(s.createdAt).toLocaleString(),
                      })}
                    </span>
                  ) : null}
                  <span>
                    {t('account.lastUsed', { date: new Date(s.lastUsedAt).toLocaleString() })}
                  </span>
                </div>
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
