# Wiring Projects to the Docs Site

## Current Model

The docs frontend now reads from a **docs-facing backend API**, not directly from Augur output files.

Set:

```bash
DOCS_DATA_BASE_URL=https://docs.khaledkord.com/api
```

The build fails immediately if `DOCS_DATA_BASE_URL` is missing.

## API Contract

The frontend currently depends on these endpoints:

- `GET /projects`
- `GET /projects/:project/current`

The broader V1 docs backend contract is:

- `GET /projects`
- `GET /projects/:project`
- `GET /projects/:project/current`
- `GET /projects/:project/analyses`
- `GET /projects/:project/analyses/:analysisId`
- `GET /projects/:project/analyses/:analysisId/view`
- `GET /projects/:project/overlays`
- `GET /projects/:project/overlays/:overlayId`

## What The Frontend Expects

`GET /projects` returns project summaries used for:

- homepage cards
- static route generation

Example:

```json
[
  {
    "slug": "synthetic-shop",
    "title": "Synthetic Shop",
    "purpose": "Demo storefront docs backed by immutable analysis snapshots and editable overlays.",
    "componentCount": 4,
    "current_analysis_id": "2026-04-14T01-00-00Z-abc1234",
    "current_overlay_id": "2026-04-14-edit-01"
  }
]
```

`GET /projects/:project/current` returns the rendered current view:

```json
{
  "project": "synthetic-shop",
  "analysis_id": "2026-04-14T01-00-00Z-abc1234",
  "overlay_id": "2026-04-14-edit-01",
  "atlas": {},
  "stories": [],
  "narratives": []
}
```

The frontend derives node-to-story references internally from `atlas + stories`.

There is no `storyByNode` input anymore.

## Augur Boundary

Augur is the producer of canonical analysis artifacts:

- `atlas.json`
- `stories/*.yaml`
- `narratives.yaml`

The docs backend is responsible for:

- indexing projects
- listing analyses
- applying overlays
- publishing the current view
- exposing a stable read API

## Storage Shape

The proposed object-store layout is:

```text
projects/<project>/analyses/<analysis-id>/meta.json
projects/<project>/analyses/<analysis-id>/atlas.json
projects/<project>/analyses/<analysis-id>/stories/<story-id>.yaml
projects/<project>/analyses/<analysis-id>/narratives.yaml

projects/<project>/overlays/<overlay-id>/meta.json
projects/<project>/overlays/<overlay-id>/stories/<story-id>.yaml
projects/<project>/overlays/<overlay-id>/narratives.yaml

projects/<project>/published/current.json
```

## Local Store

The docs store should now live outside the repo by default:

```text
/kord/docs-store
```

Bootstrap that store once from the checked-in fixture data:

```bash
npm run bootstrap-docs-store
```

The local API server resolves its backing store like this:

1. `DOCS_STORE_ROOT` if set
2. `/kord/docs-store` if it exists
3. repo fixture fallback at `synthetic-data/docs-store/`

For Augur-backed reads, the synthetic API now consumes the Augur read API instead of reading Augur memory directly.

Relevant environment variables:

- `AUGUR_API_BASE_URL`: override the Augur API base URL
- `KORD_API_BASE_URL`: accepted as a fallback alias for the same Augur API base URL
- `KORD_API_KEY`: API key used for Augur gateway requests when auth is enabled
- `DOCS_SOURCE_MODE`:
  - `hybrid` (default): prefer canonical Augur projects, fall back to docs-store fixtures
  - `augur`: only serve canonical Augur projects
  - `store`: only serve docs-store fixtures

Augur data is only considered valid when the Augur API returns an accepted analysis backed by:

- `meta.validation.passed === true`
- canonical base artifacts
  - `atlas.json`
  - `stories/`
  - `narratives.yaml`
  - `meta.json`

Non-canonical or transitional Augur filesystem state is now Augur’s responsibility to hide behind its API.

## Synthetic Test Harness

This repo includes a synthetic docs API server for validating the contract without a real backend:

```bash
npm run synthetic-api
```

Default resolved store root:

```text
/kord/docs-store
```

Default Augur API base URL:

```text
http://127.0.0.1:9091
```

Then build the frontend against it:

```bash
DOCS_DATA_BASE_URL=http://127.0.0.1:4010 npm run build
```

## Object Storage Publish

This repo can publish the external docs store into MinIO/S3-compatible object storage:

```bash
MINIO_ENDPOINT=127.0.0.1 \
MINIO_PORT=9000 \
MINIO_ACCESS_KEY=... \
MINIO_SECRET_KEY=... \
MINIO_BUCKET=docs \
npm run publish-docs-store:minio
```

Verify the uploaded objects:

```bash
MINIO_ENDPOINT=127.0.0.1 \
MINIO_PORT=9000 \
MINIO_ACCESS_KEY=... \
MINIO_SECRET_KEY=... \
MINIO_BUCKET=docs \
npm run verify-docs-store:minio
```

The uploaded key layout matches the expected docs store shape, which keeps the path portable to S3 later.

## Route Behavior

The docs site still uses Astro static routes:

- `/src/pages/[project]/index.astro`
- `/src/pages/[project]/atlas/index.astro`

That means project enumeration happens at build time via `GET /projects`.

New projects require a rebuild to appear.
