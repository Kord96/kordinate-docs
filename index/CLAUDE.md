# CLAUDE.md

This repo is the snapshot web UI for Augur output.

## Project Overview

The site reads semantic `snapshot.json` artifacts through a docs-facing gateway
API. The artifact store is shared product state: Augur agents can write
snapshots, and the website can later write human feedback or edits beside them.
The website does not own the store, and Augur does not own human edits.

## Commands

```bash
npm run synthetic-api
DOCS_DATA_BASE_URL=http://127.0.0.1:4010 npm run build
npm run dev:local-api
```

## Required Environment

```bash
DOCS_DATA_BASE_URL=https://docs.khaledkord.com/api
```

Optional build-time identity headers for local/static builds:

```bash
DOCS_USER_ID=admin
DOCS_AUTH_TOKEN=<gateway-token>
```

## API Contract

The frontend consumes:

- `GET /me`
- `GET /projects`
- `GET /projects/:owner/:repo`
- `GET /projects/:owner/:repo/current`
- `GET /projects/:owner/:repo/snapshots`
- `GET /projects/:owner/:repo/snapshots/:snapshotId`

`GET /projects` returns only repositories the current user can access.

`GET /projects/:owner/:repo/current` returns:

```json
{
  "project": "owner--repo",
  "snapshot_id": "<sha-or-snapshot-id>",
  "sha": "<commit-sha>",
  "snapshot": {}
}
```

The `snapshot` object follows the Augur semantic snapshot contract from
`project/augur/skills/snapshot/references/snapshot.md`.

## Local Harness

The synthetic API reads:

```text
SNAPSHOT_STORE_ROOT=<shared-snapshot-store>
```

Default:

```text
/kord/snapshot-store
```

The checked-in fixture at `synthetic-data/snapshot-store/` is only for local UI
development.

Tenancy in the synthetic API is controlled with:

```bash
DOCS_DEFAULT_USER=admin
SNAPSHOT_ACCESS="admin:*;guest:Kord96--augur"
```

Production tenancy belongs in the gateway. The gateway should authenticate the
user, determine accessible repos, and forward a stable user identity to this
API.
