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

export function getErrorDetail(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  if (isAxiosError(error)) {
    const data = error.response?.data as ProblemBody | undefined;
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data?.message === 'string') return data.message;
    if (Array.isArray(data?.message)) return data.message.join('; ');
    if (typeof data?.title === 'string') return data.title;
    return error.message;
  }
  if (error instanceof Error) return error.message;
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
