// Contact sheet for the evix mark — visual review before mass raster export.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const B = (p) => readFileSync(new URL(p, import.meta.url));
const mark = B('./evix-mark.svg');
const mono = B('./evix-mark-mono.svg');
const fav = B('./evix-favicon.svg');

const render = (buf, size) =>
  sharp(buf, { density: 384 }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

const W = 1240, H = 560;
const bg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
     <rect width="${W}" height="${H}" fill="#ffffff"/>
     <rect x="300" y="0" width="300" height="${H}" fill="#0F172A"/>
     <g font-family="sans-serif" font-size="15" fill="#64748b">
       <text x="30" y="40">Colour · on white</text>
       <text x="330" y="40" fill="#94a3b8">Colour · on navy</text>
       <text x="630" y="40">Mono #0F172A</text>
       <text x="930" y="40">Favicon tile</text>
       <text x="930" y="330">Small: 48 · 32 · 16 px</text>
     </g>
   </svg>`
);

const layers = [];
layers.push({ input: await render(mark, 220), left: 40, top: 70 });
layers.push({ input: await render(mark, 220), left: 340, top: 70 });
layers.push({ input: await render(mono, 220), left: 640, top: 70 });
layers.push({ input: await render(fav, 220), left: 940, top: 70 });
// small favicon row on a light gray strip to check edges
layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="270" height="90"><rect width="270" height="90" fill="#f1f5f9"/></svg>`), left: 930, top: 360 });
layers.push({ input: await render(fav, 48), left: 940, top: 380 });
layers.push({ input: await render(fav, 32), left: 1010, top: 388 });
layers.push({ input: await render(fav, 16), left: 1070, top: 396 });

await sharp(bg).composite(layers).png().toFile(new URL('./_preview.png', import.meta.url).pathname);
console.log('wrote brand/_preview.png');
