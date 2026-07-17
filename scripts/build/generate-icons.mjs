import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'public/icons/icon-source.svg');
const outputs = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

await Promise.all(outputs.map(([name, size]) =>
  sharp(source).resize(Number(size), Number(size)).png().toFile(path.join(root, 'public/icons', String(name))),
));

console.log(`Generated ${outputs.length} PWA icons.`);
