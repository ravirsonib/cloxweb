import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { Button, Field, Notice, StatusPill, useConfirm, useToast } from '@/components/ui';
import {
  EWD_SCHEDULE_A_DECLARATION,
  createManualEwdRecord,
  generateEwdRoadsidePin,
  getErrorDetail,
  getEwdTodaySheet,
  listEwdRecords,
  signEwdDailySheet,
  switchEwdActivity,
  type EwdActivityType,
} from '@/lib/api';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function dateIsoFromSheetDate(value: string): string {
  // Prisma Date may arrive as ISO datetime; sign API wants YYYY-MM-DD.
  return value.slice(0, 10);
}

export function DriverEwdPage() {
  const { t } = useTranslation('common');
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [signature, setSignature] = useState('');
  const [editActivity, setEditActivity] = useState<EwdActivityType>('WORK');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editReason, setEditReason] = useState('');
  const [pinDisplay, setPinDisplay] = useState<{ pin: string; expiresAt: string } | null>(null);

  const recordsQuery = useQuery({
    queryKey: ['driver', 'ewd', 'records', 14],
    queryFn: () => listEwdRecords(14),
  });

  const sheetQuery = useQuery({
    queryKey: ['driver', 'ewd', 'sheet', 'today'],
    queryFn: getEwdTodaySheet,
  });

  const switchMut = useMutation({
    mutationFn: (activity: EwdActivityType) =>
      switchEwdActivity({
        activity,
        workType: activity === 'WORK' ? 'DRIVING' : undefined,
      }),
    onSuccess: async () => {
      toast.success(t('driverEwd.switched', { defaultValue: 'Activity updated' }));
      await qc.invalidateQueries({ queryKey: ['driver', 'ewd'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const signMut = useMutation({
    mutationFn: () => {
      const date = sheetQuery.data?.date
        ? dateIsoFromSheetDate(String(sheetQuery.data.date))
        : new Date().toISOString().slice(0, 10);
      return signEwdDailySheet({ date, signature: signature.trim() });
    },
    onSuccess: async () => {
      toast.success(t('driverEwd.signed', { defaultValue: 'Daily sheet signed' }));
      setSignature('');
      await qc.invalidateQueries({ queryKey: ['driver', 'ewd'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const manualMut = useMutation({
    mutationFn: () =>
      createManualEwdRecord({
        activity: editActivity,
        startTime: new Date(editStart).toISOString(),
        endTime: new Date(editEnd).toISOString(),
        editReason: editReason.trim(),
      }),
    onSuccess: async () => {
      toast.success(t('driverEwd.manualSaved', { defaultValue: 'Correction saved' }));
      setEditReason('');
      await qc.invalidateQueries({ queryKey: ['driver', 'ewd'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const pinMut = useMutation({
    mutationFn: generateEwdRoadsidePin,
    onSuccess: (row) => {
      setPinDisplay({ pin: row.accessPin, expiresAt: row.expiresAt });
      toast.success(t('driverEwd.pinReady', { defaultValue: 'Roadside PIN ready' }));
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const sheetDateLabel = useMemo(() => {
    if (!sheetQuery.data?.date) return '—';
    return dateIsoFromSheetDate(String(sheetQuery.data.date));
  }, [sheetQuery.data?.date]);

  async function onSwitch(activity: EwdActivityType) {
    const ok = await confirm({
      title:
        activity === 'REST'
          ? t('driverEwd.confirmRestTitle', { defaultValue: 'Start REST?' })
          : t('driverEwd.confirmWorkTitle', { defaultValue: 'Start WORK?' }),
      description: t('driverEwd.confirmSwitchBody', {
        defaultValue: 'Closes the current interval and opens a new one in your work diary.',
      }),
      confirmLabel: activity === 'REST' ? 'REST' : 'WORK',
    });
    if (ok) switchMut.mutate(activity);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-clox-ink">
          {t('driverEwd.title', { defaultValue: 'Work diary (pilot)' })}
        </h1>
        <p className="mt-1 text-sm text-clox-mute">
          {t('driverEwd.subtitle', {
            defaultValue:
              'Standard Hours fatigue stub · logs WORK/REST for NHVR roadside and daily sign-off.',
          })}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="block"
          variant="cta"
          disabled={switchMut.isPending}
          onClick={() => void onSwitch('WORK')}
        >
          {t('driverEwd.startWork', { defaultValue: 'Start WORK' })}
        </Button>
        <Button
          type="button"
          size="block"
          variant="secondary"
          disabled={switchMut.isPending}
          onClick={() => void onSwitch('REST')}
        >
          {t('driverEwd.startRest', { defaultValue: 'Start REST' })}
        </Button>
      </div>

      <section className="space-y-3 rounded-clox-md border border-clox-border bg-clox-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">
            {t('driverEwd.todaySheet', { defaultValue: 'Today’s sheet' })}
          </h2>
          {sheetQuery.data ? (
            <StatusPill tone={sheetQuery.data.status === 'SUBMITTED' ? 'ok' : 'warn'}>
              {sheetQuery.data.status}
            </StatusPill>
          ) : null}
        </div>
        {sheetQuery.isLoading ? <LoadingBlock /> : null}
        {sheetQuery.isError ? (
          <Notice tone="error">{getErrorDetail(sheetQuery.error)}</Notice>
        ) : null}
        {sheetQuery.data ? (
          <p className="text-sm text-clox-mute">
            {sheetDateLabel} · {sheetQuery.data.timezone} · work{' '}
            {sheetQuery.data.totalWorkMinutes}m · rest {sheetQuery.data.totalRestMinutes}m
          </p>
        ) : null}
        <Notice tone="info">
          <p className="text-xs leading-relaxed">{EWD_SCHEDULE_A_DECLARATION}</p>
        </Notice>
        <Field
          label={t('driverEwd.signature', { defaultValue: 'Type full name to sign' })}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          disabled={sheetQuery.data?.status === 'SUBMITTED'}
        />
        <Button
          type="button"
          disabled={
            signMut.isPending ||
            signature.trim().length < 5 ||
            sheetQuery.data?.status === 'SUBMITTED'
          }
          onClick={() => signMut.mutate()}
        >
          {t('driverEwd.signSheet', { defaultValue: 'Sign daily sheet' })}
        </Button>
      </section>

      <section className="space-y-3 rounded-clox-md border border-clox-border bg-clox-surface p-4">
        <h2 className="font-display text-lg font-semibold">
          {t('driverEwd.roadside', { defaultValue: 'Roadside inspection PIN' })}
        </h2>
        <p className="text-sm text-clox-mute">
          {t('driverEwd.roadsideHint', {
            defaultValue: 'Generate a temporary PIN for an inspector (valid ~30 minutes).',
          })}
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={pinMut.isPending}
          onClick={() => pinMut.mutate()}
        >
          {t('driverEwd.generatePin', { defaultValue: 'Generate PIN' })}
        </Button>
        {pinDisplay ? (
          <div className="rounded-clox-sm bg-clox-surface-alt px-3 py-3 text-center">
            <p className="font-mono text-3xl font-semibold tracking-widest">{pinDisplay.pin}</p>
            <p className="mt-1 text-xs text-clox-mute">
              {t('driverEwd.pinExpires', {
                defaultValue: 'Expires {{when}}',
                when: formatWhen(pinDisplay.expiresAt),
              })}
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-clox-md border border-clox-border bg-clox-surface p-4">
        <h2 className="font-display text-lg font-semibold">
          {t('driverEwd.history', { defaultValue: 'Recent intervals' })}
        </h2>
        {recordsQuery.isLoading ? <LoadingBlock /> : null}
        {recordsQuery.isError ? (
          <Notice tone="error">{getErrorDetail(recordsQuery.error)}</Notice>
        ) : null}
        {!recordsQuery.isLoading && (recordsQuery.data?.length ?? 0) === 0 ? (
          <EmptyBlock
            title={t('driverEwd.emptyHistory', { defaultValue: 'No diary records yet' })}
            description={t('driverEwd.emptyHistoryHint', {
              defaultValue: 'Start WORK or REST, or begin an active trip.',
            })}
          />
        ) : null}
        <ul className="divide-y divide-clox-border/60">
          {(recordsQuery.data ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">
                  {row.activity}
                  {row.isEdited ? (
                    <span className="ml-2 text-xs text-amber-700">edited</span>
                  ) : null}
                </p>
                <p className="text-xs text-clox-mute">
                  {formatWhen(row.startTime)} → {formatWhen(row.endTime)}
                  {row.durationMinutes != null ? ` · ${row.durationMinutes}m` : ''}
                </p>
                {row.editReason ? (
                  <p className="text-xs text-clox-mute">{row.editReason}</p>
                ) : null}
              </div>
              {row.vehicleRego ? (
                <span className="font-mono text-xs text-clox-mute">{row.vehicleRego}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-clox-md border border-clox-border bg-clox-surface p-4">
        <h2 className="font-display text-lg font-semibold">
          {t('driverEwd.correction', { defaultValue: 'Manual correction' })}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-clox-mute">Activity</span>
            <select
              className="w-full rounded-clox-sm border border-clox-border bg-clox-surface px-3 py-2"
              value={editActivity}
              onChange={(e) => setEditActivity(e.target.value as EwdActivityType)}
            >
              <option value="WORK">WORK</option>
              <option value="REST">REST</option>
            </select>
          </label>
          <Field
            label="Reason (required)"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
          />
          <Field
            label="Start (local)"
            type="datetime-local"
            value={editStart}
            onChange={(e) => setEditStart(e.target.value)}
          />
          <Field
            label="End (local)"
            type="datetime-local"
            value={editEnd}
            onChange={(e) => setEditEnd(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={
            manualMut.isPending ||
            editReason.trim().length < 5 ||
            !editStart ||
            !editEnd
          }
          onClick={() => manualMut.mutate()}
        >
          {t('driverEwd.saveCorrection', { defaultValue: 'Save correction' })}
        </Button>
      </section>
    </div>
  );
}
