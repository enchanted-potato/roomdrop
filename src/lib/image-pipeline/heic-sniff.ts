/**
 * HEIC magic-byte sniff (D-02).
 *
 * iOS Safari lies about `file.type` and file extension for HEIC captures, so we
 * MUST inspect the first 12 bytes ourselves before any decode attempt. HEIC
 * files are ISO/BMFF containers: bytes 4..8 spell `ftyp`, and bytes 8..12 hold
 * the brand code. Any of the four brands below indicates HEIC.
 *
 * Reference: RESEARCH §"Common Pitfalls" Pitfall 3.
 */
export const HEIC_BRANDS: ReadonlySet<string> = new Set(['heic', 'heix', 'hevc', 'mif1']);

function asciiSlice(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i++) {
    const code = bytes[i];
    if (code === undefined) return '';
    out += String.fromCharCode(code);
  }
  return out;
}

export async function sniffIsHeic(file: Blob): Promise<boolean> {
  if (file.size < 12) return false;
  const buf = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (asciiSlice(bytes, 4, 8) !== 'ftyp') return false;
  const brand = asciiSlice(bytes, 8, 12);
  return HEIC_BRANDS.has(brand);
}
