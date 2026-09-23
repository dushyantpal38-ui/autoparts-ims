// One-off generator for public/og.png (1200×630 social share image).
// Usage: node scripts/make-og.mjs
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#1c2530"/>
  <rect x="60" y="60" width="1080" height="510" rx="16" fill="#1e5fa8"/>
  <g transform="translate(150,215)">
    <rect width="200" height="200" rx="40" fill="#ffffff"/>
    <path d="M100 30 55 55v90l45 25 45-25V55l-45-25zm0 19 26 14-26 14-26-14 26-14zM67 83l33 18v34l-33-18V83zm66 0v34l-33 18v-34l33-18z" fill="#1e5fa8"/>
    <circle cx="152" cy="48" r="22" fill="#d9a422" stroke="#1e5fa8" stroke-width="5"/>
  </g>
  <text x="400" y="300" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="700" fill="#ffffff">AutoParts IMS</text>
  <text x="400" y="360" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#cfe0f4">Warehouse inventory management for automobile parts</text>
  <text x="400" y="430" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#9dbde0">QR scanning · Stock tracking · Low-stock alerts · Excel export</text>
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
writeFileSync('public/og.png', png);
console.log('og.png written:', png.length, 'bytes');
