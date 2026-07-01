import { orientation as readOrientation } from 'exifr';

import { sniffIsHeic } from './heic-sniff';
import { applyOrientationTransform } from './orientation';

/**
 * A pipeline output that is safe to persist and re-render (D-03).
 * Phase 1 always emits JPEG at quality 0.9 with the long edge capped at 2048 px.
 */
export interface NormalizedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
}

export class HeicNotSupportedError extends Error {
  constructor(message = 'HEIC images are not supported. Please export as JPEG or PNG.') {
    super(message);
    this.name = 'HeicNotSupportedError';
  }
}

/** Long-edge cap for room + product images in Phase 1 (D-03). */
const MAX_EDGE = 2048;

/**
 * Normalize an uploaded image for downstream use.
 *
 * Steps:
 *   1. Sniff HEIC by magic bytes and reject BEFORE any decode (D-02, Pitfall 3).
 *   2. Read EXIF orientation via `exifr` (orientation-only import — Pitfall 2:
 *      never rely on `createImageBitmap({ imageOrientation: 'from-image' })`,
 *      Safari implements it inconsistently).
 *   3. Decode via `createImageBitmap(file)` inside a try/finally so
 *      `bitmap.close()` runs even on failure (Pitfall 1 — iOS GPU memory).
 *   4. Resize the long edge to ≤ MAX_EDGE preserving aspect ratio.
 *   5. Apply the orientation transform manually and draw to an OffscreenCanvas.
 *   6. Encode as JPEG quality 0.9.
 */
export async function pipeline(file: File | Blob): Promise<NormalizedImage> {
  if (await sniffIsHeic(file)) {
    throw new HeicNotSupportedError();
  }

  const orient = ((await readOrientation(file).catch(() => undefined)) as number | undefined) ?? 1;

  const bitmap = await createImageBitmap(file);
  try {
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const longEdge = Math.max(srcW, srcH);
    const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
    const dstW = Math.round(srcW * scale);
    const dstH = Math.round(srcH * scale);

    // Orientations 5..8 swap the visual axes.
    const swapAxes = orient >= 5 && orient <= 8;
    const outW = swapAxes ? dstH : dstW;
    const outH = swapAxes ? dstW : dstH;

    const canvas = new OffscreenCanvas(outW, outH);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('OffscreenCanvas 2D context unavailable');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    applyOrientationTransform(ctx, orient, dstW, dstH);
    ctx.drawImage(bitmap, 0, 0, dstW, dstH);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    return { blob, width: outW, height: outH, mimeType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}
