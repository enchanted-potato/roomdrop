/**
 * Apply the EXIF-orientation transform to a canvas 2D context.
 *
 * The 8 EXIF orientations map to a sequence of translate/rotate/scale calls
 * that pre-set the transform so a subsequent `drawImage(bitmap, 0, 0, w, h)`
 * produces a visually-correct rendering. `w` / `h` here are the pre-rotation
 * destination dimensions (i.e. the bitmap's width/height after resize but
 * BEFORE any axis swap).
 *
 * Reference: RESEARCH §"Code Examples → Image pipeline shape".
 */
export function applyOrientationTransform(
  ctx: OffscreenCanvasRenderingContext2D,
  orient: number,
  w: number,
  h: number,
): void {
  switch (orient) {
    case 2:
      // Flip horizontally.
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      break;
    case 3:
      // Rotate 180°.
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
      break;
    case 4:
      // Flip vertically.
      ctx.translate(0, h);
      ctx.scale(1, -1);
      break;
    case 5:
      // Transpose (rotate 90° CW + flip horizontally).
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6:
      // Rotate 90° CW.
      ctx.translate(h, 0);
      ctx.rotate(0.5 * Math.PI);
      break;
    case 7:
      // Transverse (rotate 90° CCW + flip horizontally).
      ctx.translate(h, w);
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(-1, 1);
      break;
    case 8:
      // Rotate 90° CCW.
      ctx.translate(0, w);
      ctx.rotate(-0.5 * Math.PI);
      break;
    case 1:
    default:
      // Identity — either explicit orient=1 or hostile/missing EXIF.
      break;
  }
}
