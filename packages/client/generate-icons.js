import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple SVG to PNG using Canvas (requires node-canvas or similar)
// For now, we'll create placeholder PNGs with SVG data URIs
// In production, you'd use a proper image conversion library

const sizes = [192, 512];

const svgContent = fs.readFileSync(join(__dirname, 'public/icon.svg'), 'utf8');

for (const size of sizes) {
  const scaledSvg = svgContent
    .replace('width="512"', `width="${size}"`)
    .replace('height="512"', `height="${size}"`);

  fs.writeFileSync(
    join(__dirname, `public/icon-${size}.png.svg`),
    scaledSvg
  );
}

console.log('Icon files created. Note: These are SVG files renamed as PNG.');
console.log('For production, convert these to actual PNG using a tool like:');
console.log('- sharp (npm package)');
console.log('- ImageMagick');
console.log('- Online converter');
console.log('Or use the SVG directly in your manifest with type="image/svg+xml"');
