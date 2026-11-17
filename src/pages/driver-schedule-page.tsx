import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  ActionGroup,
  Button,
  DataCardList,
  DataTable,
  Field,
  Notice,
  PaginationBar,
  ResponsiveDataView,
  Select,
  StatusPill,
  TextArea,
  dataCardClassName,
  useClientPagination,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  cancelDriverSchedule,
  getErrorDetail,
  getMyDriverSchedule,
  requestDriverTimeOff,
  type DriverScheduleEntryItem,
  type DriverTimeOffType,
} from '@/lib/api';
import { formatDateTime, isDatetimeLocalNotInPast, minDatetimeLocalValue } from '@/lib/datetime';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const TIME_OFF_TYPES: DriverTimeOffType[] = [
  'ANNUAL_LEAVE',
  'MEDICAL_LEAVE',
  'ROSTERED_OFF',
  'PERSONAL',
  'OVERTIME_AVAILABLE',
];

type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

function scheduleStatusTone(status: string): StatusTone {
  switch (status) {
    case 'APPROVED':
      return 'ok';
    case 'PENDING':
      return 'warn';
    case 'REJECTED':
      return 'danger';
    case 'CANCELLED':
      return 'neutral';
    default:
      return 'info';
  }
}

/** Driver can self-cancel while the entry has not finished yet and is not already closed. */
function isCancellable(entry: DriverScheduleEntryItem): boolean {
  if (entry.status === 'CANCELLED' || entry.status === 'REJECTED') return false;
  return new Date(entry.endAt).getTime() > Date.now();
}

