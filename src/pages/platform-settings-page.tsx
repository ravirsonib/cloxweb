import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import {
  getErrorDetail,
  getPlatformSettings,
  getRevenueSplitSettings,
  listOpsGeography,
  patchPlatformSettings,
  publishRevenueSplit,
  updateRegionEnabled,
} from '@/lib/api';
import { Button, Field, Notice, useToast } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { RevenueSplitBar } from '@/components/revenue-split-bar';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

export function PlatformSettingsPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();

  const settings = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: ({ signal }) => getPlatformSettings({ signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  const revenueSplit = useQuery({
    queryKey: ['admin', 'revenue-split'],
    queryFn: ({ signal }) => getRevenueSplitSettings({ signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  const geography = useQuery({
    queryKey: ['ops', 'geography'],
    queryFn: () => listOpsGeography(),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  const toggleRegionMut = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) =>
      updateRegionEnabled(code, enabled),
    onSuccess: async (data) => {
      toast.success(
        t('platformSettings.regionToggleSuccess', {
          code: data.code,
          status: data.enabled
            ? t('platformSettings.regionActive', { defaultValue: 'Active' })
            : t('platformSettings.regionInactive', { defaultValue: 'Inactive' }),
          defaultValue: `Region ${data.code} is now ${data.enabled ? 'Active' : 'Inactive'}.`,
        }),
      );
      await qc.invalidateQueries({ queryKey: ['ops', 'geography'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const [discount, setDiscount] = useState('10');
  const [slaMinutes, setSlaMinutes] = useState('5');
  const [driverDelta, setDriverDelta] = useState('5');
  const [carrierDelta, setCarrierDelta] = useState('10');
  const [clearingDays, setClearingDays] = useState('7');

  // Dynamic revenue split fields
  const [carrierShare, setCarrierShare] = useState('70');
  const [superShare, setSuperShare] = useState('15');
  const [stateShare, setStateShare] = useState('10');
  const [localShare, setLocalShare] = useState('5');

  useEffect(() => {
    if (!settings.data) return;
    setDiscount(String(settings.data.rescueDiscountPercent));
    setSlaMinutes(String(Math.round(settings.data.marketplaceRelistSlaMs / 60_000)));
    setDriverDelta(String(settings.data.driverUnavailableScoreDelta));
    setCarrierDelta(String(settings.data.carrierMarketplaceReleaseScoreDelta));
    setClearingDays(String(settings.data.carrierClearingDays ?? 7));
  }, [settings.data]);

  useEffect(() => {
    const p = revenueSplit.data?.effective.percents;
    if (!p) return;
    setCarrierShare(String(p.carrierPercent ?? 70));
    setSuperShare(String(p.superPercent ?? 15));
    setStateShare(String(p.statePercent ?? 10));
    setLocalShare(String(p.localPercent ?? 5));
  }, [revenueSplit.data]);

  const splitTotal = useMemo(() => {
    return (
      (Number(carrierShare) || 0) +
      (Number(superShare) || 0) +
      (Number(stateShare) || 0) +
      (Number(localShare) || 0)
    );
  }, [carrierShare, superShare, stateShare, localShare]);

  const save = useMutation({
    mutationFn: () => {
      const rescueDiscountPercent = Number(discount);
      const slaMin = Number(slaMinutes);
      const driverUnavailableScoreDelta = Number(driverDelta);
      const carrierMarketplaceReleaseScoreDelta = Number(carrierDelta);
      const carrierClearing = Number(clearingDays);
      if (
        !Number.isFinite(rescueDiscountPercent) ||
        !Number.isFinite(slaMin) ||
        !Number.isFinite(driverUnavailableScoreDelta) ||
        !Number.isFinite(carrierMarketplaceReleaseScoreDelta) ||
        !Number.isFinite(carrierClearing) ||
        carrierClearing < 0
      ) {
        throw new Error(t('platformSettings.invalid'));
      }
      return patchPlatformSettings({
        rescueDiscountPercent: Math.round(rescueDiscountPercent),
        marketplaceRelistSlaMs: Math.round(slaMin * 60_000),
        driverUnavailableScoreDelta: Math.round(driverUnavailableScoreDelta),
        carrierMarketplaceReleaseScoreDelta: Math.round(carrierMarketplaceReleaseScoreDelta),
        carrierClearingDays: Math.round(carrierClearing),
      });
    },
    onSuccess: async () => {
      toast.success(t('platformSettings.saveSuccess'));
      await qc.invalidateQueries({ queryKey: ['admin', 'platform-settings'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const publishSplitMut = useMutation({
    mutationFn: () => {
      if (splitTotal !== 100) {
        throw new Error(t('platformSettings.splitSumError', { sum: splitTotal }));
      }
      return publishRevenueSplit({
        carrierPercent: Math.round(Number(carrierShare)),
        superPercent: Math.round(Number(superShare)),
        statePercent: Math.round(Number(stateShare)),
        localPercent: Math.round(Number(localShare)),
        notes: 'Updated from Platform Settings',
      });
    },
    onSuccess: async () => {
      toast.success(t('platformSettings.saveSplitSuccess'));
      await qc.invalidateQueries({ queryKey: ['admin', 'revenue-split'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;
  if (settings.isLoading || revenueSplit.isLoading) {
    return <LoadingBlock label={t('platformSettings.loading')} />;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-clox-ink">
          {t('platformSettings.title')}
        </h1>
        <p className="mt-2 text-sm text-clox-mute">{t('platformSettings.subtitle')}</p>
      </div>

      {settings.isError ? (
        <Notice tone="error">
          {getErrorDetail(settings.error)}
        </Notice>
      ) : null}

      {/* ─── 1. Carrier Share & Revenue Distribution Card ─── */}
      <section className="clox-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clox-border pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-clox-ink">
              {t('platformSettings.revenueSplitCardTitle')}
            </h2>
            <p className="text-xs text-clox-mute">
              {t('platformSettings.revenueSplitCardSubtitle')}
            </p>
          </div>
          <Link
            to="/revenue-split"
            className="text-xs font-medium text-clox-orange hover:underline"
          >
            {t('platformSettings.viewAuditHistory')} &rarr;
          </Link>
        </div>

        {/* 100% Revenue Split Bar */}
        <RevenueSplitBar
          carrier={Number(carrierShare) || 0}
          superAdmin={Number(superShare) || 0}
          stateMaster={Number(stateShare) || 0}
          localBde={Number(localShare) || 0}
          showCards={true}
        />

        <div className="grid gap-3 sm:grid-cols-4 pt-2">
          <Field
            label={t('platformSettings.carrierShare', { defaultValue: 'Carrier Share %' })}
            value={carrierShare}
            onChange={(e) => setCarrierShare(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('platformSettings.superShare', { defaultValue: 'Super Admin %' })}
            value={superShare}
            onChange={(e) => setSuperShare(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('platformSettings.stateShare', { defaultValue: 'State Master %' })}
            value={stateShare}
            onChange={(e) => setStateShare(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('platformSettings.localShare', { defaultValue: 'Local BDE %' })}
            value={localShare}
            onChange={(e) => setLocalShare(e.target.value)}
            inputMode="numeric"
            required
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p
            className={
              splitTotal === 100
                ? 'text-xs font-medium text-emerald-600 dark:text-emerald-400'
                : 'text-xs font-semibold text-[var(--status-danger)]'
            }
          >
            {t('revenueSplit.poolSum', { sum: splitTotal })}
          </p>

          <Button
            type="button"
            variant="cta"
            disabled={publishSplitMut.isPending || splitTotal !== 100}
            onClick={() => publishSplitMut.mutate()}
          >
            {publishSplitMut.isPending ? t('loading') : t('platformSettings.saveSplit')}
          </Button>
        </div>
      </section>

      {/* ─── 2. Operational & Reliability Parameters Card ─── */}
      <form
        className="clox-card space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        noValidate
      >
        <h2 className="font-display text-base font-semibold text-clox-ink border-b border-clox-border pb-3">
          {t('platformSettings.title')}
        </h2>

        <Field
          label={t('platformSettings.discountLabel')}
          hint={t('platformSettings.discountHint')}
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          inputMode="numeric"
          required
        />
        <Field
          label={t('platformSettings.slaLabel')}
          hint={t('platformSettings.slaHint')}
          value={slaMinutes}
          onChange={(e) => setSlaMinutes(e.target.value)}
          inputMode="numeric"
          required
        />
        <Field
          label={t('platformSettings.driverDeltaLabel')}
          hint={t('platformSettings.driverDeltaHint')}
          value={driverDelta}
          onChange={(e) => setDriverDelta(e.target.value)}
          inputMode="numeric"
          required
        />
        <Field
          label={t('platformSettings.carrierDeltaLabel')}
          hint={t('platformSettings.carrierDeltaHint')}
          value={carrierDelta}
          onChange={(e) => setCarrierDelta(e.target.value)}
          inputMode="numeric"
          required
        />
        <Field
          label={t('platformSettings.clearingDaysLabel', { defaultValue: 'Carrier Clearing Pipeline (Days)' })}
          hint={t('platformSettings.clearingDaysHint', {
            defaultValue: 'Hold period before completed trip freight clears for automatic bank payout (0 = instant settlement upon POD).',
          })}
          value={clearingDays}
          onChange={(e) => setClearingDays(e.target.value)}
          inputMode="numeric"
          required
        />
        {save.isError ? <Notice tone="error">{getErrorDetail(save.error)}</Notice> : null}
        <Button type="submit" variant="cta" disabled={save.isPending}>
          {save.isPending ? t('loading') : t('platformSettings.save')}
        </Button>
      </form>

      {/* ─── 3. Service Regions & Coverage Card ─── */}
      <section className="clox-card space-y-4 p-5">
        <div className="border-b border-clox-border pb-3">
          <h2 className="font-display text-base font-semibold text-clox-ink">
            {t('platformSettings.regionsTitle', {
              defaultValue: 'Service Regions & Coverage (Australia)',
            })}
          </h2>
          <p className="text-xs text-clox-mute">
            {t('platformSettings.regionsSubtitle', {
              defaultValue:
                'Enable or disable Australian states and territories for marketplace operations, carrier coverage, and job matching.',
            })}
          </p>
        </div>

        {geography.isLoading ? (
          <LoadingBlock label={t('loading')} />
        ) : geography.isError ? (
          <Notice tone="error">{getErrorDetail(geography.error)}</Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(geography.data?.regions ?? []).map((r) => {
              const isMutating =
                toggleRegionMut.isPending &&
                toggleRegionMut.variables?.code === r.code;
              return (
                <div
                  key={r.code}
                  className="flex items-center justify-between rounded-clox-md border border-clox-border/80 bg-clox-canvas/50 p-3 transition hover:border-clox-border"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-clox-ink">
                        {r.code}
                      </span>
                      <span className="truncate text-xs text-clox-mute">
                        {r.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          r.enabled ? 'bg-emerald-500' : 'bg-clox-faint/60'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-medium ${
                          r.enabled
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-clox-mute'
                        }`}
                      >
                        {r.enabled
                          ? t('platformSettings.regionActive', { defaultValue: 'Active' })
                          : t('platformSettings.regionInactive', { defaultValue: 'Inactive' })}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() =>
                      toggleRegionMut.mutate({ code: r.code, enabled: !r.enabled })
                    }
                    className={`rounded-clox-md px-3 py-1.5 text-xs font-semibold transition shadow-sm ${
                      r.enabled
                        ? 'border border-clox-border bg-clox-surface text-clox-ink hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/40'
                        : 'border border-clox-orange bg-clox-orange text-white hover:bg-clox-orange/90'
                    }`}
                  >
                    {isMutating
                      ? t('loading')
                      : r.enabled
                      ? t('platformSettings.disable', { defaultValue: 'Disable' })
                      : t('platformSettings.enable', { defaultValue: 'Enable' })}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
