---
name: augur-content-integration
description: How to deploy augur analysis output to the docs Astro site and GitHub Issues
type: project
---

# Augur Content Integration

Augur's analysis output is available as kord resources. Charon acquires data through kord, runs scripts to build deployable artifacts, and deploys.

## Acquiring data

Augur resources are registered in KORD.json and served via the MCP:

| Resource | Tool call | Returns |
|----------|-----------|---------|
| Atlas | `augur_fetch(resource="atlas", project=<path>)` | Structural inventory (JSON) |
| Stories | `augur_fetch(resource="stories", project=<path>)` | Story compositions (YAML directory) |
| Journeys | `augur_fetch(resource="journeys", project=<path>)` | Reading paths (YAML directory) |
| Issues | `augur_fetch(resource="issues", project=<path>)` | Classified findings (JSON) |

If a resource is missing, the MCP server auto-triggers augur's `/analyze` to produce it.

## Scripts

Three scripts in this project's `.kord/agents/charon/scripts/`:

| Script | Purpose |
|--------|---------|
| `build-manifest.py <project>` | Build manifest.json + storyByNode.json from augur output |
| `generate-pages.py <project>` | Generate Astro pages from manifest + stories + journeys |
| `create-issues.py <project> [--dry-run] [--auto]` | Push augur issues.json to GitHub Issues |

## Deploying to docs site

### 1. Run the build scripts

```bash
SCRIPTS="/kord/projects/docs/.kord/agents/charon/scripts"
python3 $SCRIPTS/build-manifest.py <project>
python3 $SCRIPTS/generate-pages.py <project>
```

### 2. Install/update components

```bash
cp $KORDINATE_HOME/agents/scribe/skills/render/components/*.astro /kord/projects/docs/src/components/augur/
cp $KORDINATE_HOME/agents/scribe/skills/render/lib/*.ts /kord/projects/docs/src/components/augur/lib/
```

### 3. Copy artifacts to site

Copy the script outputs and augur data into the site content directory. Use `augur_fetch` to get paths if needed, or read from the standard locations the scripts wrote to.

### 4. Build and verify

```bash
cd /kord/projects/docs && npm run build
```

If build fails, do NOT deploy. Report the error.

### 5. Deploy

Follow the split deployment model from `deployment.md`:
- **Dev**: changes are live immediately via PVC mount + Astro dev server hot-reload
- **Prod**: commit, push to prod branch, GitHub Actions handles the rest

## Deploying to GitHub Issues

```bash
python3 /kord/projects/docs/.kord/agents/charon/scripts/create-issues.py <project> [--dry-run] [--auto]
```

Reads `issues.json` from augur output, deduplicates against existing GitHub issues, creates new ones.
