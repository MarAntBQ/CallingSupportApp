import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const require = createRequire(import.meta.url);
const { parseProfile, validateProfile, profileFiles } = require('../.github/scripts/team-profiles.cjs');

const SITE_URL = (process.env.SITE_URL || 'https://callingsupportapp.org').replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(SITE_URL)) {
  console.error(`SITE_URL debe ser https://dominio, sin ruta: ${SITE_URL}`);
  process.exit(1);
}
const REPO = 'https://github.com/MarAntBQ/CallingSupportApp';
const LOCALES = ['es', 'pt', 'en'];
const DEFAULT_LOCALE = 'es';
const PAGES = ['index', 'privacy', 'rules', 'manuals', 'updates', 'team', 'contact', 'conduct', 'terms', 'security', 'status'];
const MAIN_NAV = ['privacy', 'rules', 'manuals', 'updates', 'team', 'contact'];
const FOOTER_NAV = ['conduct', 'terms', 'security', 'status'];
const INTL = { es: 'es', pt: 'pt-BR', en: 'en-US' };

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const out = join(repoRoot, '_site');
const problems = [];
const fail = (msg) => problems.push(msg);

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function flatten(obj, prefix = '', acc = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, acc);
    else acc[key] = String(v);
  }
  return acc;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const MARKERS = ['<!-- roadmap -->', '<!-- contributors -->', '<!-- team-profiles -->', '<!-- updates -->', '<!-- manuals -->', '<!-- docs-index -->'];

function safeHref(href) {
  const h = String(href).trim();
  if (/^(https?:\/\/|mailto:)/i.test(h)) return h;
  if (/^(\/(?!\/)|\.{1,2}\/|#|\?)/.test(h)) return h;
  return /^[^:/?#]+(?:[/?#]|$)/.test(h) && !/[\x00-\x1f]/.test(h) ? h : '#';
}

const md = new Marked({ gfm: true });
md.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slugify(text);
      return depth >= 2 && depth <= 3
        ? `<h${depth} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="#">#</a></h${depth}>\n`
        : `<h${depth}>${text}</h${depth}>\n`;
    },
    html({ text }) {
      return MARKERS.includes(text.trim()) ? `${text.trim()}\n` : escapeHtml(text);
    },
    image({ href, title, text }) {
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(safeHref(href))}" alt="${escapeHtml(text)}"${t} loading="lazy">`;
    },
    link({ href: rawHref, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const href = safeHref(rawHref);
      const external = /^https?:\/\//.test(href) && !href.startsWith(SITE_URL);
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return external
        ? `<a href="${escapeHtml(href)}"${t} target="_blank" rel="noopener noreferrer">${text}<span class="ext" aria-hidden="true">↗</span></a>`
        : `<a href="${escapeHtml(href)}"${t}>${text}</a>`;
    },
  },
});

const pathFor = (locale, page) => {
  const base = locale === DEFAULT_LOCALE ? '' : `${locale}/`;
  return page === 'index' ? base : `${base}${page}/`;
};
const rootFor = (rel) => '../'.repeat(rel.split('/').filter(Boolean).length);
const fmtDate = (locale, iso) =>
  new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

// ---------- textos de interfaz
const ui = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(readFileSync(join(here, 'i18n', `${l}.json`), 'utf8'))]));
const uiFlat = Object.fromEntries(LOCALES.map((l) => [l, flatten(ui[l])]));
const uiKeys = new Set(LOCALES.flatMap((l) => Object.keys(uiFlat[l])));
for (const l of LOCALES) for (const k of uiKeys) if (!(k in uiFlat[l])) fail(`i18n/${l}.json: falta "${k}"`);

// ---------- contenido
function readDoc(file, label, required) {
  try {
    const doc = parseProfile(readFileSync(file, 'utf8'));
    for (const k of required) if (!doc.data[k]) fail(`${label}: falta "${k}"`);
    for (const k of ['updated', 'date']) if (doc.data[k] && !/^\d{4}-\d{2}-\d{2}$/.test(doc.data[k])) fail(`${label}: "${k}" debe ser AAAA-MM-DD`);
    return doc;
  } catch (e) {
    fail(`${label}: ${e.message}`);
    return { data: {}, body: '' };
  }
}

