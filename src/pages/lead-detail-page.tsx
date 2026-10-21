import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingBlock } from '@/components/status-blocks';
import { KeyValueList } from '@/components/identity-summary';
import {
  Button,
  Notice,
  SearchableSelect,
  Select,
  TextArea,
  Timeline,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  addLeadNote,
  deleteLead,
  getErrorDetail,
  getLead,
  inviteAdminPartner,
  listOpsGeography,
  updateLead,
} from '@/lib/api';
import { formatAuditAction } from '@/lib/audit-format';
import {
  LEAD_STATUS_KEYS,
  formatDateTime,
  formatLeadStatus,
  formatLeadType,
} from '@/lib/leads';
import { AdminRole, LeadStatus, LeadType } from '@/shared/types';

export function LeadDetailPage() {
  const { t } = useTranslation('common');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [priority, setPriority] = useState(false);
  const [note, setNote] = useState('');
  const [inviteRegion, setInviteRegion] = useState('VIC');
  const [inviteTerritory, setInviteTerritory] = useState('');

  const leadQuery = useQuery({
    queryKey: ['admin', 'lead', id],
    queryFn: ({ signal }) => getLead(id, { signal }),
    enabled: Boolean(id),
  });

  const lead = leadQuery.data;

  const geoQuery = useQuery({
    queryKey: ['ops', 'geography'],
    queryFn: () => listOpsGeography(),
    enabled: Boolean(
      lead &&
        (lead.type === LeadType.EOI_STATE_MASTER || lead.type === LeadType.EOI_LOCAL_BDE),
    ),
  });

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setPriority(lead.priority);
      setInviteRegion((lead.state || 'VIC').toUpperCase());
      setInviteTerritory((lead.territory || '').toUpperCase());
    }
  }, [lead]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateLead(id, {
        status: status || undefined,
        priority,
      }),
    onSuccess: () => {
      toast.success(t('saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'lead', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const noteMutation = useMutation({
    mutationFn: () => addLeadNote(id, { body: note.trim() }),
    onSuccess: () => {
      setNote('');
      toast.success(t('saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'lead', id] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLead(id),
    onSuccess: async () => {
      toast.success(t('admin.deleteLeadSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      navigate('/leads', { replace: true });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const inviteMutation = useMutation({
    mutationFn: () => {
      if (!lead) throw new Error('missing lead');
      const role =
        lead.type === LeadType.EOI_STATE_MASTER
          ? AdminRole.STATE_MASTER
          : AdminRole.LOCAL_BDE;
      return inviteAdminPartner({
        email: lead.email,
        name: lead.companyName ?? undefined,
        companyName: lead.companyName ?? undefined,
        role,
        regionCode: inviteRegion.trim().toUpperCase(),
        territoryCode:
          role === AdminRole.LOCAL_BDE
            ? inviteTerritory.trim().toUpperCase() || undefined
            : undefined,
        leadId: lead.id,
      });
    },
    onSuccess: (data: { invite?: { inviteUrl?: string } }) => {
      toast.success(t('admin.invitePartnerSuccess'));
      if (data.invite?.inviteUrl) {
        toast.success(data.invite.inviteUrl);
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'lead', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const canInvitePartner =
    lead &&
    (lead.type === LeadType.EOI_STATE_MASTER || lead.type === LeadType.EOI_LOCAL_BDE) &&
    lead.status !== LeadStatus.PROVISIONED &&
    lead.status !== LeadStatus.REJECTED;

  const regionOptions = useMemo(() => {
    const rows = (geoQuery.data?.regions ?? []).map((r) => ({
      value: r.code,
      label: r.code,
      hint: r.name,
      disabled: !r.enabled,
      badge: r.enabled ? undefined : t('opsPartners.comingSoon'),
    }));
    return rows.sort((a, b) => Number(a.disabled) - Number(b.disabled));
  }, [geoQuery.data?.regions, t]);

  useEffect(() => {
    if (!geoQuery.data?.regions?.length) return;
    const selected = geoQuery.data.regions.find((r) => r.code === inviteRegion);
    if (!selected?.enabled) {
      const firstEnabled = geoQuery.data.regions.find((r) => r.enabled);
      if (firstEnabled) {
        setInviteRegion(firstEnabled.code);
        setInviteTerritory('');
      }
    }
  }, [geoQuery.data?.regions, inviteRegion]);

  const territoryOptions = useMemo(() => {
    const region = geoQuery.data?.regions.find((r) => r.code === inviteRegion);
    return (region?.territories ?? [])
      .filter((tr) => tr.enabled)
      .map((tr) => ({
        value: tr.code,
        label: tr.code,
        hint: tr.name,
      }));
  }, [geoQuery.data?.regions, inviteRegion]);

  useEffect(() => {
    if (inviteTerritory && !territoryOptions.some((o) => o.value === inviteTerritory)) {
      setInviteTerritory('');
    }
  }, [territoryOptions, inviteTerritory]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/leads" className="text-sm font-medium text-clox-orange hover:underline">
          ← {t('admin.leadsTitle')}
        </Link>
        {lead ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: t('confirm.deleteLeadTitle'),
                  description: t('confirm.deleteLeadBody'),
                  confirmLabel: t('admin.deleteLead'),
                  tone: 'destructive',
                });
                if (ok) deleteMutation.mutate();
              })();
            }}
          >
            {t('admin.deleteLead')}
          </Button>
        ) : null}
      </div>

      {leadQuery.isLoading ? (
        <div className="mt-6">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {leadQuery.isError ? (
        <Notice tone="error" className="mt-6">
          {getErrorDetail(leadQuery.error)}
        </Notice>
      ) : null}

      {lead ? (
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="clox-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-clox-orange">
                {formatLeadType(lead.type)}
              </p>
              <h1 className="mt-2 break-words font-display text-2xl font-bold text-clox-ink sm:text-3xl">
                {lead.companyName || lead.email}
              </h1>
              <p className="mt-1 break-all text-clox-mute">{lead.email}</p>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-clox-faint">{t('admin.phone')}</dt>
                  <dd className="text-clox-ink">{lead.phone || t('dash')}</dd>
                </div>
                <div>
                  <dt className="text-clox-faint">{t('admin.abnAcn')}</dt>
                  <dd className="text-clox-ink">
                    {[lead.abn, lead.acn].filter(Boolean).join(' / ') || t('dash')}
                  </dd>
                </div>
                <div>
                  <dt className="text-clox-faint">{t('admin.location')}</dt>
                  <dd className="text-clox-ink">
                    {[lead.state, lead.territory].filter(Boolean).join(' · ') || t('dash')}
                  </dd>
                </div>
                <div>
                  <dt className="text-clox-faint">{t('admin.source')}</dt>
                  <dd className="text-clox-ink">{lead.source || t('dash')}</dd>
                </div>
                <div>
                  <dt className="text-clox-faint">{t('admin.created')}</dt>
                  <dd className="text-clox-ink">{formatDateTime(lead.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-clox-faint">{t('admin.updated')}</dt>
                  <dd className="text-clox-ink">{formatDateTime(lead.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            <section className="clox-card p-5">
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('admin.payload')}
              </h2>
              <div className="mt-3 max-h-96 overflow-y-auto">
                <KeyValueList data={lead.payload ?? {}} emptyLabel={t('admin.noPayload')} />
              </div>
            </section>

            <section className="clox-card p-5">
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('admin.notes')}
              </h2>
              <form
                className="mt-3 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (note.trim()) noteMutation.mutate();
                }}
              >
                <TextArea
                  rows={3}
                  placeholder={t('admin.notePlaceholder')}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button
                  type="submit"
                  variant="cta"
                  disabled={noteMutation.isPending || !note.trim()}
                >
                  {noteMutation.isPending ? t('loading') : t('admin.addNote')}
                </Button>
              </form>
              <ul className="mt-5 space-y-3">
                {(lead.notes ?? []).length === 0 ? (
                  <li className="text-sm text-clox-faint">{t('admin.noNotes')}</li>
                ) : (
                  lead.notes.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-clox-border bg-clox-surface-alt p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-clox-faint">
                        <span>
                          {item.author?.name || item.author?.email || t('admin.adminFallback')}
                        </span>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-clox-text">{item.body}</p>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="space-y-6">
            {canInvitePartner ? (
              <section className="clox-card p-5">
                <h2 className="font-display text-lg font-semibold text-clox-ink">
                  {t('admin.invitePartnerTitle')}
                </h2>
                <p className="mt-2 text-sm text-clox-mute">{t('admin.invitePartnerBody')}</p>
                <div className="mt-4 space-y-3">
                  <SearchableSelect
                    label={t('opsPartners.region')}
                    value={inviteRegion}
                    onChange={(next) => {
                      setInviteRegion(next);
                      setInviteTerritory('');
                    }}
                    options={regionOptions}
                    placeholder={t('opsPartners.regionPlaceholder')}
                    searchPlaceholder={t('opsPartners.searchPlaceholder')}
                    emptyLabel={t('opsPartners.noMatches')}
                    disabled={geoQuery.isLoading}
                    required
                  />
                  {lead.type === LeadType.EOI_LOCAL_BDE ? (
                    <SearchableSelect
                      label={t('opsPartners.territory')}
                      value={inviteTerritory}
                      onChange={setInviteTerritory}
                      options={territoryOptions}
                      placeholder={
                        territoryOptions.length
                          ? t('opsPartners.territoryPlaceholder')
                          : t('opsPartners.noTerritories')
                      }
                      searchPlaceholder={t('opsPartners.searchPlaceholder')}
                      emptyLabel={t('opsPartners.noMatches')}
                      disabled={geoQuery.isLoading || territoryOptions.length === 0}
                      required
                    />
                  ) : null}
                </div>
                <Button
                  className="mt-4"
                  variant="cta"
                  size="block"
                  disabled={
                    inviteMutation.isPending ||
                    geoQuery.isLoading ||
                    !inviteRegion ||
                    (lead.type === LeadType.EOI_LOCAL_BDE && !inviteTerritory)
                  }
                  onClick={() => inviteMutation.mutate()}
                >
                  {inviteMutation.isPending
                    ? t('loading')
                    : lead.type === LeadType.EOI_STATE_MASTER
                      ? t('admin.inviteAsState')
                      : t('admin.inviteAsLocal')}
                </Button>
              </section>
            ) : null}

            <section className="clox-card p-5">
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('admin.review')}
              </h2>
              <div className="mt-4 space-y-3">
                <Select
                  label={t('admin.status')}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as LeadStatus)}
                >
                  {LEAD_STATUS_KEYS.map((value) => (
                    <option key={value} value={value}>
                      {t(`leadStatuses.${value}`)}
                    </option>
                  ))}
                </Select>
                <label className="flex items-center gap-2 text-sm text-clox-mute">
                  <input
                    type="checkbox"
                    checked={priority}
                    onChange={(event) => setPriority(event.target.checked)}
                  />
                  {t('admin.priority')}
                </label>
                <Button
                  variant="cta"
                  size="block"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: t('confirm.saveLeadStatusTitle'),
                        description: t('confirm.saveLeadStatusBody'),
                        confirmLabel: t('admin.saveStatus'),
                      });
                      if (ok) updateMutation.mutate();
                    })();
                  }}
                >
                  {updateMutation.isPending ? t('loading') : t('admin.saveStatus')}
                </Button>
                <p className="text-xs text-clox-faint">
                  {t('admin.currentStatus', { status: formatLeadStatus(lead.status) })}
                </p>
              </div>
            </section>

            <section className="clox-card p-5">
              <h2 className="font-display text-lg font-semibold text-clox-ink">
                {t('admin.activity')}
              </h2>
              <Timeline
                className="mt-4"
                items={(lead.events ?? []).map((event, index) => ({
                  id: event.id,
                  title: formatAuditAction(event.action, t),
                  subtitle: `${event.actor?.email || t('system')} · ${formatDateTime(event.createdAt)}`,
                  tone: index === 0 ? 'now' : 'done',
                }))}
                empty={<p className="text-sm text-clox-faint">{t('admin.noEvents')}</p>}
              />
            </section>

            <Link to="/leads" className="clox-btn clox-btn-secondary inline-flex w-full justify-center">
              {t('admin.backToQueue')}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
