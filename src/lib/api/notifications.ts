import { http } from '@/lib/http';

export type NotificationType =
  | 'JOB_PUBLISHED'
  | 'TRIP_AT_PICKUP'
  | 'TRIP_STARTED'
  | 'TRIP_BREAK'
  | 'TRIP_EXCEPTION'
  | 'TRIP_AT_DROPOFF'
  | 'POD_FINALIZED'
  | 'TRIP_COMPLETED'
  | 'DISPUTE'
  | 'COMPLIANCE_APPROVED'
  | 'COMPLIANCE_INFO_REQUESTED'
  | 'BID_RECEIVED'
  | 'BID_ACCEPTED'
  | 'PAYMENT_SETUP_REQUIRED'
  | 'PAYOUT_SETUP_REQUIRED'
  | 'COMPLIANCE_CASE_OPENED'

  | 'COMPLIANCE_CASE_RESUBMITTED'
  | 'ADMIN_PARTNER_KYB_SUBMITTED'
  | 'COMPLIANCE_ESCALATED'
  | 'TRIP_EXCEPTION_ESCALATED'
  | 'FLEET_RWC_REVIEW_OPENED'
  | 'DRIVER_LICENCE_REVIEW_OPENED'
  | 'FUEL_INDEX_STALE'
  | 'TRIP_ASSIGNED'
  | 'TRIP_REASSIGNED'
  | 'TRIP_APPROACHING'
  | 'TRIP_REMINDER'
  | 'DETENTION_STARTED'
  | 'SURCHARGE_ACTION_REQUIRED'
  | 'SCHEDULE_REQUESTED'
  | 'SCHEDULE_APPROVED'
  | 'SCHEDULE_REJECTED'
  | 'DOCUMENT_EXPIRING';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
  unread: boolean;
};

export async function listNotifications(params?: { limit?: number; cursor?: string }) {
  const { data } = await http.get<{
    items: NotificationItem[];
    nextCursor: string | null;
  }>('/notifications', { params });
  return data;
}

export async function getNotificationUnreadCount() {
  const { data } = await http.get<{ count: number }>('/notifications/unread-count');
  return data;
}

export async function markNotificationRead(id: string) {
  const { data } = await http.post<NotificationItem>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await http.post<{ updated: number }>('/notifications/read-all');
  return data;
}

export type PushStats = {
  enabled: boolean;
  mode: 'fcm' | 'mock';
  activeDevices: {
    total: number;
    android: number;
    ios: number;
    web: number;
  };
  last24h: {
    sent: number;
    failed: number;
    pending: number;
    skipped: number;
  };
  recentFailures: Array<{
    id: string;
    type: NotificationType;
    platform: 'ANDROID' | 'IOS' | 'WEB' | null;
    attempts: number;
    lastError: string | null;
    updatedAt: string;
  }>;
};

export async function getPushStats(opts?: { signal?: AbortSignal }) {
  const { data } = await http.get<PushStats>('/notifications/push-stats', {
    signal: opts?.signal,
  });
  return data;
}

export async function registerPushDevice(input: {
  token: string;
  platform: 'ANDROID' | 'IOS' | 'WEB';
  deviceId?: string;
  appVersion?: string;
  locale?: 'en' | 'hi' | 'pa';
}) {
  const { data } = await http.put<{
    id: string;
    platform: string;
    tokenMasked: string;
    isActive: boolean;
  }>('/notifications/devices', input);
  return data;
}

export async function unregisterPushDevice(input: { token?: string; deviceId?: string }) {
  const { data } = await http.delete<{ deactivated: number }>('/notifications/devices', {
    data: input,
  });
  return data;
}
