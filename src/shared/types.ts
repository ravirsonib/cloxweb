import { z } from 'zod';

export const LeadType = {
  REGISTRY_SENDER: 'REGISTRY_SENDER',
  REGISTRY_CARRIER: 'REGISTRY_CARRIER',
  EOI_STATE_MASTER: 'EOI_STATE_MASTER',
  EOI_LOCAL_BDE: 'EOI_LOCAL_BDE',
  INVESTOR: 'INVESTOR',
} as const;

export type LeadType = (typeof LeadType)[keyof typeof LeadType];

export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  INVITED: 'INVITED',
  ONBOARDED: 'ONBOARDED',
  REJECTED: 'REJECTED',
  DUPLICATE: 'DUPLICATE',
  UNDER_REVIEW: 'UNDER_REVIEW',
  KYB_PENDING: 'KYB_PENDING',
  EXECUTIVE_REVIEW: 'EXECUTIVE_REVIEW',
  APPROVED: 'APPROVED',
  AGREEMENT_SENT: 'AGREEMENT_SENT',
  PROVISIONED: 'PROVISIONED',
} as const;

export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const AdminRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  STATE_MASTER: 'STATE_MASTER',
  LOCAL_BDE: 'LOCAL_BDE',
} as const;

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

export const PlatformRole = {
  SENDER: 'SENDER',
  TRANSPORT_COMPANY: 'TRANSPORT_COMPANY',
  DRIVER: 'DRIVER',
} as const;

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const AppRole = {
  ...AdminRole,
  ...PlatformRole,
} as const;

export type AppRole = (typeof AppRole)[keyof typeof AppRole];

export const ADMIN_ROLES: AdminRole[] = [
  AdminRole.SUPER_ADMIN,
  AdminRole.STATE_MASTER,
  AdminRole.LOCAL_BDE,
];

export function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as string[]).includes(role);
}

/** Logged-in product locales (admin). Keep in sync with api SUPPORTED_LOCALES. */
export const SUPPORTED_LOCALES = ['en', 'hi', 'pa'] as const;
export type AppLocaleCode = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocaleCode = 'en';

