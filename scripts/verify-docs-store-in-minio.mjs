#!/usr/bin/env node
import { Client } from 'minio';

const endpoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
const port = Number(process.env.MINIO_PORT || 9000);
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;
const bucket = process.env.MINIO_BUCKET || 'docs';
const prefix = (process.env.MINIO_PREFIX || '').replace(/^\/+|\/+$/g, '');
const sampleKey = process.env.MINIO_SAMPLE_KEY || 'projects/synthetic-shop/published/current.json';

if (!accessKey || !secretKey) {
  throw new Error('MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required.');
}

const client = new Client({ endPoint: endpoint, port, useSSL, accessKey, secretKey });
const objectName = prefix ? `${prefix}/${sampleKey}` : sampleKey;

async function main() {
  const objects = [];
  const stream = client.listObjects(bucket, prefix || '', true);
  await new Promise((resolve, reject) => {
    stream.on('data', (obj) => objects.push(obj.name));
    stream.on('error', reject);
    stream.on('end', resolve);
  });

  const selectedObject = objects.includes(objectName) ? objectName : objects[0];
  if (!selectedObject) {
    throw new Error(`No objects found in s3://${bucket}/${prefix}`);
  }

  const objectStream = await client.getObject(bucket, selectedObject);
  const chunks = [];
  await new Promise((resolve, reject) => {
    objectStream.on('data', (chunk) => chunks.push(chunk));
    objectStream.on('error', reject);
    objectStream.on('end', resolve);
  });

  console.log(`objects=${objects.length}`);
  console.log(`sample=${selectedObject}`);
  console.log(Buffer.concat(chunks).toString('utf8'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
