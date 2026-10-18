type BrandLogoProps = {
  /** Dark UI surfaces use the light wordmark; light surfaces use the standard mark. */
  variant?: 'light' | 'default';
  className?: string;
  markOnly?: boolean;
};

/**
 * Same brand assets as web/ (`/brand/logo-clox*.webp`).
 */
export function BrandLogo({
  variant = 'light',
  className = 'h-9 w-auto object-contain',
  markOnly = false,
}: BrandLogoProps) {
  const src = markOnly
    ? variant === 'light'
      ? '/brand/logo-mark-light.webp'
      : '/brand/logo-mark.webp'
    : variant === 'light'
      ? '/brand/logo-clox-light.webp'
      : '/brand/logo-clox.webp';

  return <img src={src} alt="CLOX" className={className} />;
}