export const Locale = {
  en: 'en',
  hi: 'hi',
  pa: 'pa',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export function isAppLocaleCode(value: string | null | undefined): value is AppLocaleCode {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export const AuditAction = {
  LEAD_CREATED: 'lead.created',
  LEAD_STATUS_CHANGED: 'lead.status_changed',
  LEAD_UPDATED: 'lead.updated',
  LEAD_NOTE_ADDED: 'lead.note_added',
  LEAD_DELETED: 'lead.deleted',
  AUTH_OTP_REQUESTED: 'auth.otp_requested',
  AUTH_OTP_VERIFIED: 'auth.otp_verified',
  AUTH_OTP_FAILED: 'auth.otp_failed',
  AUTH_TOKEN_REFRESHED: 'auth.token_refreshed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_SESSION_REVOKED: 'auth.session_revoked',
  AUTH_STEP_UP_REQUESTED: 'auth.step_up_requested',
  AUTH_STEP_UP_VERIFIED: 'auth.step_up_verified',
  ADMIN_PROVISIONED: 'admin.provisioned',
  ADMIN_INVITED: 'admin.invited',
  ADMIN_INVITE_RESENT: 'admin.invite_resent',
  ADMIN_INVITE_ACCEPTED: 'admin.invite_accepted',
  ADMIN_PARTNER_SUBMITTED: 'admin.partner_submitted',
  ADMIN_PARTNER_ACTIVATED: 'admin.partner_activated',
  ADMIN_SCOPE_CHANGED: 'admin.scope_changed',
  ADMIN_COACHING_NOTE_ADDED: 'admin.coaching_note_added',
  DOC_UPLOAD_INTENT: 'document.upload_intent',
  DOC_UPLOADED: 'document.uploaded',
  DOC_CONFIRMED: 'document.confirmed',
  COMPLIANCE_SUBMITTED: 'compliance.submitted',
  COMPLIANCE_APPROVED: 'compliance.approved',
  COMPLIANCE_REJECTED: 'compliance.rejected',
  COMPLIANCE_INFO_REQUESTED: 'compliance.info_requested',
  COMPLIANCE_ESCALATED: 'compliance.escalated',
  COMPLIANCE_DOC_EXPIRED: 'compliance.doc_expired',
  COMPANY_SUSPENDED: 'company.suspended',
  COMPANY_REACTIVATED: 'company.reactivated',
  COMPANY_DELETED: 'company.deleted',
  SENDER_REGISTERED: 'sender.registered',
  SENDER_PROFILE_UPDATED: 'sender.profile_updated',
  SENDER_PAYMENT_SETUP: 'sender.payment_setup',
  SENDER_PAYMENT_READY: 'sender.payment_ready',
  SENDER_ACTIVATED: 'sender.activated',
  CARRIER_REGISTERED: 'carrier.registered',
  CARRIER_PROFILE_UPDATED: 'carrier.profile_updated',
  CARRIER_CONNECT_SETUP: 'carrier.connect_setup',
  CARRIER_CONNECT_READY: 'carrier.connect_ready',
  CARRIER_VEHICLE_ADDED: 'carrier.vehicle_added',
  CARRIER_VEHICLE_DISABLED: 'carrier.vehicle_disabled',
  CARRIER_VEHICLE_RETIRED: 'carrier.vehicle_retired',
  CARRIER_VEHICLE_REACTIVATED: 'carrier.vehicle_reactivated',
  CARRIER_VEHICLE_DELETED: 'carrier.vehicle_deleted',
  CARRIER_DRIVER_INVITED: 'carrier.driver_invited',
  CARRIER_DRIVER_INVITE_RESENT: 'carrier.driver_invite_resent',
  CARRIER_DRIVER_DISABLED: 'carrier.driver_disabled',
  CARRIER_DRIVER_REACTIVATED: 'carrier.driver_reactivated',
  CARRIER_DRIVER_DELETED: 'carrier.driver_deleted',
  CARRIER_CAPABILITIES_UPDATED: 'carrier.capabilities_updated',
  CARRIER_ACTIVATED: 'carrier.activated',
  DRIVER_INVITE_ACCEPTED: 'driver.invite_accepted',
  DRIVER_PROFILE_SUBMITTED: 'driver.profile_submitted',
  DRIVER_ACTIVATED: 'driver.activated',
  DRIVER_SUSPENDED: 'driver.suspended',
  JOB_CREATED: 'job.created',
  JOB_UPDATED: 'job.updated',
  JOB_PUBLISHED: 'job.published',
  PROPOSAL_SUBMITTED: 'proposal.submitted',
  PROPOSAL_WITHDRAWN: 'proposal.withdrawn',
  PROPOSAL_ACCEPTED: 'proposal.accepted',
  PROPOSAL_EXPIRED_CONFLICT: 'proposal.expired_conflict',
  PAYMENT_INTENT_CREATED: 'payment.intent_created',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  ASSIGNMENT_LOCKED: 'assignment.locked',
  ASSIGNMENT_REASSIGNED: 'assignment.reassigned',
  EXCEPTION_OPENED: 'exception.opened',
  EXCEPTION_NOTIFIED: 'exception.notified',
  EXCEPTION_REASSIGNED: 'exception.reassigned',
  EXCEPTION_ESCALATED: 'exception.escalated',
  EXCEPTION_RELEASED: 'exception.released',
  EXCEPTION_RESOLVED: 'exception.resolved',
  EXCEPTION_PERFORMANCE_STUB: 'exception.performance_stub',
  REFUND_STUB: 'payment.refund_stub',
  TRIP_CREATED: 'trip.created',
  TRIP_SAFETY_PASSED: 'trip.safety_passed',
  TRIP_SAFETY_FAILED: 'trip.safety_failed',
  TRIP_MASS_CHECKED: 'trip.mass_checked',
  TRIP_STARTED: 'trip.started',
  TRIP_BREAK_TOGGLED: 'trip.break_toggled',
  TRIP_LOCATION: 'trip.location',
  TRIP_GEOFENCE_ENTER: 'trip.geofence_enter',
  TRIP_GEOFENCE_EXIT: 'trip.geofence_exit',
  TRIP_APPROACHING_NOTIFIED: 'trip.approaching_notified',
  TRIP_AT_DROPOFF_NOTIFIED: 'trip.at_dropoff_notified',
  POD_SIGNED_ON_SOG: 'pod.signed_on_sog',
  POD_FINALIZED: 'pod.finalized',
  POD_PDF_GENERATED: 'pod.pdf_generated',
  TRIP_BREAKDOWN_PDF_GENERATED: 'trip.breakdown_pdf_generated',
  TAX_INVOICE_GENERATED: 'invoice.tax_generated',
  RUN_SHEET_GENERATED: 'trip.run_sheet_generated',
  TRIP_COMPLETED: 'trip.completed',
  SURCHARGE_CREATED: 'surcharge.created',
  SURCHARGE_PAID: 'surcharge.paid',
  SURCHARGE_WAIVED: 'surcharge.waived',
  PUSH_STUB: 'notify.push_stub',
  GEOGRAPHY_REGION_UPDATED: 'geography.region_updated',
  DISPUTE_OPENED: 'dispute.opened',
  DISPUTE_TRIAGED: 'dispute.triaged',
  DISPUTE_ESCALATED: 'dispute.escalated',
  DISPUTE_ASSIGNED: 'dispute.assigned',
  DISPUTE_RESOLVED: 'dispute.resolved',
  DISPUTE_CLOSED_LOCAL: 'dispute.closed_local',
  SETTLEMENT_CYCLE_RUN: 'settlement.cycle_run',
  RECONCILIATION_RUN: 'settlement.reconciliation_run',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

const honeypotField = z.string().max(200).optional();
const localeField = z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE);
const abnField = z
  .string()
  .trim()
  .regex(/^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$|^\d{9,11}$/, 'Invalid ABN format');
const emailField = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());
const acceptedTrue = z.preprocess(
  (value) => value === true || value === 'true' || value === 'on' || value === 1 || value === '1',
  z.literal(true),
);

export const leadTypeSchema = z.enum([
  LeadType.REGISTRY_SENDER,
  LeadType.REGISTRY_CARRIER,
  LeadType.EOI_STATE_MASTER,
  LeadType.EOI_LOCAL_BDE,
  LeadType.INVESTOR,
]);

export const leadStatusSchema = z.enum([
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.INVITED,
  LeadStatus.ONBOARDED,
  LeadStatus.REJECTED,
  LeadStatus.DUPLICATE,
  LeadStatus.UNDER_REVIEW,
  LeadStatus.KYB_PENDING,
  LeadStatus.EXECUTIVE_REVIEW,
  LeadStatus.APPROVED,
  LeadStatus.AGREEMENT_SENT,
  LeadStatus.PROVISIONED,
]);

export const registrySenderSchema = z.object({
  userType: z.literal('sender'),
  companyLegalName: z.string().trim().min(2).max(200),
  abn: abnField,
  shippingOrigin: z.string().trim().min(2).max(120),
  operationalModels: z.array(z.string().min(1)).min(1),
  biddingType: z.array(z.string().min(1)).min(1),
  monthlyVolume: z.string().trim().min(1),
  infraAcknowledged: z.array(z.string()).default([]),
  email: emailField,
  phone: z.string().trim().min(8).max(30),
  locale: localeField,
  source: z.string().trim().max(200).optional(),
  honeypot: honeypotField,
});

export const registryCarrierSchema = z.object({
  userType: z.literal('carrier'),
  fleetEntityName: z.string().trim().min(2).max(200),
  abn: abnField,
  depotState: z.string().trim().min(2).max(80),
  fleetComposition: z.array(z.string().min(1)).min(1),
  capabilities: z.array(z.string()).default([]),
  complianceAuthorized: acceptedTrue,
  infraAcknowledged: z.array(z.string()).default([]),
  email: emailField,
  phone: z.string().trim().min(8).max(30),
  locale: localeField,
  source: z.string().trim().max(200).optional(),
  honeypot: honeypotField,
});

export const registryLeadSchema = z.discriminatedUnion('userType', [
  registrySenderSchema,
  registryCarrierSchema,
]);

export type RegistryLeadInput = z.infer<typeof registryLeadSchema>;

export const eoiLeadSchema = z.object({
  role: z.enum(['state_master', 'local_bde']),
  targetState: z.string().trim().min(2).max(80),
  targetTerritory: z.string().trim().min(2).max(120),
  fullLegalName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(200),
  abn: abnField,
  acn: z.string().trim().max(20).optional(),
  email: emailField,
  phone: z.string().trim().min(8).max(30),
  corporateAddress: z.string().trim().min(5).max(300),
  networkExperience: z.string().trim().min(10).max(4000),
  executionStrategy: z.string().trim().min(10).max(4000),
  declarationAccepted: acceptedTrue,
  locale: localeField,
  source: z.string().trim().max(200).optional(),
  honeypot: honeypotField,
});

export type EoiLeadInput = z.infer<typeof eoiLeadSchema>;

export const investorClassificationSchema = z.enum([
  'sophisticated_investor',
  'professional_investor',
  'strategic_industry_partner',
]);

export const capitalAllocationSchema = z.enum([
  '25000_99999',
  '100000_249999',
  '250000_499999',
  '500000_plus',
]);

export const ecosystemFocusSchema = z.enum([
  'pure_financial_growth',
  'strategic_carrier_fleet',
  'enterprise_sender_pipeline',
  'regional_admin_network',
]);

export const investorLeadSchema = z.object({
  fullNameOrEntity: z.string().trim().min(2).max(200),
  contactPersonName: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length === 0 ? undefined : value,
    z.string().trim().max(120).optional(),
  ),
  email: emailField,
  phone: z.string().trim().min(8).max(30),
  abn: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length === 0 ? undefined : value,
    abnField.optional(),
  ),
  acn: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length === 0 ? undefined : value,
    z.string().trim().max(20).optional(),
  ),
  residence: z.string().trim().min(2).max(120),
  investorClassifications: z.array(investorClassificationSchema).min(1),
  capitalAllocation: capitalAllocationSchema,
  ecosystemFocus: ecosystemFocusSchema,
  strategicNotes: z.string().trim().min(10).max(4000),
  authorizedName: z.string().trim().min(2).max(120),
  declarationAccepted: acceptedTrue,
  locale: localeField,
  source: z.string().trim().max(200).optional(),
  honeypot: honeypotField,
});