function loadCollection(locale, folder, required) {
  const dir = join(here, 'content', locale, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ slug: f.replace(/\.md$/, ''), ...readDoc(join(dir, f), `content/${locale}/${folder}/${f}`, required) }));
}

const content = {};
for (const l of LOCALES) {
  content[l] = {};
  for (const p of PAGES) {
    const file = join(here, 'content', l, `${p}.md`);
    if (!existsSync(file)) fail(`falta content/${l}/${p}.md`);
    else content[l][p] = readDoc(file, `content/${l}/${p}.md`, ['title', 'description', 'updated']);
  }
  content[l].updatesList = loadCollection(l, 'updates', ['title', 'description', 'date', 'audience']).sort((a, b) =>
    String(b.data.date).localeCompare(String(a.data.date)),
  );
  content[l].manualsList = loadCollection(l, 'manuals', ['title', 'description', 'order', 'updated']).sort(
    (a, b) => Number(a.data.order) - Number(b.data.order),
  );
}
for (const [coll, folder] of [['updatesList', 'updates'], ['manualsList', 'manuals']]) {
  const all = new Set(LOCALES.flatMap((l) => content[l][coll].map((x) => x.slug)));
  for (const l of LOCALES) {
    const have = new Set(content[l][coll].map((x) => x.slug));
    for (const s of all) if (!have.has(s)) fail(`falta content/${l}/${folder}/${s}.md`);
  }
}

// ---------- perfiles del equipo
const teamDir = join(repoRoot, 'team');
const profiles = existsSync(teamDir)
  ? profileFiles(teamDir)
      .map((f) => {
        const text = readFileSync(f, 'utf8');
        const errors = validateProfile(f, text);
        if (errors.length) fail(`team/${f.split(/[\\/]/).pop()}: ${errors.join('; ')}`);
        return parseProfile(text);
      })
      .sort((a, b) => String(a.data.name).localeCompare(String(b.data.name), 'es'))
  : [];

