type CloxLoaderProps = {
  className?: string;
  size?: number;
  label?: string;
  /** Set true when the parent already owns role="status" and visible loading text. */
  decorative?: boolean;
};

/** Shared CLOX brand loader (animated CLOX mark GIF). */
export function CloxLoader({
  className = '',
  size = 40,
  label = 'Loading',
  decorative = false,
}: CloxLoaderProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] ring-1 ring-black/10 ${className}`}
      style={{ width: size, height: size }}
      role={decorative ? undefined : 'status'}
      aria-live={decorative ? undefined : 'polite'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <img
        src="/brand/clox-loader.gif"
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-cover"
        decoding="async"
      />
      {decorative ? null : <span className="sr-only">{label}</span>}
    </span>
  );
}
