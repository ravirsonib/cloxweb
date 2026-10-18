import type { TFunction } from 'i18next';
import { formatLeadStatus, formatLeadType } from '@/lib/leads';

const ACTION_I18N: Record<string, string> = {
  'lead.created': 'admin.actionLabels.lead_created',
  'lead.status_changed': 'admin.actionLabels.lead_status_changed',
  'lead.updated': 'admin.actionLabels.lead_updated',
  'lead.note_added': 'admin.actionLabels.lead_note_added',
  'auth.otp_requested': 'admin.actionLabels.auth_otp_requested',
  'auth.otp_verified': 'admin.actionLabels.auth_otp_verified',
  'auth.otp_failed': 'admin.actionLabels.auth_otp_failed',
  'auth.token_refreshed': 'admin.actionLabels.auth_token_refreshed',
  'auth.logout': 'admin.actionLabels.auth_logout',
  'auth.session_revoked': 'admin.actionLabels.auth_session_revoked',
  'document.upload_intent': 'admin.actionLabels.doc_upload_intent',
  'document.uploaded': 'admin.actionLabels.doc_uploaded',
  'document.confirmed': 'admin.actionLabels.doc_confirmed',
  'compliance.submitted': 'admin.actionLabels.compliance_submitted',
  'compliance.approved': 'admin.actionLabels.compliance_approved',
  'compliance.rejected': 'admin.actionLabels.compliance_rejected',
  'job.created': 'admin.actionLabels.job_created',
  'job.published': 'admin.actionLabels.job_published',
  'proposal.submitted': 'admin.actionLabels.proposal_submitted',
  'proposal.accepted': 'admin.actionLabels.proposal_accepted',
  'payment.intent_created': 'admin.actionLabels.payment_intent_created',
  'payment.succeeded': 'admin.actionLabels.payment_succeeded',
  'payment.failed': 'admin.actionLabels.payment_failed',
  'assignment.locked': 'admin.actionLabels.assignment_locked',
  'trip.created': 'admin.actionLabels.trip_created',
  'trip.safety_passed': 'admin.actionLabels.trip_safety_passed',
  'trip.safety_failed': 'admin.actionLabels.trip_safety_failed',
  'trip.started': 'admin.actionLabels.trip_started',
  'trip.completed': 'admin.actionLabels.trip_completed',
  'trip.geofence_enter': 'admin.actionLabels.trip_geofence_enter',
  'trip.geofence_exit': 'admin.actionLabels.trip_geofence_exit',
  'surcharge.created': 'admin.actionLabels.surcharge_created',
  'surcharge.paid': 'admin.actionLabels.surcharge_paid',
  'surcharge.waived': 'admin.actionLabels.surcharge_waived',
};

const META_LABEL_I18N: Record<string, string> = {
  type: 'admin.metaLabels.type',
  email: 'admin.metaLabels.email',
  channel: 'admin.metaLabels.channel',
  from: 'admin.metaLabels.from',
  to: 'admin.metaLabels.to',
  priority: 'admin.metaLabels.priority',
  assigneeId: 'admin.metaLabels.assigneeId',
  noteId: 'admin.metaLabels.noteId',
  reason: 'admin.metaLabels.reason',
  possibleDuplicateAbn: 'admin.metaLabels.possibleDuplicateAbn',
  duplicateLeadIds: 'admin.metaLabels.duplicateLeadIds',
  companyName: 'admin.metaLabels.companyName',
  status: 'admin.metaLabels.status',
};

export type AuditDetailRow = {
  label: string;
  value: string;
};

export function formatAuditAction(action: string, t: TFunction): string {
  const key = ACTION_I18N[action];
  if (key) {
    const translated = t(key);
    // Fall back to humanized action when locale key is missing.
    if (translated !== key) return translated;
  }
  return action
    .replace(/\./g, ' · ')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatMetaValue(key: string, value: unknown, t: TFunction): string {
  if (value == null) return t('dash');
  if (typeof value === 'boolean') return value ? t('yes') : t('no');

  if (Array.isArray(value)) {
    if (value.length === 0) return t('dash');
    return value.map((item) => String(item)).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  const text = String(value);

  if (key === 'type' || key === 'channel') {
    try {
      return formatLeadType(text);
    } catch {
      return text;
    }
  }

  if (key === 'from' || key === 'to' || key === 'status') {
    try {
      return formatLeadStatus(text);
    } catch {
      return text;
    }
  }

  return text;
}

export function formatAuditMetadata(
  metadata: unknown,
  t: TFunction,
): AuditDetailRow[] {
  if (metadata == null) return [];

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [{ label: t('admin.metaLabels.details'), value: String(metadata) }];
  }

  const entries = Object.entries(metadata as Record<string, unknown>);
  if (entries.length === 0) return [];

  // Prefer a readable status change line when both from/to exist.
  const rows: AuditDetailRow[] = [];
  const record = metadata as Record<string, unknown>;
  if ('from' in record && 'to' in record) {
    rows.push({
      label: t('admin.metaLabels.statusChange'),
      value: `${formatMetaValue('from', record.from, t)} → ${formatMetaValue('to', record.to, t)}`,
    });
  }

  for (const [key, value] of entries) {
    if (key === 'from' || key === 'to') continue;
    const labelKey = META_LABEL_I18N[key];
    rows.push({
      label: labelKey ? t(labelKey) : humanizeKey(key),
      value: formatMetaValue(key, value, t),
    });
  }

  return rows;
}
