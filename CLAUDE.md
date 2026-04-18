# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Documentation frontend for architecture walkthroughs. Built with Astro and served at the `/dev` base path.

The repo no longer reads project data directly from local docs folders. It now expects a docs-facing backend API via `DOCS_DATA_BASE_URL`.

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run synthetic-api
npm run bootstrap-docs-store
npm run publish-docs-store:minio
npm run verify-docs-store:minio
```

## Required Environment

```bash
DOCS_DATA_BASE_URL=https://docs.khaledkord.com/api
```

The build should fail fast if `DOCS_DATA_BASE_URL` is missing.

## Frontend Data Contract

The frontend currently consumes:

- `GET /projects`
- `GET /projects/:project/current`

The current project view payload includes:

- `atlas`
- `stories`
- `narratives`
- `analysis_id`
- optional `overlay_id`

The frontend derives node-to-story references internally. It does not require `storyByNode`.

## Upstream Data Shape

Augur produces canonical analysis artifacts in this shape:

- `atlas.json`
- `stories/*.yaml`
- `narratives.yaml`

The docs backend is expected to:

- index analyses by project
- expose the current published view
- support browsing historical analyses
- apply editable overlays without mutating the Augur base analysis

## Synthetic Harness

The repo includes a synthetic docs backend in:

- `scripts/serve-synthetic-docs-api.mjs`
- `synthetic-data/docs-store/` as fixture data
- `/kord/docs-store` as the default external local store
- `http://127.0.0.1:9091` as the default Augur API source in hybrid mode

Reader behavior:

- `DOCS_SOURCE_MODE=hybrid` by default
- canonical Augur projects are preferred when the Augur API returns accepted base analyses
- docs-store fixture data remains the fallback source for projects not yet published by Augur

Use it to validate frontend integration locally:

```bash
DOCS_DATA_BASE_URL=http://127.0.0.1:4010 npm run build
```

Bootstrap the external store once with:

```bash
npm run bootstrap-docs-store
```

Publish that store to MinIO/S3-compatible object storage with:

```bash
MINIO_ENDPOINT=127.0.0.1 MINIO_PORT=9000 MINIO_ACCESS_KEY=... MINIO_SECRET_KEY=... MINIO_BUCKET=docs npm run publish-docs-store:minio
```
