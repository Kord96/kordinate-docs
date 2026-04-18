import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

export const externalDocsStoreRoot = process.env.DOCS_STORE_ROOT || '/kord/docs-store';
export const repoFixtureStoreRoot = path.join(repoRoot, 'synthetic-data', 'docs-store');

export function resolveDocsStoreRoot() {
  if (fs.existsSync(externalDocsStoreRoot)) return externalDocsStoreRoot;
  return repoFixtureStoreRoot;
}
