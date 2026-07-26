// Horizontal lockup asset (mark + "evix" wordmark) + an in-context header preview.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const onest = readFileSync(here('../public/fonts/onest-700-latin.woff2')).toString('base64');
const markInner = readFileSync(here('./evix-mark.svg'))
  .toString()
  .replace(/^[\s\S]*?<defs>/, '<defs>')
  .replace(/<\/svg>\s*$/, '');

// Standalone lockup, transparent bg, ink wordmark. viewBox 0 0 460 140.
const lockup = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="140" viewBox="0 0 460 140">
  <style>@font-face{font-family:'Onest';font-weight:700;src:url('data:font/woff2;base64,${onest}') format('woff2');}
  .wm{font-family:'Onest',sans-serif;font-weight:700;letter-spacing:-0.03em;}</style>
  <g transform="translate(6 6)">${markInner}</g>
  <text x="140" y="93" class="wm" font-size="78" fill="#101010">evix</text>
</svg>`;
writeFileSync(here('./evix-lockup.svg'), lockup);
await sharp(Buffer.from(lockup), { density: 192 }).png().toFile(here('./evix-lockup.png'));

// In-context header mock (white bar, lockup left + faux catalog button + search).
const header = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="120" viewBox="0 0 1000 120">
  <style>@font-face{font-family:'Onest';font-weight:700;src:url('data:font/woff2;base64,${onest}') format('woff2');}
  .wm{font-family:'Onest',sans-serif;font-weight:700;letter-spacing:-0.03em;}
  .btn{font-family:'Onest',sans-serif;font-weight:700;}</style>
  <rect width="1000" height="120" fill="#ffffff"/>
  <rect y="119" width="1000" height="1" fill="#f2f2f2"/>
  <g transform="translate(28 34) scale(0.42)">${markInner}</g>
  <text x="86" y="72" class="wm" font-size="34" fill="#101010">evix</text>
  <rect x="185" y="36" width="150" height="48" rx="10" fill="#436bef"/>
  <text x="232" y="66" class="btn" font-size="18" fill="#ffffff">Каталог</text>
  <rect x="355" y="36" width="470" height="48" rx="10" fill="#f2f2f2"/>
  <text x="378" y="66" font-family="Onest,sans-serif" font-size="16" fill="#7f7f7f">Поиск товаров…</text>
</svg>`;
await sharp(Buffer.from(header), { density: 144 }).png().toFile(here('./_header.png'));
console.log('wrote brand/evix-lockup.svg, evix-lockup.png, _header.png');
