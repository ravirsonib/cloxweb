import {
  forwardRef,
  useState,
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delayMs?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delayMs = 120,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delayMs);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  const positionClasses: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<TooltipPosition, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-neutral-900 border-x-transparent border-b-transparent border-4',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-neutral-900 border-x-transparent border-t-transparent border-4',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-neutral-900 border-y-transparent border-r-transparent border-4',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-neutral-900 border-y-transparent border-l-transparent border-4',
  };

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && content ? (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-[11.5px] font-medium text-white shadow-lg transition-opacity duration-150',
            positionClasses[position],
          )}
        >
          {content}
          <span className={cn('absolute h-0 w-0', arrowClasses[position])} />
        </div>
      ) : null}
    </div>
  );
}

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clox-orange focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-clox-orange text-white hover:bg-clox-orange-hover shadow-sm',
        secondary:
          'border border-clox-border-soft bg-white text-clox-ink hover:bg-clox-surface-alt hover:text-clox-ink shadow-sm',
        ghost: 'text-clox-mute hover:bg-clox-surface-alt hover:text-clox-ink',
        destructive:
          'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 shadow-sm',
        success:
          'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-sm',
      },
      size: {
        sm: 'h-8 w-8 text-sm',
        md: 'h-9 w-9 text-base',
        lg: 'h-10 w-10 text-lg',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'sm',
    },
  },
);

function iconGlyphClass(size: 'sm' | 'md' | 'lg' | null | undefined) {
  return size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
}

/** When showLabel is set, expand the square control into a readable chip (mobile / cards). */
function labeledIconClass(size: 'sm' | 'md' | 'lg' | null | undefined, showLabel?: boolean) {
  if (!showLabel) return undefined;
  if (size === 'lg') return 'w-auto gap-2 px-3';
  if (size === 'md') return 'w-auto gap-1.5 px-2.5';
  return 'w-auto gap-1.5 px-2.5 text-[12px]';
}

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  tooltipPosition?: TooltipPosition;
  /** Show visible text beside the icon (use on touch / card layouts — no hover tooltip needed). */
  showLabel?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon: Icon,
      label,
      tooltip,
      tooltipPosition = 'top',
      showLabel = false,
      variant,
      size,
      className,
      type = 'button',
      disabled,
      ...props
    },
    ref,
  ) {
    const tooltipText = showLabel ? undefined : (tooltip ?? label);
    const button = (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        disabled={disabled}
        className={cn(
          iconButtonVariants({ variant, size }),
          labeledIconClass(size, showLabel),
          className,
        )}
        {...props}
      >
        <Icon className={iconGlyphClass(size)} aria-hidden />
        {showLabel ? <span className="whitespace-nowrap font-medium">{label}</span> : null}
      </button>
    );

    if (!tooltipText || disabled) {
      return button;
    }

    return (
      <Tooltip content={tooltipText} position={tooltipPosition}>
        {button}
      </Tooltip>
    );
  },
);

export interface IconButtonLinkProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof iconButtonVariants> {
  to: string;
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  tooltipPosition?: TooltipPosition;
  showLabel?: boolean;
}

export const IconButtonLink = forwardRef<HTMLAnchorElement, IconButtonLinkProps>(
  function IconButtonLink(
    {
      to,
      icon: Icon,
      label,
      tooltip,
      tooltipPosition = 'top',
      showLabel = false,
      variant,
      size,
      className,
      ...props
    },
    ref,
  ) {
    const tooltipText = showLabel ? undefined : (tooltip ?? label);
    const link = (
      <Link
        ref={ref}
        to={to}
        aria-label={label}
        className={cn(
          iconButtonVariants({ variant, size }),
          labeledIconClass(size, showLabel),
          className,
        )}
        {...props}
      >
        <Icon className={iconGlyphClass(size)} aria-hidden />
        {showLabel ? <span className="whitespace-nowrap font-medium">{label}</span> : null}
      </Link>
    );

    if (!tooltipText) return link;

    return (
      <Tooltip content={tooltipText} position={tooltipPosition}>
        {link}
      </Tooltip>
    );
  },
);

export interface IconFileButtonProps extends VariantProps<typeof iconButtonVariants> {
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  tooltipPosition?: TooltipPosition;
  showLabel?: boolean;
  accept?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  inputId?: string;
  onFile: (file: File) => void;
}

/** Icon control that opens a file picker — same tooltip + look as IconButton. */
export function IconFileButton({
  icon: Icon,
  label,
  tooltip,
  tooltipPosition = 'top',
  showLabel = false,
  variant = 'secondary',
  size = 'sm',
  accept,
  disabled,
  loading,
  className,
  inputId,
  onFile,
}: IconFileButtonProps) {
  const tooltipText = showLabel ? undefined : (tooltip ?? label);
  const ActiveIcon = loading ? Loader2 : Icon;
  const control = (
    <label
      htmlFor={inputId}
      aria-label={label}
      className={cn(
        iconButtonVariants({ variant, size }),
        labeledIconClass(size, showLabel),
        disabled || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <ActiveIcon
        className={cn(iconGlyphClass(size), loading && 'animate-spin')}
        aria-hidden
      />
      {showLabel ? <span className="whitespace-nowrap font-medium">{label}</span> : null}
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled || loading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );

  if (!tooltipText || disabled) {
    return control;
  }

  return (
    <Tooltip content={tooltipText} position={tooltipPosition}>
      {control}
    </Tooltip>
  );
}
