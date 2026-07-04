import { describe, expect, it } from 'vitest';

import {
  applyAlpha,
  applyMask,
  autoRemoveCorners,
  extractAlpha,
  feather,
  floodRemoveAt,
  type RgbaImage,
} from './pixelOps';

type Rgba = [number, number, number, number];

/** Build an RgbaImage from a row-major 2D array of [r,g,b,a] pixels. */
function makeImage(rows: Rgba[][]): RgbaImage {
  const height = rows.length;
  const width = rows[0]!.length;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const [r, g, b, a] = rows[y]![x]!;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = a;
    }
  }
  return { data, width, height };
}

/** Read the alpha of pixel (x, y). */
function alphaAt(img: RgbaImage, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4 + 3]!;
}

const RED: Rgba = [255, 0, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];

describe('floodRemoveAt', () => {
  it('removes pixels within tolerance and stops at pixels outside it', () => {
    // 4x1 row: seed red, then -30 (in tol), then -40 (out of tol), then red.
    const img = makeImage([
      [
        [255, 0, 0, 255],
        [225, 0, 0, 255],
        [215, 0, 0, 255],
        [255, 0, 0, 255],
      ],
    ]);
    // tol 36 → t² = 1296. Δ=30 → 900 ≤ 1296 (removed); Δ=40 → 1600 > 1296 (kept).
    floodRemoveAt(img, 0, 0, 36);
    expect(alphaAt(img, 0, 0)).toBe(0);
    expect(alphaAt(img, 1, 0)).toBe(0);
    // The out-of-tolerance pixel is a barrier — it and everything past it survive.
    expect(alphaAt(img, 2, 0)).toBe(255);
    expect(alphaAt(img, 3, 0)).toBe(255);
  });

  it('does not cross a diagonal-only bridge (4-connectivity)', () => {
    const img = makeImage([
      [RED, BLUE, BLUE],
      [BLUE, RED, BLUE],
      [BLUE, BLUE, BLUE],
    ]);
    floodRemoveAt(img, 0, 0, 36);
    // Seed removed; the diagonally-adjacent red island is NOT reachable.
    expect(alphaAt(img, 0, 0)).toBe(0);
    expect(alphaAt(img, 1, 1)).toBe(255);
  });

  it('is a no-op when the seed pixel is already fully transparent', () => {
    const img = makeImage([
      [
        [255, 0, 0, 0],
        [255, 0, 0, 255],
      ],
    ]);
    floodRemoveAt(img, 0, 0, 36);
    expect(alphaAt(img, 0, 0)).toBe(0);
    // The opaque neighbour is untouched because the flood never started.
    expect(alphaAt(img, 1, 0)).toBe(255);
  });

  it('ignores out-of-bounds seeds', () => {
    const img = makeImage([[RED, RED]]);
    floodRemoveAt(img, 5, 5, 36);
    expect(alphaAt(img, 0, 0)).toBe(255);
    expect(alphaAt(img, 1, 0)).toBe(255);
  });
});

describe('autoRemoveCorners', () => {
  it('flood-removes from all four corners', () => {
    // Uniform red field: every corner flood merges into the whole image.
    const img = makeImage([
      [RED, RED, RED],
      [RED, RED, RED],
      [RED, RED, RED],
    ]);
    autoRemoveCorners(img, 36);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(alphaAt(img, x, y)).toBe(0);
      }
    }
  });

  it('leaves a distinct centre subject intact', () => {
    const img = makeImage([
      [RED, RED, RED],
      [RED, BLUE, RED],
      [RED, RED, RED],
    ]);
    autoRemoveCorners(img, 36);
    // Border cleared, centre subject kept.
    expect(alphaAt(img, 1, 1)).toBe(255);
    expect(alphaAt(img, 0, 0)).toBe(0);
    expect(alphaAt(img, 2, 2)).toBe(0);
  });
});

describe('feather', () => {
  it('softens an opaque pixel with ≥5 transparent neighbours to alpha 130', () => {
    // Centre opaque; 5 of its 8 neighbours transparent → feather to 130.
    const img = makeImage([
      [
        [255, 0, 0, 0],
        [255, 0, 0, 0],
        [255, 0, 0, 0],
      ],
      [
        [255, 0, 0, 0],
        [255, 0, 0, 255],
        [255, 0, 0, 0],
      ],
      [
        [255, 0, 0, 255],
        [255, 0, 0, 255],
        [255, 0, 0, 255],
      ],
    ]);
    feather(img);
    expect(alphaAt(img, 1, 1)).toBe(130);
  });

  it('leaves an opaque pixel with <5 transparent neighbours untouched', () => {
    // Only 4 transparent neighbours around the centre.
    const img = makeImage([
      [
        [255, 0, 0, 0],
        [255, 0, 0, 0],
        [255, 0, 0, 255],
      ],
      [
        [255, 0, 0, 0],
        [255, 0, 0, 255],
        [255, 0, 0, 255],
      ],
      [
        [255, 0, 0, 0],
        [255, 0, 0, 255],
        [255, 0, 0, 255],
      ],
    ]);
    feather(img);
    expect(alphaAt(img, 1, 1)).toBe(255);
  });

  it('never resurrects already-transparent pixels', () => {
    const img = makeImage([
      [
        [255, 0, 0, 0],
        [255, 0, 0, 0],
        [255, 0, 0, 0],
      ],
      [
        [255, 0, 0, 0],
        [255, 0, 0, 0],
        [255, 0, 0, 0],
      ],
    ]);
    feather(img);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 3; x++) {
        expect(alphaAt(img, x, y)).toBe(0);
      }
    }
  });
});

describe('extractAlpha / applyAlpha', () => {
  it('round-trips the alpha channel', () => {
    const img = makeImage([
      [
        [10, 20, 30, 12],
        [40, 50, 60, 240],
      ],
    ]);
    const snapshot = extractAlpha(img);
    expect(Array.from(snapshot)).toEqual([12, 240]);

    // Mutate, then restore from the snapshot.
    img.data[3] = 0;
    img.data[7] = 0;
    applyAlpha(img, snapshot);
    expect(alphaAt(img, 0, 0)).toBe(12);
    expect(alphaAt(img, 1, 0)).toBe(240);
  });
});

describe('applyMask', () => {
  it('copies mask values into alpha while preserving RGB', () => {
    const img = makeImage([
      [
        [11, 22, 33, 255],
        [44, 55, 66, 255],
      ],
    ]);
    const mask = new Uint8ClampedArray([0, 130]);
    applyMask(img, mask);
    // Alpha replaced by the mask.
    expect(alphaAt(img, 0, 0)).toBe(0);
    expect(alphaAt(img, 1, 0)).toBe(130);
    // RGB untouched.
    expect(Array.from(img.data.slice(0, 3))).toEqual([11, 22, 33]);
    expect(Array.from(img.data.slice(4, 7))).toEqual([44, 55, 66]);
  });
});
