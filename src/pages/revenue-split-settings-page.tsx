import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import {
  draftRevenueSplit,
  getErrorDetail,
  getRevenueSplitSettings,
  listRevenueSplitVersions,
  publishRevenueSplit,
} from '@/lib/api';
import { Button, Field, Notice, useToast } from '@/components/ui';
import { LoadingBlock } from '@/components/status-blocks';
import { RevenueSplitStages } from '@/components/revenue-split-stages';
import { RevenueSplitTree, grossAdminToCloxPool } from '@/components/revenue-split-tree';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

export function RevenueSplitSettingsPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();

  const settings = useQuery({
    queryKey: ['admin', 'revenue-split'],
    queryFn: ({ signal }) => getRevenueSplitSettings({ signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });
  const versions = useQuery({
    queryKey: ['admin', 'revenue-split', 'versions'],
    queryFn: ({ signal }) => listRevenueSplitVersions({ signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  const [carrierP, setCarrierP] = useState('70');
  const [cloxSuperP, setCloxSuperP] = useState('50');
  const [cloxStateP, setCloxStateP] = useState('30');
  const [cloxLocalP, setCloxLocalP] = useState('20');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const data = settings.data;
    if (!data) return;
    const p = data.effective.percents;
    const pool =
      data.cloxPool ??
      data.effective.cloxPool ??
      (p.cloxSuperPercent != null
        ? {
            cloxSuperPercent: p.cloxSuperPercent,
            cloxStatePercent: p.cloxStatePercent ?? 30,
            cloxLocalPercent: p.cloxLocalPercent ?? 20,
          }
        : grossAdminToCloxPool(p.superPercent, p.statePercent, p.localPercent));
    setCarrierP(String(p.carrierPercent ?? 70));
    setCloxSuperP(String(pool.cloxSuperPercent));
    setCloxStateP(String(pool.cloxStatePercent));
    setCloxLocalP(String(pool.cloxLocalPercent));
  }, [settings.data]);

  const carrierPct = Number(carrierP) || 0;
  const cloxPoolSum = useMemo(
    () =>
      (Number(cloxSuperP) || 0) + (Number(cloxStateP) || 0) + (Number(cloxLocalP) || 0),
    [cloxSuperP, cloxStateP, cloxLocalP],
  );
  const isPoolValid = cloxPoolSum === 100;

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin', 'revenue-split'] }),
      qc.invalidateQueries({ queryKey: ['admin', 'revenue-split', 'versions'] }),
    ]);
  };

  const draftMut = useMutation({
    mutationFn: () =>
      draftRevenueSplit({
        carrierPercent: Math.round(carrierPct),
        cloxSuperPercent: Math.round(Number(cloxSuperP)),
        cloxStatePercent: Math.round(Number(cloxStateP)),
        cloxLocalPercent: Math.round(Number(cloxLocalP)),
        notes: notes.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('revenueSplit.draftSuccess'));
      await invalidate();
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const publishMut = useMutation({
    mutationFn: () =>
      publishRevenueSplit({
        draftId: settings.data?.draft?.id,
        carrierPercent: Math.round(carrierPct),
        cloxSuperPercent: Math.round(Number(cloxSuperP)),
        cloxStatePercent: Math.round(Number(cloxStateP)),
        cloxLocalPercent: Math.round(Number(cloxLocalP)),
        notes: notes.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('revenueSplit.publishSuccess'));
      await invalidate();
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;
  if (settings.isLoading) return <LoadingBlock label={t('revenueSplit.loading')} />;

  const effective = settings.data?.effective.percents;
  const effectivePool =
    settings.data?.cloxPool ??
    settings.data?.effective.cloxPool ??
    (effective
      ? effective.cloxSuperPercent != null
        ? {
            cloxSuperPercent: effective.cloxSuperPercent,
            cloxStatePercent: effective.cloxStatePercent ?? 30,
            cloxLocalPercent: effective.cloxLocalPercent ?? 20,
          }
        : grossAdminToCloxPool(
            effective.superPercent,
            effective.statePercent,
            effective.localPercent,
          )
      : null);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-clox-ink">
          {t('revenueSplit.title')}
        </h1>
        <p className="mt-2 text-sm text-clox-mute">
          {t('revenueSplit.subtitle', {
            defaultValue:
              'Two steps: split gross between Carrier and CLOX, then split CLOX among Super / State / Local.',
          })}
        </p>
        <p className="mt-1 text-xs text-clox-faint">
          <Link to="/platform-settings" className="text-clox-orange hover:underline">
            {t('nav.platformSettings')}
          </Link>
          {' · '}
          <Link to="/partner-performance" className="text-clox-orange hover:underline">
            {t('nav.partnerPerformance')}
          </Link>
        </p>
      </div>

      <Notice tone="info">{t('revenueSplit.newAccrualsOnly')}</Notice>

      {settings.isError ? (
        <Notice tone="error">{getErrorDetail(settings.error)}</Notice>
      ) : null}

      {effective && effectivePool ? (
        <section className="clox-card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clox-border pb-3">
            <div>
              <h2 className="font-display text-base font-semibold text-clox-ink">
                {t('revenueSplit.effectiveTitle')}
              </h2>
              <p className="text-xs text-clox-mute">
                {t('revenueSplit.effectiveSubtitle', {
                  defaultValue: 'Currently live nested split (read-only preview).',
                })}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              v{settings.data?.effective.version ?? 1} ·{' '}
              {t('revenueSplit.active', { defaultValue: 'Live Policy' })}
            </span>
          </div>

          <RevenueSplitTree
            carrierPercent={effective.carrierPercent}
            cloxSuperPercent={effectivePool.cloxSuperPercent}
            cloxStatePercent={effectivePool.cloxStatePercent}
            cloxLocalPercent={effectivePool.cloxLocalPercent}
            showGrossHint={false}
          />
        </section>
      ) : null}

      <form
        className="clox-card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isPoolValid) return;
          publishMut.mutate();
        }}
        noValidate
      >
        <div className="border-b border-clox-border pb-3">
          <h2 className="font-display text-base font-semibold text-clox-ink">
            {t('revenueSplit.nationalTitle')}
          </h2>
          <p className="text-xs text-clox-faint">
            {t('revenueSplit.carrierDynamicHint', {
              defaultValue: 'Edit Stage 1, then Stage 2. Publish when CLOX shares sum to 100%.',
            })}
          </p>
        </div>

        <RevenueSplitStages
          carrierPercent={carrierPct}
          cloxSuperPercent={Number(cloxSuperP) || 0}
          cloxStatePercent={Number(cloxStateP) || 0}
          cloxLocalPercent={Number(cloxLocalP) || 0}
          carrierValue={carrierP}
          cloxSuperValue={cloxSuperP}
          cloxStateValue={cloxStateP}
          cloxLocalValue={cloxLocalP}
          onCarrierChange={setCarrierP}
          onCloxSuperChange={setCloxSuperP}
          onCloxStateChange={setCloxStateP}
          onCloxLocalChange={setCloxLocalP}
        />

        <Field
          label={t('revenueSplit.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={draftMut.isPending || !isPoolValid}
            onClick={() => draftMut.mutate()}
          >
            {draftMut.isPending ? t('saving') : t('revenueSplit.saveDraft')}
          </Button>
          <Button type="submit" variant="cta" disabled={publishMut.isPending || !isPoolValid}>
            {publishMut.isPending ? t('saving') : t('revenueSplit.publish')}
          </Button>
        </div>
      </form>

      <section>
        <h2 className="font-display text-lg font-semibold">{t('revenueSplit.versionHistory')}</h2>
        <ul className="mt-3 space-y-2 text-xs text-clox-mute">
          {(versions.data?.items ?? []).map((v) => {
            const payload = v.payload as {
              carrierPercent?: number;
              superPercent?: number;
              statePercent?: number;
              localPercent?: number;
              cloxSuperPercent?: number;
              cloxStatePercent?: number;
              cloxLocalPercent?: number;
              notes?: string;
            };
            const carrier = payload.carrierPercent ?? 70;
            const pool =
              payload.cloxSuperPercent != null
                ? {
                    cloxSuperPercent: payload.cloxSuperPercent,
                    cloxStatePercent: payload.cloxStatePercent ?? 0,
                    cloxLocalPercent: payload.cloxLocalPercent ?? 0,
                  }
                : grossAdminToCloxPool(
                    payload.superPercent ?? 0,
                    payload.statePercent ?? 0,
                    payload.localPercent ?? 0,
                  );
            return (
              <li
                key={v.id}
                className="rounded-clox-md border border-clox-border bg-clox-surface p-3 font-mono"
              >
                v{v.version}
                {v.publishedAt ? ` · ${t('revenueSplit.published')}` : ` · ${t('revenueSplit.draft')}`}
                {` · Carrier ${carrier}% / CLOX ${100 - carrier}% · pool ${pool.cloxSuperPercent}/${pool.cloxStatePercent}/${pool.cloxLocalPercent}`}
                {payload.notes ? ` · ${payload.notes}` : ''}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
