/** Compress an image File to a JPEG data URL suitable for POD upload APIs. */
export async function fileToCompressedJpegDataUrl(
  file: File,
  options?: { maxEdge?: number; quality?: number; maxChars?: number },
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1600;
  const maxChars = options?.maxChars ?? 3_500_000;
  let quality = options?.quality ?? 0.82;

  const objectUrl = URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas unavailable for photo compression');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > maxChars && quality > 0.45) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length > maxChars) {
      throw new Error('Photo is still too large after compression');
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
