import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type DropdownMenuItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Visual emphasis for destructive actions (delete, disable, retire…). */
  tone?: 'default' | 'destructive';
  disabled?: boolean;
  /** Omit the item entirely (kept as a prop so callers don't need `.filter()` everywhere). */
  hidden?: boolean;
  onSelect: () => void;
};

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  /** Accessible label for the trigger + menu landmark; also used as trigger text when shown. */
  label?: string;
  triggerIcon?: LucideIcon;
  /** Show a text label beside the trigger icon (comfortable touch target on cards/mobile). */
  showTriggerLabel?: boolean;
  size?: 'sm' | 'md';
  align?: 'start' | 'end';
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
}

/**
 * Lightweight overflow "Actions" menu used to collapse dense icon-only row
 * actions into a single control. Reused by carrier fleet + drivers pages;
 * extend here (not per-page) if more call sites need it.
 */
export function DropdownMenu({
  items,
  label = 'More actions',
  triggerIcon: TriggerIcon = MoreHorizontal,
  showTriggerLabel = false,
  size = 'sm',
  align = 'end',
  disabled = false,
  className,
  menuClassName,
}: DropdownMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((v) => !v);
  }, [disabled]);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const minWidth = Math.max(rect.width, 192);
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const left =
      align === 'end'
        ? Math.min(Math.max(8, rect.right - minWidth), window.innerWidth - minWidth - 8)
        : Math.min(Math.max(8, rect.left), window.innerWidth - minWidth - 8);
    setStyle(
      openUp
        ? {
            position: 'fixed',
            left,
            width: minWidth,
            bottom: window.innerHeight - rect.top + gap,
            top: 'auto',
          }
        : {
            position: 'fixed',
            left,
            width: minWidth,
            top: rect.bottom + gap,
            bottom: 'auto',
          },
    );
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const visibleItems = items.filter((item) => !item.hidden);
  if (visibleItems.length === 0) return null;

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popoverRef}
            role="menu"
            aria-label={label}
            className={cn('clox-select-popover z-[100] py-1', menuClassName)}
            style={style}
          >
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={cn(
                    'clox-select-option',
                    item.tone === 'destructive' &&
                      'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30',
                  )}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  const triggerSizeClass = size === 'md' ? 'h-9 w-9' : 'h-8 w-8';

  const defaultTrigger = (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={label}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-clox-border-soft bg-white text-clox-ink shadow-sm transition-colors hover:bg-clox-surface-alt disabled:pointer-events-none disabled:opacity-50',
        showTriggerLabel ? 'w-auto px-3 py-1.5 text-[12.5px] font-medium' : triggerSizeClass,
      )}
    >
      <TriggerIcon className="h-4 w-4 shrink-0" aria-hidden />
      {showTriggerLabel ? <span className="whitespace-nowrap">{label}</span> : null}
    </button>
  );

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      {defaultTrigger}
      {menu}
    </div>
  );
}
