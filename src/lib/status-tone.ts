/** Map domain status strings to StatusPill tones. */

export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

/** Marketplace / partner company lifecycle. */
export function companyStatusTone(status: string): StatusTone {
  switch (status) {
    case 'ACTIVE':
    case 'BID_ELIGIBLE':
      return 'ok';
    case 'SUSPENDED':
    case 'REJECTED':
      return 'danger';
    case 'INFO_REQUESTED':
    case 'PENDING_REVIEW':
    case 'PENDING_VERIFICATION':
      return 'warn';
    case 'PENDING_PAYMENT':
    case 'PENDING_COMPLIANCE_DOCS':
    case 'PENDING_SETTLEMENT_SETUP':
    case 'PENDING_FLEET_READINESS':
      return 'info';
    case 'DRAFT':
    default:
      return 'neutral';
  }
}

/** Admin partner user lifecycle. */
export function adminPartnerStatusTone(status: string): StatusTone {
  switch (status) {
    case 'ACTIVE':
      return 'ok';
    case 'REJECTED':
    case 'SUSPENDED':
      return 'danger';
    case 'PENDING_REVIEW':
      return 'warn';
    case 'INVITED':
    case 'PENDING_DOCS':
      return 'info';
    default:
      return 'neutral';
  }
}
