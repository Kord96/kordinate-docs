# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Documentation site for **logBD** — an interactive architecture walkthrough of a stream-processing pipeline that builds a queryable property graph from network logs. Built with Astro + Starlight, deployed as a static site served at `/dev` base path.

Production: `docs.khaledkord.com` | Dev: same domain at `/dev` path.

## Commands

```bash
npm run dev          # Start dev server (port 4321, binds 0.0.0.0)
npm run build        # Build static site to dist/
npm run preview      # Preview production build
```

Docker alternative: `docker build -t docs . && docker run -p 4321:4321 docs`

## Architecture

### Data Pipeline (build-time)

The site is **data-driven** — augur (architecture analysis) and scribe (story generation) produce JSON/YAML in `src/content/docs/logbd/` which the Astro pages consume at build time via `fs.readFileSync`:

- **`atlas.json`** — Full architecture model: components, groups, flows, failure modes, debt, domain model, concepts
- **`manifest.json`** — Scribe output: story block metadata (renderers, block types)
- **`storyByNode.json`** — Maps component IDs → story IDs (used for graph node click → story navigation)
- **`journeys/*.yaml`** — Ordered story sequences with bridges (narrative transitions between stories)
- **`stories/*.yaml`** — Individual stories: anchor file, summary, flows, observations, components

### Pages

There are only two main pages — both are large single-file Astro components with inline JS and CSS:

- **`src/pages/logbd/index.astro`** (~1300 lines) — Journey page. Scroll-snap sections, Cytoscape.js graph per story, drawer with detail/terminal tabs, focus mode, keyboard nav (←/→/Esc). Loads journey YAML and renders stories with progressive reveal.
- **`src/pages/logbd/atlas/index.astro`** (~1000 lines) — Atlas page. Full architecture reference: component cards, flow diagrams, failure modes, debt violations, domain model, Cytoscape.js interactive graph with expandable groups.

### Key Patterns

- **No framework JS** — All interactivity is vanilla JS in `<script>` tags within `.astro` files. Cytoscape.js and cose-bilkent layout loaded from CDN.
- **Mermaid rendering** — Configured globally in `astro.config.mjs` head script; renders `[data-language="mermaid"]` blocks on page load and Astro navigation.
- **Component/node IDs are the join key** — `atlas.json` component IDs link to `storyByNode.json` entries, which reference story IDs in `stories/*.yaml`, which are sequenced by `journeys/*.yaml`. Renaming an ID requires updating all four.
- **Starlight theming** — `src/styles/custom.css` overrides Starlight defaults. The journey and atlas pages bypass Starlight layout entirely (standalone HTML).

## Content Schema

Stories follow this structure: `id`, `title`, `teaches`, `tags`, `anchor` (source file reference), `parent`/`children`, `summary`, `flows[]`, `observations[]`, `components[]`.

Journeys: `id`, `number`, `title`, `description`, `audience`, `overview`, `stories[]` (ordered IDs), `bridges[]` (from/to/text narrative connectors).
