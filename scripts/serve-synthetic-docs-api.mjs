#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const snapshotStoreRoot = process.env.SNAPSHOT_STORE_ROOT || process.env.AUGUR_OUTPUT_ROOT || '/kord/snapshot-store';
const port = Number(process.env.SYNTHETIC_DOCS_PORT || 4010);
const defaultUserId = process.env.DOCS_DEFAULT_USER || 'admin';
const accessConfig = parseAccessConfig(process.env.SNAPSHOT_ACCESS || '');

function parseAccessConfig(raw) {
  if (!raw.trim()) return {};
  return Object.fromEntries(raw.split(';').map((entry) => {
    const [user, repos] = entry.split(':');
    return [String(user || '').trim(), String(repos || '').split(',').map((repo) => repo.trim()).filter(Boolean)];
  }).filter(([user]) => user));
}

function userIdFromRequest(req) {
  const header = String(req.headers['x-user-id'] || '').trim();
  if (header) return header;
  const auth = String(req.headers.authorization || '').trim();
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim() || defaultUserId;
  return defaultUserId;
}

function canAccess(userId, project) {
  const allowed = accessConfig[userId] || accessConfig.default;
  if (!allowed || allowed.length === 0 || allowed.includes('*')) return true;
  return allowed.includes(project);
}

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

function listDirectories(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter((entry) => fs.statSync(path.join(dirPath, entry)).isDirectory());
}

function slugFromParts(owner, repo) {
  return owner && repo ? `${owner}--${repo}` : '';
}

function repoDirCandidates(project) {
  return [
    path.join(snapshotStoreRoot, project),
    path.join(snapshotStoreRoot, project.replace('--', '-')),
    path.join(snapshotStoreRoot, project.replace('--', '/')),
  ];
}

function findRepoDir(project) {
  return repoDirCandidates(project).find((candidate) => fs.existsSync(candidate)) || null;
}

function snapshotPath(repoDir, snapshotId) {
  return path.join(repoDir, snapshotId, 'snapshot.json');
}

function listSnapshotIds(repoDir) {
  return listDirectories(repoDir)
    .filter((snapshotId) => fs.existsSync(snapshotPath(repoDir, snapshotId)))
    .sort((left, right) => fs.statSync(snapshotPath(repoDir, right)).mtimeMs - fs.statSync(snapshotPath(repoDir, left)).mtimeMs);
}

function projectFromSnapshot(snapshot, fallbackDirName) {
  const project = String(snapshot?.project || '').trim();
  if (project.includes('/')) {
    const [owner, repo] = project.split('/');
    if (owner && repo) return slugFromParts(owner, repo);
  }
  return fallbackDirName.includes('--') ? fallbackDirName : fallbackDirName.replace(/-([^-]+)$/, '--$1');
}

function loadProjectRecord(project, userId = defaultUserId) {
  if (!canAccess(userId, project)) return null;
  const repoDir = findRepoDir(project);
  if (!repoDir) return null;
  const snapshotIds = listSnapshotIds(repoDir);
  if (snapshotIds.length === 0) return null;
  const latestSnapshot = readJson(snapshotPath(repoDir, snapshotIds[0]));
  return {
    project,
    repoDir,
    latestSnapshotId: snapshotIds[0],
    latestSnapshot,
  };
}

function listProjects(userId = defaultUserId) {
  if (!fs.existsSync(snapshotStoreRoot)) return [];
  const records = [];
  for (const dirName of listDirectories(snapshotStoreRoot).sort()) {
    const repoDir = path.join(snapshotStoreRoot, dirName);
    const snapshotIds = listSnapshotIds(repoDir);
    if (snapshotIds.length === 0) continue;
    const latestSnapshot = readJson(snapshotPath(repoDir, snapshotIds[0]));
    const project = projectFromSnapshot(latestSnapshot, dirName);
    if (canAccess(userId, project)) records.push({ project, repoDir, latestSnapshotId: snapshotIds[0], latestSnapshot });
  }
  return records.sort((left, right) => left.project.localeCompare(right.project));
}

function projectSummary(record) {
  return {
    slug: record.project,
    title: record.latestSnapshot?.project || record.project.replace('--', '/'),
    purpose: record.latestSnapshot?.purpose || record.latestSnapshot?.summary || '',
    componentCount: Array.isArray(record.latestSnapshot?.components) ? record.latestSnapshot.components.length : 0,
    currentSnapshotId: record.latestSnapshotId,
    currentSha: record.latestSnapshot?.sha || record.latestSnapshotId,
  };
}

