/**
 * Generates PWA icons into public/. Run once (outputs committed):
 * `node scripts/generate-icons.mjs`
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve(import.meta.dirname, '../public');

function iconSvg(size, { maskable = false } = {}) {
  // Maskable icons need the mark inside the 80% safe zone.
  const pad = maskable ? size * 0.18 : size * 0.1;
  const r = maskable ? 0 : size * 0.22;
  const font = size * 0.52;
  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${r}" fill="#c17a52"/>
  <rect x="${pad}" y="${pad}" width="${size - 2 * pad}" height="${size - 2 * pad}" rx="${size * 0.08}"
        fill="none" stroke="#fbf8f2" stroke-width="${size * 0.035}" stroke-opacity="0.55"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="${font}" fill="#fbf8f2">R</text>
</svg>`;
}

await mkdir(OUT, { recursive: true });
const jobs = [
  ['icon-192.png', iconSvg(192)],
  ['icon-512.png', iconSvg(512)],
  ['icon-maskable-512.png', iconSvg(512, { maskable: true })],
  ['apple-touch-icon.png', iconSvg(180)],
];
for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, name));
}
console.log('icons written to', OUT);
