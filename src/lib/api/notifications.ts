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
  | 'DISPUTE';

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
