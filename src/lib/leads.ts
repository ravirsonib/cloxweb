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
