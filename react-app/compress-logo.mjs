import sharp from 'sharp';
import { statSync, existsSync } from 'fs';

const input = './src/assets/tfb-logo.png';
const outputWebP = './src/assets/tfb-logo.webp';
const outputPng = './src/assets/tfb-logo-opt.png';

console.log('Input exists:', existsSync(input));

// Create optimized WebP (target ≤ 60 KB)
await sharp(input)
  .resize(280, 280, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85, effort: 6 })
  .toFile(outputWebP);

// Also create an optimized fallback PNG for browsers that don't support WebP
await sharp(input)
  .resize(280, 280, { fit: 'inside', withoutEnlargement: true })
  .png({ compressionLevel: 9, quality: 85 })
  .toFile(outputPng);

const webpSize = statSync(outputWebP).size;
const pngSize = statSync(outputPng).size;
console.log('WebP: ' + (webpSize/1024).toFixed(1) + ' KB');
console.log('PNG fallback: ' + (pngSize/1024).toFixed(1) + ' KB');
console.log('Done!');
