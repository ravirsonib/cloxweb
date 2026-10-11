import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { primaryButtonClassName, secondaryButtonClassName } from '@/components/admin-shell';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !confirming) onCancel();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, confirming, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label={t('close')}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        disabled={confirming}
        onClick={() => {
          if (!confirming) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-7"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-white sm:text-xl">
          {title}
        </h2>
        <div
          id="confirm-dialog-body"
          className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base"
        >
          {body}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={confirming}
            onClick={onCancel}
          >
            {cancelLabel ?? t('cancel')}
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? t('loading') : (confirmLabel ?? t('confirm'))}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
