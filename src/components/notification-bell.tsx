import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, RefreshCw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  getNotificationUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/api/notifications';
import { formatDateTime } from '@/lib/leads';
import { cn } from '@/lib/cn';
import { AdminRole, AppRole } from '@/shared/types';
import { useAuthStore } from '@/stores/auth-store';

const NOTIFICATION_ROLES = new Set<string>([
  AppRole.SENDER,
  AppRole.TRANSPORT_COMPANY,
  AppRole.DRIVER,
  AdminRole.SUPER_ADMIN,
  AdminRole.STATE_MASTER,
  AdminRole.LOCAL_BDE,
]);

export function NotificationBell({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const enabled = Boolean(role && NOTIFICATION_ROLES.has(role));

  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getNotificationUnreadCount,
    enabled,
    refetchInterval: 15_000,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const prevCountRef = useRef<number | null>(null);
  useEffect(() => {
    const current = unread.data?.count;
    if (current == null) return;
    if (prevCountRef.current != null && current !== prevCountRef.current) {
      void qc.invalidateQueries({ queryKey: ['carrier', 'vehicles'] });
      void qc.invalidateQueries({ queryKey: ['carrier', 'drivers'] });
      void qc.invalidateQueries({ queryKey: ['payments', 'assignments'] });
      void qc.invalidateQueries({ queryKey: ['matching', 'board'] });
      void qc.invalidateQueries({ queryKey: ['jobs'] });
      void qc.invalidateQueries({ queryKey: ['compliance'] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['exceptions'] });
    }
    prevCountRef.current = current;
  }, [unread.data?.count, qc]);

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

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const isDesktop = window.innerWidth >= 640;
    const width = isDesktop ? 384 : Math.min(window.innerWidth - 24, 384);
    const gap = 8;

    const left = isDesktop
      ? Math.min(Math.max(16, rect.right - width + 32), window.innerWidth - width - 16)
      : 12;

    setPopoverStyle({
      position: 'fixed',
      top: rect.bottom + gap,
      left,
      width: isDesktop ? width : undefined,
      right: isDesktop ? undefined : 12,
      zIndex: 9999,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
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
    <div className={cn('relative shrink-0', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-clox-mute transition hover:bg-clox-surface-alt hover:text-clox-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clox-accent"
        aria-label={t('notifications.bellLabel')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4 shrink-0" aria-hidden strokeWidth={1.9} />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--status-warn)] px-1 font-mono text-[10px] font-semibold text-white shadow-sm ring-2 ring-clox-surface">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={t('notifications.panelTitle')}
              style={popoverStyle}
              className="overflow-hidden rounded-clox-md border border-clox-border bg-clox-surface shadow-clox-2 ring-1 ring-black/5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-clox-border bg-clox-surface-alt/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-bold text-clox-ink">
                    {t('notifications.panelTitle')}
                  </h3>
                  {count > 0 ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-clox-orange">
                      {count}
                    </span>
                  ) : null}
                </div>
                {items.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-clox-orange hover:text-clox-orange-deep hover:underline disabled:opacity-40 transition cursor-pointer"
                    disabled={count === 0 || markAll.isPending}
                    onClick={() => markAll.mutate()}
                  >
                    {t('notifications.markAllRead')}
                  </button>
                ) : null}
              </div>

              <div className="max-h-[380px] overflow-y-auto">
                {list.isLoading ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-clox-faint">
                    <RefreshCw className="h-4 w-4 animate-spin text-clox-orange" />
                    <span>{t('notifications.loading')}</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                    <div className="rounded-full bg-clox-surface-alt p-3 text-clox-faint">
                      <Bell className="h-5 w-5 opacity-40" />
                    </div>
                    <p className="mt-2 text-xs font-medium text-clox-mute">
                      {t('notifications.empty')}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-clox-border-soft">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={cn(
                            'block w-full px-4 py-3 text-left transition hover:bg-clox-surface-alt/70 cursor-pointer',
                            item.unread && 'bg-orange-50/50 hover:bg-orange-50/80',
                          )}
                          onClick={() => void openItem(item)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                'text-xs text-clox-ink',
                                item.unread ? 'font-bold' : 'font-medium',
                              )}
                            >
                              {item.title}
                            </p>
                            {item.unread ? (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-clox-orange ring-2 ring-orange-200" />
                            ) : null}
                          </div>
                          {item.body ? (
                            <p className="mt-1 line-clamp-2 text-xs text-clox-mute leading-relaxed">
                              {item.body}
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between text-[10px] text-clox-faint">
                            <span className="rounded bg-clox-surface-alt px-1.5 py-0.5 font-medium text-clox-mute">
                              {t(`notifications.types.${item.type}`, {
                                defaultValue: item.type,
                              })}
                            </span>
                            <span className="font-mono">{formatDateTime(item.createdAt)}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
