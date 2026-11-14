const remoteBaseUrl = (import.meta.env.DOCS_DATA_BASE_URL || '').replace(/\/$/, '');
const docsUserId = import.meta.env.DOCS_USER_ID || '';
const docsAuthToken = import.meta.env.DOCS_AUTH_TOKEN || '';

if (!remoteBaseUrl) {
  throw new Error('DOCS_DATA_BASE_URL is required.');
}

export interface ProjectSummary {
  slug: string;
  title: string;
  purpose: string;
  componentCount: number;
  currentSnapshotId?: string;
  currentSha?: string;
}

export interface Viewer {
  id: string;
  repos: string[];
}

export interface SnapshotSummary {
  project: string;
  snapshotId: string;
  sha: string;
  generated?: string;
  purpose?: string;
  summary?: string;
  componentCount?: number;
  flowCount?: number;
  concernCount?: number;
}

export interface SnapshotView {
  project: string;
  snapshot_id: string;
  sha: string;
  snapshot: any;
}

export function splitProjectSlug(project: string) {
  const candidate = (project || '').trim();
  const parts = candidate.split('--');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }
  return { owner: '', repo: candidate };
}

export function slugFromRouteParts(owner?: string | null, repo?: string | null) {
  if (owner && repo) return `${owner}--${repo}`;
  return repo || owner || '';
}

export function projectRoutePath(project: string) {
  const { owner, repo } = splitProjectSlug(project);
  if (owner && repo) return `/${owner}/${repo}/`;
  return `/${project}/`;
}

export function projectApiPath(project: string) {
  const { owner, repo } = splitProjectSlug(project);
  if (owner && repo) return `/projects/${owner}/${repo}`;
  return `/projects/${project}`;
}

export function projectSnapshotsRoutePath(project: string) {
  return `${projectRoutePath(project)}snapshots/`;
}

export function projectSnapshotRoutePath(project: string, snapshotId: string) {
  return `${projectSnapshotsRoutePath(project)}${snapshotId}/`;
}

export function displayProjectTitle(project: string, title?: string | null) {
  const candidate = (title || project || '').trim();
  if (!candidate) return project;
  if (candidate === project) {
    const parts = project.split('--');
    if (parts.length === 2 && parts[0] && parts[1]) return `${parts[0]}/${parts[1]}`;
  }
  return candidate;
}

export function splitDisplayProjectTitle(project: string, title?: string | null) {
  const display = displayProjectTitle(project, title);
  const parts = display.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1], display };
  }
  return { owner: '', repo: display, display };
}

async function fetchJson(url: string) {
  const headers: Record<string, string> = {};
  if (docsUserId) headers['x-user-id'] = docsUserId;
  if (docsAuthToken) headers.authorization = `Bearer ${docsAuthToken}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function getViewer(): Promise<Viewer> {
  return fetchJson(`${remoteBaseUrl}/me`);
}

function normalizeProjectSummary(item: any): ProjectSummary | null {
  const slug = item?.slug || item?.project;
  if (!slug || typeof slug !== 'string') return null;
  return {
    slug,
    title: displayProjectTitle(slug, item?.title || item?.project || slug),
    purpose: item?.purpose || '',
    componentCount: Number(item?.componentCount || item?.components || 0),
    currentSnapshotId: item?.currentSnapshotId || item?.current_snapshot_id,
    currentSha: item?.currentSha || item?.current_sha,
  };
}

export async function getProjectIndex(): Promise<ProjectSummary[]> {
  const payload = await fetchJson(`${remoteBaseUrl}/projects`);
  const items = Array.isArray(payload) ? payload : payload?.projects;
  if (!Array.isArray(items)) return [];
  return items.map(normalizeProjectSummary).filter((item): item is ProjectSummary => Boolean(item));
}

export async function getCurrentSnapshot(project: string): Promise<SnapshotView> {
  return fetchJson(`${remoteBaseUrl}${projectApiPath(project)}/current`);
}

export async function getSnapshot(project: string, snapshotId: string): Promise<SnapshotView> {
  return fetchJson(`${remoteBaseUrl}${projectApiPath(project)}/snapshots/${snapshotId}`);
}

export async function getProjectSnapshots(project: string): Promise<SnapshotSummary[]> {
  const payload = await fetchJson(`${remoteBaseUrl}${projectApiPath(project)}/snapshots`);
  return Array.isArray(payload) ? payload : payload?.snapshots || [];
}

export function basisFileRefs(basis: any): string[] {
  const files = Array.isArray(basis?.files) ? basis.files : [];
  return files
    .map((entry: any) => {
      const filePath = String(entry?.path || '').trim();
      if (!filePath) return '';
      if (entry?.start_line != null && entry?.end_line != null) return `${filePath}:${entry.start_line}-${entry.end_line}`;
      return filePath;
    })
    .filter(Boolean);
}

export function entityRefs(basis: any, keys: string[]): string[] {
  const entities = basis?.entities || {};
  return keys.flatMap((key) => Array.isArray(entities[key]) ? entities[key] : []).filter(Boolean);
}
