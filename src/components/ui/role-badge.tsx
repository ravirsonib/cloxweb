import { cn } from '@/lib/cn';
import { roleBadgeLabel, roleThemeFromRole } from '@/lib/role-theme';

export function RoleBadge({
  role,
  className,
}: {
  role: string | null | undefined;
  className?: string;
}) {
  if (!role) return null;
  const theme = roleThemeFromRole(role);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[5px] border border-clox-border bg-clox-accent-tint px-2.5 py-1 font-mono text-[11px] font-semibold text-clox-accent-deep',
        className,
      )}
      data-role-badge={theme}
    >
      {roleBadgeLabel(role)}
    </span>
  );
}
