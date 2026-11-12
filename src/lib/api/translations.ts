import { http } from '@/lib/http';
import type { AppLocale } from '@/locales';

export type TranslationPreviewResult = {
  text: string;
  translatedText: string;
  targetLocale: AppLocale;
  sourceLocale: AppLocale | null;
  cached: boolean;
  provider: string;
};

export function previewTranslation(input: {
  text: string;
  targetLocale: AppLocale;
  sourceLocale?: AppLocale;
}) {
  return http
    .post<TranslationPreviewResult>('/translations/preview', input)
    .then((r) => r.data);
}
