import { jobStatusTone, type StatusTone } from '@/lib/status-tone';

export type SenderJobLifecycleAssignment = {
  status: string;
  paidAndConfirmed: boolean;
} | null | undefined;

export type SenderJobLifecycleInput = {
  status: string;
  assignment?: SenderJobLifecycleAssignment;
};

export type SenderJobLifecycleDisplay = {
  /** i18n key under `common` */
  labelKey: string;
  defaultLabel: string;
  tone: StatusTone;
  /** True only when accept happened and card payment is still owed. */
  isPendingPayment: boolean;
  /** True when assignment is paid (LOCKED or COMPLETED). */
  isPaidAndLocked: boolean;
};

/**
 * Sender-facing job chip — never show "Locked" while assignment is PENDING,
 * and never show "Pending payment" after paidAndConfirmed (LOCKED/COMPLETED).
 * Other job statuses keep the standard jobStatuses.* labels.
 */
export function resolveSenderJobLifecycleDisplay(
  job: SenderJobLifecycleInput,
): SenderJobLifecycleDisplay {
  const assignment = job.assignment ?? null;
  const isPendingPayment =
    job.status === 'ASSIGNED' &&
    assignment?.status === 'PENDING' &&
    !assignment.paidAndConfirmed;
  const isPaidAndLocked =
    job.status === 'ASSIGNED' &&
    Boolean(assignment?.paidAndConfirmed) &&
    (assignment?.status === 'LOCKED' || assignment?.status === 'COMPLETED');

  if (isPendingPayment) {
    return {
      labelKey: 'jobs.lifecycle.pendingPayment',
      defaultLabel: 'Pending payment',
      tone: 'warn',
      isPendingPayment: true,
      isPaidAndLocked: false,
    };
  }

  if (isPaidAndLocked) {
    return {
      labelKey: 'jobs.lifecycle.paidAndLocked',
      defaultLabel: 'Paid & locked',
      tone: 'ok',
      isPendingPayment: false,
      isPaidAndLocked: true,
    };
  }

  return {
    labelKey: `jobStatuses.${job.status}`,
    defaultLabel: job.status,
    tone: jobStatusTone(job.status),
    isPendingPayment: false,
    isPaidAndLocked: false,
  };
}

/** Assignment row label on job detail (not the hero job chip). */
export function resolveSenderAssignmentStatusLabel(assignment: {
  status: string;
  paidAndConfirmed: boolean;
}): { labelKey: string; defaultLabel: string; tone: StatusTone } {
  if (assignment.status === 'PENDING' && !assignment.paidAndConfirmed) {
    return {
      labelKey: 'jobs.lifecycle.pendingPayment',
      defaultLabel: 'Pending payment',
      tone: 'warn',
    };
  }
  if (assignment.paidAndConfirmed && assignment.status === 'LOCKED') {
    return {
      labelKey: 'jobs.lifecycle.paidAndLocked',
      defaultLabel: 'Paid & locked',
      tone: 'ok',
    };
  }
  if (assignment.paidAndConfirmed && assignment.status === 'COMPLETED') {
    return {
      labelKey: 'jobs.lifecycle.assignmentCompleted',
      defaultLabel: 'Completed',
      tone: 'ok',
    };
  }
  if (assignment.status === 'CANCELLED') {
    return {
      labelKey: 'jobs.lifecycle.assignmentCancelled',
      defaultLabel: 'Cancelled',
      tone: 'danger',
    };
  }
  return {
    labelKey: `jobs.assignmentStatuses.${assignment.status}`,
    defaultLabel: assignment.status,
    tone: assignment.paidAndConfirmed ? 'ok' : 'neutral',
  };
}
