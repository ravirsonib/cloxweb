import axios, { AxiosError, isAxiosError, type AxiosInstance } from 'axios';
import { i18n } from '@/lib/i18n';

export class ApiError extends Error {
  status: number;
  detail: string;
  code?: string;
  data?: unknown;

  constructor(status: number, detail: string, options?: { code?: string; data?: unknown }) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.code = options?.code;
    this.data = options?.data;
  }
}

type ProblemBody = {
  detail?: string;
  title?: string;
  message?: string | string[];
  error?: string;
};

/** Rewrite Nest/Zod validation jargon into plain language for the UI. */
function humanizeApiMessage(raw: string): string {
  const message = raw.trim();
  if (
    /sizeBytes/i.test(message) ||
    /Too big:.*10485760/i.test(message) ||
    /File exceeds 10\s*MB/i.test(message) ||
    /expected number to be\s*[=<]*\s*10485760/i.test(message)
  ) {
    return i18n.t('errors.fileTooLarge');
  }
  if (
    /mimeType/i.test(message) ||
    /Unsupported mime/i.test(message) ||
    /Content-Type does not match/i.test(message)
  ) {
    return i18n.t('errors.unsupportedFileType');
  }
  if (/Missing file upload|multipart field/i.test(message)) {
    return i18n.t('errors.uploadMissingFile');
  }
  // Strip "field: " prefixes that still leave readable custom messages.
  return message.replace(/^[a-zA-Z0-9_.]+:\s*/, (prefix) =>
    /sizeBytes|mimeType|originalFilename/i.test(prefix) ? '' : prefix,
  );
}

export function getErrorDetail(error: unknown): string {
  if (error instanceof ApiError) return humanizeApiMessage(error.detail);
  if (isAxiosError(error)) {
    const data = error.response?.data as ProblemBody | undefined;
    if (typeof data?.detail === 'string') return humanizeApiMessage(data.detail);
    if (typeof data?.message === 'string') return humanizeApiMessage(data.message);
    if (Array.isArray(data?.message)) {
      return humanizeApiMessage(data.message.join('; '));
    }
    if (typeof data?.title === 'string') return humanizeApiMessage(data.title);
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
      return i18n.t('errors.uploadTimeout', {
        defaultValue: 'Upload timed out. Try a smaller photo or check your connection.',
      });
    }
    if (!error.response && /Network Error/i.test(error.message)) {
      return i18n.t('errors.networkOrTooLarge', {
        defaultValue:
          'Upload failed (network or file too large). Use a JPEG/PNG under 10 MB.',
      });
    }
    return humanizeApiMessage(error.message);
  }
  if (error instanceof Error) return humanizeApiMessage(error.message);
  return i18n.t('unexpectedError');
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data as ProblemBody | undefined;
    return new ApiError(status, getErrorDetail(error), {
      code: data?.error || error.code,
      data: error.response?.data,
    });
  }
  return new ApiError(0, getErrorDetail(error));
}

export function createHttpClient(options?: {
  baseURL?: string;
  timeoutMs?: number;
}): AxiosInstance {
  return axios.create({
    baseURL: options?.baseURL ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/v1',
    timeout: options?.timeoutMs ?? 30_000,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
}

export { axios, isAxiosError };
export type { AxiosError, AxiosInstance };
