import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  getErrorDetail,
  getPartnerPerformance,
  listRevenueSplitScopes,
  publishAdminRevenueSplitPackage,
  type PartnerPerformanceItem,
} from '@/lib/api';
import {
  Button,
  CardCollection,
  DataCard,
  DataTable,
  Field,
  Notice,
  ResponsiveDataView,
  RoleBadge,
  Select,
  StatusPill,
  useToast,
} from '@/components/ui';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { adminPartnerStatusTone } from '@/lib/status-tone';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  'ACTIVE',
  'INVITED',
  'PENDING_DOCS',
  'PENDING_REVIEW',
  'SUSPENDED',
  'REJECTED',
] as const;

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function hintTone(hint: PartnerPerformanceItem['hint']): 'ok' | 'warn' | 'neutral' {
  if (hint === 'above_median_bob') return 'ok';
  if (hint === 'below_median_bob') return 'warn';
  return 'neutral';
}

function scopeLabel(row: PartnerPerformanceItem) {
  if (row.primaryScope?.label) return row.primaryScope.label;
  const fromScopes = row.scopes
    .map((s) => [s.regionCode, s.territoryCode].filter(Boolean).join('/'))
    .filter(Boolean);
  return fromScopes[0] ?? '—';
}

export function PartnerPerformancePage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const toast = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') || '1') || 1;
  const roleFilter = searchParams.get('role') || '';
  const statusFilter = searchParams.get('status') || '';
  const regionId = searchParams.get('regionId') || '';
  const q = searchParams.get('q') || '';
  const [searchDraft, setSearchDraft] = useState(q);

  const [adjustTarget, setAdjustTarget] = useState<PartnerPerformanceItem | null>(null);
  const [superP, setSuperP] = useState('15');
  const [stateP, setStateP] = useState('10');
  const [localP, setLocalP] = useState('5');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const query = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      role:
        roleFilter === 'STATE_MASTER' || roleFilter === 'LOCAL_BDE'
          ? (roleFilter as 'STATE_MASTER' | 'LOCAL_BDE')
          : undefined,
      status: statusFilter || undefined,
      regionId: regionId || undefined,
      q: q || undefined,
    }),
    [page, roleFilter, statusFilter, regionId, q],
  );

  const scopes = useQuery({
    queryKey: ['admin', 'revenue-split', 'scopes'],
    queryFn: ({ signal }) => listRevenueSplitScopes({ signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  const perf = useQuery({
    queryKey: ['admin', 'partner-performance', query],
    queryFn: ({ signal }) => getPartnerPerformance(query, { signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  const poolSum =
    (Number(superP) || 0) + (Number(stateP) || 0) + (Number(localP) || 0);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  }

  const closeAdjust = () => setAdjustTarget(null);

  const openAdjust = (row: PartnerPerformanceItem) => {
    setAdjustTarget(row);
    const pkg = row.split.package;
    setSuperP(
      String(pkg?.superPercent ?? row.split.effectiveSuperPercent ?? row.split.national.superPercent),
    );
    setStateP(
      String(
        pkg?.statePercent ?? row.split.effectiveStatePercent ?? row.split.national.statePercent,
      ),
    );
    setLocalP(
      String(
        pkg?.localPercent ?? row.split.effectiveLocalPercent ?? row.split.national.localPercent,
      ),
    );
    setNotes('');
  };

  useEffect(() => {
    if (!adjustTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAdjustTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adjustTarget]);

  const publishMut = useMutation({
    mutationFn: () => {
      if (!adjustTarget) {
        throw new Error(t('partnerPerformance.noAdmin'));
      }
      return publishAdminRevenueSplitPackage({
        adminUserId: adjustTarget.id,
        superPercent: Math.round(Number(superP)),
        statePercent: Math.round(Number(stateP)),
        localPercent: Math.round(Number(localP)),
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: async () => {
      toast.success(t('partnerPerformance.packageSuccess'));
      closeAdjust();
      await qc.invalidateQueries({ queryKey: ['admin', 'partner-performance'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'revenue-split'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const items = perf.data?.items ?? [];
  const totalPages = perf.data?.totalPages ?? 1;
  const total = perf.data?.total ?? 0;

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;

  const adjustPanel =
    adjustTarget && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 cursor-pointer bg-[rgba(16,25,43,0.45)]"
              aria-label={t('cancel')}
              onClick={closeAdjust}
            />
            <aside className="relative z-[1] flex h-full w-full max-w-md flex-col border-l border-clox-border bg-clox-surface shadow-clox-2">
              <div className="flex items-start justify-between gap-3 border-b border-clox-border px-4 py-4">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-clox-ink">
                    {t('partnerPerformance.adjustTitle')}
                  </h2>
                  <p className="mt-1 truncate text-xs text-clox-mute">
                    {adjustTarget.name ?? adjustTarget.email}
                    {adjustTarget.primaryScope ? ` · ${adjustTarget.primaryScope.label}` : ''}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={closeAdjust}>
                  {t('cancel')}
                </Button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                <p className="text-xs text-clox-faint">{t('partnerPerformance.adjustHint')}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field
                    label={t('revenueSplit.superPercent')}
                    value={superP}
                    onChange={(e) => setSuperP(e.target.value)}
                    inputMode="numeric"
                  />
                  <Field
                    label={t('revenueSplit.statePercent')}
                    value={stateP}
                    onChange={(e) => setStateP(e.target.value)}
                    inputMode="numeric"
                  />
                  <Field
                    label={t('revenueSplit.localPercent')}
                    value={localP}
                    onChange={(e) => setLocalP(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <Field
                  label={t('revenueSplit.notes')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <p
                  className={
                    poolSum === 30
                      ? 'text-xs text-clox-mute'
                      : 'text-xs text-[var(--status-danger)]'
                  }
                >
                  {t('revenueSplit.poolSum', { sum: poolSum })}
                </p>
              </div>
              <div className="border-t border-clox-border px-4 py-4">
                <Button
                  type="button"
                  variant="cta"
                  className="w-full"
                  disabled={publishMut.isPending || poolSum !== 30}
                  onClick={() => publishMut.mutate()}
                >
                  {publishMut.isPending
                    ? t('saving')
                    : t('partnerPerformance.publishPackage')}
                </Button>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  function renderCard(row: PartnerPerformanceItem) {
    return (
      <DataCard key={row.id} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-clox-ink">
              {row.name ?? row.email}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-clox-mute">{row.email}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <RoleBadge role={row.role} />
            <StatusPill tone={adminPartnerStatusTone(row.status)}>
              {t(`adminUserStatuses.${row.status}`, { defaultValue: row.status })}
            </StatusPill>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-clox-sm border border-clox-border bg-clox-canvas/50 px-2 py-1 font-mono text-clox-mute">
            {scopeLabel(row)}
          </span>
          <StatusPill tone={hintTone(row.hint)}>
            {t(`partnerPerformance.hint.${row.hint}`)}
          </StatusPill>
        </div>

        <div className="grid gap-2 text-xs text-clox-mute sm:grid-cols-2">
          <div className="rounded-clox-sm border border-clox-border bg-clox-canvas/40 p-2.5">
            <p className="font-semibold text-clox-ink">{t('partnerPerformance.bobTitle')}</p>
            <p className="mt-1.5 leading-relaxed">
              {t('partnerPerformance.bobLine', {
                senders: row.bob.sendersReferred,
                carriers: row.bob.carriersReferred,
                active: row.bob.activeCompanies,
              })}
            </p>
          </div>
          <div className="rounded-clox-sm border border-clox-border bg-clox-canvas/40 p-2.5">
            <p className="font-semibold text-clox-ink">{t('partnerPerformance.seatTitle')}</p>
            <p className="mt-1.5 leading-relaxed">
              {t('partnerPerformance.seatLine', {
                jobs: row.seat.jobs90d,
                gross: money(row.seat.grossIncGstCents90d),
                accrued: money(row.seat.accruedAdminCents90d),
                peers: row.seat.peersOnSameTerritory,
              })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-clox-mute">
            {t('partnerPerformance.splitLine', {
              super: row.split.effectiveSuperPercent,
              local: row.split.effectiveLocalPercent,
              state: row.split.effectiveStatePercent,
              source: row.split.package
                ? t('partnerPerformance.splitPackage')
                : t('partnerPerformance.splitNational'),
            })}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => openAdjust(row)}
          >
            {t('partnerPerformance.adjustSplit')}
          </Button>
        </div>
      </DataCard>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-clox-ink">
          {t('partnerPerformance.title')}
        </h1>
        <p className="mt-2 text-sm text-clox-mute">{t('partnerPerformance.subtitle')}</p>
        <p className="mt-1 text-xs text-clox-faint">
          <Link to="/revenue-split" className="text-clox-orange hover:underline">
            {t('nav.revenueSplit')}
          </Link>
        </p>
      </div>

      <Notice tone="info">{t('partnerPerformance.banner')}</Notice>

      <form
        className="clox-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          updateFilter('q', searchDraft.trim());
        }}
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <Field
            label={t('search')}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t('partnerPerformance.searchPlaceholder')}
          />
        </div>
        <Select
          label={t('partnerPerformance.filterRole')}
          value={roleFilter}
          onChange={(e) => updateFilter('role', e.target.value)}
        >
          <option value="">{t('partnerPerformance.roleAll')}</option>
          <option value="STATE_MASTER">{t('partnerPerformance.roleState')}</option>
          <option value="LOCAL_BDE">{t('partnerPerformance.roleLocal')}</option>
        </Select>
        <Select
          label={t('partnerPerformance.filterStatus')}
          value={statusFilter}
          onChange={(e) => updateFilter('status', e.target.value)}
        >
          <option value="">{t('partnerPerformance.statusAll')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`adminUserStatuses.${s}`)}
            </option>
          ))}
        </Select>
        <Select
          label={t('partnerPerformance.filterRegion')}
          value={regionId}
          onChange={(e) => updateFilter('regionId', e.target.value)}
        >
          <option value="">{t('partnerPerformance.regionAll')}</option>
          {(scopes.data?.regions ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} · {r.name}
            </option>
          ))}
        </Select>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" variant="secondary" size="sm">
            {t('search')}
          </Button>
          {roleFilter || statusFilter || regionId || q ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchDraft('');
                setSearchParams(new URLSearchParams());
              }}
            >
              {t('partnerPerformance.clearFilters')}
            </Button>
          ) : null}
        </div>
      </form>

      {perf.isError ? (
        <Notice tone="error">{getErrorDetail(perf.error)}</Notice>
      ) : null}

      {perf.data ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-clox-faint">
          <p>
            {t('partnerPerformance.windowLine', {
              days: perf.data.windowDays,
              median: perf.data.bobMedianActiveCompanies,
              local: perf.data.national.localPercent,
              state: perf.data.national.statePercent,
              super: perf.data.national.superPercent,
            })}
          </p>
          <p className="font-mono">{t('totalCount', { count: total })}</p>
        </div>
      ) : null}

      {perf.isLoading ? (
        <LoadingBlock label={t('partnerPerformance.loading')} />
      ) : items.length === 0 ? (
        <EmptyBlock title={t('partnerPerformance.empty')} />
      ) : (
        <ResponsiveDataView
          cards={<CardCollection>{items.map((row) => renderCard(row))}</CardCollection>}
          table={
            <DataTable
              minWidthClassName="min-w-[64rem]"
              headers={[
                t('partnerPerformance.colPartner'),
                t('partnerPerformance.colRole'),
                t('partnerPerformance.colStatus'),
                t('partnerPerformance.colScope'),
                t('partnerPerformance.colBob'),
                t('partnerPerformance.colPackage'),
                t('partnerPerformance.colHint'),
                '',
              ]}
            >
              {items.map((row) => (
                <tr key={row.id} className="border-t border-clox-border">
                  <td className="px-4 py-3">
                    <p className="font-medium text-clox-ink">{row.name ?? row.email}</p>
                    <p className="font-mono text-[11px] text-clox-faint">{row.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={row.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={adminPartnerStatusTone(row.status)}>
                      {t(`adminUserStatuses.${row.status}`, { defaultValue: row.status })}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-clox-mute">
                    {scopeLabel(row)}
                  </td>
                  <td className="px-4 py-3 text-xs text-clox-mute">
                    {row.bob.sendersReferred}/{row.bob.carriersReferred}/{row.bob.activeCompanies}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-clox-mute">
                    {row.split.effectiveSuperPercent}/
                    {row.split.effectiveStatePercent}/
                    {row.split.effectiveLocalPercent}
                    <span className="mt-0.5 block text-[10px] text-clox-faint">
                      {row.split.package
                        ? t('partnerPerformance.splitPackage')
                        : t('partnerPerformance.splitNational')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={hintTone(row.hint)}>
                      {t(`partnerPerformance.hint.${row.hint}`)}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => openAdjust(row)}
                    >
                      {t('partnerPerformance.adjustSplit')}
                    </Button>
                  </td>
                </tr>
              ))}
            </DataTable>
          }
        />
      )}

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-clox-mute">
          <Button
            variant="secondary"
            disabled={page <= 1 || perf.isFetching}
            onClick={() => updateFilter('page', String(page - 1))}
          >
            {t('previous')}
          </Button>
          <span className="order-first w-full text-center sm:order-none sm:w-auto">
            {t('pageOf', { page, totalPages })}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages || perf.isFetching}
            onClick={() => updateFilter('page', String(page + 1))}
          >
            {t('next')}
          </Button>
        </div>
      ) : null}

      {adjustPanel}
    </div>
  );
}
