const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.82;

export async function fileToResizedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image');
  }

  const bitmap = await loadBitmap(file);
  const { width, height } = scaledDimensions(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare canvas');
  ctx.drawImage(bitmap, 0, 0, width, height);

  if ('close' in bitmap && typeof bitmap.close === 'function') {
    bitmap.close();
  }

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function scaledDimensions(srcW: number, srcH: number) {
  const longest = Math.max(srcW, srcH);
  if (longest <= MAX_DIMENSION) return { width: srcW, height: srcH };
  const ratio = MAX_DIMENSION / longest;
  return { width: Math.round(srcW * ratio), height: Math.round(srcH * ratio) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to HTMLImageElement
    }
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the photo'));
    };
    img.src = url;
  });
}
