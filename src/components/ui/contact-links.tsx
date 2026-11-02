import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PhoneLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  phone?: string | null;
  /** Whether to show the phone icon. Defaults to true. */
  showIcon?: boolean;
  /** Fallback string when phone is not provided. Defaults to '—'. */
  fallback?: string;
  /** Display as a badge chip (pill). */
  badge?: boolean;
}

/**
 * Standardized tap-to-call phone link.
 * Renders a clickable `tel:${phone}` link with an icon, mono font, and hover states.
 */
export const PhoneLink = forwardRef<HTMLAnchorElement, PhoneLinkProps>(
  function PhoneLink(
    {
      phone,
      showIcon = true,
      fallback = '—',
      badge = false,
      className,
      ...props
    },
    ref,
  ) {
    if (!phone || !phone.trim()) {
      return <span className={cn('text-clox-mute text-xs', className)}>{fallback}</span>;
    }

    const cleanPhone = phone.trim();

    return (
      <a
        ref={ref}
        href={`tel:${cleanPhone}`}
        className={cn(
          'inline-flex items-center gap-1.5 font-mono text-xs text-clox-ink hover:text-clox-orange hover:underline transition-colors shrink-0',
          badge &&
            'rounded-full border border-clox-border-soft bg-clox-surface-alt px-2.5 py-1 font-medium hover:border-clox-orange hover:no-underline',
          className,
        )}
        title={cleanPhone}
        {...props}
      >
        {showIcon ? (
          <Phone className={cn('h-3.5 w-3.5 text-clox-orange shrink-0', badge && 'h-3 w-3')} />
        ) : null}
        <span>{cleanPhone}</span>
      </a>
    );
  },
);

export interface EmailLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  email?: string | null;
  /** Whether to show the mail icon. Defaults to true. */
  showIcon?: boolean;
  /** Fallback string when email is not provided. Defaults to '—'. */
  fallback?: string;
  /** Display as a badge chip (pill). */
  badge?: boolean;
  /** Optional max width for truncation. */
  maxWidthClassName?: string;
}

/**
 * Standardized mailto link.
 * Renders a clickable `mailto:${email}` link with an icon, truncation, and hover states.
 */
export const EmailLink = forwardRef<HTMLAnchorElement, EmailLinkProps>(
  function EmailLink(
    {
      email,
      showIcon = true,
      fallback = '—',
      badge = false,
      maxWidthClassName,
      className,
      ...props
    },
    ref,
  ) {
    if (!email || !email.trim()) {
      return <span className={cn('text-clox-mute text-xs', className)}>{fallback}</span>;
    }

    const cleanEmail = email.trim();

    return (
      <a
        ref={ref}
        href={`mailto:${cleanEmail}`}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs text-clox-ink hover:text-clox-orange hover:underline transition-colors min-w-0',
          badge &&
            'rounded-full border border-clox-border-soft bg-clox-surface-alt px-2.5 py-1 font-medium hover:border-clox-orange hover:no-underline',
          className,
        )}
        title={cleanEmail}
        {...props}
      >
        {showIcon ? (
          <Mail className={cn('h-3.5 w-3.5 text-clox-orange shrink-0', badge && 'h-3 w-3')} />
        ) : null}
        <span className={cn('truncate', maxWidthClassName)}>{cleanEmail}</span>
      </a>
    );
  },
);
