// Full raster fleet for the evix brand, generated from the SVG sources.
// Outputs into ../public. .ico is packed separately by pack-ico.py (sharp can't write ico).
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = (p) => readFileSync(here(p));
const pub = (name) => here(`../public/${name}`);
const tmp = here('./_ico');
mkdirSync(tmp, { recursive: true });

const png = (buf, size, out) =>
  sharp(buf, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);

const faviconTile = src('./evix-favicon.svg');
const squareTile = src('./evix-tile-square.svg');
const maskable = src('./evix-maskable.svg');
const e16 = src('./evix-16.svg');

// SVG favicon (scales in the tab) — ship the rounded navy tile.
writeFileSync(pub('favicon.svg'), faviconTile);

// PWA + Apple icons.
await png(squareTile, 180, pub('apple-touch-icon.png'));
await png(squareTile, 192, pub('icon-192.png'));
await png(squareTile, 512, pub('icon-512.png'));
await png(maskable, 512, pub('icon-512-maskable.png'));

// .ico source frames: 16 uses the simplified E, 32/48 use the full mark tile.
await png(e16, 16, `${tmp}/16.png`);
await png(faviconTile, 32, `${tmp}/32.png`);
await png(faviconTile, 48, `${tmp}/48.png`);

// --- OG default (1200x630): mark + "vix" wordmark + domain, on navy ---
const onest = readFileSync(here('../public/fonts/onest-700-latin.woff2')).toString('base64');
const markInner = src('./evix-mark.svg')
  .toString()
  .replace(/^[\s\S]*?<defs>/, '<defs>') // keep from defs onward
  .replace(/<\/svg>\s*$/, '');
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <style>
    @font-face { font-family:'Onest'; font-weight:700; src:url('data:font/woff2;base64,${onest}') format('woff2'); }
    .wm { font-family:'Onest',sans-serif; font-weight:700; letter-spacing:-0.03em; }
  </style>
  <rect width="1200" height="630" fill="#0F172A"/>
  <rect width="1200" height="6" y="624" fill="#3B82F6"/>
  <g transform="translate(150 205) scale(1.75)">${markInner}</g>
  <text x="470" y="355" class="wm" font-size="205" fill="#ffffff">vix</text>
  <text x="152" y="470" font-family="Onest,sans-serif" font-weight="400" font-size="34" fill="#94a3b8" letter-spacing="0.02em">shop.evix.md</text>
</svg>`;
await sharp(Buffer.from(og), { density: 144 }).png().toFile(pub('og-default.png'));

console.log('assets written to public/: favicon.svg, apple-touch-icon.png, icon-192/512/512-maskable.png, og-default.png, _ico/{16,32,48}.png');
