import { i18n } from '@/lib/i18n';
import type { LeadStatus, LeadType } from '@/shared/types';

export type AdminRef = {
  id: string;
  email: string;
  name: string | null;
};

export type LeadListItem = {
  id: string;
  type: LeadType;
  status: LeadStatus;
  email: string;
  phone: string | null;
  companyName: string | null;
  abn: string | null;
  state: string | null;
  territory: string | null;
  priority: boolean;
  assigneeId: string | null;
  locale: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: AdminRef | null;
};

export type LeadNote = {
  id: string;
  leadId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: AdminRef;
};

export type LeadEvent = {
  id: string;
  leadId: string | null;
  actorId: string | null;
  action: string;
  metadata: unknown;
  createdAt: string;
  actor: AdminRef | null;
};

export type LeadDetail = LeadListItem & {
  acn: string | null;
  payload: Record<string, unknown> | null;
  ipHash: string | null;
  promotedUserId: string | null;
  notes: LeadNote[];
  events: LeadEvent[];
};

export type PayloadEntry = {
  key: string;
  label: string;
  /** Plain text for simple values */
  value: string;
  /** Chip-style list items when the field is an array */
  items?: string[];
};

export const LEAD_TYPE_KEYS = [
  'REGISTRY_SENDER',
  'REGISTRY_CARRIER',
  'EOI_STATE_MASTER',
  'EOI_LOCAL_BDE',
  'INVESTOR',
] as const satisfies readonly LeadType[];

export const LEAD_STATUS_KEYS = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'INVITED',
  'ONBOARDED',
  'REJECTED',
  'DUPLICATE',
  'UNDER_REVIEW',
  'KYB_PENDING',
  'EXECUTIVE_REVIEW',
  'APPROVED',
  'AGREEMENT_SENT',
  'PROVISIONED',
] as const satisfies readonly LeadStatus[];

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return i18n.t('dash');
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return i18n.t('dash');
  const locale = i18n.language?.startsWith('hi') ? 'hi-IN' : 'en-AU';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatLeadType(type: string): string {
  return i18n.t(`leadTypes.${type}`, { defaultValue: type });
}

export function formatLeadStatus(status: string): string {
  return i18n.t(`leadStatuses.${status}`, { defaultValue: status });
}

/** Fields already shown in the lead summary — omit from submission details. */
const PAYLOAD_HIDDEN_KEYS = new Set([
  'honeypot',
  'idempotencyKey',
  'email',
  'phone',
  'source',
  'locale',
]);

const FIELD_LABEL_KEYS: Record<string, string> = {
  userType: 'admin.fields.userType',
  companyLegalName: 'admin.fields.companyLegalName',
  fleetEntityName: 'admin.fields.fleetEntityName',
  companyName: 'admin.fields.companyName',
  fullLegalName: 'admin.fields.fullLegalName',
  fullNameOrEntity: 'admin.fields.fullNameOrEntity',
  contactPersonName: 'admin.fields.contactPersonName',
  authorizedName: 'admin.fields.authorizedName',
  abn: 'admin.fields.abn',
  acn: 'admin.fields.acn',
  shippingOrigin: 'admin.fields.shippingOrigin',
  depotState: 'admin.fields.depotState',
  targetState: 'admin.fields.targetState',
  targetTerritory: 'admin.fields.targetTerritory',
  residence: 'admin.fields.residence',
  corporateAddress: 'admin.fields.corporateAddress',
  operationalModels: 'admin.fields.operationalModels',
  biddingType: 'admin.fields.biddingType',
  monthlyVolume: 'admin.fields.monthlyVolume',
  fleetComposition: 'admin.fields.fleetComposition',
  capabilities: 'admin.fields.capabilities',
  infraAcknowledged: 'admin.fields.infraAcknowledged',
  complianceAuthorized: 'admin.fields.complianceAuthorized',
  declarationAccepted: 'admin.fields.declarationAccepted',
  networkExperience: 'admin.fields.networkExperience',
  executionStrategy: 'admin.fields.executionStrategy',
  strategicNotes: 'admin.fields.strategicNotes',
  investorClassifications: 'admin.fields.investorClassifications',
  capitalAllocation: 'admin.fields.capitalAllocation',
  ecosystemFocus: 'admin.fields.ecosystemFocus',
  role: 'admin.fields.role',
};

