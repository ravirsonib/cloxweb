const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Platform document upload ceiling (matches API multer / intent limit). */
export function maxDocumentUploadBytes(): number {
  return MAX_UPLOAD_BYTES;
}

function canvasToJpegDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxChars: number,
  startQuality: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable for photo compression');
  }
  ctx.drawImage(source, 0, 0, width, height);

  let quality = startQuality;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > maxChars && quality > 0.35) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

/** Compress an image File to a JPEG data URL suitable for POD upload APIs. */
export async function fileToCompressedJpegDataUrl(
  file: File,
  options?: { maxEdge?: number; quality?: number; maxChars?: number },
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1280;
  const maxChars = options?.maxChars ?? 2_400_000;
  const startQuality = options?.quality ?? 0.72;

  const objectUrl = URL.createObjectURL(file);
  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error(
        'Could not read that image. Use a JPEG or PNG photo (HEIC may not be supported).',
      );
    }
    try {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
      let width = Math.max(1, Math.round(bitmap.width * scale));
      let height = Math.max(1, Math.round(bitmap.height * scale));
      let dataUrl = canvasToJpegDataUrl(bitmap, width, height, maxChars, startQuality);
      if (dataUrl.length > maxChars) {
        width = Math.max(1, Math.round(width * 0.7));
        height = Math.max(1, Math.round(height * 0.7));
        dataUrl = canvasToJpegDataUrl(bitmap, width, height, maxChars, 0.6);
      }
      if (dataUrl.length > maxChars) {
        throw new Error('Photo is still too large after compression');
      }
      return dataUrl;
    } finally {
      bitmap.close();
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Compress an image to a JPEG File for multipart document uploads. */
export async function fileToCompressedJpegFile(
  file: File,
  options?: { maxEdge?: number; quality?: number; maxBytes?: number },
): Promise<File> {
  const maxBytes = options?.maxBytes ?? MAX_UPLOAD_BYTES;
  const dataUrl = await fileToCompressedJpegDataUrl(file, {
    maxEdge: options?.maxEdge,
    quality: options?.quality,
    maxChars: Math.floor(maxBytes * 1.37),
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (blob.size > maxBytes) {
    throw new Error('Photo is still too large after compression');
  }
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