export function DriverSchedulePage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<DriverTimeOffType>('ANNUAL_LEAVE');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');

  const scheduleQuery = useQuery({
    queryKey: ['driver', 'schedule', 'mine'],
    queryFn: () => getMyDriverSchedule(),
    enabled: role === AppRole.DRIVER,
    staleTime: 5_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['driver', 'schedule', 'mine'] });

  const requestMutation = useMutation({
    mutationFn: () =>
      requestDriverTimeOff({
        type,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason: reason.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(
        t('driverSchedule.requestSuccess', {
          defaultValue: 'Time-off request submitted. Your carrier will review it shortly.',
        }),
      );
      setShowForm(false);
      setType('ANNUAL_LEAVE');
      setStartAt('');
      setEndAt('');
      setReason('');
      await invalidate();
    },
    // Inline Notice in the form shows the API error — do not also toast (duplicate).
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelDriverSchedule(id),
    onSuccess: async () => {
      toast.success(
        t('driverSchedule.cancelSuccess', { defaultValue: 'Schedule entry cancelled.' }),
      );
      await invalidate();
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  async function handleSubmitRequest() {
    if (!startAt || !endAt) {
      toast.error(
        t('driverSchedule.datesRequired', {
          defaultValue: 'Please provide both start and end date/time.',
        }),
      );
      return;
    }
    if (!isDatetimeLocalNotInPast(startAt) || !isDatetimeLocalNotInPast(endAt)) {
      toast.error(
        t('validation.datetimeNotInPast', {
          defaultValue: 'Choose a current or future date and time.',
        }),
      );
      return;
    }
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      toast.error(
        t('driverSchedule.startBeforeEnd', {
          defaultValue: 'Start time must be before end time.',
        }),
      );
      return;
    }
    const ok = await confirm({
      title: t('driverSchedule.confirmRequestTitle', { defaultValue: 'Submit Time-Off Request' }),
      description: t('driverSchedule.confirmRequestBody', {
        defaultValue: `Request ${type.replace(/_/g, ' ')} from ${formatDateTime(start)} to ${formatDateTime(end)}? Your carrier must approve this before it takes effect.`,
      }),
      confirmLabel: t('driverSchedule.confirmRequestCta', { defaultValue: 'Submit Request' }),
    });
    if (ok) {
      await requestMutation.mutateAsync();
    }
  }

  async function handleCancel(entry: DriverScheduleEntryItem) {
    const ok = await confirm({
      title: t('driverSchedule.confirmCancelTitle', { defaultValue: 'Cancel Schedule Entry' }),
      description: t('driverSchedule.confirmCancelBody', {
        defaultValue: `Cancel your ${entry.type.replace(/_/g, ' ')} entry from ${formatDateTime(entry.startAt)} to ${formatDateTime(entry.endAt)}?`,
      }),
      confirmLabel: t('driverSchedule.confirmCancelCta', { defaultValue: 'Cancel Entry' }),
      tone: 'destructive',
    });
    if (ok) {
      cancelMutation.mutate(entry.id);
    }
  }

  const items = scheduleQuery.data ?? [];
  const { page, setPage, totalPages, pagedItems } = useClientPagination(items, 10);

  if (role !== AppRole.DRIVER) return <Navigate to="/" replace />;

  function statusLabel(status: string) {
    return t(`driverSchedule.statuses.${status}`, { defaultValue: status });
  }

  function typeLabel(entryType: string) {
    return t(`driverSchedule.types.${entryType}`, {
      defaultValue: entryType.replace(/_/g, ' '),
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('driverSchedule.title', { defaultValue: 'My Schedule' })}
          </h1>
          <p className="mt-2 text-sm text-clox-mute">
            {t('driverSchedule.subtitle', {
              defaultValue: 'View your time-off and availability, and request new leave.',
            })}
          </p>
        </div>
        <Button type="button" variant="primary" onClick={() => setShowForm((open) => !open)}>
          {showForm
            ? t('cancel')
            : t('driverSchedule.requestTimeOff', { defaultValue: '+ Request Time-Off' })}
        </Button>
      </div>

      {showForm ? (
        <form
          className="clox-card mt-6 p-4 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (requestMutation.isPending) return;
            void handleSubmitRequest();
          }}
          noValidate
        >
          <fieldset disabled={requestMutation.isPending} className="min-w-0 border-0 p-0">
            <h2 className="font-display text-lg font-semibold text-clox-ink">
              {t('driverSchedule.formTitle', { defaultValue: 'Request time-off' })}
            </h2>
            <p className="mt-1 text-sm text-clox-mute">
              {t('driverSchedule.formHint', {
                defaultValue:
                  'Your carrier reviews each request before it is confirmed. You will not be matched to new jobs during an approved window.',
              })}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select
                label={t('driverSchedule.typeLabel', { defaultValue: 'Type' })}
                value={type}
                onChange={(e) => {
                  requestMutation.reset();
                  setType(e.target.value as DriverTimeOffType);
                }}
              >
                {TIME_OFF_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {typeLabel(item)}
                  </option>
                ))}
              </Select>
              <div className="hidden sm:block" aria-hidden />
              <Field
                type="datetime-local"
                label={t('driverSchedule.startAt', { defaultValue: 'Start date & time' })}
                value={startAt}
                onChange={(e) => {
                  requestMutation.reset();
                  setStartAt(e.target.value);
                }}
                min={minDatetimeLocalValue()}
                required
              />
              <Field
                type="datetime-local"
                label={t('driverSchedule.endAt', { defaultValue: 'End date & time' })}
                value={endAt}
                onChange={(e) => {
                  requestMutation.reset();
                  setEndAt(e.target.value);
                }}
                min={startAt && startAt >= minDatetimeLocalValue() ? startAt : minDatetimeLocalValue()}
                required
              />
            </div>
            <TextArea
              className="mt-3"
              label={t('driverSchedule.reasonLabel', { defaultValue: 'Reason (optional)' })}
              value={reason}
              onChange={(e) => {
                requestMutation.reset();
                setReason(e.target.value);
              }}
              placeholder={t('driverSchedule.reasonPlaceholder', {
                defaultValue: 'e.g. Family holiday, medical appointment',
              })}
              maxLength={500}
            />
            {requestMutation.isError ? (
              <Notice tone="error" className="mt-3">
                {getErrorDetail(requestMutation.error)}
              </Notice>
            ) : null}
            <div className="clox-form-actions mt-4">
              <Button
                type="button"
                variant="secondary"
                disabled={requestMutation.isPending}
                onClick={() => setShowForm(false)}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" variant="cta" disabled={requestMutation.isPending}>
                {requestMutation.isPending
                  ? t('loading')
                  : t('driverSchedule.submitRequest', { defaultValue: 'Submit Request' })}
              </Button>
            </div>
          </fieldset>
        </form>
      ) : null}

      {scheduleQuery.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {scheduleQuery.isError ? (
        <Notice tone="error" className="mt-8">
          {getErrorDetail(scheduleQuery.error)}
        </Notice>
      ) : null}

      {!scheduleQuery.isLoading && !scheduleQuery.isError ? (
        items.length === 0 ? (
          <div className="mt-6">
            <EmptyBlock
              title={t('driverSchedule.emptyTitle', { defaultValue: 'No schedule entries yet' })}
              description={t('driverSchedule.emptyHint', {
                defaultValue: 'Request time-off above to let your carrier know you are unavailable.',
              })}
            />
          </div>
        ) : (
          <>
            <ResponsiveDataView
              className="mt-6"
              cards={
                <DataCardList
                  items={pagedItems}
                  getKey={(row) => row.id}
                  renderItem={(row) => (
                    <div className={dataCardClassName}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-clox-ink">{typeLabel(row.type)}</p>
                        <StatusPill tone={scheduleStatusTone(row.status)}>
                          {statusLabel(row.status)}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-xs text-clox-mute">
                        {formatDateTime(row.startAt)} → {formatDateTime(row.endAt)}
                      </p>
                      {row.reason ? (
                        <p className="mt-1 text-xs text-clox-mute">{row.reason}</p>
                      ) : null}
                      {row.rejectionReason ? (
                        <p className="mt-1 text-xs font-medium text-clox-danger">
                          {t('driverSchedule.rejectionNote', { defaultValue: 'Note' })}:{' '}
                          {row.rejectionReason}
                        </p>
                      ) : null}
                      {isCancellable(row) ? (
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={cancelMutation.isPending}
                            onClick={() => void handleCancel(row)}
                          >
                            {t('driverSchedule.cancelEntry', { defaultValue: 'Cancel' })}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                />
              }
              table={
                <DataTable
                  minWidthClassName="min-w-[52rem]"
                  headers={[
                    t('driverSchedule.colType', { defaultValue: 'Type' }),
                    t('driverSchedule.colDates', { defaultValue: 'Time Window' }),
                    t('driverSchedule.colStatus', { defaultValue: 'Status' }),
                    t('driverSchedule.colReason', { defaultValue: 'Reason' }),
                    t('driverSchedule.colActions', { defaultValue: 'Actions' }),
                  ]}
                  headerClassNames={[undefined, undefined, undefined, undefined, 'text-right']}
                >
                  {pagedItems.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                    >
                      <td className="px-4 py-3 align-top text-clox-ink">{typeLabel(row.type)}</td>
                      <td className="px-4 py-3 align-top text-xs">
                        <p className="font-medium text-clox-ink">
                          {formatDateTime(row.startAt)} →
                        </p>
                        <p className="text-clox-mute">{formatDateTime(row.endAt)}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusPill tone={scheduleStatusTone(row.status)}>
                          {statusLabel(row.status)}
                        </StatusPill>
                        {row.rejectionReason ? (
                          <p
                            className="mt-0.5 max-w-[12rem] truncate text-[11px] text-clox-danger"
                            title={row.rejectionReason}
                          >
                            {row.rejectionReason}
                          </p>
                        ) : null}
                      </td>
                      <td className="max-w-[14rem] px-4 py-3 align-top text-xs text-clox-mute">
                        <span className="line-clamp-2" title={row.reason || row.notes || undefined}>
                          {row.reason || row.notes || t('dash')}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        {isCancellable(row) ? (
                          <ActionGroup>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={cancelMutation.isPending}
                              onClick={() => void handleCancel(row)}
                            >
                              {t('driverSchedule.cancelEntry', { defaultValue: 'Cancel' })}
                            </Button>
                          </ActionGroup>
                        ) : (
                          <span className="text-xs text-clox-faint">{t('dash')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              }
            />
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )
      ) : null}
    </div>
  );
}