export type InvestorLeadInput = z.infer<typeof investorLeadSchema>;

export const createLeadResponseSchema = z.object({
  id: z.string().uuid(),
  type: leadTypeSchema,
  status: leadStatusSchema,
  createdAt: z.string().datetime(),
  warnings: z.array(z.string()).optional(),
  possibleDuplicate: z.boolean().optional(),
});

export type CreateLeadResponse = z.infer<typeof createLeadResponseSchema>;

export const otpRequestSchema = z.object({
  email: emailField,
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  email: emailField,
  code: z.string().trim().regex(/^\d{4,8}$/),
});

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.string(),
  sessionId: z.string().uuid().optional(),
  principal: z
    .object({
      kind: z.enum(['admin', 'user']),
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string().nullable(),
      role: z.enum([
        AppRole.SUPER_ADMIN,
        AppRole.STATE_MASTER,
        AppRole.LOCAL_BDE,
        AppRole.SENDER,
        AppRole.TRANSPORT_COMPANY,
        AppRole.DRIVER,
      ]),
      scopes: z
        .array(
          z.object({
            scopeType: z.enum(['STATE', 'LOCAL']),
            regionCode: z.string().nullable(),
            territoryCode: z.string().nullable(),
          }),
        )
        .optional(),
    })
    .optional(),
  admin: z
    .object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string().nullable(),
      role: z.enum([
        AdminRole.SUPER_ADMIN,
        AdminRole.STATE_MASTER,
        AdminRole.LOCAL_BDE,
      ]),
    })
    .optional(),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const adminLeadListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: leadTypeSchema.optional(),
  status: leadStatusSchema.optional(),
  q: z.string().trim().max(200).optional(),
  priority: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      return value === 'true';
    }),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AdminLeadListQuery = z.infer<typeof adminLeadListQuerySchema>;

