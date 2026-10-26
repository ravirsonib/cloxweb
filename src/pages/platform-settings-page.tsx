import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { getErrorDetail, getPlatformSettings, patchPlatformSettings } from '@/lib/api';
import { Button, Field, Notice, useToast } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
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

  const [discount, setDiscount] = useState('10');
  const [slaMinutes, setSlaMinutes] = useState('5');
  const [driverDelta, setDriverDelta] = useState('5');
  const [carrierDelta, setCarrierDelta] = useState('10');

  useEffect(() => {
    if (!settings.data) return;
    setDiscount(String(settings.data.rescueDiscountPercent));
    setSlaMinutes(String(Math.round(settings.data.marketplaceRelistSlaMs / 60_000)));
    setDriverDelta(String(settings.data.driverUnavailableScoreDelta));
    setCarrierDelta(String(settings.data.carrierMarketplaceReleaseScoreDelta));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => {
      const rescueDiscountPercent = Number(discount);
      const slaMin = Number(slaMinutes);
      const driverUnavailableScoreDelta = Number(driverDelta);
      const carrierMarketplaceReleaseScoreDelta = Number(carrierDelta);
      if (
        !Number.isFinite(rescueDiscountPercent) ||
        !Number.isFinite(slaMin) ||
        !Number.isFinite(driverUnavailableScoreDelta) ||
        !Number.isFinite(carrierMarketplaceReleaseScoreDelta)
      ) {
        throw new Error(t('platformSettings.invalid'));
      }
      return patchPlatformSettings({
        rescueDiscountPercent: Math.round(rescueDiscountPercent),
        marketplaceRelistSlaMs: Math.round(slaMin * 60_000),
        driverUnavailableScoreDelta: Math.round(driverUnavailableScoreDelta),
        carrierMarketplaceReleaseScoreDelta: Math.round(carrierMarketplaceReleaseScoreDelta),
      });
    },
    onSuccess: async () => {
      toast.success(t('platformSettings.saveSuccess'));
      await qc.invalidateQueries({ queryKey: ['admin', 'platform-settings'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;
  if (settings.isLoading) return <LoadingBlock label={t('platformSettings.loading')} />;

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl font-bold text-clox-ink">
        {t('platformSettings.title')}
      </h1>
      <p className="mt-2 text-sm text-clox-mute">{t('platformSettings.subtitle')}</p>

      {settings.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(settings.error)}
        </Notice>
      ) : null}

      <form
        className="clox-card mt-6 space-y-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        noValidate
      >
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
        {save.isError ? <Notice tone="error">{getErrorDetail(save.error)}</Notice> : null}
        <Button type="submit" variant="cta" disabled={save.isPending}>
          {save.isPending ? t('loading') : t('platformSettings.save')}
        </Button>
      </form>
    </div>
  );
}
