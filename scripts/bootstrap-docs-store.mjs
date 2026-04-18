#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { externalDocsStoreRoot, repoFixtureStoreRoot } from './lib/docs-store-path.mjs';

if (!fs.existsSync(repoFixtureStoreRoot)) {
  throw new Error(`Fixture docs store not found: ${repoFixtureStoreRoot}`);
}

fs.mkdirSync(path.dirname(externalDocsStoreRoot), { recursive: true });

if (fs.existsSync(externalDocsStoreRoot)) {
  const entries = fs.readdirSync(externalDocsStoreRoot);
  if (entries.length > 0) {
    console.log(`Docs store already exists: ${externalDocsStoreRoot}`);
    process.exit(0);
  }
}

fs.cpSync(repoFixtureStoreRoot, externalDocsStoreRoot, { recursive: true });
console.log(`Bootstrapped docs store at ${externalDocsStoreRoot}`);
