---
name: augur-content-integration
description: How to deploy augur analysis output from scribe into the docs Astro site
type: project
---

# Augur Content Integration

When scribe runs `/document <project> --target docs`, it produces output at `<project>/.kord/agents/scribe/output/`. Charon's job is to wire that output into this docs site.

## Source

Scribe output at `<project>/.kord/agents/scribe/output/`:

```
manifest.json          — rendering decisions per story block
storyByNode.json       — atlas node ID → story IDs index
pages/<project>/       — generated Astro page files
  index.astro          — default journey page
  <journey>.astro      — additional journey pages
  atlas/index.astro    — interactive atlas graph page
```

Atlas, stories, and journeys come directly from augur at `<project>/.kord/agents/augur/memory/`:

```
atlas.json
stories/*.yaml
journeys/*.yaml
```

## Destination

This docs site at `/kord/projects/docs/`:

```
src/components/augur/          — rendering components (from kordinate)
src/components/augur/lib/      — supporting TypeScript (from kordinate)
src/content/docs/<project>/    — data files (atlas, manifest, stories, journeys)
src/pages/<project>/           — route pages (from scribe output)
```

## Procedure

### 1. Install/update components

Components live in kordinate at `$KORDINATE_HOME/agents/scribe/skills/render/`. Only update if source is newer:

```bash
rsync -u $KORDINATE_HOME/agents/scribe/skills/render/components/*.astro /kord/projects/docs/src/components/augur/
rsync -u $KORDINATE_HOME/agents/scribe/skills/render/lib/*.ts /kord/projects/docs/src/components/augur/lib/
```

### 2. Copy data files

```bash
PROJECT_OUTPUT="<project>/.kord/agents/scribe/output"
AUGUR_OUTPUT="<project>/.kord/agents/augur/memory"
DEST="/kord/projects/docs/src/content/docs/<project>"

mkdir -p $DEST/stories $DEST/journeys
cp $AUGUR_OUTPUT/atlas.json $DEST/
cp $PROJECT_OUTPUT/manifest.json $DEST/
cp $PROJECT_OUTPUT/storyByNode.json $DEST/
rsync -a --delete $AUGUR_OUTPUT/stories/ $DEST/stories/ 2>/dev/null || true
rsync -a --delete $AUGUR_OUTPUT/journeys/ $DEST/journeys/ 2>/dev/null || true
```

### 3. Copy generated pages

```bash
rsync -a $PROJECT_OUTPUT/pages/ /kord/projects/docs/src/pages/
```

### 4. Build and verify

```bash
cd /kord/projects/docs && npm run build
```

If build fails, do NOT deploy. Report the error.

### 5. Deploy

Follow the split deployment model from `deployment.md`:
- **Dev**: the pod auto-picks up changes via the PVC mount + Astro dev server hot-reload. No action needed.
- **Prod**: commit, push to prod branch, GitHub Actions handles the rest.

For dev (already running):
```bash
# Changes are live immediately via PVC + hot-reload
```

For prod:
```bash
cd /kord/projects/docs
git add src/components/augur/ src/content/docs/<project>/ src/pages/<project>/
git commit -m "docs(<project>): update from augur analysis"
# Then use /roll to push to prod when ready
```

## Components Reference

| Component | Purpose |
|-----------|---------|
| `JourneyPage.astro` | Full explorer: tabs, sidebar, canvas, drawer |
| `StoryCard.astro` | Story section with all building blocks |
| `GraphBlock.astro` | Interactive graph (cytoscape) |
| `SequenceDiagram.astro` | Mermaid sequence diagram |
| `TimelineCard.astro` | Failure cascade timeline |
| `ObservationCard.astro` | Evidence/warning card |
| `RationaleCard.astro` | Design decision card |
| `AtlasPage.astro` | Full interactive atlas graph |
| `BottomDrawer.astro` | Drawer shell for detail panels |
| `cytoscape-config.ts` | Node type colors, shapes, severity colors |
| `narrative.ts` | Bold-ref parsing, HTML escaping |
