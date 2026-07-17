import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const checks = [];
const check = (name, passed, detail = '') => checks.push({ name, passed, detail });

const manifestPath = path.join(root, 'public/manifest.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
check('manifest display standalone', manifest.display === 'standalone');
check('manifest landscape', manifest.orientation === 'landscape');
check('manifest has 192 and 512 icons', manifest.icons?.some((icon) => icon.sizes === '192x192') && manifest.icons?.some((icon) => icon.sizes === '512x512'));

for (const icon of manifest.icons ?? []) {
  try {
    await access(path.join(root, 'public', icon.src.replace(/^\//, '')));
    check(`icon exists ${icon.src}`, true);
  } catch {
    check(`icon exists ${icon.src}`, false);
  }
}

const required = [
  'dist/index.html', 'dist/sw.js', 'dist/manifest.webmanifest',
  'src/app/GameApp.ts', 'src/controls/InputManager.ts',
  'src/entities/player/PlayerController.ts', 'src/camera/ThirdPersonCamera.ts',
  'src/physics/CollisionWorld.ts', 'docs/ASSET_LICENSES.md',
];
for (const relative of required) {
  try {
    await access(path.join(root, relative));
    check(`required file ${relative}`, true);
  } catch {
    check(`required file ${relative}`, false);
  }
}

const distIndex = await readFile(path.join(root, 'dist/index.html'), 'utf8');
const references = [...distIndex.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((match) => match[1]);
for (const reference of references) {
  const withoutQuery = reference.split('?')[0];
  try {
    await access(path.join(root, 'dist', withoutQuery.replace(/^\//, '')));
    check(`HTML asset ${reference}`, true);
  } catch {
    check(`HTML asset ${reference}`, false);
  }
}

const publicAssetFolders = await readdir(path.join(root, 'public/assets'));
check('asset registry folders created', publicAssetFolders.length >= 7, `${publicAssetFolders.length} folders`);

for (const result of checks) {
  console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}

const failures = checks.filter((result) => !result.passed);
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed.`);
if (failures.length) process.exitCode = 1;
