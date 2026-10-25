import {
  forwardRef,
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

type FileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: ReactNode;
  hint?: ReactNode;
  /** Controlled selected filename (optional; otherwise derived from last change). */
  fileName?: string | null;
};

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  {
    label,
    hint,
    fileName,
    className,
    id,
    disabled,
    onChange,
    accept,
    capture,
    ...props
  },
  ref,
) {
  const { t } = useTranslation('common');
  const autoId = useId();
  const inputId = id ?? autoId;
  const [localName, setLocalName] = useState<string | null>(null);
  const displayName = fileName !== undefined ? fileName : localName;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]?.name ?? null;
    setLocalName(next);
    onChange?.(event);
  }

  return (
    <div className={cn('clox-file-field mb-4', className)}>
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-semibold text-clox-ink">
          {label}
        </label>
      ) : null}
      {hint ? <p className="mb-2 text-xs text-clox-faint">{hint}</p> : null}
      <label
        htmlFor={inputId}
        className={cn('clox-file-drop', disabled && 'clox-file-drop-disabled')}
      >
        <input
          ref={ref}
          id={inputId}
          type="file"
          accept={accept}
          capture={capture}
          disabled={disabled}
          className="sr-only"
          onChange={handleChange}
          {...props}
        />
        <span className="clox-file-drop-icon" aria-hidden>
          <Upload className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="clox-file-drop-text">
          {displayName ? displayName : t('fileInput.choose')}
        </span>
        {displayName ? (
          <span className="clox-file-drop-hint">{t('fileInput.replace')}</span>
        ) : (
          <span className="clox-file-drop-hint">{t('fileInput.hint')}</span>
        )}
      </label>
    </div>
  );
});