export const updateLeadSchema = z
  .object({
    status: leadStatusSchema.optional(),
    priority: z.boolean().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.priority !== undefined ||
      value.assigneeId !== undefined,
    { message: 'At least one field is required' },
  );

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const createLeadNoteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type CreateLeadNoteInput = z.infer<typeof createLeadNoteSchema>;

export const adminAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().max(100).optional(),
  leadId: z.string().uuid().optional(),
});

export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;

export const adminLeadExportQuerySchema = z.object({
  type: leadTypeSchema.optional(),
  status: leadStatusSchema.optional(),
  q: z.string().trim().max(200).optional(),
});

export type AdminLeadExportQuery = z.infer<typeof adminLeadExportQuerySchema>;

export const CompanyType = {
  SENDER: 'SENDER',
  CARRIER: 'CARRIER',
} as const;
export type CompanyType = (typeof CompanyType)[keyof typeof CompanyType];

export const CompanyStatus = {
  DRAFT: 'DRAFT',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  PENDING_REVIEW: 'PENDING_REVIEW',
  INFO_REQUESTED: 'INFO_REQUESTED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PENDING_COMPLIANCE_DOCS: 'PENDING_COMPLIANCE_DOCS',
  PENDING_SETTLEMENT_SETUP: 'PENDING_SETTLEMENT_SETUP',
  PENDING_FLEET_READINESS: 'PENDING_FLEET_READINESS',
  ACTIVE: 'ACTIVE',
  BID_ELIGIBLE: 'BID_ELIGIBLE',
  SUSPENDED: 'SUSPENDED',
  REJECTED: 'REJECTED',
} as const;
export type CompanyStatus = (typeof CompanyStatus)[keyof typeof CompanyStatus];

