import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { pipeline, HeicNotSupportedError } from './index';
import { sniffIsHeic } from './heic-sniff';
import { applyOrientationTransform } from './orientation';

function loadFixture(name: string): Blob {
  const buf = readFileSync(resolve(__dirname, '../../test/fixtures', name));
  // Convert Node Buffer to a plain Uint8Array so Blob accepts it uniformly.
  return new Blob([new Uint8Array(buf)]);
}

describe('sniffIsHeic', () => {
  it('returns false for an empty blob', async () => {
    const blob = new Blob([]);
    await expect(sniffIsHeic(blob)).resolves.toBe(false);
  });

  it('returns true for the heic-magic-bytes.bin fixture', async () => {
    const blob = loadFixture('heic-magic-bytes.bin');
    await expect(sniffIsHeic(blob)).resolves.toBe(true);
  });

  it.each([
    ['heic', true],
    ['heix', true],
    ['hevc', true],
    ['mif1', true],
    ['mp4 ', false],
    ['jpeg', false],
  ] as const)('brand %s → sniff returns %s', async (brand, expected) => {
    const bytes = new Uint8Array(12);
    // size (any nonzero) at 0..4
    bytes.set([0, 0, 0, 0x18], 0);
    // ftyp at 4..8
    bytes.set([0x66, 0x74, 0x79, 0x70], 4);
    // brand at 8..12
    for (let i = 0; i < 4; i++) bytes[8 + i] = brand.charCodeAt(i);
    const blob = new Blob([bytes]);
    await expect(sniffIsHeic(blob)).resolves.toBe(expected);
  });
});

describe('pipeline (HEIC rejection)', () => {
  it('rejects a HEIC blob with HeicNotSupportedError before any decode', async () => {
    const blob = loadFixture('heic-magic-bytes.bin');
    await expect(pipeline(blob)).rejects.toBeInstanceOf(HeicNotSupportedError);
  });
});

describe('pipeline (resize + orient)', () => {
  it('resizes a 4000×3000 JPEG so long edge = 2048 with preserved aspect', async () => {
    const blob = loadFixture('landscape-4000x3000.jpg');
    const result = await pipeline(blob);
    expect(result.mimeType).toBe('image/jpeg');
    expect(Math.max(result.width, result.height)).toBe(2048);
    // 3000 * (2048 / 4000) = 1536
    expect(Math.min(result.width, result.height)).toBe(1536);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.type).toBe('image/jpeg');
  });

  it('applies EXIF orientation 6 so the output is portrait-shaped', async () => {
    // The Portrait_6.jpg fixture has raw pixels stored in landscape orientation
    // with an EXIF orientation=6 tag. After applying the correction the visible
    // aspect ratio must be portrait (height > width).
    const blob = loadFixture('portrait-orient-6.jpg');
    const result = await pipeline(blob);
    expect(result.height).toBeGreaterThan(result.width);
    expect(result.mimeType).toBe('image/jpeg');
  });
});

describe('applyOrientationTransform', () => {
  function makeCtx() {
    return {
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
    } as unknown as OffscreenCanvasRenderingContext2D & {
      translate: ReturnType<typeof vi.fn>;
      rotate: ReturnType<typeof vi.fn>;
      scale: ReturnType<typeof vi.fn>;
    };
  }

  it('case 1 (identity) — no transform calls', () => {
    const ctx = makeCtx();
    applyOrientationTransform(ctx, 1, 100, 80);
    expect(ctx.translate).not.toHaveBeenCalled();
    expect(ctx.rotate).not.toHaveBeenCalled();
    expect(ctx.scale).not.toHaveBeenCalled();
  });

  it('case 6 (rotate 90° CW) — translates then rotates', () => {
    const ctx = makeCtx();
    applyOrientationTransform(ctx, 6, 100, 80);
    expect(ctx.translate).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalled();
  });

  it.each([2, 3, 4, 5, 7, 8])('case %d does not throw', (orient) => {
    const ctx = makeCtx();
    expect(() => applyOrientationTransform(ctx, orient, 100, 80)).not.toThrow();
  });
});
