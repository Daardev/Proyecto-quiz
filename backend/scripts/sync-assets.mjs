import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');
const repoRoot = resolve(backendRoot, '..');

const SOURCES = [
  { from: resolve(repoRoot, 'frontend/public/styles'), to: resolve(backendRoot, 'public/styles') },
  { from: resolve(repoRoot, 'frontend/src'), to: resolve(backendRoot, 'public/src') },
];

async function syncOne({ from, to }) {
  await mkdir(to, { recursive: true });
  await rm(to, { recursive: true, force: true });
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true });
  console.log(`[sync] ${from.replace(repoRoot, '.')} -> ${to.replace(backendRoot, '.')}`);
}

async function main() {
  for (const entry of SOURCES) {
    await syncOne(entry);
  }
  console.log('[sync] OK');
}

main().catch((err) => {
  console.error('[sync] FAIL:', err.message);
  process.exit(1);
});
