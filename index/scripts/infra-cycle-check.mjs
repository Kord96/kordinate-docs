#!/usr/bin/env node
// Compile the actual site against checked-in UI fixture data, then stop the API.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = {
  ...process.env,
  DOCS_DATA_BASE_URL: 'http://127.0.0.1:4010',
  SNAPSHOT_STORE_ROOT: path.join(root, 'synthetic-data/snapshot-store'),
  AUGUR_OUTPUT_ROOT: '',
  SYNTHETIC_DOCS_PORT: '4010',
  DOCS_DEFAULT_USER: 'admin',
  DOCS_USER_ID: 'admin',
  DOCS_AUTH_TOKEN: '',
  SNAPSHOT_ACCESS: 'admin:*;guest:Kord96--augur',
};
const children = new Set();
let stopping = false;
let killTimer;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  killTimer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 5000);
  killTimer.unref();
}
function start(args) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  children.add(child);
  child.on('error', (error) => { console.error(error); stop(1); });
  child.on('exit', () => {
    children.delete(child);
    if (children.size === 0) clearTimeout(killTimer);
  });
  return child;
}
process.on('SIGTERM', () => stop(143));
process.on('SIGINT', () => stop(130));
const api = start(['scripts/serve-synthetic-docs-api.mjs']);
api.on('exit', () => { if (!stopping) stop(1); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
    try {
      const response = await fetch(`${env.DOCS_DATA_BASE_URL}/health`, { signal: AbortSignal.timeout(500) });
      const health = await response.json();
      if (response.ok && health.ok && health.snapshotStoreRoot === env.SNAPSHOT_STORE_ROOT) {
        ready = true;
        break;
      }
    } catch { /* Retry while the fixture API starts. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Fixture API did not become ready.');
  if (!stopping) {
    const build = start(['node_modules/astro/bin/astro.mjs', 'build']);
    const code = await new Promise((resolve) => {
      build.on('exit', (code) => resolve(code ?? 1));
      build.on('error', () => resolve(1));
    });
    stop(code);
  }
} catch (error) {
  if (!stopping) console.error(error);
  stop(1);
}
