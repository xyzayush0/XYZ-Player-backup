import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const wwwDir = path.join(rootDir, 'www');

if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

const filesToCopy = [
  'index.html',
  'style.css',
  'app.js',
  'tracks.js',
  'offlineDb.js',
  'manifest.json',
  'sw.js'
];

for (const f of filesToCopy) {
  const src = path.join(rootDir, f);
  const dest = path.join(wwwDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

const dirsToCopy = ['Preview', 'audio'];
for (const d of dirsToCopy) {
  const src = path.join(rootDir, d);
  const dest = path.join(wwwDir, d);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true, force: true });
  }
}

const apiDir = path.join(rootDir, 'api');
if (fs.existsSync(apiDir)) {
  fs.cpSync(apiDir, path.join(wwwDir, 'api'), { recursive: true, force: true });
}

console.log('✓ Successfully synchronized web assets into www/ for Android Capacitor build');