export const COMPANY_STATUS_KEYS = Object.values(CompanyStatus);

export const adminDashboardQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', '30d', 'year', 'all']).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export type AdminDashboardQuery = z.infer<typeof adminDashboardQuerySchema>;

export const financeQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', '30d', 'quarter', 'year', 'all']).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  regionCode: z.string().trim().optional(),
  companyId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
});

export type FinanceQuery = z.infer<typeof financeQuerySchema>;

export const adminCompanyListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['SENDER', 'CARRIER']).optional(),
  status: z.enum([
    'DRAFT',
    'PENDING_VERIFICATION',
    'PENDING_REVIEW',
    'INFO_REQUESTED',
    'PENDING_PAYMENT',
    'PENDING_COMPLIANCE_DOCS',
    'PENDING_SETTLEMENT_SETUP',
    'PENDING_FLEET_READINESS',
    'ACTIVE',
    'BID_ELIGIBLE',
    'SUSPENDED',
    'REJECTED',
  ]).optional(),
  regionCode: z.string().trim().max(16).optional(),
  q: z.string().trim().max(200).optional(),
});

export type AdminCompanyListQuery = z.infer<typeof adminCompanyListQuerySchema>;

export const vehicleClassCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_]+$/, 'Code must be alphanumeric with underscores only')
  .transform((v) => v.toUpperCase());

export const vehicleClassCreateSchema = z.object({
  code: vehicleClassCodeSchema,
  name: z.string().trim().min(1, 'Name is required').max(64),
  rank: z.number().int().min(1, 'Rank must be at least 1').max(999),
  maxChargeableWeightKg: z.number().positive('Max chargeable weight must be positive').max(100_000),
  maxLengthCm: z.number().positive('Length must be positive').max(10_000),
  maxWidthCm: z.number().positive('Width must be positive').max(1_000),
  maxHeightCm: z.number().positive('Height must be positive').max(1_000),
  minLicenceClass: z.string().trim().min(1, 'Min licence class is required').max(10),
  suggestedGvmKg: z.number().int().positive('Suggested GVM must be positive').max(200_000),
  suggestedTareKg: z.number().int().positive('Suggested Tare must be positive').max(200_000),
  isActive: z.boolean().default(true),
});

