import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { previewTranslation } from '@/lib/api/translations';
import { normalizeAppLocale } from '@/locales';
import { cn } from '@/lib/cn';

type TranslatedUgcProps = {
  text: string | null | undefined;
  className?: string;
  /** Optional source locale hint when known (UGC is still stored verbatim). */
  sourceLocale?: string | null;
};

/**
 * Optional on-read translation for UGC. Source text is never overwritten.
 */
export function TranslatedUgc({
  text,
  className,
  sourceLocale,
}: TranslatedUgcProps) {
  const { t, i18n } = useTranslation('common');
  const [showingTranslation, setShowingTranslation] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const targetLocale = normalizeAppLocale(i18n.language);

  const translate = useMutation({
    mutationFn: () =>
      previewTranslation({
        text: text ?? '',
        targetLocale,
        ...(sourceLocale
          ? { sourceLocale: normalizeAppLocale(sourceLocale) }
          : {}),
      }),
    onSuccess: (result) => {
      setTranslated(result.translatedText);
      setShowingTranslation(true);
    },
  });

  if (!text?.trim()) return null;

  const display = showingTranslation && translated ? translated : text;

  return (
    <div className={cn('space-y-1', className)}>
      <p className="whitespace-pre-wrap text-sm text-clox-ink">{display}</p>
      <div className="flex flex-wrap gap-2">
        {!showingTranslation ? (
          <button
            type="button"
            className="text-xs font-medium text-clox-accent underline-offset-2 hover:underline disabled:opacity-50"
            disabled={translate.isPending || !text.trim()}
            onClick={() => translate.mutate()}
          >
            {translate.isPending ? t('ugc.translating') : t('ugc.translate')}
          </button>
        ) : (
          <button
            type="button"
            className="text-xs font-medium text-clox-accent underline-offset-2 hover:underline"
            onClick={() => setShowingTranslation(false)}
          >
            {t('ugc.showOriginal')}
          </button>
        )}
      </div>
      {translate.isError ? (
        <p className="text-xs text-clox-danger">{t('ugc.translateFailed')}</p>
      ) : null}
    </div>
  );
}
