/**
 * Temporary identity surfaces until Amar sends the product mark.
 * Wordmark / initials only — no chili, no invented icon.
 * Palette sampled from launch-source.jpeg (not shipped).
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const SPACE = "#07090C";
const EXHAUST = "#E59570";
const EMBER = "#BD7A64";
const WHITE = "#FFFFFF";
const SMOKE = "#6B7684";

function initialsSvg(size) {
  const fontSize = Math.round(size * 0.38);
  const radius = Math.round(size * 0.22);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${EXHAUST}"/>
      <stop offset="100%" stop-color="${EMBER}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${SPACE}"/>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" fill="url(#tile)"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Inter, ui-sans-serif, system-ui, sans-serif"
    font-size="${fontSize}" font-weight="700" fill="${WHITE}">IS</text>
</svg>`;
}

function ogSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${EXHAUST}"/>
      <stop offset="100%" stop-color="${EMBER}"/>
    </linearGradient>
    <radialGradient id="glow" cx="18%" cy="52%" r="28%">
      <stop offset="0%" stop-color="${EXHAUST}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${SPACE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${SPACE}"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="80" y="215" width="120" height="120" rx="28" fill="url(#tile)"/>
  <text x="140" y="292" text-anchor="middle" dominant-baseline="middle"
    font-family="Inter, ui-sans-serif, system-ui, sans-serif"
    font-size="46" font-weight="700" fill="${WHITE}">IS</text>
  <text x="228" y="288" font-family="Inter, ui-sans-serif, system-ui, sans-serif"
    font-size="72" font-weight="700" fill="${WHITE}">InvestSalsa</text>
  <text x="228" y="348" font-family="Inter, ui-sans-serif, system-ui, sans-serif"
    font-size="22" font-weight="600" letter-spacing="4" fill="${EXHAUST}">HOME. BUDGET. INVEST. FREEDOM.</text>
  <text x="80" y="580" font-family="Inter, ui-sans-serif, system-ui, sans-serif"
    font-size="14" font-weight="500" fill="${SMOKE}">Launch</text>
</svg>`;
}

async function writePng(path, svg, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(path);
}

writeFileSync("public/favicon.svg", initialsSvg(32));
await writePng("public/favicon-16.png", initialsSvg(16), 16, 16);
await writePng("public/favicon-32.png", initialsSvg(32), 32, 32);
await writePng("public/logo.png", initialsSvg(32), 32, 32);
await writePng("public/apple-touch-icon.png", initialsSvg(180), 180, 180);
await writePng("src/app/icon.png", initialsSvg(512), 512, 512);
await writePng("src/app/apple-icon.png", initialsSvg(180), 180, 180);
await writePng("public/og.png", ogSvg(), 1200, 630);
console.log("Wrote wordmark placeholders (no chili).");
