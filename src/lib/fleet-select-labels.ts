/** Display labels for carrier fleet/driver <Select> options (never raw UUIDs). */

export function carrierVehicleSelectLabel(
  v: {
    registration?: string | null;
    label?: string | null;
    vehicleClass?: string | null;
  },
  dash = '-',
): string {
  const name = v.registration?.trim() || v.label?.trim() || '';
  const cls = v.vehicleClass?.trim() || dash;
  if (name) return `${name} · ${cls}`;
  if (v.vehicleClass?.trim()) return v.vehicleClass.trim();
  return 'Fleet vehicle';
}

export function carrierDriverSelectLabel(
  d: {
    user?: { name?: string | null; email?: string | null } | null;
    name?: string | null;
    email?: string | null;
    licenceClass?: string | null;
  },
): string {
  const name =
    d.user?.name?.trim() ||
    d.name?.trim() ||
    d.user?.email?.trim() ||
    d.email?.trim() ||
    'Driver';
  return d.licenceClass?.trim() ? `${name} · ${d.licenceClass.trim()}` : name;
}
