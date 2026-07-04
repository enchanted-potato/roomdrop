/**
 * Pure pixel operations for the manual background-colour removal editor.
 *
 * Ported directly from the PoC's interactive flow
 * (`poc/Cushion Stylist.dc.html:406-473`). Everything here works on a plain
 * `RgbaImage` shape — no DOM, no canvas — so the flood / feather / mask logic
 * is unit-testable in jsdom without a 2d context. All functions mutate `data`
 * in place except `extractAlpha`, which returns a fresh array.
 */

/** A raw RGBA image buffer: `data.length === width * height * 4`. */
export type RgbaImage = { data: Uint8ClampedArray; width: number; height: number };

/**
 * From the seed pixel (sx, sy), set alpha = 0 across the 4-connected region
 * whose RGB is within `tol` (squared euclidean distance dr²+dg²+db² ≤ tol²) of
 * the seed colour. A no-op if the seed is out of bounds or already fully
 * transparent. Pixels reachable only diagonally are never removed.
 */
export function floodRemoveAt(img: RgbaImage, sx: number, sy: number, tol: number): void {
  const { width: w, height: h, data: d } = img;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const i0 = (sy * w + sx) * 4;
  if (d[i0 + 3] === 0) return;
  const tr = d[i0];
  const tg = d[i0 + 1];
  const tb = d[i0 + 2];
  const t2 = tol * tol;
  const seen = new Uint8Array(w * h);
  const start = sy * w + sx;
  const stack: number[] = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop() as number;
    const o = i * 4;
    const dr = d[o] - tr;
    const dg = d[o + 1] - tg;
    const db = d[o + 2] - tb;
    if (dr * dr + dg * dg + db * db > t2) continue;
    d[o + 3] = 0;
    const x = i % w;
    const y = (i / w) | 0;
    if (x + 1 < w && !seen[i + 1]) {
      seen[i + 1] = 1;
      stack.push(i + 1);
    }
    if (x - 1 >= 0 && !seen[i - 1]) {
      seen[i - 1] = 1;
      stack.push(i - 1);
    }
    if (y + 1 < h && !seen[i + w]) {
      seen[i + w] = 1;
      stack.push(i + w);
    }
    if (y - 1 >= 0 && !seen[i - w]) {
      seen[i - w] = 1;
      stack.push(i - w);
    }
  }
}

/**
 * Auto-clear the background by flood-removing from the four image corners at
 * the given tolerance — the on-open default for the editor.
 */
export function autoRemoveCorners(img: RgbaImage, tol: number): void {
  const { width: w, height: h } = img;
  floodRemoveAt(img, 0, 0, tol);
  floodRemoveAt(img, w - 1, 0, tol);
  floodRemoveAt(img, 0, h - 1, tol);
  floodRemoveAt(img, w - 1, h - 1, tol);
}

/**
 * Soften cutout edges: for every still-opaque pixel, if ≥5 of its in-bounds
 * neighbours (the 3×3 block, out-of-bounds not counted) are fully transparent,
 * drop its alpha to 130. Already-transparent pixels are untouched. Reads a
 * snapshot of alpha first so the pass does not feed on its own writes.
 */
export function feather(img: RgbaImage): void {
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  const alpha = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) alpha[i] = d[i * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (alpha[i] === 0) continue;
      let transparent = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (alpha[ny * w + nx] === 0) transparent++;
        }
      }
      if (transparent >= 5) d[i * 4 + 3] = 130;
    }
  }
}

/** Snapshot the alpha channel into a fresh `w*h` array (undo history). */
export function extractAlpha(img: RgbaImage): Uint8ClampedArray {
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  const alpha = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) alpha[i] = d[i * 4 + 3];
  return alpha;
}

/** Write a `w*h` alpha array back into the RGBA data (undo restore). */
export function applyAlpha(img: RgbaImage, alpha: Uint8ClampedArray): void {
  const { data: d } = img;
  const n = alpha.length;
  for (let i = 0; i < n; i++) d[i * 4 + 3] = alpha[i];
}

/**
 * Set each pixel's alpha to the corresponding mask value, leaving RGB intact.
 * Used after upscaling the working mask onto the full-resolution original.
 */
export function applyMask(img: RgbaImage, mask: Uint8ClampedArray): void {
  const { data: d } = img;
  const n = mask.length;
  for (let i = 0; i < n; i++) d[i * 4 + 3] = mask[i];
}
