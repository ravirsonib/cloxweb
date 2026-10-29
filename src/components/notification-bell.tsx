import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  getNotificationUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/api/notifications';
import { cn } from '@/lib/cn';
import { AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const MARKETPLACE_ROLES = new Set<string>([
  AppRole.SENDER,
  AppRole.TRANSPORT_COMPANY,
  AppRole.DRIVER,
]);

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

export function NotificationBell({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const kind = useAuthStore((s) => s.kind);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const enabled = kind === 'user' && Boolean(role && MARKETPLACE_ROLES.has(role));

  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getNotificationUnreadCount,
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => listNotifications({ limit: 20 }),
    enabled: enabled && open,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!enabled) return null;

  const count = unread.data?.count ?? 0;
  const items = list.data?.items ?? [];

  const openItem = async (item: NotificationItem) => {
    if (item.unread) {
      try {
        await markOne.mutateAsync(item.id);
      } catch {
        /* still navigate */
      }
    }
    setOpen(false);
    if (item.href) navigate(item.href);
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-clox-mute transition hover:bg-clox-surface-alt hover:text-clox-ink"
        aria-label={t('notifications.bellLabel')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" aria-hidden strokeWidth={1.9} />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--status-warn)] px-1 font-mono text-[10px] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t('notifications.panelTitle')}
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-clox-md border border-clox-border bg-clox-surface shadow-clox-2"
        >
          <div className="flex items-center justify-between gap-2 border-b border-clox-border px-3 py-2">
            <p className="text-sm font-semibold text-clox-ink">
              {t('notifications.panelTitle')}
            </p>
            <button
              type="button"
              className="text-xs font-medium text-clox-orange hover:underline disabled:opacity-40"
              disabled={count === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              {t('notifications.markAllRead')}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {list.isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-clox-faint">
                {t('notifications.loading')}
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-clox-faint">
                {t('notifications.empty')}
              </p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id} className="border-t border-clox-border-soft first:border-t-0">
                    <button
                      type="button"
                      className={cn(
                        'block w-full px-3 py-2.5 text-left transition hover:bg-clox-surface-alt',
                        item.unread && 'bg-[color-mix(in_srgb,var(--status-warn-bg)_40%,transparent)]',
                      )}
                      onClick={() => void openItem(item)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-clox-ink">{item.title}</p>
                        {item.unread ? (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--status-warn)]" />
                        ) : null}
                      </div>
                      {item.body ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-clox-mute">{item.body}</p>
                      ) : null}
                      <p className="mt-1 font-mono text-[10px] text-clox-faint">
                        {t(`notifications.types.${item.type}`, {
                          defaultValue: item.type,
                        })}
                        {' · '}
                        {formatWhen(item.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
