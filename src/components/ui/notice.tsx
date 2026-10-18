import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const tones = {
  info: 'clox-notice-info',
  warn: 'clox-notice-warn',
  error: 'clox-notice-error',
  success: 'clox-notice-success',
} as const;

export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('clox-notice', tones[tone], className)} role={tone === 'error' ? 'alert' : undefined}>
      <div className="min-w-0">
        {title ? <p className="font-semibold text-inherit">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5' : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}
