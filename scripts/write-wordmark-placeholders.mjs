/**
 * Temporary identity surfaces until Amar sends the product mark.
 * Wordmark / initials only — no chili, no invented icon.
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const CHARCOAL = "#16181D";
const LIME = "#A3E635";
const WHITE = "#F4F4F5";

function initialsSvg(size) {
  const fontSize = Math.round(size * 0.38);
  const radius = Math.round(size * 0.22);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${CHARCOAL}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Inter, ui-sans-serif, system-ui, sans-serif"
    font-size="${fontSize}" font-weight="700" fill="${LIME}">IS</text>
</svg>`;
}

function ogSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${CHARCOAL}"/>
  <text x="80" y="290" font-family="Inter, ui-sans-serif, system-ui, sans-serif"
    font-size="72" font-weight="700" fill="${WHITE}">Invest<tspan fill="${LIME}">Salsa</tspan></text>
  <text x="80" y="360" font-family="Inter, ui-sans-serif, system-ui, sans-serif"
    font-size="28" font-weight="500" fill="${LIME}">Home. Budget. Invest. Freedom.</text>
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
await writePng("public/og.png", ogSvg(), 1200, 630);
console.log("Wrote wordmark placeholders (no chili).");
