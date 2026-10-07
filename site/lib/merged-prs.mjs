export const REPO = 'MarAntBQ/CallingSupportApp';
export const API = `https://api.github.com/repos/${REPO}`;
const LOCALES = ['es', 'pt', 'en'];
const SKIP = /^(ninguna|nenhuma|none)\.?$/i;
export const MAX_LENGTH = 280;
const PER_PAGE = 100;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH);

export const prUrl = (number) => `https://github.com/${REPO}/pull/${number}`;

export function prNumberFromUrl(url) {
  const match = String(url ?? '').trim().match(/\/pull\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

export function isDependencyPr(pr) {
  const login = String(pr.user?.login ?? '').toLowerCase();
  return (
    pr.user?.type === 'Bot' ||
    /dependabot|renovate/.test(login) ||
    (pr.labels ?? []).some((l) => String(l?.name ?? '').toLowerCase() === 'dependencies')
  );
}

function sectionLines(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const out = [];
  let found = false;
  let comment = false;
  let fence = false;
  for (const line of lines) {
    if (comment) {
      if (line.includes('-->')) comment = false;
      continue;
    }
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (/^\s*<!--/.test(line)) {
      if (!line.includes('-->')) comment = true;
      continue;
    }
    if (/^##[ \t]/.test(line)) {
      if (found) break;
      if (/^##[ \t]+Novedad[ \t]*$/.test(line)) found = true;
      continue;
    }
    if (found) out.push(line);
  }
  return found ? out : null;
}

export function parseNovedad(body) {
  const lines = sectionLines(body);
  if (lines === null) return null;
  const result = {};
  for (const line of lines) {
    const match = line.match(/^[ \t]*[-*][ \t]*(es|pt|en)[ \t]*:(.*)$/i);
    if (!match) continue;
    const value = clean(match[2]);
    if (value) result[match[1].toLowerCase()] = value;
  }
  return result;
}

export function toEntry(pr) {
  if (!pr.merged_at || isDependencyPr(pr) || !Number.isInteger(pr.number) || pr.number <= 0) return null;
  const novedad = parseNovedad(pr.body);
  if (novedad && LOCALES.some((l) => novedad[l] && SKIP.test(novedad[l]))) return null;
  const title = clean(String(pr.title ?? '').replace(/\s*\(#\d+\)\s*$/, ''));
  const text = Object.fromEntries(LOCALES.map((l) => [l, novedad?.[l] || novedad?.es || title]));
  if (!text.es) return null;
  return {
    number: pr.number,
    url: prUrl(pr.number),
    date: String(pr.merged_at).slice(0, 10),
    mergedAt: String(pr.merged_at),
    text,
    translated: Boolean(novedad && LOCALES.every((l) => novedad[l])),
  };
}

export async function fetchMergedEntries({
  fetchImpl = fetch,
  api = process.env.SITE_GITHUB_API || API,
  token = process.env.GITHUB_TOKEN,
  totalTimeoutMs = 30000,
  maxPages = 100,
} = {}) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'callingsupportapp-site' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const signal = AbortSignal.timeout(totalTimeoutMs);
  const prs = [];
  for (let page = 1; ; page += 1) {
    if (page > maxPages) throw new Error(`más de ${maxPages} páginas de PR cerrados`);
    const res = await fetchImpl(`${api}/pulls?state=closed&base=main&per_page=${PER_PAGE}&page=${page}`, { headers, signal });
    if (!res.ok) throw new Error(`GitHub respondió ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error('GitHub no devolvió una lista');
    prs.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return prs
    .map(toEntry)
    .filter(Boolean)
    .sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));
}
