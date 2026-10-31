import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const tones = {
  ok: 'clox-status-ok',
  warn: 'clox-status-warn',
  urgent: 'clox-status-urgent',
  danger: 'clox-status-danger',
  info: 'clox-status-info',
  neutral: 'clox-status-neutral',
} as const;

export type StatusPillTone = keyof typeof tones;

export function StatusPill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusPillTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn('clox-status', tones[tone], className)}>{children}</span>;
}
