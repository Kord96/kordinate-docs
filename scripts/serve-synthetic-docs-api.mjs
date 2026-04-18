#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { resolveDocsStoreRoot } from './lib/docs-store-path.mjs';

const storeRoot = process.env.SYNTHETIC_DOCS_STORE || resolveDocsStoreRoot();
const augurApiBaseUrl = (process.env.AUGUR_API_BASE_URL || process.env.KORD_API_BASE_URL || 'http://127.0.0.1:9091').replace(/\/$/, '');
const kordApiKey = (process.env.KORD_API_KEY || process.env.KORD_API_KEYS || '').split(',').map((value) => value.trim()).find(Boolean) || '';
const sourceMode = process.env.DOCS_SOURCE_MODE || 'hybrid';
const port = Number(process.env.SYNTHETIC_DOCS_PORT || 4010);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function listDirectories(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter((entry) => fs.statSync(path.join(dirPath, entry)).isDirectory());
}

function projectRoot(project) {
  return path.join(storeRoot, 'projects', project);
}

function projectExists(project) {
  return fs.existsSync(projectRoot(project));
}

function analysisRoot(project, analysisId) {
  return path.join(projectRoot(project), 'analyses', analysisId);
}

function overlayRoot(project, overlayId) {
  return path.join(projectRoot(project), 'overlays', overlayId);
}

function loadStoryDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => readYaml(path.join(dirPath, name)));
}

function loadNarratives(filePath) {
  if (!fs.existsSync(filePath)) return { version: '1', narratives: [] };
  return readYaml(filePath);
}

function loadAnalysisMeta(project, analysisId) {
  return readJson(path.join(analysisRoot(project, analysisId), 'meta.json'));
}

function loadOverlayMeta(project, overlayId) {
  return readJson(path.join(overlayRoot(project, overlayId), 'meta.json'));
}

