# Snapshot Website Wiring

## Boundary

The website reads and presents semantic Augur snapshots. The shared snapshot
store is neutral: Augur writes agent and detector artifacts, and the website may
later write human feedback or edits beside the agent output.

## Shared Store Shape

```text
<snapshot-store-root>/
  <repo-slug>/
    <snapshot-id-or-sha>/
      snapshot.json
      run-output.json
      detector-state.json
      diff.json
      delta/
```

The website only requires `snapshot.json`.

## Gateway Contract

The gateway owns authentication and tenancy. It should expose only repos the
current user can access:

- `GET /me`
- `GET /projects`
- `GET /projects/:owner/:repo`
- `GET /projects/:owner/:repo/current`
- `GET /projects/:owner/:repo/snapshots`
- `GET /projects/:owner/:repo/snapshots/:snapshotId`

The frontend sends optional build-time identity headers from `DOCS_USER_ID` and
`DOCS_AUTH_TOKEN`. Production should replace this with real gateway-managed
session/auth headers.

## Local Development

Run the fixture API:

```bash
SNAPSHOT_STORE_ROOT=synthetic-data/snapshot-store \
SNAPSHOT_ACCESS="admin:*;guest:Kord96--augur" \
npm run synthetic-api
```

Build the site against it:

```bash
DOCS_DATA_BASE_URL=http://127.0.0.1:4010 DOCS_USER_ID=admin npm run build
```
