import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import {
  createAdminVehicleClass,
  deleteAdminVehicleClass,
  getErrorDetail,
  listAdminVehicleClasses,
  updateAdminVehicleClass,
} from '@/lib/api';
import { Button, ChoiceCheck, Field, Notice, Select, useConfirm, useToast } from '@/components/ui';
import { EmptyBlock, LoadingBlock } from '@/components/status-blocks';
import { X } from 'lucide-react';
import { LICENCE_CLASSES } from '@/lib/validation';
import { AdminRole, type VehicleClassDto } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

type ModalMode = 'CREATE' | 'EDIT' | null;

interface FormData {
  code: string;
  name: string;
  rank: number;
  maxChargeableWeightKg: number;
  maxLengthCm: number;
  maxWidthCm: number;
  maxHeightCm: number;
  minLicenceClass: string;
  suggestedGvmKg: number;
  suggestedTareKg: number;
  isActive: boolean;
}

const INITIAL_FORM: FormData = {
  code: '',
  name: '',
  rank: 1,
  maxChargeableWeightKg: 1000,
  maxLengthCm: 240,
  maxWidthCm: 180,
  maxHeightCm: 150,
  minLicenceClass: 'C',
  suggestedGvmKg: 3500,
  suggestedTareKg: 2000,
  isActive: true,
};

