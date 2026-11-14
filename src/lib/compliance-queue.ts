import type { ComplianceCaseListItem } from '@/lib/api';

/** Queue tabs for Ops — plain-language buckets over compliance case types. */
export const COMPLIANCE_QUEUE_TABS = [
  'all',
  'fleet',
  'drivers',
  'carrierKyb',
  'sender',
  'partner',
  'profile',
] as const;

export type ComplianceQueueTab = (typeof COMPLIANCE_QUEUE_TABS)[number];

const PENDING_DOC_STATUSES = new Set(['UPLOADED', 'UNDER_REVIEW']);

/** Map queue tab → API caseType / caseTypes filter. */
export function caseFilterForQueueTab(tab: ComplianceQueueTab): {
  caseType?: string;
  caseTypes?: string[];
} {
  switch (tab) {
    case 'fleet':
      return { caseType: 'CARRIER_FLEET_RWC' };
    case 'drivers':
      return { caseType: 'CARRIER_DRIVER_LICENCE' };
    case 'carrierKyb':
      return { caseType: 'CARRIER_KYB' };
    case 'sender':
      return { caseTypes: ['SENDER_KYB', 'SENDER_KYC'] };
    case 'partner':
      return { caseType: 'ADMIN_PARTNER_KYB' };
    case 'profile':
      return { caseType: 'COMPANY_PROFILE_CHANGE' };
    case 'all':
    default:
      return {};
  }
}

/** Human-readable case type for list/detail (i18n key: compliance.caseTypes.*). */
export function complianceCaseTypeLabelKey(caseType: string): string {
  return `compliance.caseTypes.${caseType}`;
}

/**
 * Distinct vehicles with RWC still waiting Ops decision on a fleet case.
 * Falls back to pending RWC doc count when vehicleId is missing.
 */
export function pendingFleetVehicleCount(row: ComplianceCaseListItem): number | null {
  if (row.caseType !== 'CARRIER_FLEET_RWC') return null;
  const pending = row.documents.filter(
    (d) => d.docType === 'RWC' && PENDING_DOC_STATUSES.has(d.status),
  );
  const vehicleIds = new Set(
    pending.map((d) => d.vehicleId).filter((id): id is string => Boolean(id)),
  );
  if (vehicleIds.size > 0) return vehicleIds.size;
  return pending.length > 0 ? pending.length : 0;
}