export const vehicleClassUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(64).optional(),
  rank: z.number().int().min(1, 'Rank must be at least 1').max(999).optional(),
  maxChargeableWeightKg: z.number().positive('Max chargeable weight must be positive').max(100_000).optional(),
  maxLengthCm: z.number().positive('Length must be positive').max(10_000).optional(),
  maxWidthCm: z.number().positive('Width must be positive').max(1_000).optional(),
  maxHeightCm: z.number().positive('Height must be positive').max(1_000).optional(),
  minLicenceClass: z.string().trim().min(1, 'Min licence class is required').max(10).optional(),
  suggestedGvmKg: z.number().int().positive('Suggested GVM must be positive').max(200_000).optional(),
  suggestedTareKg: z.number().int().positive('Suggested Tare must be positive').max(200_000).optional(),
  isActive: z.boolean().optional(),
});

export type VehicleClassCreateInput = z.infer<typeof vehicleClassCreateSchema>;
export type VehicleClassUpdateInput = z.infer<typeof vehicleClassUpdateSchema>;

export type VehicleClassDto = {
  id: string;
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
  createdAt: string;
  updatedAt: string;
};

export const updateRegionEnabledSchema = z.object({
  enabled: z.boolean(),
});
export type UpdateRegionEnabledInput = z.infer<typeof updateRegionEnabledSchema>;

// ─── M11 Disputes (WF-OPS-002) ───────────────────────────────────────────────

export const DisputeType = {
  WAITING_SURCHARGE: 'WAITING_SURCHARGE',
  MASS_SURCHARGE: 'MASS_SURCHARGE',
  DAMAGE: 'DAMAGE',
  CANCELLATION: 'CANCELLATION',
  GENERAL: 'GENERAL',
} as const;
export type DisputeType = (typeof DisputeType)[keyof typeof DisputeType];

