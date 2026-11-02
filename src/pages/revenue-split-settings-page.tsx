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
import { RevenueSplitBar } from '@/components/revenue-split-bar';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function poolSum(carrierP: number, superP: number, stateP: number, localP: number) {
  return carrierP + superP + stateP + localP;
}

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
  const [superP, setSuperP] = useState('15');
  const [stateP, setStateP] = useState('10');
  const [localP, setLocalP] = useState('5');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const p = settings.data?.effective.percents;
    if (!p) return;
    setCarrierP(String(p.carrierPercent ?? 70));
    setSuperP(String(p.superPercent));
    setStateP(String(p.statePercent));
    setLocalP(String(p.localPercent));
  }, [settings.data]);

  const nationalSum = useMemo(
    () =>
      poolSum(
        Number(carrierP) || 0,
        Number(superP) || 0,
        Number(stateP) || 0,
        Number(localP) || 0,
      ),
    [carrierP, superP, stateP, localP],
  );

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin', 'revenue-split'] }),
      qc.invalidateQueries({ queryKey: ['admin', 'revenue-split', 'versions'] }),
    ]);
  };

  const draftMut = useMutation({
    mutationFn: () =>
      draftRevenueSplit({
        carrierPercent: Math.round(Number(carrierP)),
        superPercent: Math.round(Number(superP)),
        statePercent: Math.round(Number(stateP)),
        localPercent: Math.round(Number(localP)),
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
        carrierPercent: Math.round(Number(carrierP)),
        superPercent: Math.round(Number(superP)),
        statePercent: Math.round(Number(stateP)),
        localPercent: Math.round(Number(localP)),
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

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-clox-ink">
          {t('revenueSplit.title')}
        </h1>
        <p className="mt-2 text-sm text-clox-mute">{t('revenueSplit.subtitle')}</p>
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
      <Notice tone="info">{t('revenueSplit.perAdminHint')}</Notice>

      {settings.isError ? (
        <Notice tone="error">{getErrorDetail(settings.error)}</Notice>
      ) : null}

      {/* ─── Effective National Policy Card with 100% Bar ─── */}
      {effective ? (
        <section className="clox-card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clox-border pb-3">
            <div>
              <h2 className="font-display text-base font-semibold text-clox-ink">
                {t('revenueSplit.effectiveTitle')}
              </h2>
              <p className="text-xs text-clox-mute">
                {t('revenueSplit.effectiveSubtitle', {
                  defaultValue: 'Live 100% revenue distribution applied to new shipments upon settlement.',
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                v{settings.data?.effective.version ?? 1} · {t('revenueSplit.active', { defaultValue: 'Live Policy' })}
              </span>
            </div>
          </div>

          <RevenueSplitBar
            carrier={effective.carrierPercent}
            superAdmin={effective.superPercent}
            stateMaster={effective.statePercent}
            localBde={effective.localPercent}
          />
        </section>
      ) : null}

      <form
        className="clox-card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          publishMut.mutate();
        }}
        noValidate
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clox-border pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-clox-ink">
              {t('revenueSplit.nationalTitle')}
            </h2>
            <p className="text-xs text-clox-faint">{t('revenueSplit.carrierDynamicHint')}</p>
          </div>
          <span className="text-xs text-clox-mute">
            {t('revenueSplit.livePreview', { defaultValue: 'Live Edit Preview' })}
          </span>
        </div>

        {/* Live preview bar as user adjusts numbers */}
        <RevenueSplitBar
          carrier={Number(carrierP) || 0}
          superAdmin={Number(superP) || 0}
          stateMaster={Number(stateP) || 0}
          localBde={Number(localP) || 0}
          showCards={false}
        />

        <div className="grid gap-3 sm:grid-cols-4 pt-2">
          <Field
            label={t('revenueSplit.carrierPercent', { defaultValue: 'Carrier %' })}
            value={carrierP}
            onChange={(e) => setCarrierP(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('revenueSplit.superPercent')}
            value={superP}
            onChange={(e) => setSuperP(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('revenueSplit.statePercent')}
            value={stateP}
            onChange={(e) => setStateP(e.target.value)}
            inputMode="numeric"
            required
          />
          <Field
            label={t('revenueSplit.localPercent')}
            value={localP}
            onChange={(e) => setLocalP(e.target.value)}
            inputMode="numeric"
            required
          />
        </div>
        <Field
          label={t('revenueSplit.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p
          className={
            nationalSum === 100
              ? 'text-xs font-medium text-emerald-600 dark:text-emerald-400'
              : 'text-xs font-semibold text-[var(--status-danger)]'
          }
        >
          {t('revenueSplit.poolSum', { sum: nationalSum })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={draftMut.isPending || nationalSum !== 100}
            onClick={() => draftMut.mutate()}
          >
            {draftMut.isPending ? t('saving') : t('revenueSplit.saveDraft')}
          </Button>
          <Button
            type="submit"
            variant="cta"
            disabled={publishMut.isPending || nationalSum !== 100}
          >
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
              notes?: string;
            };
            return (
              <li
                key={v.id}
                className="rounded-clox-md border border-clox-border bg-clox-surface p-3 font-mono"
              >
                v{v.version}
                {v.publishedAt ? ` · ${t('revenueSplit.published')}` : ` · ${t('revenueSplit.draft')}`}
                {` · C${payload.carrierPercent ?? 70}/S${payload.superPercent}/St${payload.statePercent}/L${payload.localPercent}`}
                {payload.notes ? ` · ${payload.notes}` : ''}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