const VALUE_LABEL_KEYS: Record<string, string> = {
  sender: 'admin.values.sender',
  carrier: 'admin.values.carrier',
  local_bde: 'admin.values.localBde',
  state_master: 'admin.values.stateMaster',
  sophisticated_investor: 'admin.values.sophisticatedInvestor',
  professional_investor: 'admin.values.professionalInvestor',
  strategic_industry_partner: 'admin.values.strategicIndustryPartner',
  '25000_99999': 'admin.values.band25k',
  '100000_249999': 'admin.values.band100k',
  '250000_499999': 'admin.values.band250k',
  '500000_plus': 'admin.values.band500k',
  pure_financial_growth: 'admin.values.pureFinancialGrowth',
  strategic_carrier_fleet: 'admin.values.strategicCarrierFleet',
  enterprise_sender_pipeline: 'admin.values.enterpriseSenderPipeline',
  regional_admin_network: 'admin.values.regionalAdminNetwork',
};

function titleCaseWords(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatPayloadLabel(key: string): string {
  const labelKey = FIELD_LABEL_KEYS[key];
  if (labelKey) return i18n.t(labelKey, { defaultValue: titleCaseWords(key) });
  return titleCaseWords(key);
}

export function formatPayloadScalar(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return i18n.t('dash');
  }
  if (typeof value === 'boolean') return value ? i18n.t('yes') : i18n.t('no');
  if (typeof value === 'number') return String(value);

  const raw = String(value).trim();
  const valueKey = VALUE_LABEL_KEYS[raw];
  if (valueKey) return i18n.t(valueKey, { defaultValue: titleCaseWords(raw) });

  // Keep natural sentences; soften snake/kebab codes.
  if (/^[a-z0-9]+([_-][a-z0-9]+)+$/i.test(raw) && raw.length < 60) {
    return titleCaseWords(raw);
  }
  return raw;
}

/** @deprecated use formatPayloadScalar — kept for any older imports */
export function formatPayloadValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return i18n.t('dash');
    return value.map((item) => formatPayloadScalar(item)).join(', ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${formatPayloadLabel(key)}: ${formatPayloadScalar(nested)}`)
      .join('; ');
  }
  return formatPayloadScalar(value);
}

/** Flatten payload entries for admin-friendly display cards. */
export function getPayloadEntries(
  payload: Record<string, unknown> | null | undefined,
): PayloadEntry[] {
  if (!payload || typeof payload !== 'object') return [];

  return Object.entries(payload)
    .filter(([key]) => !PAYLOAD_HIDDEN_KEYS.has(key))
    .map(([key, value]) => {
      const label = formatPayloadLabel(key);

      if (Array.isArray(value)) {
        const items = value
          .map((item) => formatPayloadScalar(item))
          .filter((item) => item && item !== i18n.t('dash'));
        return {
          key,
          label,
          value: items.length > 0 ? items.join(', ') : i18n.t('dash'),
          items: items.length > 0 ? items : undefined,
        };
      }

      if (value && typeof value === 'object') {
        const nested = Object.entries(value as Record<string, unknown>)
          .map(([nestedKey, nestedValue]) => ({
            key: `${key}.${nestedKey}`,
            label: `${label} · ${formatPayloadLabel(nestedKey)}`,
            value: formatPayloadScalar(nestedValue),
          }));
        // Represent nested objects as a single readable block.
        return {
          key,
          label,
          value:
            nested.length > 0
              ? nested.map((item) => `${item.label.split(' · ').pop()}: ${item.value}`).join('\n')
              : i18n.t('dash'),
        };
      }

      return {
        key,
        label,
        value: formatPayloadScalar(value),
      };
    });
}

/** Location from columns, with payload fallback for older sender leads. */
export function resolveLeadLocation(lead: {
  state: string | null;
  territory: string | null;
  payload?: Record<string, unknown> | null;
}): string {
  const fromColumns = [lead.state, lead.territory].filter(Boolean).join(' · ');
  if (fromColumns) return fromColumns;

  const payload = lead.payload ?? {};
  const candidates = [
    payload.shippingOrigin,
    payload.depotState,
    payload.targetState,
    payload.targetTerritory,
    payload.residence,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return candidates.join(' · ');
}
