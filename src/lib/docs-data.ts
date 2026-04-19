const remoteBaseUrl = (import.meta.env.DOCS_DATA_BASE_URL || '').replace(/\/$/, '');

if (!remoteBaseUrl) {
  throw new Error('DOCS_DATA_BASE_URL is required. This repo now runs in remote-only docs data mode.');
}

export interface ProjectSummary {
  slug: string;
  title: string;
  purpose: string;
  componentCount: number;
  currentAnalysisId?: string;
  currentOverlayId?: string | null;
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

export function projectAtlasRoutePath(project: string) {
  return `${projectRoutePath(project)}atlas/`;
}

export function projectAtlasSubpageRoutePath(project: string, subpage: string) {
  return `${projectAtlasRoutePath(project)}${subpage}/`;
}

export function projectAnalysesRoutePath(project: string) {
  return `${projectRoutePath(project)}analyses/`;
}

export function projectAnalysisRoutePath(project: string, analysisId: string) {
  return `${projectAnalysesRoutePath(project)}${analysisId}/`;
}

export function projectAnalysisAtlasRoutePath(project: string, analysisId: string) {
  return `${projectAnalysisRoutePath(project, analysisId)}atlas/`;
}

export function projectAnalysisAtlasSubpageRoutePath(project: string, analysisId: string, subpage: string) {
  return `${projectAnalysisAtlasRoutePath(project, analysisId)}${subpage}/`;
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

export interface ProjectBundle {
  project: string;
  atlas: any;
  storyByNode: Record<string, string[]>;
  journeys: any[];
  storyMap: Record<string, any>;
  symbolIndex: Record<string, any>;
  analysisId?: string;
  overlayId?: string | null;
}

export interface AnalysisSummary {
  project: string;
  analysisId: string;
  requestId?: string;
  commitSha?: string;
  commitTime?: string;
  analyzedAt?: string;
  status?: string;
  repository?: {
    project?: string;
    commit?: string;
    commitTime?: string;
    fileCount?: number | null;
    filesReadCount?: number | null;
    repoTokensEst?: number | null;
  };
  agent?: {
    name?: string;
    specialization?: string;
    bundleMode?: string;
  };
  validation?: {
    passed?: boolean;
    attempts?: number;
  };
}

interface ProjectCurrentView {
  project: string;
  analysis_id?: string;
  overlay_id?: string | null;
  atlas?: any;
  stories?: any[];
  narratives?: any[] | { narratives?: any[] };
  symbols_seed?: any;
}

function deriveSymbolIndex(symbolsSeed: any) {
  const index: Record<string, any> = {};
  const files = Array.isArray(symbolsSeed?.files) ? symbolsSeed.files : [];
  for (const fileEntry of files) {
    const file = typeof fileEntry?.file === 'string' ? fileEntry.file : '';
    const language = typeof fileEntry?.language === 'string' ? fileEntry.language : '';
    const reasons = Array.isArray(fileEntry?.reasons) ? fileEntry.reasons.filter(Boolean) : [];
    const symbols = Array.isArray(fileEntry?.symbols) ? fileEntry.symbols : [];
    for (const symbol of symbols) {
      const name = typeof symbol?.name === 'string' ? symbol.name.trim() : '';
      if (!name) continue;
      const existing = index[name];
      if (existing) continue;
      index[name] = {
        name,
        kind: typeof symbol?.kind === 'string' ? symbol.kind : '',
        exported: Boolean(symbol?.exported),
        file,
        language,
        reasons,
      };
    }
  }
  return index;
}

function uniqueStrings(values: any[]) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function normalizeProjectSummary(item: any): ProjectSummary | null {
  const slug = item?.slug || item?.project;
  if (!slug || typeof slug !== 'string') return null;

  return {
    slug,
    title: displayProjectTitle(slug, item?.title || item?.project || slug),
    purpose: item?.purpose || '',
    componentCount: Number(item?.componentCount || item?.components || 0),
    currentAnalysisId: item?.current_analysis_id || item?.currentAnalysisId,
    currentOverlayId: item?.current_overlay_id ?? item?.currentOverlayId ?? null,
  };
}

function normalizeProjectList(payload: any): ProjectSummary[] {
  const rawItems = Array.isArray(payload) ? payload : payload?.projects;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map(normalizeProjectSummary)
    .filter((item): item is ProjectSummary => Boolean(item));
}

function normalizeNarratives(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.narratives)) return payload.narratives;
  return [];
}

function normalizeNarrativeStories(value: any): Array<{ id: string; description?: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry: any) => {
      if (typeof entry === 'string') return { id: entry };
      if (entry?.id && typeof entry.id === 'string') {
        return { id: entry.id, description: typeof entry.description === 'string' ? entry.description : '' };
      }
      return null;
    })
    .filter((entry): entry is { id: string; description?: string } => Boolean(entry));
}

function narrativesToJourneys(narratives: any[]) {
  return narratives.map((narrative: any) => {
    const entries = normalizeNarrativeStories(narrative?.stories);
    const stories = entries.map((entry) => entry.id);
    const bridges = entries
      .filter((entry, index) => index > 0 && entry.description)
      .map((entry) => ({ to: entry.id, text: entry.description }));

    return {
      id: narrative?.id || 'journey',
      title: narrative?.title || narrative?.id || 'Journey',
      description: narrative?.description || '',
      overview: narrative?.description || '',
      audience: Array.isArray(narrative?.audience) ? narrative.audience : [],
      stories,
      bridges,
    };
  });
}

