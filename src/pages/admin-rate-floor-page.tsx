import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import {
  createAdminFuelIndex,
  createAdminRateFloorDraft,
  createAdminRateFloorOverride,
  deleteAdminPublicHoliday,
  expireAdminRateFloorOverride,
  exportAdminRateFloorChecksCsv,
  getAdminFuelIndexStatus,
  getAdminRateFloorVersion,
  getErrorDetail,
  isAxiosError,
  listAdminFuelIndexes,
  listAdminPublicHolidays,
  listAdminRateFloorChecks,
  listAdminRateFloorOverrides,
  listAdminRateFloorVersions,
  patchAdminRateFloorBody,
  patchAdminRateFloorLine,
  publishAdminRateFloorVersion,
  submitAdminRateFloorApproval,
  upsertAdminPublicHoliday,
  withdrawAdminRateFloorApproval,
  type FuelIndexDto,
  type RateFloorBodyLoadingDto,
  type RateFloorLineDto,
} from '@/lib/api';
import { Button, Field, Notice, StatusPill, useConfirm, useToast } from '@/components/ui';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { AdminRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function dollarsToCentsAllowZero(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function fuelConfirmRequired(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  const data = err.response?.data as
    | { code?: string; message?: string | { code?: string } }
    | undefined;
  if (data?.code === 'FUEL_MOVE_CONFIRM_REQUIRED') return true;
  if (data?.message && typeof data.message === 'object') {
    return data.message.code === 'FUEL_MOVE_CONFIRM_REQUIRED';
  }
  return false;
}

function holidayDateIso(value: string): string {
  return value.slice(0, 10);
}

function FuelHistoryChart({ rows }: { rows: FuelIndexDto[] }) {
  const points = [...rows].reverse();
  if (points.length < 2) {
    return (
      <p className="text-xs text-clox-muted">Need at least two fuel weeks to chart history.</p>
    );
  }
  const values = points.map((p) => p.dieselCpl);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const w = 480;
  const h = 120;
  const pad = 8;
  const coords = points
    .map((p, i) => {
      const x = pad + (i * (w - pad * 2)) / (points.length - 1);
      const y = h - pad - ((p.dieselCpl - min) / span) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <div className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-3">
      <p className="mb-2 text-xs font-semibold text-clox-ink">
        Diesel c/L history ({min.toFixed(1)} – {max.toFixed(1)})
      </p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-28 w-full"
        role="img"
        aria-label="Fuel index chart"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-clox-orange"
          points={coords}
        />
      </svg>
    </div>
  );
}

type Tab = 'versions' | 'fuel' | 'holidays' | 'audit' | 'overrides';

export function AdminRateFloorPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('versions');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [hourlyDollars, setHourlyDollars] = useState('');
  const [kmDollars, setKmDollars] = useState('');
  const [variableKmDollars, setVariableKmDollars] = useState('');
  const [litresPerKm, setLitresPerKm] = useState('');
  const [basis, setBasis] = useState<'V' | 'W' | 'D'>('V');
  const [editBodyCode, setEditBodyCode] = useState<string | null>(null);
  const [bodyPct, setBodyPct] = useState('');
  const [bodyMinHours, setBodyMinHours] = useState('');
  const [dieselCpl, setDieselCpl] = useState('');
  const [fuelNote, setFuelNote] = useState('');
  const [fuelWeekStart, setFuelWeekStart] = useState('');
  const [overrideJobId, setOverrideJobId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideExpires, setOverrideExpires] = useState('');
  const [overrideFloorDollars, setOverrideFloorDollars] = useState('');
  const [holidayState, setHolidayState] = useState('NATIONAL');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayFilter, setHolidayFilter] = useState('');
  const [auditJobId, setAuditJobId] = useState('');
  const [auditResult, setAuditResult] = useState<'' | 'PASS' | 'REJECT' | 'OVERRIDE'>('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [exportingChecks, setExportingChecks] = useState(false);

  const versionsQuery = useQuery({
    queryKey: ['admin', 'rate-floor', 'versions'],
    queryFn: ({ signal }) => listAdminRateFloorVersions({ signal }),
  });

  const detailQuery = useQuery({
    queryKey: ['admin', 'rate-floor', 'version', selectedId],
    queryFn: ({ signal }) => getAdminRateFloorVersion(selectedId!, { signal }),
    enabled: Boolean(selectedId),
  });

  const fuelStatusQuery = useQuery({
    queryKey: ['admin', 'fuel-index', 'status'],
    queryFn: ({ signal }) => getAdminFuelIndexStatus({ signal }),
  });

  const fuelListQuery = useQuery({
    queryKey: ['admin', 'fuel-index', 'list'],
    queryFn: ({ signal }) => listAdminFuelIndexes({ signal }),
    enabled: tab === 'fuel',
  });

  const overridesQuery = useQuery({
    queryKey: ['admin', 'rate-floor', 'overrides'],
    queryFn: ({ signal }) => listAdminRateFloorOverrides({ signal, activeOnly: true }),
    enabled: tab === 'overrides',
  });

  const holidaysQuery = useQuery({
    queryKey: ['admin', 'public-holidays', holidayFilter || 'all'],
    queryFn: ({ signal }) =>
      listAdminPublicHolidays({
        signal,
        state: holidayFilter.trim() || undefined,
      }),
    enabled: tab === 'holidays',
  });

  const checksQuery = useQuery({
    queryKey: ['admin', 'rate-floor', 'checks', auditJobId, auditResult, auditFrom, auditTo],
    queryFn: ({ signal }) =>
      listAdminRateFloorChecks({
        signal,
        jobId: auditJobId.trim() || undefined,
        result: auditResult || undefined,
        from: auditFrom.trim() || undefined,
        to: auditTo.trim() || undefined,
        limit: 100,
      }),
    enabled: tab === 'audit',
  });

  const draftMutation = useMutation({
    mutationFn: () => createAdminRateFloorDraft(),
    onSuccess: async (v) => {
      toast.success(t('adminRateFloor.draftCreated', { defaultValue: 'Draft created' }));
      await qc.invalidateQueries({ queryKey: ['admin', 'rate-floor'] });
      setSelectedId(v.id);
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const submitApprovalMutation = useMutation({
    mutationFn: (id: string) => submitAdminRateFloorApproval(id),
    onSuccess: async () => {
      toast.success(
        t('adminRateFloor.submitted', { defaultValue: 'Submitted for second-admin publish' }),
      );
      await qc.invalidateQueries({ queryKey: ['admin', 'rate-floor'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const withdrawApprovalMutation = useMutation({
    mutationFn: (id: string) => withdrawAdminRateFloorApproval(id),
    onSuccess: async () => {
      toast.success(t('adminRateFloor.withdrawn', { defaultValue: 'Approval withdrawn' }));
      await qc.invalidateQueries({ queryKey: ['admin', 'rate-floor'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishAdminRateFloorVersion(id),
    onSuccess: async () => {
      toast.success(t('adminRateFloor.published', { defaultValue: 'Floor version published' }));
      await qc.invalidateQueries({ queryKey: ['admin', 'rate-floor'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const overrideMutation = useMutation({
    mutationFn: createAdminRateFloorOverride,
    onSuccess: async () => {
      toast.success(t('adminRateFloor.overrideCreated', { defaultValue: 'Override created' }));
      setOverrideJobId('');
      setOverrideReason('');
      setOverrideExpires('');
      setOverrideFloorDollars('');
      await qc.invalidateQueries({ queryKey: ['admin', 'rate-floor', 'overrides'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const expireOverrideMutation = useMutation({
    mutationFn: expireAdminRateFloorOverride,
    onSuccess: async () => {
      toast.success(t('adminRateFloor.overrideExpired', { defaultValue: 'Override expired' }));
      await qc.invalidateQueries({ queryKey: ['admin', 'rate-floor', 'overrides'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const patchMutation = useMutation({
    mutationFn: (args: {
      code: string;
      hourlyFloorCents: number;
      kmFloorCents: number;
      variableKmCents: number;
      litresPerKm: number;
      basis: 'V' | 'W' | 'D';
    }) =>
      patchAdminRateFloorLine(selectedId!, args.code, {
        hourlyFloorCents: args.hourlyFloorCents,
        kmFloorCents: args.kmFloorCents,
        variableKmCents: args.variableKmCents,
        litresPerKm: args.litresPerKm,
        basis: args.basis,
      }),
    onSuccess: async () => {
      toast.success(t('adminRateFloor.lineSaved', { defaultValue: 'Floor line saved' }));
      setEditCode(null);
      await qc.invalidateQueries({ queryKey: ['admin', 'rate-floor', 'version', selectedId] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const bodyPatchMutation = useMutation({
    mutationFn: (args: { code: string; loadingPct: number; minHours: number | null }) =>
      patchAdminRateFloorBody(selectedId!, args.code, {
        loadingPct: args.loadingPct,
        minHours: args.minHours,
      }),
    onSuccess: async () => {
      toast.success(t('adminRateFloor.bodySaved', { defaultValue: 'Body loading saved' }));
      setEditBodyCode(null);
      await qc.invalidateQueries({ queryKey: ['admin', 'rate-floor', 'version', selectedId] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const holidayUpsertMutation = useMutation({
    mutationFn: upsertAdminPublicHoliday,
    onSuccess: async () => {
      toast.success(t('adminRateFloor.holidaySaved', { defaultValue: 'Holiday saved' }));
      setHolidayDate('');
      setHolidayName('');
      await qc.invalidateQueries({ queryKey: ['admin', 'public-holidays'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const holidayDeleteMutation = useMutation({
    mutationFn: deleteAdminPublicHoliday,
    onSuccess: async () => {
      toast.success(t('adminRateFloor.holidayDeleted', { defaultValue: 'Holiday deleted' }));
      await qc.invalidateQueries({ queryKey: ['admin', 'public-holidays'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const fuelMutation = useMutation({
    mutationFn: (input: {
      dieselCpl: number;
      note?: string;
      weekStart?: string;
      confirm?: boolean;
    }) => createAdminFuelIndex(input),
    onSuccess: async () => {
      toast.success(t('adminRateFloor.fuelSaved', { defaultValue: 'Fuel index saved' }));
      setDieselCpl('');
      setFuelNote('');
      await qc.invalidateQueries({ queryKey: ['admin', 'fuel-index'] });
    },
  });

  const versions = versionsQuery.data ?? [];
  const lines = useMemo(() => detailQuery.data?.lines ?? [], [detailQuery.data?.lines]);
  const bodyLoadings = useMemo(
    () => detailQuery.data?.bodyLoadings ?? [],
    [detailQuery.data?.bodyLoadings],
  );
  const isDraft = detailQuery.data?.status === 'DRAFT';
  const pendingApproval = Boolean(detailQuery.data?.approvalSubmittedAt);
  const fuelStatus = fuelStatusQuery.data;

  if (role !== AdminRole.SUPER_ADMIN) {
    return <Navigate to="/" replace />;
  }

  function startEdit(line: RateFloorLineDto) {
    setEditCode(line.vehicleClassCode);
    setHourlyDollars(centsToDollars(line.hourlyFloorCents));
    setKmDollars(centsToDollars(line.kmFloorCents));
    setVariableKmDollars(centsToDollars(line.variableKmCents));
    setLitresPerKm(String(line.litresPerKm));
    setBasis(
      line.basis === 'W' || line.basis === 'D' || line.basis === 'V' ? line.basis : 'V',
    );
  }

  function startBodyEdit(row: RateFloorBodyLoadingDto) {
    setEditBodyCode(row.bodyCode);
    setBodyPct(String(row.loadingPct));
    setBodyMinHours(row.minHours != null ? String(row.minHours) : '');
  }

  async function saveEdit() {
    if (!editCode) return;
    const hourlyFloorCents = dollarsToCents(hourlyDollars);
    const kmFloorCents = dollarsToCents(kmDollars);
    const variableKmCents = dollarsToCentsAllowZero(variableKmDollars);
    const litres = Number(litresPerKm);
    if (
      hourlyFloorCents == null ||
      kmFloorCents == null ||
      variableKmCents == null ||
      !Number.isFinite(litres) ||
      litres < 0
    ) {
      toast.error(
        t('adminRateFloor.invalidCents', {
          defaultValue: 'Enter valid floor $, variable $/km, and litres/km',
        }),
      );
      return;
    }
    await patchMutation.mutateAsync({
      code: editCode,
      hourlyFloorCents,
      kmFloorCents,
      variableKmCents,
      litresPerKm: litres,
      basis,
    });
  }

  async function saveBodyEdit() {
    if (!editBodyCode) return;
    const pct = Number(bodyPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 200) {
      toast.error(
        t('adminRateFloor.invalidBodyPct', { defaultValue: 'Loading % must be 0–200' }),
      );
      return;
    }
    const minHoursRaw = bodyMinHours.trim();
    const minHours =
      minHoursRaw === ''
        ? null
        : Number.isFinite(Number(minHoursRaw))
          ? Number(minHoursRaw)
          : NaN;
    if (minHoursRaw !== '' && Number.isNaN(minHours as number)) {
      toast.error(
        t('adminRateFloor.invalidBodyHours', { defaultValue: 'Min hours must be a number' }),
      );
      return;
    }
    await bodyPatchMutation.mutateAsync({
      code: editBodyCode,
      loadingPct: pct,
      minHours: minHours as number | null,
    });
  }

  async function submitFuel(confirmMove = false) {
    const cpl = Number(dieselCpl);
    if (!Number.isFinite(cpl) || cpl < 50 || cpl > 500) {
      toast.error(
        t('adminRateFloor.invalidDiesel', {
          defaultValue: 'Enter diesel as c/L between 50 and 500',
        }),
      );
      return;
    }
    try {
      await fuelMutation.mutateAsync({
        dieselCpl: cpl,
        note: fuelNote.trim() || undefined,
        weekStart: fuelWeekStart.trim() || undefined,
        confirm: confirmMove || undefined,
      });
    } catch (err) {
      if (!confirmMove && fuelConfirmRequired(err)) {
        const ok = await confirm({
          title: t('adminRateFloor.fuelConfirmTitle', {
            defaultValue: 'Large diesel move — confirm?',
          }),
          description: getErrorDetail(err),
          tone: 'default',
        });
        if (ok) await submitFuel(true);
        return;
      }
      toast.error(getErrorDetail(err));
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'versions', label: t('adminRateFloor.tabVersions', { defaultValue: 'Versions' }) },
    { id: 'fuel', label: t('adminRateFloor.tabFuel', { defaultValue: 'Fuel index' }) },
    { id: 'holidays', label: t('adminRateFloor.tabHolidays', { defaultValue: 'Holidays' }) },
    { id: 'audit', label: t('adminRateFloor.tabAudit', { defaultValue: 'Floor audit' }) },
    { id: 'overrides', label: t('adminRateFloor.tabOverrides', { defaultValue: 'Overrides' }) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-clox-ink">
            {t('adminRateFloor.title', { defaultValue: 'Rate floor versions' })}
          </h1>
          <p className="mt-1 text-sm text-clox-muted">
            {t('adminRateFloor.subtitle', {
              defaultValue:
                'Hard cost-recovery floors (sender-facing). Dual-approve publish: creator submits, second Super publishes.',
            })}
          </p>
        </div>
        {tab === 'versions' ? (
          <Button
            type="button"
            onClick={() => draftMutation.mutate()}
            disabled={draftMutation.isPending}
          >
            {t('adminRateFloor.newDraft', { defaultValue: 'New draft from published' })}
          </Button>
        ) : null}
      </div>

      {fuelStatus?.isStale ? (
        <Notice tone="warn">
          {t('adminRateFloor.fuelStale', {
            defaultValue:
              'Diesel index is stale ({{ageDays}} days old; threshold {{staleDays}}). Enter this week’s AIP national average.',
            ageDays: fuelStatus.ageDays ?? '—',
            staleDays: fuelStatus.fuelStaleDays,
          })}
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-clox-border pb-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={tab === item.id ? 'primary' : 'ghost'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === 'overrides' ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-clox-md border border-clox-border bg-clox-surface p-4 sm:grid-cols-2">
            <Field
              label={t('adminRateFloor.overrideJobId', { defaultValue: 'Job ID' })}
              value={overrideJobId}
              onChange={(e) => setOverrideJobId(e.target.value)}
            />
            <Field
              label={t('adminRateFloor.overrideExpires', {
                defaultValue: 'Expires (ISO datetime)',
              })}
              value={overrideExpires}
              onChange={(e) => setOverrideExpires(e.target.value)}
              placeholder="2026-12-01T00:00:00+11:00"
            />
            <Field
              label={t('adminRateFloor.overrideFloor', {
                defaultValue: 'Floor override (ex GST $)',
              })}
              value={overrideFloorDollars}
              onChange={(e) => setOverrideFloorDollars(e.target.value)}
            />
            <Field
              label={t('adminRateFloor.overrideReason', { defaultValue: 'Reason' })}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
            <div className="sm:col-span-2">
              <Button
                type="button"
                disabled={overrideMutation.isPending}
                onClick={() => {
                  const cents = dollarsToCents(overrideFloorDollars);
                  if (!overrideJobId.trim() || cents == null || !overrideExpires.trim()) {
                    toast.error(
                      t('adminRateFloor.overrideInvalid', {
                        defaultValue: 'Job ID, future expiry, and floor $ required',
                      }),
                    );
                    return;
                  }
                  overrideMutation.mutate({
                    jobId: overrideJobId.trim(),
                    reason: overrideReason.trim() || 'Ops floor override',
                    expiresAt: overrideExpires.trim(),
                    floorExGstCentsOverride: cents,
                  });
                }}
              >
                {t('adminRateFloor.saveOverride', { defaultValue: 'Create override' })}
              </Button>
            </div>
          </div>
          {overridesQuery.isLoading ? <LoadingBlock /> : null}
          <div className="overflow-x-auto rounded-clox-md border border-clox-border bg-clox-surface">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-clox-border text-clox-muted">
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Floor ex GST</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2">Approver</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(overridesQuery.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-clox-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{row.jobId}</td>
                    <td className="px-3 py-2">${centsToDollars(row.floorExGstCentsOverride)}</td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(row.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-clox-muted">
                      {row.approvedByAdmin?.email ?? row.approvedByAdminId}
                    </td>
                    <td className="px-3 py-2 text-clox-muted">{row.reason}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={expireOverrideMutation.isPending}
                        onClick={() => expireOverrideMutation.mutate(row.id)}
                      >
                        {t('adminRateFloor.expireNow', { defaultValue: 'Expire now' })}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'holidays' ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-clox-md border border-clox-border bg-clox-surface p-4 sm:grid-cols-4">
            <Field
              label={t('adminRateFloor.holidayState', { defaultValue: 'State / NATIONAL' })}
              value={holidayState}
              onChange={(e) => setHolidayState(e.target.value.toUpperCase())}
            />
            <Field
              label={t('adminRateFloor.holidayDate', { defaultValue: 'Date' })}
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
            <Field
              label={t('adminRateFloor.holidayName', { defaultValue: 'Name' })}
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
            />
            <div className="flex items-end">
              <Button
                type="button"
                disabled={holidayUpsertMutation.isPending}
                onClick={() => {
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate) || holidayName.trim().length < 2) {
                    toast.error(
                      t('adminRateFloor.holidayInvalid', {
                        defaultValue: 'Date (YYYY-MM-DD) and name required',
                      }),
                    );
                    return;
                  }
                  holidayUpsertMutation.mutate({
                    state: holidayState.trim() || 'NATIONAL',
                    holidayDate,
                    name: holidayName.trim(),
                  });
                }}
              >
                {t('adminRateFloor.saveHoliday', { defaultValue: 'Save holiday' })}
              </Button>
            </div>
          </div>
          <Field
            label={t('adminRateFloor.holidayFilter', {
              defaultValue: 'Filter by state (optional)',
            })}
            value={holidayFilter}
            onChange={(e) => setHolidayFilter(e.target.value.toUpperCase())}
            placeholder="VIC"
          />
          {holidaysQuery.isLoading ? <LoadingBlock /> : null}
          <div className="overflow-x-auto rounded-clox-md border border-clox-border bg-clox-surface">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-clox-border text-clox-muted">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(holidaysQuery.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-clox-border/60">
                    <td className="px-3 py-2 font-mono text-xs">
                      {holidayDateIso(row.holidayDate)}
                    </td>
                    <td className="px-3 py-2">{row.state}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={holidayDeleteMutation.isPending}
                        onClick={() => holidayDeleteMutation.mutate(row.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'audit' ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-clox-md border border-clox-border bg-clox-surface p-4 sm:grid-cols-4">
            <Field
              label={t('adminRateFloor.auditJobId', { defaultValue: 'Job ID' })}
              value={auditJobId}
              onChange={(e) => setAuditJobId(e.target.value)}
            />
            <label className="block text-sm">
              <span className="mb-1 block text-clox-muted">
                {t('adminRateFloor.auditResult', { defaultValue: 'Result' })}
              </span>
              <select
                className="clox-field-control w-full"
                value={auditResult}
                onChange={(e) =>
                  setAuditResult(e.target.value as '' | 'PASS' | 'REJECT' | 'OVERRIDE')
                }
              >
                <option value="">All</option>
                <option value="PASS">PASS</option>
                <option value="REJECT">REJECT</option>
                <option value="OVERRIDE">OVERRIDE</option>
              </select>
            </label>
            <Field
              label={t('adminRateFloor.auditFrom', { defaultValue: 'From (YYYY-MM-DD)' })}
              value={auditFrom}
              onChange={(e) => setAuditFrom(e.target.value)}
            />
            <Field
              label={t('adminRateFloor.auditTo', { defaultValue: 'To (YYYY-MM-DD)' })}
              value={auditTo}
              onChange={(e) => setAuditTo(e.target.value)}
            />
            <div className="sm:col-span-4">
              <Button
                type="button"
                variant="secondary"
                disabled={exportingChecks}
                onClick={() => {
                  void (async () => {
                    setExportingChecks(true);
                    try {
                      await exportAdminRateFloorChecksCsv({
                        jobId: auditJobId.trim() || undefined,
                        result: auditResult || undefined,
                        from: auditFrom.trim() || undefined,
                        to: auditTo.trim() || undefined,
                      });
                      toast.success(
                        t('adminRateFloor.auditExported', { defaultValue: 'CSV downloaded' }),
                      );
                    } catch (err) {
                      toast.error(getErrorDetail(err));
                    } finally {
                      setExportingChecks(false);
                    }
                  })();
                }}
              >
                {exportingChecks
                  ? t('loading')
                  : t('adminRateFloor.exportCsv', { defaultValue: 'Export CSV' })}
              </Button>
            </div>
          </div>
          {checksQuery.isLoading ? <LoadingBlock /> : null}
          <div className="overflow-x-auto rounded-clox-md border border-clox-border bg-clox-surface">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-clox-border text-clox-muted">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Floor inc GST</th>
                  <th className="px-3 py-2">Offered</th>
                </tr>
              </thead>
              <tbody>
                {(checksQuery.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-clox-border/60">
                    <td className="px-3 py-2 text-xs">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill
                        tone={
                          row.result === 'PASS'
                            ? 'ok'
                            : row.result === 'REJECT'
                              ? 'warn'
                              : 'neutral'
                        }
                      >
                        {row.result}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.jobId ?? '—'}</td>
                    <td className="px-3 py-2">${centsToDollars(row.floorIncGstCents)}</td>
                    <td className="px-3 py-2">
                      {row.offeredIncGstCents != null
                        ? `$${centsToDollars(row.offeredIncGstCents)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'fuel' ? (
        <div className="space-y-4">
          {fuelStatusQuery.isLoading ? <LoadingBlock /> : null}
          {fuelStatus?.latest ? (
            <p className="text-sm text-clox-muted">
              Latest: {fuelStatus.latest.dieselCpl} c/L · week of {fuelStatus.latest.weekStart}
              {fuelStatus.ageDays != null ? ` · ${fuelStatus.ageDays}d old` : ''}
            </p>
          ) : null}

          <div className="grid gap-3 rounded-clox-md border border-clox-border bg-clox-surface p-4 sm:grid-cols-3">
            <Field
              label={t('adminRateFloor.dieselCpl', { defaultValue: 'Diesel c/L' })}
              value={dieselCpl}
              onChange={(e) => setDieselCpl(e.target.value)}
              placeholder="211.4"
            />
            <Field
              label={t('adminRateFloor.weekStart', {
                defaultValue: 'Week start (Mon, optional)',
              })}
              value={fuelWeekStart}
              onChange={(e) => setFuelWeekStart(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
            <Field
              label={t('adminRateFloor.fuelNote', { defaultValue: 'Note (optional)' })}
              value={fuelNote}
              onChange={(e) => setFuelNote(e.target.value)}
            />
            <div className="sm:col-span-3">
              <Button
                type="button"
                onClick={() => void submitFuel(false)}
                disabled={fuelMutation.isPending}
              >
                {t('adminRateFloor.saveFuel', { defaultValue: 'Save weekly diesel' })}
              </Button>
            </div>
          </div>

          {fuelListQuery.isLoading ? <LoadingBlock /> : null}
          {fuelListQuery.data ? <FuelHistoryChart rows={fuelListQuery.data} /> : null}
          {fuelListQuery.isError ? (
            <Notice tone="error">{getErrorDetail(fuelListQuery.error)}</Notice>
          ) : null}
          <div className="overflow-x-auto rounded-clox-md border border-clox-border bg-clox-surface">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-clox-border text-clox-muted">
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Diesel c/L</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Entered</th>
                </tr>
              </thead>
              <tbody>
                {(fuelListQuery.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-clox-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{row.weekStart}</td>
                    <td className="px-3 py-2">{row.dieselCpl}</td>
                    <td className="px-3 py-2 text-clox-muted">{row.note ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-clox-muted">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'versions' ? (
        <>
          {versionsQuery.isLoading ? <LoadingBlock /> : null}
          {versionsQuery.isError ? (
            <Notice tone="error">{getErrorDetail(versionsQuery.error)}</Notice>
          ) : null}

          {!versionsQuery.isLoading && versions.length === 0 ? (
            <EmptyBlock
              title={t('adminRateFloor.empty', { defaultValue: 'No floor versions yet' })}
              description={t('adminRateFloor.emptyHint', {
                defaultValue: 'Run API seed or create a draft after the first published seed exists.',
              })}
            />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-2 rounded-clox-md border border-clox-border bg-clox-surface p-3">
              {versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-clox-sm px-3 py-2 text-left text-sm ${
                    selectedId === v.id
                      ? 'bg-clox-surface-alt font-semibold'
                      : 'hover:bg-clox-surface-alt'
                  }`}
                  onClick={() => setSelectedId(v.id)}
                >
                  <span className="truncate">{v.label}</span>
                  <StatusPill
                    tone={
                      v.status === 'PUBLISHED' ? 'ok' : v.status === 'DRAFT' ? 'warn' : 'neutral'
                    }
                  >
                    {v.status}
                  </StatusPill>
                </button>
              ))}
            </div>

            <div className="rounded-clox-md border border-clox-border bg-clox-surface p-4">
              {!selectedId ? (
                <p className="text-sm text-clox-muted">
                  {t('adminRateFloor.pickVersion', {
                    defaultValue: 'Select a version to view lines.',
                  })}
                </p>
              ) : detailQuery.isLoading ? (
                <LoadingBlock />
              ) : detailQuery.data ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-lg font-semibold">
                        {detailQuery.data.label}
                      </h2>
                      <p className="text-xs text-clox-muted">
                        min {detailQuery.data.minHours}h · {detailQuery.data.minKmChargeKm} km
                        charge · diesel ref {detailQuery.data.referenceDieselCpl} c/L · labour $
                        {(detailQuery.data.labourRateHrCents / 100).toFixed(2)}/hr
                      </p>
                      {detailQuery.data.labourMultipliers?.length ? (
                        <p className="mt-1 text-xs text-clox-muted">
                          Labour (read-only):{' '}
                          {detailQuery.data.labourMultipliers
                            .map((m) => `${m.periodCode}×${m.multiplier}`)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    {isDraft ? (
                      <div className="flex flex-wrap gap-2">
                        {pendingApproval ? (
                          <>
                            <StatusPill tone="warn">
                              {t('adminRateFloor.pendingApproval', {
                                defaultValue: 'Pending second Super',
                              })}
                            </StatusPill>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                withdrawApprovalMutation.mutate(detailQuery.data!.id)
                              }
                              disabled={withdrawApprovalMutation.isPending}
                            >
                              {t('adminRateFloor.withdraw', { defaultValue: 'Withdraw' })}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: t('adminRateFloor.publishConfirmTitle', {
                                    defaultValue: 'Approve & publish?',
                                  }),
                                  description: t('adminRateFloor.publishConfirmBody', {
                                    defaultValue:
                                      'Must be a different Super than the creator. Previous PUBLISHED version will be retired.',
                                  }),
                                  tone: 'default',
                                });
                                if (ok) publishMutation.mutate(detailQuery.data!.id);
                              }}
                              disabled={publishMutation.isPending}
                            >
                              {t('adminRateFloor.approvePublish', {
                                defaultValue: 'Approve & publish',
                              })}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => submitApprovalMutation.mutate(detailQuery.data!.id)}
                            disabled={submitApprovalMutation.isPending}
                          >
                            {t('adminRateFloor.submitApproval', {
                              defaultValue: 'Submit for approval',
                            })}
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-clox-border text-clox-muted">
                          <th className="px-2 py-2">Class</th>
                          <th className="px-2 py-2">Hourly</th>
                          <th className="px-2 py-2">Per-km</th>
                          <th className="px-2 py-2">Var $/km</th>
                          <th className="px-2 py-2">L/km</th>
                          <th className="px-2 py-2">Basis</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.id} className="border-b border-clox-border/60">
                            <td className="px-2 py-2 font-mono text-xs">
                              {line.vehicleClassCode}
                            </td>
                            <td className="px-2 py-2">
                              {editCode === line.vehicleClassCode ? (
                                <Field
                                  label=""
                                  value={hourlyDollars}
                                  onChange={(e) => setHourlyDollars(e.target.value)}
                                />
                              ) : (
                                `$${centsToDollars(line.hourlyFloorCents)}`
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {editCode === line.vehicleClassCode ? (
                                <Field
                                  label=""
                                  value={kmDollars}
                                  onChange={(e) => setKmDollars(e.target.value)}
                                />
                              ) : (
                                `$${centsToDollars(line.kmFloorCents)}`
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {editCode === line.vehicleClassCode ? (
                                <Field
                                  label=""
                                  value={variableKmDollars}
                                  onChange={(e) => setVariableKmDollars(e.target.value)}
                                />
                              ) : (
                                `$${centsToDollars(line.variableKmCents)}`
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {editCode === line.vehicleClassCode ? (
                                <Field
                                  label=""
                                  value={litresPerKm}
                                  onChange={(e) => setLitresPerKm(e.target.value)}
                                />
                              ) : (
                                line.litresPerKm
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {editCode === line.vehicleClassCode ? (
                                <select
                                  className="clox-field-control"
                                  value={basis}
                                  onChange={(e) =>
                                    setBasis(e.target.value as 'V' | 'W' | 'D')
                                  }
                                >
                                  <option value="V">V</option>
                                  <option value="W">W</option>
                                  <option value="D">D</option>
                                </select>
                              ) : (
                                line.basis
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {isDraft && !pendingApproval ? (
                                editCode === line.vehicleClassCode ? (
                                  <div className="flex justify-end gap-2">
                                    <Button type="button" size="sm" onClick={() => void saveEdit()}>
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditCode(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEdit(line)}
                                  >
                                    Edit
                                  </Button>
                                )
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h3 className="mb-2 font-display text-sm font-semibold text-clox-ink">
                      {t('adminRateFloor.bodyTitle', {
                        defaultValue: 'Body loadings',
                      })}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-clox-border text-clox-muted">
                            <th className="px-2 py-2">Body</th>
                            <th className="px-2 py-2">Loading %</th>
                            <th className="px-2 py-2">Min hours</th>
                            <th className="px-2 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {bodyLoadings.map((row) => (
                            <tr key={row.id} className="border-b border-clox-border/60">
                              <td className="px-2 py-2 font-mono text-xs">{row.bodyCode}</td>
                              <td className="px-2 py-2">
                                {editBodyCode === row.bodyCode ? (
                                  <Field
                                    label=""
                                    value={bodyPct}
                                    onChange={(e) => setBodyPct(e.target.value)}
                                  />
                                ) : (
                                  `${row.loadingPct}%`
                                )}
                              </td>
                              <td className="px-2 py-2">
                                {editBodyCode === row.bodyCode ? (
                                  <Field
                                    label=""
                                    value={bodyMinHours}
                                    onChange={(e) => setBodyMinHours(e.target.value)}
                                    placeholder="blank = none"
                                  />
                                ) : (
                                  row.minHours ?? '—'
                                )}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {isDraft && !pendingApproval ? (
                                  editBodyCode === row.bodyCode ? (
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void saveBodyEdit()}
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditBodyCode(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startBodyEdit(row)}
                                    >
                                      Edit
                                    </Button>
                                  )
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
