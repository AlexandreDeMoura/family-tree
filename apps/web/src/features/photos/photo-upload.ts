import {
  PHOTO_MAX_DIMENSION,
  PHOTO_SOURCE_MAX_BYTES,
  PHOTO_UPLOAD_MAX_BYTES,
} from '@family-tree/family-core';

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class PendingPhotoCleanupError extends Error {
  readonly retryCleanup: () => Promise<void>;

  constructor(message: string, retryCleanup: () => Promise<void>) {
    super(message);
    this.name = 'PendingPhotoCleanupError';
    this.retryCleanup = retryCleanup;
  }
}

export function validatePhotoSource(file: Pick<File, 'size' | 'type'>): string | null {
  if (!acceptedTypes.has(file.type)) return 'Choose a JPEG, PNG, or WebP image.';
  if (file.size <= 0) return 'The selected image is empty.';
  if (file.size > PHOTO_SOURCE_MAX_BYTES) return 'Choose an image no larger than 20 MB.';
  return null;
}

export function containedDimensions(width: number, height: number) {
  const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function convertPhotoToJpeg(file: File): Promise<Blob> {
  const validationError = validatePhotoSource(file);
  if (validationError) throw new Error(validationError);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image could not be read. Choose another JPEG, PNG, or WebP file.');
  }
  try {
    const dimensions = containedDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot prepare images for upload.');
    context.fillStyle = '#fffdf8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const jpeg = await canvasToBlob(canvas, quality);
      if (jpeg.size <= PHOTO_UPLOAD_MAX_BYTES) return jpeg;
    }
    throw new Error('The prepared photo is still larger than 5 MB. Choose a smaller image.');
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The image could not be converted to JPEG.'));
    }, 'image/jpeg', quality);
  });
}
