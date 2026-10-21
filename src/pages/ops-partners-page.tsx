import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import {
  deleteCompany,
  disableCompany,
  getErrorDetail,
  inviteAdminPartner,
  listAdminPartners,
  listOpsGeography,
  reactivateCompany,
  resendAdminPartnerInvite,
  type PartnerAdminListItem,
} from '@/lib/api';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import {
  Button,
  DataTable,
  Field,
  Notice,
  SearchableSelect,
  Select,
  StatusPill,
  useConfirm,
  useToast,
} from '@/components/ui';
import { adminPartnerStatusTone, companyStatusTone } from '@/lib/status-tone';
import { AdminRole, CompanyStatus } from '@/shared/types';

const inviteSchema = z
  .object({
    email: z.string().email(),
    name: z.string().trim().max(120).optional(),
    companyName: z.string().trim().max(200).optional(),
    role: z.enum([AdminRole.STATE_MASTER, AdminRole.LOCAL_BDE]),
    regionCode: z.string().trim().toUpperCase().min(2).max(3),
    territoryCode: z.string().trim().toUpperCase().max(32).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === AdminRole.LOCAL_BDE && !value.territoryCode) {
      ctx.addIssue({
        code: 'custom',
        path: ['territoryCode'],
        message: 'Territory required for Local BDE',
      });
    }
  });

type InviteForm = z.infer<typeof inviteSchema>;