export const DisputeStatus = {
  OPEN_TRIAGE: 'OPEN_TRIAGE',
  TRIAGED: 'TRIAGED',
  ESCALATED_STATE: 'ESCALATED_STATE',
  ESCALATED_SUPER: 'ESCALATED_SUPER',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const DisputeRuling = {
  FAVOR_SENDER: 'FAVOR_SENDER',
  FAVOR_CARRIER: 'FAVOR_CARRIER',
  SPLIT: 'SPLIT',
} as const;
export type DisputeRuling = (typeof DisputeRuling)[keyof typeof DisputeRuling];

export const DisputeFinancialAdjustment = {
  NONE: 'NONE',
  REFUND_SENDER: 'REFUND_SENDER',
  WAIVE_SURCHARGE: 'WAIVE_SURCHARGE',
  ADJUST_PAYOUT: 'ADJUST_PAYOUT',
} as const;
export type DisputeFinancialAdjustment =
  (typeof DisputeFinancialAdjustment)[keyof typeof DisputeFinancialAdjustment];

export const createDisputeSchema = z.object({
  jobId: z.string().uuid(),
  tripId: z.string().uuid().optional(),
  surchargeId: z.string().uuid().optional(),
  type: z.enum([
    'WAITING_SURCHARGE',
    'MASS_SURCHARGE',
    'DAMAGE',
    'CANCELLATION',
    'GENERAL',
  ]),
  reason: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(3000),
  disputedAmountCents: z.number().int().nonnegative().optional(),
  evidenceUrls: z.array(z.string().trim().min(1)).default([]),
});
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

export const triageDisputeSchema = z.object({
  contactedSender: z.boolean().optional(),
  contactedCarrier: z.boolean().optional(),
  evidenceComplete: z.boolean().optional(),
  triageNotes: z.string().trim().max(3000).optional(),
});
export type TriageDisputeInput = z.infer<typeof triageDisputeSchema>;

export const escalateDisputeSchema = z.object({
  target: z.enum(['STATE', 'SUPER']),
  notes: z.string().trim().max(3000).optional(),
});
export type EscalateDisputeInput = z.infer<typeof escalateDisputeSchema>;

export const assignDisputeSchema = z.object({
  adminUserId: z.string().uuid(),
});
export type AssignDisputeInput = z.infer<typeof assignDisputeSchema>;

export const resolveDisputeSchema = z.object({
  ruling: z.enum(['FAVOR_SENDER', 'FAVOR_CARRIER', 'SPLIT']),
  rulingNotes: z.string().trim().min(3).max(3000),
  financialAdjustment: z
    .enum(['NONE', 'REFUND_SENDER', 'WAIVE_SURCHARGE', 'ADJUST_PAYOUT'])
    .default('NONE'),
  adjustmentAmountCents: z.number().int().nonnegative().optional(),
});
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export const closeLocalDisputeSchema = z.object({
  notes: z.string().trim().max(3000).optional(),
});
export type CloseLocalDisputeInput = z.infer<typeof closeLocalDisputeSchema>;

export const listDisputesQuerySchema = z.object({
  status: z
    .enum([
      'OPEN_TRIAGE',
      'TRIAGED',
      'ESCALATED_STATE',
      'ESCALATED_SUPER',
      'RESOLVED',
      'REJECTED',
      'CLOSED',
    ])
    .optional(),
  type: z
    .enum([
      'WAITING_SURCHARGE',
      'MASS_SURCHARGE',
      'DAMAGE',
      'CANCELLATION',
      'GENERAL',
    ])
    .optional(),
  regionId: z.string().uuid().optional(),
  territoryId: z.string().uuid().optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListDisputesQuery = z.infer<typeof listDisputesQuerySchema>;

export type OpsDashboardStatsResponse = {
  role: AdminRole;
  scope: {
    type: 'NATIONAL' | 'STATE' | 'TERRITORY';
    regionCode?: string;
    regionName?: string;
    territoryCode?: string;
    territoryName?: string;
  };
  kpis: {
    activeCarriers: number;
    activeJobs: number;
    openDisputes: number;
    accruedRevenueCents: number;
    pendingCompliance?: number;
    prospectsInPipeline?: number;
    onboardingStuck?: number;
    firstLineDisputes?: number;
  };
  recentDisputes: Array<{
    id: string;
    disputeNumber: string;
    type: string;
    status: string;
    reason: string;
    disputedAmountCents: number | null;
    companyName: string;
    createdAt: string;
  }>;
  recentComplianceCases?: Array<{
    id: string;
    caseType: string;
    status: string;
    companyName: string;
    createdAt: string;
  }>;
  recentJobs?: Array<{
    id: string;
    title: string | null;
    status: string;
    pickupSuburb: string | null;
    dropoffSuburb: string | null;
    createdAt: string;
  }>;
  tasks?: Array<{
    id: string;
    kind: 'DISPUTE_TRIAGE' | 'PROSPECT_FOLLOWUP' | 'ONBOARDING_STUCK';
    title: string;
    description: string;
    href: string;
    dueText: string;
  }>;
};

export type BdeTeamMemberSummary = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  status: string;
  active: boolean;
  regionCode: string;
  territoryCode: string | null;
  territoryName: string | null;
  openTasksCount: number;
  overdueTasksCount: number;
  pipelineCount: number;
  slaStatus: 'GOOD' | 'WARNING' | 'BREACHED';
  accruedRevenueCents: number;
};

export type BdeTeamListResponse = {
  regionCode: string;
  regionName: string;
  members: BdeTeamMemberSummary[];
};

export type BdeTeamMemberDetail = BdeTeamMemberSummary & {
  createdAt: string;
  companyName: string | null;
  prospects: Array<{
    id: string;
    legalName: string;
    companyType: string;
    stage: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    createdAt: string;
  }>;
  recentDisputes: Array<{
    id: string;
    disputeNumber: string;
    type: string;
    status: string;
    reason: string;
    disputedAmountCents: number | null;
    createdAt: string;
    isOverdue: boolean;
  }>;
  coachingNotes: Array<{
    id: string;
    authorId: string;
    authorName: string;
    text: string;
    createdAt: string;
  }>;
};



