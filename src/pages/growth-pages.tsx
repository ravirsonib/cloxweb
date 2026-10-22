import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataCardList,
  DataTable,
  Field,
  Notice,
  ResponsiveDataView,
  Select,
  StatusPill,
  dataCardClassName,
  useToast,
} from '@/components/ui';
import {
  createCompanyInvite,
  createProspect,
  getErrorDetail,
  listCompanyInvites,
  listMyGrowthCompanies,
  listProspects,
  resendCompanyInvite,
  updateProspect,
  type CompanyInviteRow,
  type GrowthCompany,
  type GrowthProspect,
} from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/leads';
import { companyStatusTone, type StatusTone } from '@/lib/status-tone';

const STAGES = ['LEAD', 'CONTACTED', 'INVITED', 'ONBOARDING', 'WON', 'LOST'] as const;

function prospectStageTone(stage: string): StatusTone {
  switch (stage) {
    case 'WON':
      return 'ok';
    case 'LOST':
      return 'danger';
    case 'INVITED':
    case 'ONBOARDING':
      return 'info';
    case 'CONTACTED':
      return 'warn';
    case 'LEAD':
    default:
      return 'neutral';
  }
}

function inviteStatusTone(acceptedAt: string | null, expiresAt: string): StatusTone {
  if (acceptedAt) return 'ok';
  if (new Date(expiresAt) < new Date()) return 'danger';
  return 'info';
}

function inviteStatusKey(acceptedAt: string | null, expiresAt: string): 'accepted' | 'expired' | 'pending' {
  if (acceptedAt) return 'accepted';
  if (new Date(expiresAt) < new Date()) return 'expired';
  return 'pending';
}

function GrowthBookNav({ active }: { active: 'pipeline' | 'senders' | 'carriers' }) {
  const { t } = useTranslation('common');
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-[5px] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide transition',
      isActive
        ? 'bg-clox-navy-ink text-white'
        : 'text-clox-mute hover:bg-clox-surface-alt hover:text-clox-ink',
    );

  return (
    <div
      className="inline-flex flex-wrap rounded-clox-sm border border-clox-border bg-clox-surface p-0.5"
      role="navigation"
      aria-label={t('growth.bookNav')}
    >
      <NavLink to="/ops/growth" end className={itemClass} aria-current={active === 'pipeline' ? 'page' : undefined}>
        {t('growth.title')}
      </NavLink>
      <NavLink
        to="/ops/my-senders"
        className={itemClass}
        aria-current={active === 'senders' ? 'page' : undefined}
      >
        {t('growth.mySenders')}
      </NavLink>
      <NavLink
        to="/ops/my-carriers"
        className={itemClass}
        aria-current={active === 'carriers' ? 'page' : undefined}
      >
        {t('growth.myCarriers')}
      </NavLink>
    </div>
  );
}

function BackToGrowth() {
  const { t } = useTranslation('common');
  return (
    <Link
      to="/ops/growth"
      className="text-sm font-medium text-clox-orange transition hover:underline"
    >
      ← {t('growth.backToGrowth')}
    </Link>
  );
}