if (problems.length) {
  console.error(`El sitio no se generó:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

// ---------- bloques especiales del Markdown
function teamBlock(l) {
  const t = ui[l].team;
  if (!profiles.length) return `<p class="muted">${escapeHtml(t.empty)}</p>`;
  return `<div class="profiles">${profiles
    .map(({ data, body }) => {
      const gh = escapeHtml(data.github);
      const meta = [
        data.country ? escapeHtml(data.country) : '',
        data.languages?.length ? `${escapeHtml(t.languages)}: ${data.languages.map((x) => escapeHtml(x.toUpperCase())).join(', ')}` : '',
        data.since ? `${escapeHtml(t.since)} ${escapeHtml(data.since)}` : '',
      ].filter(Boolean);
      const links = [`<a href="https://github.com/${gh}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.profile)}</a>`].concat(
        (data.links || []).map((u) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u.replace(/^https:\/\//, ''))}</a>`),
      );
      return `<article class="profile">
  <img src="https://github.com/${gh}.png?size=112" alt="" width="56" height="56" loading="lazy">
  <div>
    <h3>${escapeHtml(data.name)}</h3>
    <p class="profile__meta">@${gh}${meta.length ? ` · ${meta.join(' · ')}` : ''}</p>
    <div class="profile__body">${md.parse(body)}</div>
    <p class="profile__links">${links.join(' · ')}</p>
  </div>
</article>`;
    })
    .join('\n')}</div>`;
}

const liveBlock = (id, l, group, link) =>
  `<div id="${id}" class="live panel" aria-live="polite" aria-busy="true" ${Object.entries(ui[l][group])
    .map(([k, v]) => `data-${k}="${escapeHtml(v)}"`)
    .join(' ')}><p class="muted">${escapeHtml(ui[l][group].loading)}</p></div>
<p class="live__more"><a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui[l][group].all)}</a></p>`;

function updatesBlock(l) {
  const u = ui[l].updates;
  return content[l].updatesList
    .map(
      ({ data, body }) => `<article class="update" id="${escapeHtml(data.date)}">
  <p class="update__date">${fmtDate(l, data.date)}</p>
  <h2>${escapeHtml(data.title)}</h2>
  <p class="update__for"><span class="pill">${escapeHtml(u.for)}: ${escapeHtml(data.audience)}</span></p>
  ${md.parse(body)}
  ${data.pr ? `<p><a href="${escapeHtml(data.pr)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u.pr)}</a></p>` : ''}
</article>`,
    )
    .join('\n');
}

function cards(items) {
  return `<div class="cards">${items.join('\n')}</div>`;
}

function manualsBlock(l, rel) {
  const root = rootFor(rel);
  return cards(
    content[l].manualsList.map(
      ({ slug, data }) => `<a class="card-link" href="${root}${pathFor(l, 'manuals')}${slug}/">
  <h3>${escapeHtml(data.title)}</h3>
  <p>${escapeHtml(data.description)}</p>
  <span class="card-link__go">${escapeHtml(ui[l].manuals.open)} →</span>
</a>`,
    ),
  );
}

function docsIndexBlock(l, rel) {
  const root = rootFor(rel);
  return cards(
    [...MAIN_NAV, ...FOOTER_NAV].map((p) => {
      const d = content[l][p].data;
      return `<a class="card-link" href="${root}${pathFor(l, p)}"><h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.description)}</p></a>`;
    }),
  );
}

function renderBody(l, rel, body, prefix = '') {
  let html = prefix + md.parse(body);
  const blocks = {
    '<!-- roadmap -->': () => liveBlock('roadmap-list', l, 'roadmap', `${REPO}/milestones?state=all`),
    '<!-- contributors -->': () => liveBlock('contributors-list', l, 'contributors', `${REPO}/graphs/contributors`),
    '<!-- team-profiles -->': () => teamBlock(l),
    '<!-- updates -->': () => updatesBlock(l),
    '<!-- manuals -->': () => manualsBlock(l, rel),
    '<!-- docs-index -->': () => docsIndexBlock(l, rel),
  };
  for (const [mark, fn] of Object.entries(blocks)) if (html.includes(mark)) html = html.replace(mark, () => fn());
  return html;
}

// ---------- páginas
const layout = readFileSync(join(here, 'layout.html'), 'utf8');
const written = [];

function writePage({ l, page, rel, data, body, alt, prefix = '', root = rootFor(rel) }) {
  const navItem = (p) => `<li><a href="${root}${pathFor(l, p)}"${p === page ? ' aria-current="page"' : ''}>${escapeHtml(ui[l].nav[p])}</a></li>`;
  const values = {
    lang: l,
    root,
    langPath: pathFor(l, 'index'),
    'site.url': SITE_URL,
    'page.title': escapeHtml(data.title),
    'page.fullTitle': escapeHtml(page === 'index' && rel === pathFor(l, 'index') ? data.title : `${data.title} · ${ui[l].titleSuffix}`),
    'page.description': escapeHtml(data.description),
    'page.updatedLine': data.updated ? `<p class="doc__updated">${escapeHtml(ui[l].updated)}: ${fmtDate(l, data.updated)}</p>` : '',
    nav: MAIN_NAV.map(navItem).join('\n            '),
    footerNav: FOOTER_NAV.map(navItem).join('\n        '),
    content: renderBody(l, rel, body, prefix),
    'url.self': `${SITE_URL}/${rel}`,
    ...Object.fromEntries(LOCALES.map((x) => [`url.${x}`, `${SITE_URL}/${alt(x)}`])),
    ...Object.fromEntries(LOCALES.map((x) => [`switch.${x}`, `${root}${alt(x)}` || './'])),
    ...Object.fromEntries(LOCALES.map((x) => [`current.${x}`, x === l ? 'aria-current="true"' : ''])),
    ...Object.fromEntries(Object.entries(uiFlat[l]).map(([k, v]) => [`ui.${k}`, escapeHtml(v)])),
  };
  const missing = new Set();
  const html = layout.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    if (key in values) return values[key];
    missing.add(key);
    return '';
  });
  if (missing.size) {
    console.error(`layout.html usa claves que no existen (${rel || '/'}): ${[...missing].join(', ')}`);
    process.exit(1);
  }
  mkdirSync(join(out, rel), { recursive: true });
  writeFileSync(join(out, rel, 'index.html'), html);
  written.push({ rel, alt });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const l of LOCALES) {
  for (const p of PAGES) {
    const { data, body } = content[l][p];
    writePage({ l, page: p, rel: pathFor(l, p), data, body, alt: (x) => pathFor(x, p) });
  }
  for (const m of content[l].manualsList) {
    const rel = `${pathFor(l, 'manuals')}${m.slug}/`;
    const back = `<p class="back"><a href="${rootFor(rel)}${pathFor(l, 'manuals')}">← ${escapeHtml(ui[l].manuals.back)}</a></p>\n`;
    writePage({ l, page: 'manuals', rel, data: m.data, body: m.body, prefix: back, alt: (x) => `${pathFor(x, 'manuals')}${m.slug}/` });
  }
}

// 404: una sola página (el servidor no sabe el idioma), con los tres idiomas y rutas absolutas
writePage({
  l: DEFAULT_LOCALE,
  page: '404',
  rel: '404/',
  root: '/',
  data: { title: ui[DEFAULT_LOCALE].notFound.title, description: ui[DEFAULT_LOCALE].notFound.description },
  body: '',
  prefix: LOCALES.map((x) => {
    const n = ui[x].notFound;
    const head = x === DEFAULT_LOCALE ? '' : `<strong>${escapeHtml(n.title)}.</strong> `;
    return `<p lang="${x}">${head}${escapeHtml(n.description)} <a href="/${pathFor(x, 'index')}">${escapeHtml(n.home)}</a></p>`;
  }).join('\n'),
  alt: (x) => pathFor(x, 'index'),
});
cpSync(join(out, '404', 'index.html'), join(out, '404.html'));
rmSync(join(out, '404'), { recursive: true });
written.pop();

// ---------- estáticos
cpSync(join(here, 'assets'), join(out, 'assets'), { recursive: true });
const fontsOut = join(out, 'assets', 'fonts');
mkdirSync(fontsOut, { recursive: true });
for (const [pkg, files] of [
  ['@fontsource-variable/inter', ['inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2']],
  ['@fontsource/source-serif-4', ['source-serif-4-latin-400-normal.woff2', 'source-serif-4-latin-ext-400-normal.woff2']],
]) {
  const base = join(here, 'node_modules', pkg);
  for (const f of files) cpSync(join(base, 'files', f), join(fontsOut, f));
  cpSync(join(base, 'LICENSE'), join(fontsOut, `LICENSE-${pkg.split('/')[1]}.txt`));
}
writeFileSync(
  join(out, 'assets', 'site.webmanifest'),
  `${JSON.stringify(
    {
      name: 'CallingSupportApp',
      short_name: 'CallingSupport',
      icons: [192, 512].map((s) => ({ src: `icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' })),
      theme_color: '#f6f5f4',
      background_color: '#f6f5f4',
      display: 'browser',
    },
    null,
    2,
  )}\n`,
);
if (existsSync(join(here, 'static'))) cpSync(join(here, 'static'), out, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const seen = new Set();
const urls = [];
for (const p of written) {
  const key = p.alt('es');
  if (seen.has(key)) continue;
  seen.add(key);
  const alts = LOCALES.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${SITE_URL}/${p.alt(x)}"/>`).join('\n');
  for (const x of LOCALES) urls.push(`  <url>\n    <loc>${SITE_URL}/${p.alt(x)}</loc>\n    <lastmod>${today}</lastmod>\n${alts}\n  </url>`);
}
writeFileSync(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(
  `Sitio generado en _site/: ${written.length} páginas (${LOCALES.join(', ')}), ${profiles.length} perfil(es), ${content.es.updatesList.length} novedad(es), ${content.es.manualsList.length} manual(es).`,
);