function snapshotMeta(record, snapshotId) {
  const snapshot = readJson(snapshotPath(record.repoDir, snapshotId));
  return {
    project: record.project,
    snapshotId,
    sha: snapshot?.sha || snapshotId,
    generated: snapshot?.generated || '',
    purpose: snapshot?.purpose || '',
    summary: snapshot?.summary || '',
    componentCount: Array.isArray(snapshot?.components) ? snapshot.components.length : 0,
    flowCount: Array.isArray(snapshot?.flows) ? snapshot.flows.length : 0,
    concernCount: Array.isArray(snapshot?.concerns) ? snapshot.concerns.length : 0,
  };
}

function snapshotView(record, snapshotId) {
  const snapshot = readJson(snapshotPath(record.repoDir, snapshotId));
  return {
    project: record.project,
    snapshot_id: snapshotId,
    sha: snapshot?.sha || snapshotId,
    snapshot,
  };
}

function handleMe(req, res) {
  const userId = userIdFromRequest(req);
  sendJson(res, 200, {
    id: userId,
    repos: listProjects(userId).map((record) => record.project),
  });
}

function handleProjects(req, res) {
  sendJson(res, 200, listProjects(userIdFromRequest(req)).map(projectSummary));
}

function handleProject(req, res, project) {
  const record = loadProjectRecord(project, userIdFromRequest(req));
  if (!record) return sendJson(res, 404, { error: 'project_not_found' });
  sendJson(res, 200, projectSummary(record));
}

function handleProjectCurrent(req, res, project) {
  const record = loadProjectRecord(project, userIdFromRequest(req));
  if (!record) return sendJson(res, 404, { error: 'project_not_found' });
  sendJson(res, 200, snapshotView(record, record.latestSnapshotId));
}

function handleProjectSnapshots(req, res, project) {
  const record = loadProjectRecord(project, userIdFromRequest(req));
  if (!record) return sendJson(res, 404, { error: 'project_not_found' });
  sendJson(res, 200, listSnapshotIds(record.repoDir).map((snapshotId) => snapshotMeta(record, snapshotId)));
}

function handleProjectSnapshot(req, res, project, snapshotId) {
  const record = loadProjectRecord(project, userIdFromRequest(req));
  if (!record) return sendJson(res, 404, { error: 'project_not_found' });
  if (!fs.existsSync(snapshotPath(record.repoDir, snapshotId))) return sendJson(res, 404, { error: 'snapshot_not_found' });
  sendJson(res, 200, snapshotView(record, snapshotId));
}

const server = http.createServer((req, res) => {
  if (!req.url) return sendText(res, 400, 'missing url');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    if (req.method === 'GET' && parts.length === 1 && parts[0] === 'health') {
      return sendJson(res, 200, { ok: true, snapshotStoreRoot });
    }
    if (req.method === 'GET' && parts.length === 1 && parts[0] === 'me') {
      return handleMe(req, res);
    }
    if (req.method === 'GET' && parts.length === 1 && parts[0] === 'repos') {
      return handleProjects(req, res);
    }
    if (req.method === 'GET' && parts.length === 1 && parts[0] === 'projects') {
      return handleProjects(req, res);
    }
    if (req.method === 'GET' && parts[0] === 'projects' && parts.length >= 3) {
      const project = slugFromParts(parts[1], parts[2]);
      if (!project) return sendJson(res, 404, { error: 'project_not_found' });
      if (parts.length === 3) return handleProject(req, res, project);
      if (parts.length === 4 && parts[3] === 'current') return handleProjectCurrent(req, res, project);
      if (parts.length === 4 && parts[3] === 'snapshots') return handleProjectSnapshots(req, res, project);
      if (parts.length === 5 && parts[3] === 'snapshots') return handleProjectSnapshot(req, res, project, parts[4]);
    }
    return sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    return sendJson(res, 500, { error: 'internal_error', message: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, () => {
  console.log(`Snapshot docs API listening on http://127.0.0.1:${port}`);
  console.log(`Snapshot store root: ${snapshotStoreRoot}`);
});
