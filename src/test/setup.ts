import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import sharp from 'sharp';

afterEach(() => {
  cleanup();
});

/**
 * Node 22+ ships an experimental global `localStorage` that shadows jsdom's
 * and throws unless `--localstorage-file` is set. Replace it with a real
 * in-memory Storage so zustand's persist middleware works in tests.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

/**
 * jsdom polyfills for the browser-only canvas APIs the ImagePipeline touches.
 *
 * jsdom does not implement `createImageBitmap` or `OffscreenCanvas`. Rather
 * than swap the whole test environment to `happy-dom` (still missing these)
 * or pull in the `canvas` native binding (fragile node-gyp build), we install
 * minimal polyfills that let the pipeline's math + orientation logic run and
 * produce a JPEG-typed Blob. The `sharp` decoder gives us the fixture's
 * unrotated raw pixel dimensions — which is exactly what a real browser's
 * `createImageBitmap(file)` returns (per RESEARCH Pitfall 2 we deliberately
 * do not pass `{ imageOrientation: 'from-image' }`).
 */

type BitmapLike = {
  width: number;
  height: number;
  close(): void;
};

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arr = new Uint8Array(await blob.arrayBuffer());
  return Buffer.from(arr);
}

if (typeof globalThis.createImageBitmap === 'undefined') {
  // sharp reads raw pixel dimensions regardless of EXIF unless `.rotate()` is
  // called explicitly — perfect for mirroring browser createImageBitmap semantics.
  (
    globalThis as unknown as { createImageBitmap: (src: Blob) => Promise<BitmapLike> }
  ).createImageBitmap = async (src: Blob): Promise<BitmapLike> => {
    const buf = await blobToBuffer(src);
    const meta = await sharp(buf).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    return {
      width,
      height,
      close() {
        /* no-op — no GPU-backed resource in the polyfill */
      },
    };
  };
}

if (typeof globalThis.OffscreenCanvas === 'undefined') {
  class FakeCtx {
    imageSmoothingEnabled = true;
    imageSmoothingQuality: 'high' | 'medium' | 'low' = 'high';
    translate(): void {}
    rotate(): void {}
    scale(): void {}
    drawImage(): void {}
  }

  class FakeOffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(kind: string): FakeCtx | null {
      return kind === '2d' ? new FakeCtx() : null;
    }
    async convertToBlob(options?: { type?: string; quality?: number }): Promise<Blob> {
      const type = options?.type ?? 'image/png';
      // Emit a nonempty placeholder blob; consumers only need type + size.
      return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type });
    }
  }

  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = FakeOffscreenCanvas;
}
