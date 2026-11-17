import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getErrorDetail,
  getPlatformSettings,
  getRevenueSplitSettings,
  listCarrierRevenueUplifts,
  listSenderFeeOverrides,
  publishCarrierRevenueUplift,
  publishSenderFeeOverride,
} from '@/lib/api';
import { Button, Field, StatusPill, useToast } from '@/components/ui';
import { CarrierCloxBar } from '@/components/revenue-split-tree';
import { CompanyType } from '@/shared/types';
import { formatDateTime } from '@/lib/leads';

type Props = {
  companyId: string;
  companyType: CompanyType;
};

function effectiveCarrierShare(
  nationalCarrier: number,
  bonusPoints: number,
  minPlatformPercent: number,
) {
  const minPlatform = Math.max(1, Math.min(99, minPlatformPercent));
  const maxCarrier = 100 - minPlatform;
  const bonus = Math.max(0, bonusPoints);
  return Math.min(maxCarrier, nationalCarrier + bonus);
}

export function CompanyRevenuePolicyPanel({ companyId, companyType }: Props) {
  const { t } = useTranslation('common');
  const toast = useToast();
  const qc = useQueryClient();
  const isCarrier = companyType === CompanyType.CARRIER;
  const isSender = companyType === CompanyType.SENDER;

  const [bonus, setBonus] = useState('0');
  const [feePercent, setFeePercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [seededFee, setSeededFee] = useState(false);

  const national = useQuery({
    queryKey: ['admin', 'revenue-split'],
    queryFn: ({ signal }) => getRevenueSplitSettings({ signal }),
  });

  const platform = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: ({ signal }) => getPlatformSettings({ signal }),
  });

  const uplifts = useQuery({
    queryKey: ['admin', 'carrier-uplifts', companyId],
    queryFn: ({ signal }) => listCarrierRevenueUplifts(companyId, { signal }),
    enabled: isCarrier,
  });

  const feeOverrides = useQuery({
    queryKey: ['admin', 'sender-fee-overrides', companyId],
    queryFn: ({ signal }) => listSenderFeeOverrides(companyId, { signal }),
    enabled: isSender,
  });

  const latestUplift = uplifts.data?.items?.[0];
  const latestFee = feeOverrides.data?.items?.[0];
  const hasActiveFeeOverride = Boolean(latestFee && !latestFee.inheritNational);
  const nationalFeePercent = platform.data?.senderPlatformFeePercent ?? 0;

  useEffect(() => {
    if (latestUplift) setBonus(String(latestUplift.bonusPercent));
  }, [latestUplift?.id, latestUplift?.bonusPercent]);

  useEffect(() => {
    if (!isSender || seededFee || !platform.data) return;
    if (hasActiveFeeOverride && latestFee) {
      setFeePercent(String(latestFee.feePercent));
    } else {
      setFeePercent(String(nationalFeePercent));
    }
    setSeededFee(true);
  }, [
    isSender,
    seededFee,
    platform.data,
    hasActiveFeeOverride,
    latestFee,
    nationalFeePercent,
  ]);

  const publishUplift = useMutation({
    mutationFn: (bonusOverride?: number) =>
      publishCarrierRevenueUplift({
        companyId,
        bonusPercent: Math.round(
          bonusOverride != null ? bonusOverride : Number(bonus),
        ),
        notes: notes.trim() || undefined,
      }),
    onSuccess: async (_data, bonusOverride) => {
      toast.success(
        bonusOverride === 0
          ? t('companies.upliftCleared', {
              defaultValue: 'Uplift cleared — back to national carrier share',
            })
          : t('companies.upliftPublished', { defaultValue: 'Carrier revenue uplift published' }),
      );
      setNotes('');
      if (bonusOverride === 0) setBonus('0');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'carrier-uplifts', companyId] }),
        qc.invalidateQueries({ queryKey: ['admin', 'customers'] }),
      ]);
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const publishFee = useMutation({
    mutationFn: (input: { feePercent?: number; inheritNational?: boolean }) =>
      publishSenderFeeOverride({
        companyId,
        feePercent: input.feePercent,
        inheritNational: input.inheritNational,
        notes: notes.trim() || undefined,
      }),
    onSuccess: async (_data, vars) => {
      toast.success(
        vars.inheritNational
          ? t('companies.senderFeeCleared', {
              defaultValue: 'Sender fee cleared — using platform default again',
            })
          : t('companies.senderFeePublished', { defaultValue: 'Sender fee override published' }),
      );
      setNotes('');
      setSeededFee(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'sender-fee-overrides', companyId] }),
        qc.invalidateQueries({ queryKey: ['admin', 'customers'] }),
      ]);
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const nationalCarrier =
    national.data?.carrierPercent ?? national.data?.effective.percents.carrierPercent ?? 70;
  const minPlatformPercent = platform.data?.minPlatformPercent ?? 10;
  const maxBonus = Math.max(0, 100 - minPlatformPercent - nationalCarrier);
  const bonusPoints = Number(bonus) || 0;
  const isBonusValid =
    Number.isFinite(bonusPoints) &&
    Number.isInteger(bonusPoints) &&
    bonusPoints >= 0 &&
    bonusPoints <= maxBonus;
  const previewEffective = useMemo(
    () => effectiveCarrierShare(nationalCarrier, bonusPoints, minPlatformPercent),
    [nationalCarrier, bonusPoints, minPlatformPercent],
  );
  const previewClox = 100 - previewEffective;
  const nationalClox = 100 - nationalCarrier;
  const wasCapped =
    nationalCarrier + Math.max(0, bonusPoints) > previewEffective && bonusPoints > 0;

  const feePoints = Number(feePercent);
  const isFeeValid =
    Number.isFinite(feePoints) &&
    Number.isInteger(feePoints) &&
    feePoints >= 0 &&
    feePoints <= 30;
  const effectiveFee = hasActiveFeeOverride ? (latestFee?.feePercent ?? feePoints) : nationalFeePercent;

  if (!isCarrier && !isSender) return null;

  return (
    <div className="clox-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-clox-ink">
            {isCarrier
              ? t('companies.revenueUpliftTitle', { defaultValue: 'Carrier revenue uplift' })
              : t('companies.senderFeeTitle', { defaultValue: 'Sender platform fee override' })}
          </h2>
          <p className="mt-1 text-xs text-clox-mute">
            {isCarrier
              ? t('companies.revenueUpliftHint', {
                  defaultValue: `National carrier share is ${nationalCarrier}%. Bonus points raise this carrier’s share (CLOX pool shrinks).`,
                  nationalCarrier,
                })
              : t('companies.senderFeeHint', {
                  defaultValue:
                    'Override platform sender fee for this company. 0% = exempt. Clear override to follow Platform Settings again.',
                })}
          </p>
        </div>
        {isCarrier && bonusPoints > 0 ? (
          <StatusPill tone="info">
            {t('companies.primeUplift', {
              defaultValue: `Preferred +${bonusPoints}%`,
              bonus: bonusPoints,
            })}
          </StatusPill>
        ) : null}
        {isSender && hasActiveFeeOverride ? (
          <StatusPill tone="info">
            {t('companies.primeFee', {
              defaultValue: `Custom fee ${latestFee?.feePercent}%`,
              fee: latestFee?.feePercent,
            })}
          </StatusPill>
        ) : null}
      </div>

      {isCarrier ? (
        <>
          <div className="rounded-clox-md border border-clox-border bg-clox-surface-alt/40 p-3 text-xs text-clox-ink space-y-1">
            <p className="font-semibold">
              {t('companies.effectiveNow', { defaultValue: 'Effective now' })}
            </p>
            <p>
              {t('companies.carrierEffectiveLine', {
                defaultValue: `Carrier ${previewEffective}% (= national ${nationalCarrier}% + ${bonusPoints}) · CLOX ${previewClox}%`,
                effective: previewEffective,
                national: nationalCarrier,
                bonus: bonusPoints,
                clox: previewClox,
              })}
            </p>
            <p className="text-clox-mute">
              {bonusPoints > 0
                ? t('companies.sourceOverride', {
                    defaultValue: `Source: published uplift${latestUplift ? ` from ${formatDateTime(latestUplift.effectiveFrom)}` : ''}`,
                    at: latestUplift ? formatDateTime(latestUplift.effectiveFrom) : '',
                  })
                : t('companies.sourceNational', {
                    defaultValue: 'Source: platform national split (no uplift)',
                  })}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('companies.bonusPercent', {
                defaultValue: `Bonus points (0–${maxBonus})`,
                max: maxBonus,
              })}
              hint={t('companies.bonusPercentHint', {
                defaultValue: `Added to national Carrier ${nationalCarrier}%. Max keeps CLOX ≥ ${minPlatformPercent}%.`,
                nationalCarrier,
                min: minPlatformPercent,
                maxBonus,
              })}
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              inputMode="numeric"
              error={
                bonus !== '' && !isBonusValid
                  ? t('companies.bonusPercentInvalid', {
                      defaultValue: `Enter an integer from 0 to ${maxBonus}`,
                      max: maxBonus,
                    })
                  : undefined
              }
            />
            <Field
              label={t('revenueSplit.notes', { defaultValue: 'Notes' })}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-clox-md border border-clox-border bg-clox-surface-alt/40 p-4">
            <CarrierCloxBar
              carrierPercent={previewEffective}
              label={t('companies.upliftAfter', {
                defaultValue:
                  bonusPoints > 0
                    ? `This carrier: +${bonusPoints}% → Carrier ${previewEffective}% · CLOX ${previewClox}%`
                    : `This carrier: Carrier ${previewEffective}% · CLOX ${previewClox}% (national)`,
                bonus: bonusPoints,
                carrier: previewEffective,
                clox: previewClox,
              })}
            />
            {wasCapped ? (
              <p className="text-xs font-medium text-[var(--status-warn)]">
                {t('companies.upliftCapped', {
                  defaultValue: `Capped by Min CLOX pool ${minPlatformPercent}% — carrier cannot go above ${100 - minPlatformPercent}%.`,
                  min: minPlatformPercent,
                  maxCarrier: 100 - minPlatformPercent,
                })}
              </p>
            ) : bonusPoints > 0 ? (
              <p className="text-xs text-clox-mute">
                {t('companies.effectivePreview', {
                  defaultValue: `National is ${nationalCarrier}% / ${nationalClox}%. Bonus moves ${bonusPoints} points from CLOX to this carrier.`,
                  nationalCarrier,
                  nationalClox,
                  bonus: bonusPoints,
                })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="cta"
              disabled={publishUplift.isPending || !isBonusValid}
              onClick={() => publishUplift.mutate(undefined)}
            >
              {publishUplift.isPending
                ? t('saving')
                : t('companies.publishUplift', { defaultValue: 'Publish uplift' })}
            </Button>
            {bonusPoints > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={publishUplift.isPending}
                onClick={() => publishUplift.mutate(0)}
              >
                {t('companies.clearUplift', { defaultValue: 'Clear uplift (back to national)' })}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="rounded-clox-md border border-clox-border bg-clox-surface-alt/40 p-3 text-xs text-clox-ink space-y-1">
            <p className="font-semibold">
              {t('companies.effectiveNow', { defaultValue: 'Effective now' })}
            </p>
            <p>
              {hasActiveFeeOverride
                ? t('companies.senderEffectiveOverride', {
                    defaultValue: `Fee ${effectiveFee}% (custom override)${effectiveFee === 0 ? ' — exempt' : ''}`,
                    fee: effectiveFee,
                  })
                : t('companies.senderEffectiveDefault', {
                    defaultValue: `Fee ${nationalFeePercent}% (platform default)`,
                    fee: nationalFeePercent,
                  })}
            </p>
            <p className="text-clox-mute">
              {hasActiveFeeOverride && latestFee
                ? t('companies.sourceOverride', {
                    defaultValue: `Source: published override from ${formatDateTime(latestFee.effectiveFrom)}`,
                    at: formatDateTime(latestFee.effectiveFrom),
                  })
                : t('companies.sourcePlatformFee', {
                    defaultValue: 'Source: Platform Settings sender fee',
                  })}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('companies.senderFeePercent', {
                defaultValue: 'Fee % (0–30)',
              })}
              hint={t('companies.senderFeePercentHint', {
                defaultValue: `Starts from platform default ${nationalFeePercent}%. Set 0 to exempt this sender. Clear override to follow platform again.`,
                national: nationalFeePercent,
              })}
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              inputMode="numeric"
              error={
                feePercent !== '' && !isFeeValid
                  ? t('companies.senderFeeInvalid', {
                      defaultValue: 'Enter an integer from 0 to 30',
                    })
                  : undefined
              }
            />
            <Field
              label={t('revenueSplit.notes', { defaultValue: 'Notes' })}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="cta"
              disabled={publishFee.isPending || !isFeeValid}
              onClick={() => publishFee.mutate({ feePercent: Math.round(feePoints) })}
            >
              {publishFee.isPending
                ? t('saving')
                : t('companies.publishSenderFee', { defaultValue: 'Publish fee override' })}
            </Button>
            {hasActiveFeeOverride ? (
              <Button
                type="button"
                variant="secondary"
                disabled={publishFee.isPending}
                onClick={() => publishFee.mutate({ inheritNational: true })}
              >
                {t('companies.clearSenderFee', {
                  defaultValue: 'Clear override (use platform default)',
                })}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
