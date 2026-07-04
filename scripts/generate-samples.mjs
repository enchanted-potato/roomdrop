/**
 * Generates the bundled sample-room assets (ONB-02) into src/assets/samples/.
 * Run once (outputs are committed): `node scripts/generate-samples.mjs`
 *
 * Everything is rendered from inline SVG via sharp — no external images, no
 * licensing questions, warm-neutral palette matching the app tokens.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve(import.meta.dirname, '../src/assets/samples');

const roomSvg = `
<svg width="1600" height="1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ece2d2"/>
      <stop offset="1" stop-color="#ddcfb8"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9a27a"/>
      <stop offset="1" stop-color="#a97f57"/>
    </linearGradient>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff8e8" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#fff8e8" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="820" fill="url(#wall)"/>
  <rect y="820" width="1600" height="380" fill="url(#floor)"/>
  <rect y="800" width="1600" height="26" fill="#f4ede0"/>
  <!-- floorboards -->
  <g stroke="#96703f" stroke-opacity="0.35" stroke-width="3">
    <line x1="0" y1="900" x2="1600" y2="900"/>
    <line x1="0" y1="990" x2="1600" y2="990"/>
    <line x1="0" y1="1090" x2="1600" y2="1090"/>
  </g>
  <!-- window -->
  <g>
    <rect x="1080" y="140" width="360" height="480" rx="8" fill="#b7d3d8"/>
    <rect x="1080" y="140" width="360" height="480" rx="8" fill="none" stroke="#f4ede0" stroke-width="26"/>
    <line x1="1260" y1="150" x2="1260" y2="610" stroke="#f4ede0" stroke-width="18"/>
    <line x1="1090" y1="380" x2="1430" y2="380" stroke="#f4ede0" stroke-width="18"/>
  </g>
  <!-- sunlight patch -->
  <polygon points="1080,620 1440,620 1560,1060 960,1060" fill="url(#light)"/>
  <!-- sofa -->
  <g>
    <rect x="180" y="560" width="640" height="300" rx="40" fill="#8a9b8e"/>
    <rect x="150" y="520" width="120" height="340" rx="36" fill="#7b8c7f"/>
    <rect x="730" y="520" width="120" height="340" rx="36" fill="#7b8c7f"/>
    <rect x="210" y="470" width="580" height="180" rx="36" fill="#96a79a"/>
    <rect x="180" y="840" width="640" height="30" fill="#6d7d71"/>
    <rect x="220" y="870" width="28" height="46" fill="#5d4a33"/>
    <rect x="760" y="870" width="28" height="46" fill="#5d4a33"/>
  </g>
  <!-- rug -->
  <ellipse cx="820" cy="1060" rx="420" ry="90" fill="#d8c7ac"/>
  <ellipse cx="820" cy="1060" rx="330" ry="66" fill="none" stroke="#c17a52" stroke-opacity="0.5" stroke-width="8"/>
</svg>`;

const cushionSvg = `
<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="c" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d08a5e"/>
      <stop offset="1" stop-color="#b56a3f"/>
    </linearGradient>
  </defs>
  <path d="M60 90 Q300 30 540 90 Q570 300 540 510 Q300 570 60 510 Q30 300 60 90 Z" fill="url(#c)"/>
  <path d="M60 90 Q300 30 540 90 Q570 300 540 510 Q300 570 60 510 Q30 300 60 90 Z"
        fill="none" stroke="#8f4f2a" stroke-width="10" stroke-opacity="0.5"/>
  <g stroke="#f4e3d3" stroke-width="14" stroke-linecap="round" stroke-opacity="0.75">
    <line x1="180" y1="180" x2="420" y2="420"/>
    <line x1="420" y1="180" x2="180" y2="420"/>
  </g>
  <circle cx="300" cy="300" r="26" fill="#f4e3d3"/>
</svg>`;

const artSvg = `
<svg width="500" height="650" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="460" height="610" rx="6" fill="#5d4a33"/>
  <rect x="52" y="52" width="396" height="546" fill="#fbf8f2"/>
  <rect x="84" y="84" width="332" height="482" fill="#e8ddc8"/>
  <circle cx="250" cy="240" r="90" fill="#c17a52"/>
  <path d="M84 470 L200 330 L290 430 L350 370 L416 450 L416 566 L84 566 Z" fill="#8a9b8e"/>
  <rect x="84" y="84" width="332" height="482" fill="none" stroke="#d8c7ac" stroke-width="4"/>
</svg>`;

const plantSvg = `
<svg width="500" height="700" xmlns="http://www.w3.org/2000/svg">
  <g fill="#6d8a5f">
    <path d="M250 400 Q120 300 150 130 Q260 220 255 390 Z"/>
    <path d="M250 400 Q380 300 350 130 Q240 220 245 390 Z" fill="#5c7950"/>
    <path d="M250 410 Q90 400 60 260 Q220 290 248 400 Z" fill="#7d9a6f"/>
    <path d="M250 410 Q410 400 440 260 Q280 290 252 400 Z"/>
    <path d="M245 400 Q240 240 250 60 Q265 240 255 400 Z" fill="#557246"/>
  </g>
  <path d="M140 420 L360 420 L330 660 Q250 690 170 660 Z" fill="#b5573f"/>
  <path d="M130 400 L370 400 L360 450 L140 450 Z" fill="#c46a50"/>
</svg>`;

const tableSvg = `
<svg width="700" height="500" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="350" cy="120" rx="280" ry="60" fill="#a97f57"/>
  <ellipse cx="350" cy="105" rx="280" ry="60" fill="#c9a27a"/>
  <path d="M120 130 L150 440 L185 440 L160 150 Z" fill="#8a6844"/>
  <path d="M580 130 L550 440 L515 440 L540 150 Z" fill="#8a6844"/>
  <path d="M340 165 L330 470 L370 470 L360 165 Z" fill="#7b5c3b"/>
  <ellipse cx="350" cy="452" rx="150" ry="26" fill="#5d4a33" opacity="0.25"/>
</svg>`;

await mkdir(OUT, { recursive: true });

await sharp(Buffer.from(roomSvg)).jpeg({ quality: 82 }).toFile(path.join(OUT, 'room.jpg'));
const items = [
  ['cushion', cushionSvg],
  ['art', artSvg],
  ['plant', plantSvg],
  ['table', tableSvg],
];
for (const [name, svg] of items) {
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(OUT, `${name}.png`));
}
console.log('samples written to', OUT);
