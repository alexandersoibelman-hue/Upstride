#!/usr/bin/env node
/**
 * Assemble the deployable site into _site/.
 *
 *   npm run build:site
 *
 * Shared by every host rather than written inline in one deploy config, so
 * GitHub Pages and Cloudflare Pages cannot drift apart and produce different
 * sites from the same commit.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, '_site');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

await fs.rm(SITE, { recursive: true, force: true });
await fs.mkdir(SITE, { recursive: true });

// One self-contained document. A multi-file deploy lets a browser pair a
// freshly fetched page with a stylesheet it still has cached, which renders the
// app subtly broken; a single file cannot desynchronise with itself.
execFileSync(
  process.execPath,
  [path.join(ROOT, 'scripts/build-single.js'), path.join(SITE, 'index.html'), '--full'],
  { stdio: 'inherit' },
);

await fs.copyFile(path.join(SITE, 'index.html'), path.join(SITE, 'standalone.html'));
await fs.copyFile(path.join(ROOT, 'manifest.webmanifest'), path.join(SITE, 'manifest.webmanifest'));

// Tells GitHub Pages not to run the output through Jekyll. Harmless elsewhere.
await fs.writeFile(path.join(SITE, '.nojekyll'), '');

// A CNAME file at the repo root switches GitHub Pages onto a custom domain.
// Copied only when present: publishing one before DNS resolves takes the
// github.io URL down with it, since Pages starts redirecting to a domain that
// cannot yet answer. Cloudflare Pages ignores the file.
if (await exists(path.join(ROOT, 'CNAME'))) {
  await fs.copyFile(path.join(ROOT, 'CNAME'), path.join(SITE, 'CNAME'));
}

// Sources published alongside for reading, not for the app to load.
for (const dir of ['styles', 'src']) {
  await fs.cp(path.join(ROOT, dir), path.join(SITE, dir), { recursive: true });
}

const entries = await fs.readdir(SITE);
const bytes = (await fs.stat(path.join(SITE, 'index.html'))).size;
console.log(`Site -> _site/ (${entries.length} entries, index.html ${(bytes / 1024).toFixed(1)} KB)`);
