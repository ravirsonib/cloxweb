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

/** Marketplace job lifecycle. */
export function jobStatusTone(status: string): StatusTone {
  switch (status) {
    case 'COMPLETED':
      return 'ok';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    case 'IN_TRANSIT':
    case 'ASSIGNED':
      return 'info';
    case 'PUBLISHED':
    case 'BIDDING':
      return 'warn';
    case 'DRAFT':
    default:
      return 'neutral';
  }
}

/** Job assignment lifecycle. */
export function assignmentStatusTone(status: string): StatusTone {
  switch (status) {
    case 'LOCKED':
    case 'COMPLETED':
      return 'ok';
    case 'CANCELLED':
      return 'danger';
    case 'PENDING':
      return 'warn';
    default:
      return 'neutral';
  }
}

/** Trip lifecycle. */
export function tripStatusTone(status: string): StatusTone {
  switch (status) {
    case 'COMPLETED':
      return 'ok';
    case 'CANCELLED':
    case 'BREAKDOWN':
      return 'danger';
    case 'IN_TRANSIT':
    case 'EN_ROUTE_PICKUP':
    case 'AT_PICKUP':
    case 'AT_DROPOFF':
      return 'info';
    case 'PENDING_GATES':
      return 'warn';
    default:
      return 'neutral';
  }
}