export function AdminVehicleClassesPage() {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedClass, setSelectedClass] = useState<VehicleClassDto | null>(null);
  const [formValues, setFormValues] = useState<FormData>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'vehicle-classes'],
    queryFn: ({ signal }) => listAdminVehicleClasses({ signal }),
    enabled: role === AdminRole.SUPER_ADMIN,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => createAdminVehicleClass(data),
    onSuccess: async () => {
      toast.success(t('adminVehicleClasses.createSuccess', { defaultValue: 'Vehicle class created successfully' }));
      setModalMode(null);
      await qc.invalidateQueries({ queryKey: ['admin', 'vehicle-classes'] });
      await qc.invalidateQueries({ queryKey: ['jobs', 'meta', 'vehicle-classes'] });
    },
    onError: (err) => setFormError(getErrorDetail(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) =>
      updateAdminVehicleClass(id, data),
    onSuccess: async () => {
      toast.success(t('adminVehicleClasses.updateSuccess', { defaultValue: 'Vehicle class updated successfully' }));
      setModalMode(null);
      await qc.invalidateQueries({ queryKey: ['admin', 'vehicle-classes'] });
      await qc.invalidateQueries({ queryKey: ['jobs', 'meta', 'vehicle-classes'] });
    },
    onError: (err) => setFormError(getErrorDetail(err)),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateAdminVehicleClass(id, { isActive }),
    onSuccess: async (_, vars) => {
      toast.success(
        vars.isActive
          ? t('adminVehicleClasses.activated', { defaultValue: 'Vehicle class activated' })
          : t('adminVehicleClasses.deactivated', { defaultValue: 'Vehicle class deactivated' }),
      );
      await qc.invalidateQueries({ queryKey: ['admin', 'vehicle-classes'] });
      await qc.invalidateQueries({ queryKey: ['jobs', 'meta', 'vehicle-classes'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminVehicleClass(id),
    onSuccess: async () => {
      toast.success(t('adminVehicleClasses.deleteSuccess', { defaultValue: 'Vehicle class deleted' }));
      await qc.invalidateQueries({ queryKey: ['admin', 'vehicle-classes'] });
      await qc.invalidateQueries({ queryKey: ['jobs', 'meta', 'vehicle-classes'] });
    },
    onError: (err) => toast.error(getErrorDetail(err)),
  });

  if (role !== AdminRole.SUPER_ADMIN) return <Navigate to="/" replace />;
  if (query.isLoading) return <LoadingBlock label={t('loading', { defaultValue: 'Loading vehicle classes…' })} />;

  const classes = query.data ?? [];
  const activeCount = classes.filter((c) => c.isActive).length;

  const openCreateModal = () => {
    const nextRank = classes.length > 0 ? Math.max(...classes.map((c) => c.rank)) + 1 : 1;
    setFormValues({
      ...INITIAL_FORM,
      rank: nextRank,
    });
    setSelectedClass(null);
    setFormError(null);
    setModalMode('CREATE');
  };

  const openEditModal = (item: VehicleClassDto) => {
    setSelectedClass(item);
    setFormValues({
      code: item.code,
      name: item.name,
      rank: item.rank,
      maxChargeableWeightKg: item.maxChargeableWeightKg,
      maxLengthCm: item.maxLengthCm,
      maxWidthCm: item.maxWidthCm,
      maxHeightCm: item.maxHeightCm,
      minLicenceClass: item.minLicenceClass,
      suggestedGvmKg: item.suggestedGvmKg,
      suggestedTareKg: item.suggestedTareKg,
      isActive: item.isActive,
    });
    setFormError(null);
    setModalMode('EDIT');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formValues.name.trim()) {
      setFormError('Display name is required');
      return;
    }

    if (modalMode === 'CREATE') {
      const codeClean = formValues.code.trim().toUpperCase();
      if (!codeClean) {
        setFormError('Class code is required');
        return;
      }
      if (!/^[A-Z0-9_]+$/.test(codeClean)) {
        setFormError('Code must contain only uppercase letters, numbers, and underscores');
        return;
      }
      createMutation.mutate({
        ...formValues,
        code: codeClean,
      });
    } else if (modalMode === 'EDIT' && selectedClass) {
      updateMutation.mutate({
        id: selectedClass.id,
        data: {
          name: formValues.name,
          rank: Number(formValues.rank),
          maxChargeableWeightKg: Number(formValues.maxChargeableWeightKg),
          maxLengthCm: Number(formValues.maxLengthCm),
          maxWidthCm: Number(formValues.maxWidthCm),
          maxHeightCm: Number(formValues.maxHeightCm),
          minLicenceClass: formValues.minLicenceClass,
          suggestedGvmKg: Number(formValues.suggestedGvmKg),
          suggestedTareKg: Number(formValues.suggestedTareKg),
          isActive: formValues.isActive,
        },
      });
    }
  };

  const handleDelete = async (item: VehicleClassDto) => {
    const ok = await confirm({
      title: t('adminVehicleClasses.deleteConfirmTitle', {
        defaultValue: `Delete Vehicle Class "${item.code}"?`,
      }),
      description: t('adminVehicleClasses.deleteConfirmBody', {
        defaultValue:
          'If this vehicle class is referenced by existing vehicles or jobs, deletion will be blocked and you can deactivate it instead.',
      }),
      tone: 'destructive',
    });
    if (!ok) return;
    deleteMutation.mutate(item.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-clox-ink">
            {t('adminVehicleClasses.title', { defaultValue: 'Vehicle Classes' })}
          </h1>
          <p className="mt-1 text-sm text-clox-mute">
            {t('adminVehicleClasses.subtitle', {
              defaultValue:
                'Manage vehicle hierarchy, cargo weight and dimension envelopes, licence classes, and fleet defaults. Sender load auto-suggestion uses these dynamic rules.',
            })}
          </p>
        </div>
        <Button type="button" onClick={openCreateModal}>
          + {t('adminVehicleClasses.addBtn', { defaultValue: 'Add Vehicle Class' })}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-clox-md border border-clox-border bg-clox-surface p-4 text-sm">
        <div>
          <span className="text-clox-mute">Total Configured:</span>{' '}
          <span className="font-semibold text-clox-ink">{classes.length}</span>
        </div>
        <div className="h-4 w-px bg-clox-border" />
        <div>
          <span className="text-clox-mute">Active in Marketplace:</span>{' '}
          <span className="font-semibold text-[var(--status-ok)]">{activeCount}</span>
        </div>
        <div className="h-4 w-px bg-clox-border" />
        <div className="text-xs text-clox-faint">
          Auto-suggestion evaluates active classes in order of <strong>Rank</strong>: selects the lowest rank where cargo weight and dimensions (L×W×H) both fit.
        </div>
      </div>

      {query.isError ? (
        <Notice tone="error">
          {getErrorDetail(query.error)}
        </Notice>
      ) : null}

      {classes.length === 0 ? (
        <EmptyBlock
          title={t('adminVehicleClasses.emptyTitle', { defaultValue: 'No vehicle classes configured' })}
          description={t('adminVehicleClasses.emptyDesc', {
            defaultValue: 'Add a new vehicle class or wait for automatic initialization.',
          })}
        />
      ) : (
        <div className="overflow-x-auto rounded-clox-md border border-clox-border bg-clox-surface shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-clox-border bg-clox-surface-alt text-xs font-semibold uppercase tracking-wider text-clox-mute">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Display Name</th>
                <th className="px-4 py-3">Max Payload</th>
                <th className="px-4 py-3">Cargo Bay (L × W × H)</th>
                <th className="px-4 py-3">Min Licence</th>
                <th className="px-4 py-3">Suggested GVM / Tare</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clox-border">
              {classes.map((cls) => (
                <tr key={cls.id} className="hover:bg-clox-surface-alt/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-clox-ink">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-clox-surface-alt text-xs font-bold text-clox-mute">
                      #{cls.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-clox-ink">
                    {cls.code}
                  </td>
                  <td className="px-4 py-3 font-medium text-clox-ink">
                    {cls.name}
                  </td>
                  <td className="px-4 py-3 text-clox-ink">
                    {cls.maxChargeableWeightKg.toLocaleString()} kg
                  </td>
                  <td className="px-4 py-3 text-clox-ink whitespace-nowrap">
                    {cls.maxLengthCm} × {cls.maxWidthCm} × {cls.maxHeightCm} cm
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded border border-clox-border bg-clox-surface-alt px-2 py-0.5 text-xs font-bold text-clox-ink">
                      {cls.minLicenceClass}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-clox-mute">
                    {cls.suggestedGvmKg.toLocaleString()} / {cls.suggestedTareKg.toLocaleString()} kg
                  </td>
                  <td className="px-4 py-3">
                    {cls.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-[var(--status-ok-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-ok)]">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-clox-surface-alt px-2.5 py-0.5 text-xs font-semibold text-clox-mute">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => openEditModal(cls)}
                      >
                        {t('edit', { defaultValue: 'Edit' })}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs"
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: cls.id,
                            isActive: !cls.isActive,
                          })
                        }
                      >
                        {cls.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                        onClick={() => handleDelete(cls)}
                      >
                        {t('delete', { defaultValue: 'Delete' })}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-clox-lg border border-clox-border bg-clox-surface p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-clox-ink">
                  {modalMode === 'CREATE'
                    ? t('adminVehicleClasses.createTitle', { defaultValue: 'Add New Vehicle Class' })
                    : t('adminVehicleClasses.editTitle', { defaultValue: `Edit Vehicle Class: ${selectedClass?.code}` })}
                </h2>
                <p className="mt-1 text-xs text-clox-mute">
                  Configure load thresholds and dimension limits for auto-suggestion.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-clox-sm p-1.5 text-clox-mute hover:bg-clox-surface-alt hover:text-clox-ink transition-colors focus:outline-none focus:ring-2 focus:ring-clox-accent"
                aria-label={t('close', { defaultValue: 'Close' })}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError ? (
              <Notice tone="error" className="mt-4">
                {formError}
              </Notice>
            ) : null}

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t('adminVehicleClasses.codeLabel', { defaultValue: 'Class Code' })}
                  hint={modalMode === 'CREATE' ? 'Unique uppercase identifier (e.g. RIGID_8T)' : 'Code cannot be changed once created'}
                  value={formValues.code}
                  disabled={modalMode === 'EDIT'}
                  required
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                    }))
                  }
                />
                <Field
                  label={t('adminVehicleClasses.nameLabel', { defaultValue: 'Display Name' })}
                  hint="Human-readable label (e.g. Rigid 8T (up to 8t))"
                  value={formValues.name}
                  required
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field
                  type="number"
                  label={t('adminVehicleClasses.rankLabel', { defaultValue: 'Rank Hierarchy' })}
                  hint="1 = smallest (e.g. Ute); larger can take smaller jobs"
                  value={formValues.rank}
                  required
                  min={1}
                  step={1}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      rank: Number.parseInt(e.target.value, 10) || 1,
                    }))
                  }
                />
                <Field
                  type="number"
                  label={t('adminVehicleClasses.maxWeightLabel', { defaultValue: 'Max Payload (kg)' })}
                  hint="Max chargeable weight"
                  value={formValues.maxChargeableWeightKg}
                  required
                  min={1}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      maxChargeableWeightKg: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                />
                <Select
                  label={t('adminVehicleClasses.minLicenceLabel', { defaultValue: 'Min Licence' })}
                  hint="Required driver licence"
                  value={formValues.minLicenceClass}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      minLicenceClass: e.target.value,
                    }))
                  }
                >
                  {LICENCE_CLASSES.map((lic: string) => (
                    <option key={lic} value={lic}>
                      {lic}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="rounded-clox-md border border-clox-border bg-clox-surface-alt p-3">
                <p className="text-xs font-bold text-clox-ink">
                  Cargo Bay Dimensions (cm)
                </p>
                <p className="text-[11px] text-clox-mute">
                  Used by auto-suggestion so large/bulky items trigger a vehicle class with sufficient cargo envelope.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field
                    type="number"
                    label="Max Length (cm)"
                    value={formValues.maxLengthCm}
                    required
                    min={1}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        maxLengthCm: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <Field
                    type="number"
                    label="Max Width (cm)"
                    value={formValues.maxWidthCm}
                    required
                    min={1}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        maxWidthCm: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <Field
                    type="number"
                    label="Max Height (cm)"
                    value={formValues.maxHeightCm}
                    required
                    min={1}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        maxHeightCm: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  type="number"
                  label={t('adminVehicleClasses.gvmLabel', { defaultValue: 'Suggested GVM (kg)' })}
                  hint="Default GVM when carrier selects this class"
                  value={formValues.suggestedGvmKg}
                  required
                  min={1}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      suggestedGvmKg: Number.parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
                <Field
                  type="number"
                  label={t('adminVehicleClasses.tareLabel', { defaultValue: 'Suggested Tare (kg)' })}
                  hint="Default Tare when carrier selects this class"
                  value={formValues.suggestedTareKg}
                  required
                  min={1}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      suggestedTareKg: Number.parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
              </div>

              <ChoiceCheck
                checked={formValues.isActive}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
              >
                {t('adminVehicleClasses.activeCheckLabel', {
                  defaultValue: 'Active (Available for sender auto-suggestion and carrier fleet registration)',
                })}
              </ChoiceCheck>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setModalMode(null)}
                >
                  {t('cancel', { defaultValue: 'Cancel' })}
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? t('saving', { defaultValue: 'Saving…' })
                    : t('save', { defaultValue: 'Save Vehicle Class' })}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