export function GrowthPipelinePage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const stage = searchParams.get('stage') || '';
  const q = searchParams.get('q') || '';
  const [searchDraft, setSearchDraft] = useState(q);
  const [showCreate, setShowCreate] = useState(false);

  const query = useMemo(
    () => ({
      page: 1,
      pageSize: 50,
      stage: stage || undefined,
      q: q || undefined,
    }),
    [stage, q],
  );

  const prospectsQuery = useQuery({
    queryKey: ['ops', 'growth', 'prospects', query],
    queryFn: () => listProspects(query),
  });

  const createSchema = z.object({
    companyType: z.enum(['SENDER', 'CARRIER']),
    legalName: z.string().trim().min(2),
    contactName: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    notes: z.string().optional(),
  });
  type CreateForm = z.infer<typeof createSchema>;

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      companyType: 'SENDER',
      legalName: '',
      contactName: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateForm) =>
      createProspect({
        companyType: values.companyType,
        legalName: values.legalName.trim(),
        contactName: values.contactName?.trim() || undefined,
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('growth.prospectCreated'));
      setShowCreate(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['ops', 'growth', 'prospects'] });
    },
    onError: (e) => toast.error(getErrorDetail(e)),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage: next }: { id: string; stage: string }) =>
      updateProspect(id, { stage: next }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops', 'growth', 'prospects'] });
    },
    onError: (e) => toast.error(getErrorDetail(e)),
  });

  function updateFilter(key: 'stage' | 'q', value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  function applySearch() {
    updateFilter('q', searchDraft.trim());
  }

  const items = prospectsQuery.data?.items ?? [];
  const total = prospectsQuery.data?.total ?? items.length;

  function invitePath(row: GrowthProspect) {
    return `/ops/growth/invite?prospectId=${row.id}&type=${row.companyType}&email=${encodeURIComponent(row.email ?? '')}&name=${encodeURIComponent(row.legalName)}`;
  }

  function stageLabel(value: string) {
    return t(`growth.stages.${value}`, { defaultValue: value });
  }

  function typeLabel(value: string) {
    return value === 'CARRIER' ? t('companies.typeCarrier') : t('companies.typeSender');
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('growth.title')}
          </h1>
          <p className="mt-2 text-sm text-clox-mute">
            {t('growth.subtitle')} · {t('totalCount', { count: total })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/ops/growth/invite">
            <Button type="button" variant="secondary">
              {t('growth.inviteCta')}
            </Button>
          </Link>
          <Button type="button" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? t('growth.cancelAdd') : t('growth.addProspect')}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <GrowthBookNav active="pipeline" />
      </div>

      <Notice tone="info" className="mt-4" title={t('growth.prospectExplainTitle')}>
        {t('growth.prospectExplainBody')}
      </Notice>

      {showCreate ? (
        <form
          className="clox-card mt-6 max-w-xl space-y-3 p-5"
          onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
        >
          <h2 className="font-display text-lg font-semibold text-clox-ink">
            {t('growth.addProspect')}
          </h2>
          <Select
            className="mb-0"
            label={t('growth.companyType')}
            value={form.watch('companyType')}
            onChange={(e) =>
              form.setValue('companyType', e.target.value as 'SENDER' | 'CARRIER')
            }
          >
            <option value="SENDER">{t('companies.typeSender')}</option>
            <option value="CARRIER">{t('companies.typeCarrier')}</option>
          </Select>
          <Field label={t('growth.legalName')} required {...form.register('legalName')} />
          <Field label={t('growth.contactName')} {...form.register('contactName')} />
          <Field type="email" label={t('email')} {...form.register('email')} />
          <Field label={t('phone')} {...form.register('phone')} />
          <Field label={t('growth.notes')} {...form.register('notes')} />
          {createMutation.isError ? (
            <Notice tone="error">{getErrorDetail(createMutation.error)}</Notice>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('saving') : t('growth.saveProspect')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              {t('growth.cancelAdd')}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:items-end">
        <label className="mb-0 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
            {t('search')}
          </span>
          <input
            className="clox-field-control"
            placeholder={t('growth.searchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applySearch();
            }}
          />
        </label>
        <Select
          className="mb-0"
          label={t('growth.stage')}
          value={stage}
          onChange={(e) => updateFilter('stage', e.target.value)}
        >
          <option value="">{t('growth.allStages')}</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {stageLabel(s)}
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={applySearch}>
          {t('search')}
        </Button>
      </div>

      {prospectsQuery.isLoading ? (
        <div className="mt-8">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {prospectsQuery.isError ? (
        <Notice tone="error" className="mt-8">
          {getErrorDetail(prospectsQuery.error)}
        </Notice>
      ) : null}

      {!prospectsQuery.isLoading && !prospectsQuery.isError ? (
        items.length === 0 ? (
          <div className="mt-6">
            <EmptyBlock
              title={t('growth.emptyProspects')}
              description={t('growth.emptyProspectsHint')}
            />
          </div>
        ) : (
          <ResponsiveDataView
            className="mt-6"
            cards={
              <DataCardList
                items={items}
                getKey={(row) => row.id}
                renderItem={(row) => (
                  <div className={dataCardClassName}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-clox-ink">{row.legalName}</p>
                        <p className="mt-0.5 truncate text-xs text-clox-faint">
                          {row.email ?? t('dash')}
                        </p>
                      </div>
                      <StatusPill tone={prospectStageTone(row.stage)}>
                        {stageLabel(row.stage)}
                      </StatusPill>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-clox-mute">
                      <span>{typeLabel(row.companyType)}</span>
                      {row.contactName ? <span>{row.contactName}</span> : null}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:items-end">
                      <Select
                        className="mb-0"
                        label={t('growth.stage')}
                        value={row.stage}
                        onChange={(e) =>
                          stageMutation.mutate({ id: row.id, stage: e.target.value })
                        }
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {stageLabel(s)}
                          </option>
                        ))}
                      </Select>
                      <Link to={invitePath(row)}>
                        <Button type="button" variant="secondary" size="sm" className="w-full">
                          {t('growth.invite')}
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              />
            }
            table={
              <DataTable
                minWidthClassName="min-w-[52rem]"
                headers={[
                  t('growth.legalName'),
                  t('growth.companyType'),
                  t('growth.stage'),
                  t('email'),
                  t('growth.colActions'),
                ]}
                headerClassNames={[undefined, undefined, undefined, undefined, 'text-right']}
              >
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-clox-ink">{row.legalName}</p>
                      {row.contactName ? (
                        <p className="text-xs text-clox-faint">{row.contactName}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-clox-mute">{typeLabel(row.companyType)}</td>
                    <td className="px-4 py-3">
                      <Select
                        className="mb-0 min-w-[9.5rem]"
                        aria-label={t('growth.stage')}
                        value={row.stage}
                        onChange={(e) =>
                          stageMutation.mutate({ id: row.id, stage: e.target.value })
                        }
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {stageLabel(s)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-clox-mute">{row.email ?? t('dash')}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={invitePath(row)}>
                        <Button type="button" variant="secondary" size="sm">
                          {t('growth.invite')}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </DataTable>
            }
          />
        )
      ) : null}
    </div>
  );
}

export function GrowthInvitePage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const schema = z.object({
    companyType: z.enum(['SENDER', 'CARRIER']),
    email: z.string().trim().email(),
    legalNameHint: z.string().optional(),
  });
  type Form = z.infer<typeof schema>;

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyType: searchParams.get('type') === 'CARRIER' ? 'CARRIER' : 'SENDER',
      email: searchParams.get('email') || '',
      legalNameHint: searchParams.get('name') || '',
    },
  });

  const invitesQuery = useQuery({
    queryKey: ['ops', 'growth', 'invites'],
    queryFn: listCompanyInvites,
  });

  const inviteMutation = useMutation({
    mutationFn: (values: Form) =>
      createCompanyInvite({
        companyType: values.companyType,
        email: values.email.trim(),
        legalNameHint: values.legalNameHint?.trim() || undefined,
        prospectId: searchParams.get('prospectId') || undefined,
      }),
    onSuccess: async (data) => {
      toast.success(
        data.mailSkipped ? t('growth.inviteCreatedNoMail') : t('growth.inviteSent'),
      );
      await queryClient.invalidateQueries({ queryKey: ['ops', 'growth'] });
    },
    onError: (e) => toast.error(getErrorDetail(e)),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => resendCompanyInvite(id),
    onSuccess: async () => {
      toast.success(t('growth.inviteResent'));
      await queryClient.invalidateQueries({ queryKey: ['ops', 'growth', 'invites'] });
    },
    onError: (e) => toast.error(getErrorDetail(e)),
  });

  function inviteStatusLabel(acceptedAt: string | null, expiresAt: string) {
    return t(`growth.${inviteStatusKey(acceptedAt, expiresAt)}`);
  }

  const invites = invitesQuery.data?.items ?? [];

  return (
    <div>
      <BackToGrowth />
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
            {t('growth.inviteTitle')}
          </h1>
          <p className="mt-2 text-sm text-clox-mute">{t('growth.inviteSubtitle')}</p>
        </div>
      </div>

      <form
        className="clox-card mt-6 max-w-lg space-y-3 p-5"
        onSubmit={form.handleSubmit((v) => inviteMutation.mutate(v))}
      >
        <Select
          className="mb-0"
          label={t('growth.companyType')}
          value={form.watch('companyType')}
          onChange={(e) =>
            form.setValue('companyType', e.target.value as 'SENDER' | 'CARRIER')
          }
        >
          <option value="SENDER">{t('companies.typeSender')}</option>
          <option value="CARRIER">{t('companies.typeCarrier')}</option>
        </Select>
        <Field
          type="email"
          label={t('email')}
          required
          placeholder={t('growth.emailPlaceholder')}
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Field
          label={t('growth.legalName')}
          placeholder={t('growth.legalNamePlaceholder')}
          {...form.register('legalNameHint')}
        />
        {inviteMutation.data?.inviteUrl ? (
          <Notice tone="info">
            <span className="break-all">{inviteMutation.data.inviteUrl}</span>
          </Notice>
        ) : null}
        <Button type="submit" disabled={inviteMutation.isPending}>
          {inviteMutation.isPending ? t('submitting') : t('growth.sendInvite')}
        </Button>
      </form>

      <h2 className="mt-8 font-display text-lg font-semibold text-clox-ink">
        {t('growth.recentInvites')}
      </h2>

      {invitesQuery.isLoading ? (
        <div className="mt-4">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {!invitesQuery.isLoading && invites.length < 1 ? (
        <div className="mt-4">
          <EmptyBlock
            title={t('growth.emptyInvites')}
            description={t('growth.emptyInvitesHint')}
          />
        </div>
      ) : null}

      {invites.length > 0 ? (
        <ResponsiveDataView
          className="mt-4"
          cards={
            <DataCardList
              items={invites}
              getKey={(row) => row.id}
              renderItem={(row) => (
                <div className={dataCardClassName}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-clox-ink">{row.email}</p>
                      <p className="mt-0.5 text-xs text-clox-faint">
                        {row.companyType === 'CARRIER'
                          ? t('companies.typeCarrier')
                          : t('companies.typeSender')}
                      </p>
                    </div>
                    <StatusPill tone={inviteStatusTone(row.acceptedAt, row.expiresAt)}>
                      {inviteStatusLabel(row.acceptedAt, row.expiresAt)}
                    </StatusPill>
                  </div>
                  <p className="mt-3 text-xs text-clox-mute">
                    {t('growth.expires')}: {formatDateTime(row.expiresAt)}
                  </p>
                  {!row.acceptedAt ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={resendMutation.isPending}
                        onClick={() => resendMutation.mutate(row.id)}
                      >
                        {t('growth.resend')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            />
          }
          table={
            <DataTable
              minWidthClassName="min-w-[44rem]"
              headers={[
                t('email'),
                t('growth.companyType'),
                t('growth.inviteStatus'),
                t('growth.expires'),
                t('growth.colActions'),
              ]}
              headerClassNames={[undefined, undefined, undefined, undefined, 'text-right']}
            >
              {invites.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                >
                  <td className="px-4 py-3 font-medium text-clox-ink">{r.email}</td>
                  <td className="px-4 py-3 text-clox-mute">
                    {r.companyType === 'CARRIER'
                      ? t('companies.typeCarrier')
                      : t('companies.typeSender')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={inviteStatusTone(r.acceptedAt, r.expiresAt)}>
                      {inviteStatusLabel(r.acceptedAt, r.expiresAt)}
                    </StatusPill>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-clox-mute">
                    {formatDateTime(r.expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.acceptedAt ? (
                      <span className="text-clox-faint">{t('dash')}</span>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={resendMutation.isPending}
                        onClick={() => resendMutation.mutate(r.id)}
                      >
                        {t('growth.resend')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          }
        />
      ) : null}
    </div>
  );
}

function MyCompaniesPage({ type }: { type: 'SENDER' | 'CARRIER' }) {
  const { t } = useTranslation('common');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || '1') || 1;
  const q = searchParams.get('q') || '';
  const [searchDraft, setSearchDraft] = useState(q);

  const listQuery = useQuery({
    queryKey: ['ops', 'growth', 'my-companies', type, page, q],
    queryFn: () => listMyGrowthCompanies({ type, page, pageSize: 20, q: q || undefined }),
  });

  const invitesQuery = useQuery({
    queryKey: ['ops', 'growth', 'invites'],
    queryFn: listCompanyInvites,
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => resendCompanyInvite(id),
    onSuccess: async () => {
      toast.success(t('growth.inviteResent'));
      await queryClient.invalidateQueries({ queryKey: ['ops', 'growth', 'invites'] });
    },
    onError: (e) => toast.error(getErrorDetail(e)),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? items.length;
  const totalPages = listQuery.data?.totalPages ?? 1;
  const title = type === 'SENDER' ? t('growth.mySenders') : t('growth.myCarriers');
  const active = type === 'SENDER' ? 'senders' : 'carriers';

  const invitesForType = useMemo(() => {
    const rows = invitesQuery.data?.items ?? [];
    const filtered = rows.filter((row) => row.companyType === type);
    if (!q.trim()) return filtered;
    const needle = q.trim().toLowerCase();
    return filtered.filter(
      (row) =>
        row.email.toLowerCase().includes(needle) ||
        (row.legalNameHint ?? '').toLowerCase().includes(needle),
    );
  }, [invitesQuery.data?.items, type, q]);

  const pendingInvites = invitesForType.filter(
    (row) => inviteStatusKey(row.acceptedAt, row.expiresAt) === 'pending',
  );

  function applySearch() {
    const next = new URLSearchParams();
    if (searchDraft.trim()) next.set('q', searchDraft.trim());
    setSearchParams(next);
  }

  function inviteStatusLabel(row: CompanyInviteRow) {
    return t(`growth.${inviteStatusKey(row.acceptedAt, row.expiresAt)}`);
  }

  function renderCompanyCard(row: GrowthCompany) {
    return (
      <div className={dataCardClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-clox-ink">{row.legalName}</p>
            <p className="mt-0.5 truncate text-xs text-clox-faint">{row.email ?? t('dash')}</p>
          </div>
          <StatusPill tone={companyStatusTone(row.status)}>
            {t(`companyStatuses.${row.status}`, { defaultValue: row.status })}
          </StatusPill>
        </div>
        <p className="mt-3 text-xs text-clox-mute">
          {t('growth.referredAt')}:{' '}
          {row.referredAt ? formatDateTime(row.referredAt) : t('dash')}
        </p>
      </div>
    );
  }

  function renderInviteCard(row: CompanyInviteRow) {
    return (
      <div className={dataCardClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-clox-ink">{row.email}</p>
            {row.legalNameHint ? (
              <p className="mt-0.5 truncate text-xs text-clox-faint">{row.legalNameHint}</p>
            ) : null}
          </div>
          <StatusPill tone={inviteStatusTone(row.acceptedAt, row.expiresAt)}>
            {inviteStatusLabel(row)}
          </StatusPill>
        </div>
        <p className="mt-3 text-xs text-clox-mute">
          {t('growth.expires')}: {formatDateTime(row.expiresAt)}
        </p>
        {!row.acceptedAt && inviteStatusKey(row.acceptedAt, row.expiresAt) === 'pending' ? (
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={resendMutation.isPending}
              onClick={() => resendMutation.mutate(row.id)}
            >
              {t('growth.resend')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <BackToGrowth />
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-clox-mute">
            {t('growth.myBookHint')} · {t('totalCount', { count: total })}
          </p>
        </div>
        <Link to={`/ops/growth/invite?type=${type}`}>
          <Button type="button" variant="secondary">
            {t('growth.inviteCta')}
          </Button>
        </Link>
      </div>

      <div className="mt-4">
        <GrowthBookNav active={active} />
      </div>

      <Notice tone="info" className="mt-4" title={t('growth.bookFunnelTitle')}>
        {t('growth.bookFunnelBody')}
      </Notice>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="mb-0 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
            {t('search')}
          </span>
          <input
            className="clox-field-control"
            placeholder={t('growth.bookSearchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applySearch();
            }}
          />
        </label>
        <Button variant="primary" onClick={applySearch}>
          {t('search')}
        </Button>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold text-clox-ink">
        {t('growth.pendingInvitesTitle')}
        {pendingInvites.length > 0 ? (
          <span className="ml-2 font-mono text-sm font-normal text-clox-mute">
            ({pendingInvites.length})
          </span>
        ) : null}
      </h2>
      <p className="mt-1 text-sm text-clox-mute">{t('growth.pendingInvitesHint')}</p>

      {invitesQuery.isLoading ? (
        <div className="mt-4">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {invitesQuery.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(invitesQuery.error)}
        </Notice>
      ) : null}

      {!invitesQuery.isLoading && !invitesQuery.isError ? (
        pendingInvites.length === 0 ? (
          <div className="mt-4">
            <EmptyBlock
              title={t('growth.emptyPendingInvites')}
              description={t('growth.emptyPendingInvitesHint')}
            />
          </div>
        ) : (
          <ResponsiveDataView
            className="mt-4"
            cards={
              <DataCardList
                items={pendingInvites}
                getKey={(row) => row.id}
                renderItem={renderInviteCard}
              />
            }
            table={
              <DataTable
                minWidthClassName="min-w-[40rem]"
                headers={[
                  t('email'),
                  t('growth.legalName'),
                  t('growth.inviteStatus'),
                  t('growth.expires'),
                  t('growth.colActions'),
                ]}
                headerClassNames={[undefined, undefined, undefined, undefined, 'text-right']}
              >
                {pendingInvites.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3 font-medium text-clox-ink">{row.email}</td>
                    <td className="px-4 py-3 text-clox-mute">
                      {row.legalNameHint ?? t('dash')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={inviteStatusTone(row.acceptedAt, row.expiresAt)}>
                        {inviteStatusLabel(row)}
                      </StatusPill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-clox-mute">
                      {formatDateTime(row.expiresAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={resendMutation.isPending}
                        onClick={() => resendMutation.mutate(row.id)}
                      >
                        {t('growth.resend')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            }
          />
        )
      ) : null}

      <h2 className="mt-10 font-display text-lg font-semibold text-clox-ink">
        {t('growth.registeredBookTitle')}
        {total > 0 ? (
          <span className="ml-2 font-mono text-sm font-normal text-clox-mute">({total})</span>
        ) : null}
      </h2>
      <p className="mt-1 text-sm text-clox-mute">{t('growth.registeredBookHint')}</p>

      {listQuery.isLoading ? (
        <div className="mt-4">
          <LoadingBlock label={t('loading')} />
        </div>
      ) : null}

      {listQuery.isError ? (
        <Notice tone="error" className="mt-4">
          {getErrorDetail(listQuery.error)}
        </Notice>
      ) : null}

      {!listQuery.isLoading && !listQuery.isError ? (
        items.length === 0 ? (
          <div className="mt-4">
            <EmptyBlock title={t('growth.emptyBook')} description={t('growth.emptyBookHint')} />
          </div>
        ) : (
          <ResponsiveDataView
            className="mt-4"
            cards={
              <DataCardList
                items={items}
                getKey={(row) => row.id}
                renderItem={renderCompanyCard}
              />
            }
            table={
              <DataTable
                minWidthClassName="min-w-[40rem]"
                headers={[
                  t('growth.legalName'),
                  t('growth.onboardingStatus'),
                  t('email'),
                  t('growth.referredAt'),
                ]}
              >
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-clox-border-soft hover:bg-clox-surface-alt/60"
                  >
                    <td className="px-4 py-3 font-medium text-clox-ink">{r.legalName}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={companyStatusTone(r.status)}>
                        {t(`companyStatuses.${r.status}`, { defaultValue: r.status })}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-clox-mute">{r.email ?? t('dash')}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-clox-mute">
                      {r.referredAt ? formatDateTime(r.referredAt) : t('dash')}
                    </td>
                  </tr>
                ))}
              </DataTable>
            }
          />
        )
      ) : null}

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-clox-mute">
          <p>{t('pageOf', { page, totalPages })}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set('page', String(page - 1));
                setSearchParams(next);
              }}
            >
              {t('previous')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set('page', String(page + 1));
                setSearchParams(next);
              }}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MySendersPage() {
  return <MyCompaniesPage type="SENDER" />;
}

export function MyCarriersPage() {
  return <MyCompaniesPage type="CARRIER" />;
}
