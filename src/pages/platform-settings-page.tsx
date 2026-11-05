import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import {
  Building2,
  Calculator,
  Calendar,
  Clock,
  Landmark,
  Layers,
  MapPin,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import {
  getErrorDetail,
  getPlatformSettings,
  getRevenueSplitSettings,
  listOpsGeography,
  patchPlatformSettings,
  publishRevenueSplit,
  updateRegionEnabled,
} from '@/lib/api';
import { Button, Field, Notice, StatusPill, useConfirm, useToast } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { RevenueSplitBar } from '@/components/revenue-split-bar';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

export function PlatformSettingsPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

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

  // Operational thresholds
  const [discount, setDiscount] = useState('10');
  const [slaMinutes, setSlaMinutes] = useState('5');
  const [driverDelta, setDriverDelta] = useState('5');
  const [carrierDelta, setCarrierDelta] = useState('10');
  const [clearingDays, setClearingDays] = useState('7');
  const [gstRate, setGstRate] = useState('10');

  // Pricing model parameters (PER_KM vs HOURLY)
  const [perKmRateDollars, setPerKmRateDollars] = useState('2.50');
  const [perKmMinBaseDollars, setPerKmMinBaseDollars] = useState('50.00');
  const [hourlyRateDollars, setHourlyRateDollars] = useState('80.00');
  const [hourlyFloorHours, setHourlyFloorHours] = useState('4.0');
  const [hourlyMinBaseDollars, setHourlyMinBaseDollars] = useState('200.00');

  // Settlement cycle cadence & cutoff
  const [cadenceDays, setCadenceDays] = useState('14');
  const [cutoffHour, setCutoffHour] = useState('4');

  // State Master Tier governance toggle
  const [enableStateTier, setEnableStateTier] = useState<boolean>(false);

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
    setGstRate(String(settings.data.gstPercent ?? 10));

    if (settings.data.perKmRateCents != null) {
      setPerKmRateDollars((settings.data.perKmRateCents / 100).toFixed(2));
    }
    if (settings.data.perKmMinBaseCents != null) {
      setPerKmMinBaseDollars((settings.data.perKmMinBaseCents / 100).toFixed(2));
    }
    if (settings.data.hourlyRateCents != null) {
      setHourlyRateDollars((settings.data.hourlyRateCents / 100).toFixed(2));
    }
    if (settings.data.hourlyMinFloorHours != null) {
      setHourlyFloorHours(String(settings.data.hourlyMinFloorHours));
    }
    if (settings.data.hourlyMinBaseCents != null) {
      setHourlyMinBaseDollars((settings.data.hourlyMinBaseCents / 100).toFixed(2));
    }
    if (settings.data.settlementCycleCadenceDays != null) {
      setCadenceDays(String(settings.data.settlementCycleCadenceDays));
    }
    if (settings.data.settlementCutoffHour != null) {
      setCutoffHour(String(settings.data.settlementCutoffHour));
    }
    if (settings.data.enableStateMasterTier != null) {
      setEnableStateTier(Boolean(settings.data.enableStateMasterTier));
    }
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
      const gst = Number(gstRate);

      const perKmRate = Math.round(Number(perKmRateDollars) * 100);
      const perKmMinBase = Math.round(Number(perKmMinBaseDollars) * 100);
      const hourlyRate = Math.round(Number(hourlyRateDollars) * 100);
      const hourlyFloor = Number(hourlyFloorHours);
      const hourlyMinBase = Math.round(Number(hourlyMinBaseDollars) * 100);

      const cycleDays = Number(cadenceDays);
      const cycleCutoff = Number(cutoffHour);

      if (
        !Number.isFinite(rescueDiscountPercent) ||
        !Number.isFinite(slaMin) ||
        !Number.isFinite(driverUnavailableScoreDelta) ||
        !Number.isFinite(carrierMarketplaceReleaseScoreDelta) ||
        !Number.isFinite(carrierClearing) ||
        carrierClearing < 0 ||
        !Number.isFinite(gst) ||
        gst < 0 ||
        gst > 100 ||
        !Number.isFinite(perKmRate) ||
        perKmRate <= 0 ||
        !Number.isFinite(perKmMinBase) ||
        perKmMinBase < 0 ||
        !Number.isFinite(hourlyRate) ||
        hourlyRate <= 0 ||
        !Number.isFinite(hourlyFloor) ||
        hourlyFloor < 0.5 ||
        !Number.isFinite(hourlyMinBase) ||
        hourlyMinBase < 0 ||
        !Number.isFinite(cycleDays) ||
        cycleDays < 1 ||
        cycleDays > 90 ||
        !Number.isFinite(cycleCutoff) ||
        cycleCutoff < 0 ||
        cycleCutoff > 23
      ) {
        throw new Error(
          t('platformSettings.invalid', {
            defaultValue: 'Please enter valid numbers, pricing rates, and settlement schedule.',
          }),
        );
      }
      return patchPlatformSettings({
        rescueDiscountPercent: Math.round(rescueDiscountPercent),
        marketplaceRelistSlaMs: Math.round(slaMin * 60_000),
        driverUnavailableScoreDelta: Math.round(driverUnavailableScoreDelta),
        carrierMarketplaceReleaseScoreDelta: Math.round(carrierMarketplaceReleaseScoreDelta),
        carrierClearingDays: Math.round(carrierClearing),
        gstPercent: gst,
        perKmRateCents: perKmRate,
        perKmMinBaseCents: perKmMinBase,
        hourlyRateCents: hourlyRate,
        hourlyMinFloorHours: hourlyFloor,
        hourlyMinBaseCents: hourlyMinBase,
        settlementCycleCadenceDays: Math.round(cycleDays),
        settlementCutoffHour: Math.round(cycleCutoff),
        enableStateMasterTier: enableStateTier,
      });
    },
    onSuccess: async () => {
      toast.success(t('platformSettings.saveSuccess'));
      await qc.invalidateQueries({ queryKey: ['admin', 'platform-settings'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const toggleStateTierMut = useMutation({
    mutationFn: (enabled: boolean) => patchPlatformSettings({ enableStateMasterTier: enabled }),
    onSuccess: async (data) => {
      setEnableStateTier(Boolean(data.enableStateMasterTier));
      toast.success(
        data.enableStateMasterTier
          ? t('platformSettings.stateTierEnabledToast', {
              defaultValue: 'State Master Tier enabled. 3-tier franchise governance active.',
            })
          : t('platformSettings.stateTierDisabledToast', {
              defaultValue: 'State Master Tier disabled. 10% State split routed to Super Admin (HQ Holding). Direct 2-tier governance active.',
            }),
      );
      await qc.invalidateQueries({ queryKey: ['admin', 'platform-settings'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const handleToggleStateTier = async () => {
    const nextVal = !enableStateTier;
    const ok = await confirm({
      title: nextVal
        ? t('platformSettings.confirmEnableStateTierTitle', {
            defaultValue: 'Enable State Master Franchise Tier?',
          })
        : t('platformSettings.confirmDisableStateTierTitle', {
            defaultValue: 'Disable State Master Tier (Direct HQ Mode)?',
          }),
      description: nextVal
        ? t('platformSettings.confirmEnableStateTierDesc', {
            defaultValue:
              'Enabling the State Master tier activates the 3-tier franchise model. Active State Masters will receive their designated 10% commission on origin freight, and Local BDEs will escalate disputes to State Masters before Super Admin.',
          })
        : t('platformSettings.confirmDisableStateTierDesc', {
            defaultValue:
              'Disabling the State Master tier transitions the platform to a Direct 2-Tier governance model. The 10% State revenue split will automatically route directly to CLOX / Super Admin (HQ Holding). All Local BDE dispute escalations will bypass the State queue and go directly to Super Admin.',
          }),
      confirmLabel: nextVal
        ? t('platformSettings.enableStateTierAction', { defaultValue: 'Enable State Tier' })
        : t('platformSettings.disableStateTierAction', { defaultValue: 'Disable State Tier' }),
      cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
      tone: nextVal ? 'default' : 'destructive',
    });
    if (!ok) return;
    toggleStateTierMut.mutate(nextVal);
  };

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

  const handlePublishSplit = async () => {
    if (splitTotal !== 100) return;
    const ok = await confirm({
      title: t('platformSettings.confirmPublishSplitTitle', {
        defaultValue: 'Publish Revenue Split Policy?',
      }),
      description: t('platformSettings.confirmPublishSplitDesc', {
        defaultValue: `This will update the national revenue distribution policy to Carrier: ${carrierShare}%, Super Admin: ${superShare}%, State Master: ${stateShare}%, and Local BDE: ${localShare}%. Future settlement accruals will apply this split.`,
      }),
      confirmLabel: t('platformSettings.confirmPublishSplitAction', {
        defaultValue: 'Publish Split Policy',
      }),
      cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
      tone: 'default',
    });
    if (!ok) return;
    publishSplitMut.mutate();
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await confirm({
      title: t('platformSettings.confirmSaveTitle', {
        defaultValue: 'Save Platform Configuration?',
      }),
      description: t('platformSettings.confirmSaveDesc', {
        defaultValue:
          'This will update marketplace operational SLA thresholds, freight quoting base rates (PER_KM and HOURLY), and the automated settlement disbursement schedule.',
      }),
      confirmLabel: t('platformSettings.confirmSaveAction', {
        defaultValue: 'Save Configuration',
      }),
      cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
      tone: 'default',
    });
    if (!ok) return;
    save.mutate();
  };

  const handlePresetCadence = async (label: string, val: string) => {
    if (cadenceDays === val) return;
    const ok = await confirm({
      title: t('platformSettings.confirmPresetTitle', {
        label,
        defaultValue: `Apply ${label} Cadence Preset?`,
      }),
      description: t('platformSettings.confirmPresetDesc', {
        val,
        defaultValue: `This will set the settlement cycle window to ${val} days in the form. You must click "Save Platform Configuration" to apply the change.`,
      }),
      confirmLabel: t('platformSettings.confirmPresetAction', {
        defaultValue: 'Apply Preset',
      }),
      cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
      tone: 'default',
    });
    if (!ok) return;
    setCadenceDays(val);
  };

  const handleToggleRegion = async (code: string, name: string, enabled: boolean) => {
    const actionLabel = enabled
      ? t('platformSettings.disable', { defaultValue: 'Disable' })
      : t('platformSettings.enable', { defaultValue: 'Enable' });
    const ok = await confirm({
      title: enabled
        ? t('platformSettings.confirmDisableRegionTitle', {
            code,
            name,
            defaultValue: `Disable Region ${code} (${name})?`,
          })
        : t('platformSettings.confirmEnableRegionTitle', {
            code,
            name,
            defaultValue: `Enable Region ${code} (${name})?`,
          }),
      description: enabled
        ? t('platformSettings.confirmDisableRegionDesc', {
            code,
            name,
            defaultValue: `Disabling ${code} (${name}) will suspend new freight bookings originating or terminating in this state and pause carrier dispatch for this region.`,
          })
        : t('platformSettings.confirmEnableRegionDesc', {
            code,
            name,
            defaultValue: `Enabling ${code} (${name}) will allow shippers to post jobs and carriers to receive dispatch offers across this state.`,
          }),
      confirmLabel: actionLabel,
      cancelLabel: t('cancel', { defaultValue: 'Cancel' }),
      tone: enabled ? 'destructive' : 'default',
    });
    if (!ok) return;
    toggleRegionMut.mutate({ code, enabled: !enabled });
  };

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;
  if (settings.isLoading || revenueSplit.isLoading) {
    return <LoadingBlock label={t('platformSettings.loading')} />;
  }

  return (
    <div className="max-w-5xl space-y-8 pb-12">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-clox-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-clox-md bg-clox-orange/10 text-clox-orange">
              <Sliders className="h-5 w-5" />
            </span>
            <h1 className="font-display text-2xl font-bold text-clox-ink">
              {t('platformSettings.title', { defaultValue: 'Platform Settings' })}
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-clox-mute">
            {t('platformSettings.subtitle', {
              defaultValue:
                'Global operational policies, dynamic revenue distribution, freight pricing models, and regional coverage.',
            })}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-clox-border bg-clox-surface px-3 py-1.5 text-xs font-semibold text-clox-ink shadow-sm">
          <ShieldCheck className="h-4 w-4 text-[var(--status-ok)]" />
          <span>
            {t('platformSettings.superAdminPolicyBadge', { defaultValue: 'Super Admin Policy' })}
          </span>
        </div>
      </div>

      {settings.isError ? (
        <Notice tone="error">{getErrorDetail(settings.error)}</Notice>
      ) : null}

      {/* ─── 1. Carrier Share & Revenue Distribution Card ─── */}
      <section className="clox-card space-y-5 p-6 shadow-clox-1">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clox-border pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-clox-ink">
              {t('platformSettings.revenueSplitCardTitle', {
                defaultValue: 'Carrier Share & Revenue Distribution',
              })}
            </h2>
            <p className="text-xs text-clox-mute">
              {t('platformSettings.revenueSplitCardSubtitle', {
                defaultValue: 'Configure dynamic carrier share and platform administrative revenue splits.',
              })}
            </p>
          </div>
          <Link
            to="/revenue-split"
            className="text-xs font-semibold text-clox-orange hover:underline"
          >
            {t('platformSettings.viewAuditHistory', { defaultValue: 'View Full Split Version History' })} &rarr;
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          <Field
            label={t('platformSettings.carrierShare', { defaultValue: 'Carrier Share %' })}
            hint={t('platformSettings.carrierShareHint', { defaultValue: 'Net carrier payout' })}
            value={carrierShare}
            onChange={(e) => setCarrierShare(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('platformSettings.superShare', { defaultValue: 'Super Admin %' })}
            hint={t('platformSettings.superShareHint', { defaultValue: 'Platform HQ holding' })}
            value={superShare}
            onChange={(e) => setSuperShare(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('platformSettings.stateShare', { defaultValue: 'State Master %' })}
            hint={t('platformSettings.stateShareHint', { defaultValue: 'State franchise commission' })}
            value={stateShare}
            onChange={(e) => setStateShare(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('platformSettings.localShare', { defaultValue: 'Local BDE %' })}
            hint={t('platformSettings.localShareHint', { defaultValue: 'Local territory commission' })}
            value={localShare}
            onChange={(e) => setLocalShare(e.target.value)}
            inputMode="numeric"
            required
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-clox-border-soft pt-3">
          <div className="flex items-center gap-2">
            <StatusPill
              tone={splitTotal === 100 ? 'ok' : 'danger'}
              className="text-xs px-3 py-1 font-semibold"
            >
              {t('revenueSplit.poolSum', {
                sum: splitTotal,
                defaultValue: `Total split sum: ${splitTotal} / 100%`,
              })}
            </StatusPill>
          </div>

          <Button
            type="button"
            variant="cta"
            disabled={publishSplitMut.isPending || splitTotal !== 100}
            onClick={handlePublishSplit}
          >
            {publishSplitMut.isPending ? t('loading') : t('platformSettings.saveSplit', { defaultValue: 'Publish Split Policy' })}
          </Button>
        </div>
      </section>

      {/* ─── 2. State Master Tier Governance & Revenue Routing Card ─── */}
      <section className="clox-card space-y-5 p-6 shadow-clox-1">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-clox-border pb-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clox-md bg-clox-orange/10 text-clox-orange">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-semibold text-clox-ink">
                  {t('platformSettings.stateTierCardTitle', {
                    defaultValue: 'State Master Tier Governance & Revenue Routing',
                  })}
                </h2>
                <StatusPill tone={enableStateTier ? 'ok' : 'neutral'}>
                  {enableStateTier
                    ? t('platformSettings.stateTierActivePill', { defaultValue: 'Active (3-Tier Franchise)' })
                    : t('platformSettings.stateTierDisabledPill', { defaultValue: 'Disabled (Direct 2-Tier HQ)' })}
                </StatusPill>
              </div>
              <p className="mt-0.5 text-xs text-clox-mute">
                {t('platformSettings.stateTierCardSubtitle', {
                  defaultValue:
                    'Toggle State Master franchise participation. When disabled, State share routes to Super Admin and dispute escalations bypass State directly to Super Admin.',
                })}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant={enableStateTier ? 'destructive' : 'primary'}
            disabled={toggleStateTierMut.isPending}
            onClick={handleToggleStateTier}
          >
            {toggleStateTierMut.isPending
              ? t('loading')
              : enableStateTier
              ? t('platformSettings.disableStateTierBtn', { defaultValue: 'Disable State Master Tier' })
              : t('platformSettings.enableStateTierBtn', { defaultValue: 'Enable State Master Tier' })}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 pt-1 text-xs">
          <div className="rounded-clox-md border border-clox-border bg-clox-surface-subtle p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-clox-ink">
              <Landmark className="h-4 w-4 text-clox-orange" />
              <span>{t('platformSettings.revenueRoutingTitle', { defaultValue: 'Revenue Commission Routing (10%)' })}</span>
            </div>
            <p className="text-clox-mute leading-relaxed">
              {enableStateTier
                ? t('platformSettings.revenueRoutingActiveDesc', {
                    defaultValue:
                      'Origin 10% commission is allocated to the active State Master seat assigned to the pickup state/region.',
                  })
                : t('platformSettings.revenueRoutingDisabledDesc', {
                    defaultValue:
                      'State Master tier is disabled. The 10% state commission automatically routes directly to CLOX / Super Admin (HQ Holding).',
                  })}
            </p>
          </div>

          <div className="rounded-clox-md border border-clox-border bg-clox-surface-subtle p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-clox-ink">
              <Layers className="h-4 w-4 text-clox-orange" />
              <span>{t('platformSettings.disputeRoutingTitle', { defaultValue: 'Dispute Adjudication Workflow' })}</span>
            </div>
            <p className="text-clox-mute leading-relaxed">
              {enableStateTier
                ? t('platformSettings.disputeRoutingActiveDesc', {
                    defaultValue:
                      'Standard 3-tier escalation: Local BDE triages locally, escalates to State Master, who may rule or escalate to Super Admin.',
                  })
                : t('platformSettings.disputeRoutingDisabledDesc', {
                    defaultValue:
                      'Direct 2-tier escalation: Local BDE triages locally. All escalations bypass State Master and report directly to Super Admin for binding resolution.',
                  })}
            </p>
          </div>
        </div>
      </section>

      {/* ─── 3. Operational & Platform Parameters Form ─── */}
      <form
        className="space-y-6"
        onSubmit={handleSaveSettings}
        noValidate
      >
        {/* ─── Part A: Operational Thresholds & Marketplace SLA ─── */}
        <section className="clox-card space-y-5 p-6 shadow-clox-1">
          <div className="border-b border-clox-border pb-3">
            <h2 className="font-display text-base font-semibold text-clox-ink">
              {t('platformSettings.operationalCardTitle', {
                defaultValue: 'Operational Thresholds & Marketplace SLA',
              })}
            </h2>
            <p className="text-xs text-clox-mute">
              {t('platformSettings.operationalCardSubtitle', {
                defaultValue:
                  'Configure dispatch timers, reliability score impacts, holding windows, and tax rates.',
              })}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label={t('platformSettings.discountLabel', { defaultValue: 'Rescue Discount %' })}
              hint={t('platformSettings.discountHint', {
                defaultValue: 'Applied to carrier bid floor on re-listed jobs (0–50). Customer price unchanged.',
              })}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              inputMode="numeric"
              required
            />
            <Field
              label={t('platformSettings.slaLabel', { defaultValue: 'Marketplace Re-list SLA (min)' })}
              hint={t('platformSettings.slaHint', {
                defaultValue: 'Auto re-list pre-trip exceptions still awaiting carrier after this time.',
              })}
              value={slaMinutes}
              onChange={(e) => setSlaMinutes(e.target.value)}
              inputMode="numeric"
              required
            />
            <Field
              label={t('platformSettings.driverDeltaLabel', { defaultValue: 'Driver Score Delta' })}
              hint={t('platformSettings.driverDeltaHint', {
                defaultValue: 'Points deducted when a driver opens DRIVER_UNAVAILABLE.',
              })}
              value={driverDelta}
              onChange={(e) => setDriverDelta(e.target.value)}
              inputMode="numeric"
              required
            />
            <Field
              label={t('platformSettings.carrierDeltaLabel', { defaultValue: 'Carrier Score Delta' })}
              hint={t('platformSettings.carrierDeltaHint', {
                defaultValue: 'Points deducted when a job is released back to marketplace.',
              })}
              value={carrierDelta}
              onChange={(e) => setCarrierDelta(e.target.value)}
              inputMode="numeric"
              required
            />
            <Field
              label={t('platformSettings.clearingDaysLabel', { defaultValue: 'Carrier Clearing Pipeline (Days)' })}
              hint={t('platformSettings.clearingDaysHint', {
                defaultValue: 'Hold period before completed trip freight clears for payout (0 = instant).',
              })}
              value={clearingDays}
              onChange={(e) => setClearingDays(e.target.value)}
              inputMode="numeric"
              required
            />
            <Field
              label={t('platformSettings.gstLabel', { defaultValue: 'GST Rate %' })}
              hint={t('platformSettings.gstHint', {
                defaultValue: 'Applicable Australian Goods & Services Tax percentage (default 10%).',
              })}
              value={gstRate}
              onChange={(e) => setGstRate(e.target.value)}
              inputMode="decimal"
              required
            />
          </div>
        </section>

        {/* ─── Part B: Freight Pricing Models & Base Rates ─── */}
        <section className="clox-card space-y-5 p-6 shadow-clox-1">
          <div className="border-b border-clox-border pb-3">
            <h2 className="font-display text-base font-semibold text-clox-ink">
              {t('platformSettings.pricingTitle', {
                defaultValue: 'Freight Pricing Models & Base Rates',
              })}
            </h2>
            <p className="text-xs text-clox-mute">
              {t('platformSettings.pricingSubtitle', {
                defaultValue:
                  'Baseline rate cards, trip minimum base fares, and billable hour floors for automatic marketplace quoting.',
              })}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Model 1: PER_KM (Distance-Based) */}
            <div className="flex flex-col justify-between rounded-clox-md border border-clox-border bg-clox-surface-alt/40 p-5 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-clox-border pb-2.5">
                  <span className="font-mono text-xs font-bold uppercase text-clox-orange">
                    {t('platformSettings.perKmBadge', { defaultValue: '1. Distance-Based (PER_KM)' })}
                  </span>
                  <span className="rounded bg-clox-surface px-2 py-0.5 text-[11px] font-medium text-clox-mute border border-clox-border-soft">
                    {t('platformSettings.perKmSubtitle', { defaultValue: 'Point-to-Point Freight' })}
                  </span>
                </div>

                <Field
                  label={t('platformSettings.perKmRateLabel', { defaultValue: 'Base Rate ($ AUD / km)' })}
                  hint={t('platformSettings.perKmRateHint', {
                    defaultValue: 'Rate per kilometre (e.g. 2.50 = $2.50/km inc GST).',
                  })}
                  value={perKmRateDollars}
                  onChange={(e) => setPerKmRateDollars(e.target.value)}
                  inputMode="decimal"
                  required
                />

                <Field
                  label={t('platformSettings.perKmMinBaseLabel', {
                    defaultValue: 'Minimum Trip Base Fare ($ AUD inc GST)',
                  })}
                  hint={t('platformSettings.perKmMinBaseHint', {
                    defaultValue: 'Minimum base fare floor applied to distance jobs (e.g. 50.00 = $50.00).',
                  })}
                  value={perKmMinBaseDollars}
                  onChange={(e) => setPerKmMinBaseDollars(e.target.value)}
                  inputMode="decimal"
                  required
                />
              </div>

              {/* High-Contrast Theme-Safe Formula Box */}
              <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4 text-xs text-clox-ink shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-clox-ink">
                  <Calculator className="h-4 w-4 text-clox-orange" />
                  <span>{t('platformSettings.pricingFormulaLabel', { defaultValue: 'Pricing Formula:' })}</span>
                </div>
                <div className="rounded border border-clox-border-soft bg-clox-surface-alt px-3 py-2 font-mono text-[11.5px] text-clox-ink break-all">
                  Estimate = max(${perKmMinBaseDollars || '50.00'}, Distance (km) × ${perKmRateDollars || '2.50'})
                </div>
                <p className="text-[11px] text-clox-mute">
                  {t('platformSettings.perKmFormulaDesc', {
                    defaultValue:
                      'Standard distance formula applied from pickup to drop-off, protected by the trip base fare floor.',
                  })}
                </p>
              </div>
            </div>

            {/* Model 2: HOURLY (Time-Based) */}
            <div className="flex flex-col justify-between rounded-clox-md border border-clox-border bg-clox-surface-alt/40 p-5 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-clox-border pb-2.5">
                  <span className="font-mono text-xs font-bold uppercase text-clox-orange">
                    {t('platformSettings.hourlyBadge', { defaultValue: '2. Time-Based (HOURLY)' })}
                  </span>
                  <span className="rounded bg-clox-surface px-2 py-0.5 text-[11px] font-medium text-clox-mute border border-clox-border-soft">
                    {t('platformSettings.hourlySubtitle', { defaultValue: 'Multi-Stop (up to 4 stops)' })}
                  </span>
                </div>

                <Field
                  label={t('platformSettings.hourlyRateLabel', { defaultValue: 'Hourly Rate ($ AUD / hr)' })}
                  hint={t('platformSettings.hourlyRateHint', {
                    defaultValue: 'Base rate per billable hour (e.g. 80.00 = $80.00/hr inc GST).',
                  })}
                  value={hourlyRateDollars}
                  onChange={(e) => setHourlyRateDollars(e.target.value)}
                  inputMode="decimal"
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label={t('platformSettings.hourlyFloorHoursLabel', { defaultValue: 'Floor Hours' })}
                    hint={t('platformSettings.hourlyFloorHoursHint', { defaultValue: 'Min billable hours (e.g. 4.0).' })}
                    value={hourlyFloorHours}
                    onChange={(e) => setHourlyFloorHours(e.target.value)}
                    inputMode="decimal"
                    required
                  />
                  <Field
                    label={t('platformSettings.hourlyMinBaseLabel', { defaultValue: 'Platform Min Floor ($)' })}
                    hint={t('platformSettings.hourlyMinBaseHint', { defaultValue: 'Absolute floor ($200.00).' })}
                    value={hourlyMinBaseDollars}
                    onChange={(e) => setHourlyMinBaseDollars(e.target.value)}
                    inputMode="decimal"
                    required
                  />
                </div>
              </div>

              {/* High-Contrast Theme-Safe Formula Box */}
              <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4 text-xs text-clox-ink shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-clox-ink">
                  <Clock className="h-4 w-4 text-clox-orange" />
                  <span>{t('platformSettings.minBaseChargeLabel', { defaultValue: 'Minimum Base Charge:' })}</span>
                </div>
                <div className="rounded border border-clox-border-soft bg-clox-surface-alt px-3 py-2 font-mono text-[11.5px] text-clox-ink break-all">
                  {hourlyFloorHours || '4.0'} hrs × ${hourlyRateDollars || '80.00'} = $
                  {(
                    (Number(hourlyFloorHours) || 4) *
                    (Number(hourlyRateDollars) || 80)
                  ).toFixed(2)}{' '}
                  AUD ({t('platformSettings.platformFloor', { defaultValue: 'Platform Floor' })}: ${hourlyMinBaseDollars || '200.00'})
                </div>
                <p className="text-[11px] text-clox-mute">
                  {t('platformSettings.hourlyFormulaDesc', {
                    defaultValue:
                      'Applied across scheduled duration or minimum hours floor for multi-stop freight bookings.',
                  })}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Part C: Settlement Cycle & Payout Schedule ─── */}
        <section className="clox-card space-y-5 p-6 shadow-clox-1">
          <div className="border-b border-clox-border pb-3">
            <h2 className="font-display text-base font-semibold text-clox-ink">
              {t('platformSettings.settlementCycleTitle', {
                defaultValue: 'Settlement Cycle & Payout Schedule',
              })}
            </h2>
            <p className="text-xs text-clox-mute">
              {t('platformSettings.settlementCycleSubtitle', {
                defaultValue:
                  'Rolling settlement cadence and autonomous disbursement sweep hour for carrier and partner net payouts.',
              })}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Field
                label={t('platformSettings.cadenceLabel', { defaultValue: 'Cycle Cadence (Days)' })}
                hint={t('platformSettings.cadenceHint', {
                  defaultValue: 'Common presets: 7 (Weekly), 14 (Fortnightly), 30 (Monthly).',
                })}
                value={cadenceDays}
                onChange={(e) => setCadenceDays(e.target.value)}
                inputMode="numeric"
                required
              />
              <div className="mt-2 flex items-center gap-2">
                {[
                  {
                    label: t('platformSettings.presetWeekly', { defaultValue: 'Weekly (7d)' }),
                    val: '7',
                  },
                  {
                    label: t('platformSettings.presetFortnightly', { defaultValue: 'Fortnightly (14d)' }),
                    val: '14',
                  },
                  {
                    label: t('platformSettings.presetMonthly', { defaultValue: 'Monthly (30d)' }),
                    val: '30',
                  },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => handlePresetCadence(preset.label, preset.val)}
                    className={`rounded-clox-sm px-3 py-1.5 text-xs font-semibold transition ${
                      cadenceDays === preset.val
                        ? 'bg-clox-orange text-white shadow-sm'
                        : 'border border-clox-border bg-clox-surface text-clox-mute hover:border-clox-mute hover:text-clox-ink'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <Field
              label={t('platformSettings.cutoffHourLabel', {
                defaultValue: 'Automated Cutoff Hour (0–23 AEST)',
              })}
              hint={t('platformSettings.cutoffHourHint', {
                defaultValue:
                  'Hour of day when autonomous watchdog triggers automated payout run (e.g. 4 = 4:00 AM AEST).',
              })}
              value={cutoffHour}
              onChange={(e) => setCutoffHour(e.target.value)}
              inputMode="numeric"
              required
            />
          </div>

          {/* High-Contrast Policy Callout Box */}
          <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4 text-xs text-clox-ink shadow-sm space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-clox-ink">
              <Calendar className="h-4 w-4 text-clox-orange" />
              <span>
                {t('platformSettings.activeWatchdogPolicyLabel', {
                  defaultValue: 'Active Settlement Watchdog Policy:',
                })}
              </span>
            </div>
            <p className="text-[11.5px] text-clox-mute">
              {t('platformSettings.activeWatchdogPolicyDesc', {
                cadence: cadenceDays,
                cutoff: cutoffHour,
                defaultValue: `Rolling ${cadenceDays}-day settlement window. Automated autonomous disbursement sweep executes at ${cutoffHour}:00 AM AEST on the scheduled settlement cycle close date.`,
              })}
            </p>
          </div>
        </section>

        {/* ─── Form Submission Action Bar ─── */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-clox-md border border-clox-border bg-clox-surface p-4 shadow-sm">
          {save.isError ? (
            <Notice tone="error">{getErrorDetail(save.error)}</Notice>
          ) : (
            <p className="text-xs text-clox-mute">
              {t('platformSettings.saveBannerHint', {
                defaultValue:
                  'Changes take effect immediately across all newly created bookings and settlement cycles.',
              })}
            </p>
          )}

          <Button type="submit" variant="cta" disabled={save.isPending} className="px-6 py-2.5">
            {save.isPending
              ? t('loading')
              : t('platformSettings.saveAllSettings', { defaultValue: 'Save Platform Configuration' })}
          </Button>
        </div>
      </form>

      {/* ─── 3. Service Regions & Coverage Card ─── */}
      <section className="clox-card space-y-5 p-6 shadow-clox-1">
        <div className="border-b border-clox-border pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-clox-orange" />
            <h2 className="font-display text-base font-semibold text-clox-ink">
              {t('platformSettings.regionsTitle', {
                defaultValue: 'Service Regions & Marketplace Coverage (Australia)',
              })}
            </h2>
          </div>
          <p className="mt-1 text-xs text-clox-mute">
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
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {(geography.data?.regions ?? []).map((r) => {
              const isMutating =
                toggleRegionMut.isPending &&
                toggleRegionMut.variables?.code === r.code;
              return (
                <div
                  key={r.code}
                  className="flex flex-col justify-between rounded-clox-md border border-clox-border bg-clox-surface p-4 transition hover:border-clox-border-soft hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-base font-bold text-clox-ink">
                        {r.code}
                      </span>
                      <StatusPill tone={r.enabled ? 'ok' : 'neutral'}>
                        {r.enabled
                          ? t('platformSettings.regionActive', { defaultValue: 'Active' })
                          : t('platformSettings.regionInactive', { defaultValue: 'Inactive' })}
                      </StatusPill>
                    </div>
                    <p className="mt-1.5 truncate text-xs font-medium text-clox-mute" title={r.name}>
                      {r.name}
                    </p>
                  </div>

                  <div className="mt-4 border-t border-clox-border-soft pt-3">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => handleToggleRegion(r.code, r.name, r.enabled)}
                      className={`w-full rounded-clox-sm px-3 py-1.5 text-xs font-semibold transition shadow-sm ${
                        r.enabled
                          ? 'border border-clox-border bg-clox-surface text-clox-ink hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)] hover:border-[var(--status-danger-bd)]'
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
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
