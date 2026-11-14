import { ApiError } from '@/lib/http/client';
import {
  fileToCompressedJpegFile,
  maxDocumentUploadBytes,
} from '@/lib/image-data-url';
import { i18n } from '@/lib/i18n';
import { resolveUploadMime, type UploadMime } from '@/lib/upload-mime';

export type PreparedDocumentUpload = {
  file: File;
  mimeType: UploadMime;
};

/**
 * Prepare a file for document upload-intent + multipart put.
 * Phone camera / gallery shots are often >10 MB; Safari then surfaces axios
 * "Network Error" with no HTTP body. Compress images first (same approach as
 * trip breakdown photos). PDFs are left unchanged.
 */
export async function prepareDocumentUploadFile(
  file: File,
): Promise<PreparedDocumentUpload> {
  const mime = resolveUploadMime(file);
  const maxBytes = maxDocumentUploadBytes();

  if (mime === 'application/pdf') {
    if (file.size > maxBytes) {
      throw new ApiError(400, i18n.t('errors.fileTooLarge'), {
        code: 'FILE_TOO_LARGE',
      });
    }
    return { file, mimeType: mime };
  }

  // Always re-encode images to JPEG under the platform ceiling for reliable
  // mobile uploads. Small desktop files stay small after a light pass.
  const compressed = await fileToCompressedJpegFile(file, { maxBytes });
  return { file: compressed, mimeType: 'image/jpeg' };
}
