#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'minio';
import { resolveDocsStoreRoot } from './lib/docs-store-path.mjs';

const endpoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
const port = Number(process.env.MINIO_PORT || 9000);
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;
const bucket = process.env.MINIO_BUCKET || 'docs';
const prefix = (process.env.MINIO_PREFIX || '').replace(/^\/+|\/+$/g, '');
const storeRoot = process.env.DOCS_STORE_ROOT || resolveDocsStoreRoot();

if (!accessKey || !secretKey) {
  throw new Error('MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required.');
}

if (!fs.existsSync(storeRoot)) {
  throw new Error(`Docs store root does not exist: ${storeRoot}`);
}

const client = new Client({ endPoint: endpoint, port, useSSL, accessKey, secretKey });

function contentTypeFor(filePath) {
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'application/yaml';
  return 'application/octet-stream';
}

function listFiles(root, current = root) {
  const entries = fs.readdirSync(current, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(root, fullPath));
    else out.push(fullPath);
  }
  return out;
}

function objectNameFor(filePath) {
  const rel = path.relative(storeRoot, filePath).split(path.sep).join('/');
  return prefix ? `${prefix}/${rel}` : rel;
}

async function main() {
  const exists = await client.bucketExists(bucket).catch(() => false);
  if (!exists) await client.makeBucket(bucket);

  const files = listFiles(storeRoot);
  for (const filePath of files) {
    const objectName = objectNameFor(filePath);
    await client.fPutObject(bucket, objectName, filePath, {
      'Content-Type': contentTypeFor(filePath),
    });
    console.log(`uploaded ${objectName}`);
  }

  console.log(`Published ${files.length} objects to s3://${bucket}/${prefix}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