function collectStoryNodeRefs(story: any, validNodeIds: Set<string>) {
  const refs = new Set<string>();
  const add = (value: any) => {
    if (typeof value === 'string' && validNodeIds.has(value)) refs.add(value);
  };

  for (const structure of story?.structures || []) {
    for (const node of structure?.nodes || []) add(typeof node === 'string' ? node : node?.id);
    for (const edge of structure?.edges || []) {
      add(edge?.from);
      add(edge?.to);
    }
  }

  for (const flow of story?.flows || []) {
    for (const step of flow?.steps || []) {
      add(step?.node);
      add(step?.to);
    }
  }

  for (const observation of story?.observations || []) add(observation?.component);

  return [...refs];
}

function deriveStoryByNode(atlas: any, stories: any[]) {
  const validNodeIds = new Set<string>([
    ...(atlas?.components || []).map((component: any) => component?.id),
    ...(atlas?.external_dependencies || []).map((dependency: any) => dependency?.id),
  ].filter(Boolean));

  const derived: Record<string, string[]> = {};
  for (const story of stories) {
    if (!story?.id) continue;
    for (const nodeId of collectStoryNodeRefs(story, validNodeIds)) {
      derived[nodeId] ||= [];
      derived[nodeId].push(story.id);
    }
  }

  return Object.fromEntries(
    Object.entries(derived).map(([nodeId, storyIds]) => [nodeId, uniqueStrings(storyIds)]),
  );
}

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchProjectCurrent(project: string): Promise<ProjectCurrentView> {
  return fetchJson(`${remoteBaseUrl}${projectApiPath(project)}/current`);
}

export async function getProjectIndex(): Promise<ProjectSummary[]> {
  const projects = await fetchJson(`${remoteBaseUrl}/projects`);
  return normalizeProjectList(projects);
}

export async function getProjectAtlas(project: string) {
  const current = await fetchProjectCurrent(project);
  return current?.atlas || {};
}

export async function getProjectBundle(project: string): Promise<ProjectBundle> {
  const current = await fetchProjectCurrent(project);
  const atlas = current?.atlas || {};
  const stories = Array.isArray(current?.stories) ? current.stories : [];
  const narratives = normalizeNarratives(current?.narratives);
  const journeys = narrativesToJourneys(narratives);
  const storyByNode = deriveStoryByNode(atlas, stories);
  const symbolIndex = deriveSymbolIndex(current?.symbols_seed);
  const storyMap = Object.fromEntries(
    stories
      .filter((story: any) => story?.id)
      .map((story: any) => [story.id, story]),
  );

  return {
    project,
    atlas,
    storyByNode,
    journeys,
    storyMap,
    symbolIndex,
    analysisId: current?.analysis_id,
    overlayId: current?.overlay_id ?? null,
  };
}

function normalizeAnalysisSummary(item: any): AnalysisSummary | null {
  const analysisId = item?.analysis_id || item?.analysisId;
  const project = item?.project;
  if (!analysisId || !project) return null;

  return {
    project,
    analysisId,
    requestId: item?.request_id || item?.requestId,
    commitSha: item?.commit_sha || item?.commitSha,
    commitTime: item?.commit_time || item?.commitTime,
    analyzedAt: item?.analyzed_at || item?.analyzedAt,
    status: item?.status,
    repository: item?.repository ? {
      project: item.repository?.project || '',
      commit: item.repository?.commit || '',
      commitTime: item.repository?.commit_time ?? item.repository?.commitTime ?? '',
      fileCount: item.repository?.file_count ?? item.repository?.fileCount ?? null,
      filesReadCount: item.repository?.files_read_count ?? item.repository?.filesReadCount ?? null,
      repoTokensEst: item.repository?.repo_tokens_est ?? item.repository?.repoTokensEst ?? null,
    } : undefined,
    agent: item?.agent ? {
      name: item.agent?.name || '',
      specialization: item.agent?.specialization || '',
      bundleMode: item.agent?.bundle_mode ?? item.agent?.bundleMode ?? '',
    } : undefined,
    validation: item?.validation ? {
      passed: item.validation?.passed,
      attempts: item.validation?.attempts,
    } : undefined,
  };
}

export async function getProjectAnalyses(project: string): Promise<AnalysisSummary[]> {
  const payload = await fetchJson(`${remoteBaseUrl}${projectApiPath(project)}/analyses`);
  const items = Array.isArray(payload) ? payload : payload?.analyses;
  if (!Array.isArray(items)) return [];

  return items
    .map(normalizeAnalysisSummary)
    .filter((item): item is AnalysisSummary => Boolean(item));
}

export async function getProjectAnalysisBundle(project: string, analysisId: string, overlayId?: string | null): Promise<ProjectBundle> {
  const url = new URL(`${remoteBaseUrl}${projectApiPath(project)}/analyses/${analysisId}/view`);
  if (overlayId) url.searchParams.set('overlayId', overlayId);
  const view = await fetchJson(url.toString());
  const atlas = view?.atlas || {};
  const stories = Array.isArray(view?.stories) ? view.stories : [];
  const narratives = normalizeNarratives(view?.narratives);
  const journeys = narrativesToJourneys(narratives);
  const storyByNode = deriveStoryByNode(atlas, stories);
  const symbolIndex = deriveSymbolIndex(view?.symbols_seed);
  const storyMap = Object.fromEntries(
    stories
      .filter((story: any) => story?.id)
      .map((story: any) => [story.id, story]),
  );

  return {
    project,
    atlas,
    storyByNode,
    journeys,
    storyMap,
    symbolIndex,
    analysisId: view?.analysis_id || analysisId,
    overlayId: view?.overlay_id ?? overlayId ?? null,
  };
}
