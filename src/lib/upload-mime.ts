/** Allowed upload MIME types — keep in sync with api documents ALLOWED_MIME. */
export type UploadMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

const ALLOWED: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/**
 * Resolve MIME for upload-intent. Camera captures often have empty type or
 * `image/jpg`; falling back to `application/pdf` then fails on putContent.
 */
export function resolveUploadMime(file: File): UploadMime {
  const raw = (file.type || '').toLowerCase().trim();
  const normalized =
    raw === 'image/jpg' || raw === 'image/pjpeg' ? 'image/jpeg' : raw;

  if (ALLOWED.has(normalized)) {
    return normalized as UploadMime;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.pdf')) return 'application/pdf';

  // Mobile camera blobs frequently omit type and use a generic name.
  if (!normalized && file.size > 0) {
    return 'image/jpeg';
  }

  throw new Error(
    'Unsupported file type. Use PDF, JPEG, PNG, or WebP (not HEIC).',
  );
}
