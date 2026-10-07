export const API = 'https://api.github.com/repos/MarAntBQ/CallingSupportApp';
const LOCALES = ['es', 'pt', 'en'];
const SKIP = /^(ninguna|nenhuma|none)\.?$/i;
const MAX_LENGTH = 280;

export function isDependencyPr(pr) {
  return pr.user?.type === 'Bot' || /dependabot/i.test(pr.user?.login ?? '') || (pr.labels ?? []).some((l) => l.name === 'dependencies');
}

function section(body) {
  const text = String(body ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '');
  const match = text.match(/^##[ \t]+Novedad[ \t]*\n([\s\S]*?)(?=^##[ \t]|(?![\s\S]))/m);
  return match ? match[1] : null;
}

export function parseNovedad(body) {
  const block = section(body);
  if (block === null) return null;
  const lines = {};
  for (const [, locale, value] of block.matchAll(/^[ \t]*[-*][ \t]*(es|pt|en)[ \t]*:[ \t]*(.*)$/gim)) {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (clean) lines[locale.toLowerCase()] = clean.slice(0, MAX_LENGTH);
  }
  return lines;
}

export function toEntry(pr) {
  if (!pr.merged_at || isDependencyPr(pr)) return null;
  const novedad = parseNovedad(pr.body);
  const title = String(pr.title).replace(/\s*\(#\d+\)\s*$/, '').trim();
  if (novedad && LOCALES.some((l) => novedad[l] && SKIP.test(novedad[l]))) return null;
  const text = Object.fromEntries(LOCALES.map((l) => [l, novedad?.[l] || novedad?.es || title]));
  return {
    number: pr.number,
    url: pr.html_url,
    date: pr.merged_at.slice(0, 10),
    mergedAt: pr.merged_at,
    text,
    translated: Boolean(novedad && LOCALES.every((l) => novedad[l])),
  };
}

export async function fetchMergedEntries({
  fetchImpl = fetch,
  api = process.env.SITE_GITHUB_API || API,
  token = process.env.GITHUB_TOKEN,
  maxPages = 10,
  timeoutMs = 15000,
} = {}) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'callingsupportapp-site' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const prs = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetchImpl(`${api}/pulls?state=closed&base=main&per_page=100&page=${page}`, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`GitHub respondió ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error('GitHub no devolvió una lista');
    prs.push(...batch);
    if (batch.length < 100) break;
  }
  return prs
    .map(toEntry)
    .filter(Boolean)
    .sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));
}
