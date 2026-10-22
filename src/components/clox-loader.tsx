type CloxLoaderProps = {
  className?: string;
  size?: number;
  label?: string;
};

/** Shared CLOX brand loader (orange growth arrow GIF). */
export function CloxLoader({ className = '', size = 40, label = 'Loading' }: CloxLoaderProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <img
        src="/brand/clox-loader.gif"
        alt=""
        width={size}
        height={size}
        className="object-contain"
        decoding="async"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
