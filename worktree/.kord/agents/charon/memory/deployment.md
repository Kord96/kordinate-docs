---
name: docs-deployment
description: Docs app split deployment model — dev pod with auth gate vs static prod on GitHub Pages
type: project
---

# Docs App Deployment

The docs site (kordinate-docs) has a split deployment model:

## Dev Environment
- Runs as a Kubernetes pod in the `master` namespace (deployment: `docs`)
- Image: `10.43.43.113:5000/docs:latest` (built from the Dockerfile which runs `npm run dev`)
- Mounts `/kord` PVC, workingDir `/kord/projects/docs`
- Port 4321, Astro dev server with hot-reload
- **Auth gate**: Vite plugin (`vite-auth-plugin.ts`) requires password for all pages. Password from `DEV_PASSWORD` env var (default: "dev"). Sets httpOnly cookie `dev-auth` for 1 week.
- Readiness probe: `GET /dev/` on port 4321 — NOTE: the auth gate redirects unauthenticated requests to `/dev/login` (302), so the probe path or auth bypass needs consideration when deploying with auth enabled.

## Prod Environment
- Static site built with `npm run build`, deployed to GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)
- Triggered by push to `prod` branch
- Served at `docs.khaledkord.com` under `/dev` base path
- No auth, no server — pure static HTML
- The Vite auth plugin only runs during `npm run dev`, so it has zero effect on prod builds

## Key Details
- The Vite auth plugin runs at the Node/Vite level (before Astro routing) because Astro middleware can't read cookies/headers for prerendered Starlight pages in static mode
- Base path is `/dev` — Vite strips this, so the plugin matches paths like `/login` not `/dev/login`, but redirects use full paths like `/dev/login`
- `.env` is gitignored — password must be provided via env var or .env file on the PVC/pod
- `astro.config.mjs` imports the auth plugin; it's always loaded but only `configureServer` runs during dev