export function OpsPartnersPage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<PartnerAdminListItem | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [disableNote, setDisableNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['ops', 'partners'],
    queryFn: () => listAdminPartners(),
  });

  const geoQuery = useQuery({
    queryKey: ['ops', 'geography'],
    queryFn: () => listOpsGeography(),
  });

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      name: '',
      companyName: '',
      role: AdminRole.STATE_MASTER,
      regionCode: 'VIC',
      territoryCode: '',
    },
  });

  const role = form.watch('role');
  const regionCode = form.watch('regionCode');

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
    const current = form.getValues('regionCode');
    const selected = geoQuery.data.regions.find((r) => r.code === current);
    if (!selected?.enabled) {
      const firstEnabled = geoQuery.data.regions.find((r) => r.enabled);
      if (firstEnabled) form.setValue('regionCode', firstEnabled.code);
    }
  }, [geoQuery.data?.regions, form]);

  const territoryOptions = useMemo(() => {
    const region = geoQuery.data?.regions.find((r) => r.code === regionCode);
    return (region?.territories ?? [])
      .filter((tr) => tr.enabled)
      .map((tr) => ({
        value: tr.code,
        label: tr.code,
        hint: tr.name,
      }));
  }, [geoQuery.data?.regions, regionCode]);

  useEffect(() => {
    const current = form.getValues('territoryCode');
    if (current && !territoryOptions.some((o) => o.value === current)) {
      form.setValue('territoryCode', '');
    }
  }, [territoryOptions, form]);

  const inviteMutation = useMutation({
    mutationFn: (values: InviteForm) =>
      inviteAdminPartner({
        email: values.email.trim().toLowerCase(),
        name: values.name?.trim() || undefined,
        companyName: values.companyName?.trim() || undefined,
        role: values.role,
        regionCode: values.regionCode.trim().toUpperCase(),
        territoryCode:
          values.role === AdminRole.LOCAL_BDE
            ? values.territoryCode?.trim().toUpperCase()
            : undefined,
      }),
    onSuccess: (data: { invite?: { inviteUrl?: string; debugToken?: string } }) => {
      toast.success(t('opsPartners.inviteSuccess'));
      setLastInviteUrl(data.invite?.inviteUrl ?? null);
      form.reset({
        email: '',
        name: '',
        companyName: '',
        role: AdminRole.STATE_MASTER,
        regionCode: 'VIC',
        territoryCode: '',
      });
      void qc.invalidateQueries({ queryKey: ['ops', 'partners'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const resendMutation = useMutation({
    mutationFn: (email: string) => resendAdminPartnerInvite(email),
    onSuccess: () => {
      toast.success(t('opsPartners.resendSuccess'));
      void qc.invalidateQueries({ queryKey: ['ops', 'partners'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const invalidatePartners = () =>
    void qc.invalidateQueries({ queryKey: ['ops', 'partners'] });

  const disableMutation = useMutation({
    mutationFn: () =>
      disableCompany(disableTarget!.companyId!, {
        reason: disableReason.trim(),
        note: disableNote.trim() || undefined,
      }),
    onSuccess: () => {
      setDisableTarget(null);
      setDisableReason('');
      setDisableNote('');
      setActionError(null);
      toast.success(t('opsPartners.disableSuccess'));
      invalidatePartners();
    },
    onError: (err) => setActionError(getErrorDetail(err)),
  });

  const reactivateMutation = useMutation({
    mutationFn: (companyId: string) => reactivateCompany(companyId),
    onSuccess: () => {
      toast.success(t('opsPartners.reactivateSuccess'));
      invalidatePartners();
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (companyId: string) => deleteCompany(companyId),
    onSuccess: () => {
      toast.success(t('opsPartners.deleteSuccess'));
      invalidatePartners();
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const busy =
    disableMutation.isPending ||
    reactivateMutation.isPending ||
    deleteMutation.isPending ||
    resendMutation.isPending;

  async function onReactivate(row: PartnerAdminListItem) {
    if (!row.companyId) return;
    const ok = await confirm({
      title: t('opsPartners.reactivateTitle'),
      description: t('opsPartners.reactivateBody', {
        name: row.company?.legalName || row.name || row.email,
      }),
      confirmLabel: t('opsPartners.reactivateConfirm'),
    });
    if (ok) reactivateMutation.mutate(row.companyId);
  }

  async function onDelete(row: PartnerAdminListItem) {
    if (!row.companyId) return;
    const ok = await confirm({
      title: t('opsPartners.deleteTitle'),
      description: t('opsPartners.deleteBody', {
        name: row.company?.legalName || row.name || row.email,
      }),
      confirmLabel: t('opsPartners.deleteConfirm'),
      tone: 'destructive',
    });
    if (ok) deleteMutation.mutate(row.companyId);
  }

  function renderActions(row: PartnerAdminListItem) {
    const companyStatus = row.company?.status;
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {row.openCase ? (
          <Link
            to={`/compliance/${row.openCase.id}`}
            className="text-xs font-semibold text-clox-orange hover:underline"
          >
            {t('opsPartners.openCase')}
          </Link>
        ) : null}
        {row.status === 'INVITED' || row.status === 'PENDING_DOCS' ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => resendMutation.mutate(row.email)}
          >
            {t('opsPartners.resend')}
          </Button>
        ) : null}
        {row.companyId && companyStatus === CompanyStatus.DRAFT ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void onDelete(row)}
          >
            {t('opsPartners.delete')}
          </Button>
        ) : null}
        {row.companyId && companyStatus === CompanyStatus.SUSPENDED ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void onReactivate(row)}
          >
            {t('opsPartners.reactivate')}
          </Button>
        ) : null}
        {row.companyId &&
        companyStatus &&
        companyStatus !== CompanyStatus.DRAFT &&
        companyStatus !== CompanyStatus.SUSPENDED &&
        companyStatus !== CompanyStatus.REJECTED ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => {
              setDisableTarget(row);
              setDisableReason('');
              setDisableNote('');
              setActionError(null);
            }}
          >
            {t('opsPartners.disable')}
          </Button>
        ) : null}
      </div>
    );
  }

  const items = listQuery.data?.items ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-clox-ink sm:text-3xl">
        {t('opsPartners.title')}
      </h1>
      <p className="mt-2 text-sm text-clox-mute">{t('opsPartners.subtitle')}</p>

      <section className="clox-card mt-6 max-w-2xl p-5">
        <h2 className="font-display text-lg font-semibold text-clox-ink">
          {t('opsPartners.inviteTitle')}
        </h2>
        {geoQuery.isError ? (
          <Notice tone="error" className="mt-3">
            {getErrorDetail(geoQuery.error)}
          </Notice>
        ) : null}
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => inviteMutation.mutate(values))}
        >
          <Field
            label={t('opsPartners.email')}
            className="sm:col-span-2"
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Field label={t('opsPartners.name')} {...form.register('name')} />
          <Field label={t('opsPartners.companyName')} {...form.register('companyName')} />
          <Select label={t('opsPartners.role')} {...form.register('role')}>
            <option value={AdminRole.STATE_MASTER}>{t('opsPartners.roleState')}</option>
            <option value={AdminRole.LOCAL_BDE}>{t('opsPartners.roleLocal')}</option>
          </Select>
          <Controller
            name="regionCode"
            control={form.control}
            render={({ field, fieldState }) => (
              <SearchableSelect
                label={t('opsPartners.region')}
                value={field.value}
                onChange={(next) => {
                  field.onChange(next);
                  form.setValue('territoryCode', '');
                }}
                options={regionOptions}
                placeholder={t('opsPartners.regionPlaceholder')}
                searchPlaceholder={t('opsPartners.searchPlaceholder')}
                emptyLabel={t('opsPartners.noMatches')}
                error={fieldState.error?.message}
                disabled={geoQuery.isLoading}
                required
              />
            )}
          />
          {role === AdminRole.LOCAL_BDE ? (
            <Controller
              name="territoryCode"
              control={form.control}
              render={({ field, fieldState }) => (
                <SearchableSelect
                  className="sm:col-span-2"
                  label={t('opsPartners.territory')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={territoryOptions}
                  placeholder={
                    territoryOptions.length
                      ? t('opsPartners.territoryPlaceholder')
                      : t('opsPartners.noTerritories')
                  }
                  searchPlaceholder={t('opsPartners.searchPlaceholder')}
                  emptyLabel={t('opsPartners.noMatches')}
                  error={fieldState.error?.message}
                  disabled={geoQuery.isLoading || !regionCode || territoryOptions.length === 0}
                  required
                />
              )}
            />
          ) : null}
          <div className="sm:col-span-2">
            <Button
              type="submit"
              variant="cta"
              disabled={inviteMutation.isPending || geoQuery.isLoading}
            >
              {inviteMutation.isPending ? t('loading') : t('opsPartners.sendInvite')}
            </Button>
          </div>
        </form>
        {lastInviteUrl ? (
          <Notice tone="info" className="mt-4 break-all">
            {t('opsPartners.inviteUrlHint')}: {lastInviteUrl}
          </Notice>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-clox-ink">
          {t('opsPartners.listTitle')}
        </h2>
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
        {!listQuery.isLoading && !listQuery.isError && items.length === 0 ? (
          <div className="mt-4">
            <EmptyBlock
              title={t('opsPartners.emptyTitle')}
              description={t('opsPartners.emptyHint')}
            />
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <DataTable
              minWidthClassName="min-w-[56rem]"
              headers={[
                t('opsPartners.colPartner'),
                t('opsPartners.colRole'),
                t('opsPartners.colStatus'),
                t('opsPartners.colCompanyStatus'),
                t('opsPartners.colScope'),
                t('opsPartners.colActions'),
              ]}
            >
              {items.map((row) => (
                <tr key={row.id} className="border-t border-clox-border-soft">
                  <td className="px-4 py-3">
                    <p className="font-medium text-clox-ink">
                      {row.company?.legalName || row.name || row.email}
                    </p>
                    <p className="text-xs text-clox-faint">{row.email}</p>
                    {row.company?.abn ? (
                      <p className="font-mono text-xs text-clox-faint">ABN {row.company.abn}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.role}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={adminPartnerStatusTone(row.status)}>{row.status}</StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    {row.company?.status ? (
                      <StatusPill tone={companyStatusTone(row.company.status)}>
                        {t(`companyStatuses.${row.company.status}`, {
                          defaultValue: row.company.status,
                        })}
                      </StatusPill>
                    ) : (
                      t('dash')
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-clox-mute">
                    {(row.scopes ?? [])
                      .map((s) => [s.regionCode, s.territoryCode].filter(Boolean).join('/'))
                      .join(', ') || t('dash')}
                  </td>
                  <td className="px-4 py-3 text-right">{renderActions(row)}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        ) : null}
      </section>

      {disableTarget ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="clox-card w-full max-w-md p-5 shadow-clox-2">
            <h3 className="font-display text-lg font-semibold text-clox-ink">
              {t('opsPartners.disableTitle')}
            </h3>
            <p className="mt-2 text-sm text-clox-mute">
              {t('opsPartners.disableBody', {
                name:
                  disableTarget.company?.legalName ||
                  disableTarget.name ||
                  disableTarget.email,
              })}
            </p>
            <Field
              className="mt-4"
              label={t('companies.disableReason')}
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
              placeholder={t('companies.disableReasonPlaceholder')}
            />
            <Field
              label={t('companies.disableNote')}
              value={disableNote}
              onChange={(e) => setDisableNote(e.target.value)}
              placeholder={t('companies.disableNotePlaceholder')}
            />
            {actionError ? (
              <Notice tone="error" className="mt-3">
                {actionError}
              </Notice>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDisableTarget(null);
                  setActionError(null);
                }}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={disableMutation.isPending || disableReason.trim().length < 3}
                onClick={() => disableMutation.mutate()}
              >
                {disableMutation.isPending ? t('loading') : t('opsPartners.disableConfirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
