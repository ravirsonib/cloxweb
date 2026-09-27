import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fieldClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '@/components/admin-shell';
import { addLeadNote, getErrorDetail, getLead, updateLead } from '@/lib/api';
import {
  LEAD_STATUS_KEYS,
  formatDateTime,
  formatLeadStatus,
  formatLeadType,
} from '@/lib/leads';
import { LeadStatus } from '@/shared/types';

export function LeadDetailPage() {
  const { t } = useTranslation('common');
  const { id = '' } = useParams();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [priority, setPriority] = useState(false);
  const [note, setNote] = useState('');

  const leadQuery = useQuery({
    queryKey: ['admin', 'lead', id],
    queryFn: ({ signal }) => getLead(id, { signal }),
    enabled: Boolean(id),
  });

  const lead = leadQuery.data;

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setPriority(lead.priority);
    }
  }, [lead]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateLead(id, {
        status: status || undefined,
        priority,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'lead', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => addLeadNote(id, { body: note.trim() }),
    onSuccess: () => {
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'lead', id] });
    },
  });

  return (
    <div>
      <Link to="/leads" className="text-sm font-medium text-clox-orange hover:underline">
        ← {t('admin.leadsTitle')}
      </Link>

      {leadQuery.isLoading ? (
        <p className="mt-6 text-slate-400">{t('loading')}</p>
      ) : null}

      {leadQuery.isError ? (
        <p className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {getErrorDetail(leadQuery.error)}
        </p>
      ) : null}

      {lead ? (
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-clox-orange">
                {formatLeadType(lead.type)}
              </p>
              <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">
                {lead.companyName || lead.email}
              </h1>
              <p className="mt-1 break-all text-slate-400">{lead.email}</p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-slate-500">{t('admin.phone')}</dt>
                  <dd className="text-white">{lead.phone || t('dash')}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('admin.abnAcn')}</dt>
                  <dd className="text-white">
                    {[lead.abn, lead.acn].filter(Boolean).join(' / ') || t('dash')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('admin.location')}</dt>
                  <dd className="text-white">
                    {[lead.state, lead.territory].filter(Boolean).join(' · ') || t('dash')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('admin.source')}</dt>
                  <dd className="text-white">{lead.source || t('dash')}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('admin.created')}</dt>
                  <dd className="text-white">{formatDateTime(lead.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('admin.updated')}</dt>
                  <dd className="text-white">{formatDateTime(lead.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">{t('admin.payload')}</h2>
              <pre className="mt-3 max-h-96 overflow-x-auto overflow-y-auto rounded-xl bg-slate-950/80 p-3 text-xs text-slate-300 whitespace-pre-wrap break-words sm:whitespace-pre">
                {JSON.stringify(lead.payload ?? {}, null, 2)}
              </pre>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">{t('admin.notes')}</h2>
              <form
                className="mt-3 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (note.trim()) noteMutation.mutate();
                }}
              >
                <textarea
                  className={fieldClassName}
                  rows={3}
                  placeholder={t('admin.notePlaceholder')}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                {noteMutation.isError ? (
                  <p className="text-sm text-red-300">{getErrorDetail(noteMutation.error)}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={noteMutation.isPending || !note.trim()}
                  className={primaryButtonClassName}
                >
                  {noteMutation.isPending ? t('loading') : t('admin.addNote')}
                </button>
              </form>
              <ul className="mt-5 space-y-3">
                {(lead.notes ?? []).length === 0 ? (
                  <li className="text-sm text-slate-500">{t('admin.noNotes')}</li>
                ) : (
                  lead.notes.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {item.author?.name || item.author?.email || t('admin.adminFallback')}
                        </span>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-slate-200">{item.body}</p>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">{t('admin.review')}</h2>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm text-slate-400">{t('admin.status')}</label>
                  <select
                    className={fieldClassName}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as LeadStatus)}
                  >
                    {LEAD_STATUS_KEYS.map((value) => (
                      <option key={value} value={value}>
                        {t(`leadStatuses.${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={priority}
                    onChange={(event) => setPriority(event.target.checked)}
                  />
                  {t('admin.priority')}
                </label>
                {updateMutation.isError ? (
                  <p className="text-sm text-red-300">{getErrorDetail(updateMutation.error)}</p>
                ) : null}
                {updateMutation.isSuccess ? (
                  <p className="text-sm text-emerald-300">{t('saved')}</p>
                ) : null}
                <button
                  type="button"
                  className={`${primaryButtonClassName} w-full`}
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate()}
                >
                  {updateMutation.isPending ? t('loading') : t('admin.saveStatus')}
                </button>
                <p className="text-xs text-slate-500">
                  {t('admin.currentStatus', { status: formatLeadStatus(lead.status) })}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">{t('admin.activity')}</h2>
              <ul className="mt-3 space-y-3">
                {(lead.events ?? []).length === 0 ? (
                  <li className="text-sm text-slate-500">{t('admin.noEvents')}</li>
                ) : (
                  lead.events.map((event) => (
                    <li key={event.id} className="border-b border-white/10 pb-3 last:border-0">
                      <p className="text-sm font-medium text-white">{event.action}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {event.actor?.email || t('system')} · {formatDateTime(event.createdAt)}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <Link to="/leads" className={`${secondaryButtonClassName} w-full`}>
              {t('admin.backToQueue')}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