function loadCurrentPointer(project) {
  return readJson(path.join(projectRoot(project), 'published', 'current.json'));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function pathExists(filePath) {
  return fs.existsSync(filePath);
}

async function fetchJson(url) {
  const headers = { accept: 'application/json' };
  if (kordApiKey) headers['x-api-key'] = kordApiKey;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch ${url}: ${response.status} ${body}`);
  }
  return response.json();
}

async function listAugurProjects() {
  const payload = await fetchJson(`${augurApiBaseUrl}/augur/projects`);
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  return projects.sort((left, right) => String(left.project || '').localeCompare(String(right.project || '')));
}

async function loadAugurProject(project) {
  const projects = await listAugurProjects();
  return projects.find((item) => item?.project === project) || null;
}

async function loadAugurAnalysisList(project) {
  const payload = await fetchJson(`${augurApiBaseUrl}/augur/projects/${encodeURIComponent(project)}/analyses`);
  return Array.isArray(payload?.analyses) ? payload.analyses : [];
}

async function loadAugurRenderedView(project, analysisId) {
  const payload = await fetchJson(`${augurApiBaseUrl}/augur/projects/${encodeURIComponent(project)}/analyses/${encodeURIComponent(analysisId)}/base`);
  return {
    project,
    analysis_id: payload?.analysis_id || analysisId,
    overlay_id: null,
    atlas: payload?.atlas || {},
    stories: Array.isArray(payload?.stories) ? payload.stories : [],
    narratives: Array.isArray(payload?.narratives) ? payload.narratives : [],
    meta: payload?.meta || {},
  };
}

async function buildAugurProjectSummary(project) {
  const record = await loadAugurProject(project);
  if (!record) return null;
  const view = await loadAugurRenderedView(project, record.latest_analysis_id);
  return {
    slug: project,
    title: record.title || view.atlas?.project || project,
    purpose: record.purpose || view.atlas?.purpose || '',
    componentCount: Array.isArray(view.atlas?.components) ? view.atlas.components.length : 0,
    current_analysis_id: record.latest_analysis_id,
    current_overlay_id: null,
  };
}

function loadRenderedView(project, analysisId, overlayId = null) {
  const baseRoot = analysisRoot(project, analysisId);
  const atlas = readJson(path.join(baseRoot, 'atlas.json'));
  const baseStories = loadStoryDirectory(path.join(baseRoot, 'stories'));
  const baseStoryMap = Object.fromEntries(baseStories.filter((story) => story?.id).map((story) => [story.id, story]));
  const baseNarratives = loadNarratives(path.join(baseRoot, 'narratives.yaml'));

  let narratives = baseNarratives;
  if (overlayId) {
    const oRoot = overlayRoot(project, overlayId);
    for (const story of loadStoryDirectory(path.join(oRoot, 'stories'))) {
      if (story?.id) baseStoryMap[story.id] = story;
    }
    const overlayNarratives = path.join(oRoot, 'narratives.yaml');
    if (fs.existsSync(overlayNarratives)) narratives = loadNarratives(overlayNarratives);
  }

  return {
    project,
    analysis_id: analysisId,
    overlay_id: overlayId,
    atlas,
    stories: Object.values(baseStoryMap),
    narratives: narratives.narratives || [],
  };
}

function buildProjectSummary(project) {
  const current = loadCurrentPointer(project);
  const view = loadRenderedView(project, current.default_analysis_id, current.default_overlay_id || null);
  return {
    slug: project,
    title: view.atlas?.project || project,
    purpose: view.atlas?.purpose || '',
    componentCount: Array.isArray(view.atlas?.components) ? view.atlas.components.length : 0,
    current_analysis_id: current.default_analysis_id,
    current_overlay_id: current.default_overlay_id || null,
  };
}

async function listProjectSummaries() {
  const summaries = new Map();

  if (sourceMode !== 'store') {
    for (const project of await listAugurProjects()) {
      const summary = await buildAugurProjectSummary(project.project);
      if (summary) summaries.set(project.project, summary);
    }
  }

  if (sourceMode !== 'augur') {
    const projectsDir = path.join(storeRoot, 'projects');
    for (const project of listDirectories(projectsDir).sort()) {
      if (!summaries.has(project)) summaries.set(project, buildProjectSummary(project));
    }
  }

  return [...summaries.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

async function sourceForProject(project) {
  if (sourceMode !== 'store' && await loadAugurProject(project)) return 'augur';
  if (sourceMode !== 'augur' && projectExists(project)) return 'store';
  return null;
}

async function handleProjects(req, res) {
  sendJson(res, 200, await listProjectSummaries());
}

async function handleProject(req, res, project) {
  const source = await sourceForProject(project);
  if (!source) return sendJson(res, 404, { error: 'project_not_found' });
  sendJson(res, 200, source === 'augur' ? await buildAugurProjectSummary(project) : buildProjectSummary(project));
}

async function handleProjectCurrent(req, res, project) {
  const source = await sourceForProject(project);
  if (!source) return sendJson(res, 404, { error: 'project_not_found' });
  if (source === 'augur') {
    const record = await loadAugurProject(project);
    if (!record) return sendJson(res, 404, { error: 'project_not_found' });
    return sendJson(res, 200, await loadAugurRenderedView(project, record.latest_analysis_id));
  }
  const current = loadCurrentPointer(project);
  return sendJson(res, 200, loadRenderedView(project, current.default_analysis_id, current.default_overlay_id || null));
}

async function handleProjectAnalyses(req, res, project) {
  const source = await sourceForProject(project);
  if (!source) return sendJson(res, 404, { error: 'project_not_found' });
  if (source === 'augur') return sendJson(res, 200, await loadAugurAnalysisList(project));
  const analyses = listDirectories(path.join(projectRoot(project), 'analyses'))
    .sort()
    .reverse()
    .map((analysisId) => loadAnalysisMeta(project, analysisId));
  return sendJson(res, 200, analyses);
}

async function handleProjectAnalysis(req, res, project, analysisId) {
  const source = await sourceForProject(project);
  if (!source) return sendJson(res, 404, { error: 'project_not_found' });
  if (source === 'augur') {
    try {
      const payload = await fetchJson(`${augurApiBaseUrl}/augur/projects/${encodeURIComponent(project)}/analyses/${encodeURIComponent(analysisId)}`);
      return sendJson(res, 200, payload?.meta || payload);
    } catch {
      return sendJson(res, 404, { error: 'analysis_not_found' });
    }
  }
  if (!fs.existsSync(path.join(analysisRoot(project, analysisId), 'meta.json'))) {
    return sendJson(res, 404, { error: 'analysis_not_found' });
  }
  return sendJson(res, 200, loadAnalysisMeta(project, analysisId));
}

async function handleProjectAnalysisView(req, res, project, analysisId, url) {
  const source = await sourceForProject(project);
  if (!source) return sendJson(res, 404, { error: 'project_not_found' });
  if (source === 'augur') {
    try {
      return sendJson(res, 200, await loadAugurRenderedView(project, analysisId));
    } catch {
      return sendJson(res, 404, { error: 'analysis_not_found' });
    }
  }
  if (!fs.existsSync(path.join(analysisRoot(project, analysisId), 'meta.json'))) {
    return sendJson(res, 404, { error: 'analysis_not_found' });
  }
  const overlayId = url.searchParams.get('overlayId');
  return sendJson(res, 200, loadRenderedView(project, analysisId, overlayId));
}

function handleProjectOverlays(req, res, project) {
  if (!projectExists(project)) return sendJson(res, 200, []);
  const overlaysDir = path.join(projectRoot(project), 'overlays');
  const overlays = listDirectories(overlaysDir)
    .sort()
    .reverse()
    .map((overlayId) => loadOverlayMeta(project, overlayId));
  sendJson(res, 200, overlays);
}

function handleProjectOverlay(req, res, project, overlayId) {
  if (!fs.existsSync(path.join(overlayRoot(project, overlayId), 'meta.json'))) {
    return sendJson(res, 404, { error: 'overlay_not_found' });
  }
  sendJson(res, 200, loadOverlayMeta(project, overlayId));
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return sendText(res, 400, 'missing url');

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    if (req.method === 'GET' && parts.length === 1 && parts[0] === 'health') {
      return sendJson(res, 200, { ok: true, storeRoot });
    }
    if (req.method === 'GET' && parts.length === 1 && parts[0] === 'projects') {
      return await handleProjects(req, res);
    }
    if (req.method === 'GET' && parts.length === 2 && parts[0] === 'projects') {
      return await handleProject(req, res, parts[1]);
    }
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'projects' && parts[2] === 'current') {
      return await handleProjectCurrent(req, res, parts[1]);
    }
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'projects' && parts[2] === 'analyses') {
      return await handleProjectAnalyses(req, res, parts[1]);
    }
    if (req.method === 'GET' && parts.length === 4 && parts[0] === 'projects' && parts[2] === 'analyses') {
      return await handleProjectAnalysis(req, res, parts[1], parts[3]);
    }
    if (req.method === 'GET' && parts.length === 5 && parts[0] === 'projects' && parts[2] === 'analyses' && parts[4] === 'view') {
      return await handleProjectAnalysisView(req, res, parts[1], parts[3], url);
    }
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'projects' && parts[2] === 'overlays') {
      return handleProjectOverlays(req, res, parts[1]);
    }
    if (req.method === 'GET' && parts.length === 4 && parts[0] === 'projects' && parts[2] === 'overlays') {
      return handleProjectOverlay(req, res, parts[1], parts[3]);
    }
    return sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    return sendJson(res, 500, { error: 'internal_error', message: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, () => {
  console.log(`Synthetic docs API listening on http://127.0.0.1:${port}`);
  console.log(`Store root: ${storeRoot}`);
  console.log(`Augur API base URL: ${augurApiBaseUrl}`);
  console.log(`Source mode: ${sourceMode}`);
});
