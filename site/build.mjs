import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { fetchMergedEntries } from './lib/merged-prs.mjs';

const require = createRequire(import.meta.url);
const { parseProfile, validateProfile, profileFiles } = require('../.github/scripts/team-profiles.cjs');

const SITE_URL = (process.env.SITE_URL || 'https://callingsupportapp.org').replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(SITE_URL)) {
  console.error(`SITE_URL debe ser https://dominio, sin ruta: ${SITE_URL}`);
  process.exit(1);
}
const REPO = 'https://github.com/MarAntBQ/CallingSupportApp';
const RECAPTCHA_SITE_KEY = '6LdKguItAAAAAAVLfpo2INl4o6C3D8oia3h-hr6q';
const LOCALES = ['es', 'pt', 'en'];
const DEFAULT_LOCALE = 'es';
const PAGES = ['index', 'privacy', 'rules', 'manuals', 'updates', 'team', 'contact', 'developers', 'conduct', 'terms', 'security', 'status'];
const NAV = [
  { group: 'project', items: ['updates', 'status', 'team'] },
  { group: 'policies', items: ['privacy', 'rules', 'conduct', 'terms', 'security'] },
  { group: 'guides', items: ['manuals', 'developers'] },
  { page: 'contact' },
];
const MAIN_NAV = NAV.flatMap((n) => n.items || [n.page]);
const FOOTER_NAV = ['developers', 'conduct', 'terms', 'security', 'status'];
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

const MARKERS = ['<!-- roadmap -->', '<!-- contributors -->', '<!-- team-profiles -->', '<!-- updates -->', '<!-- manuals -->', '<!-- docs-index -->', '<!-- contact-form -->', '<!-- temple-photo -->'];

function safeHref(href) {
  const h = String(href).trim();
  if (/^(https?:\/\/|mailto:)/i.test(h)) return h;
  if (/^(\/(?!\/)|\.{1,2}\/|#|\?)/.test(h)) return h;
  return /^[^:/?#]+(?:[/?#]|$)/.test(h) && !/[\x00-\x1f]/.test(h) ? h : '#';
}

let renderLang = DEFAULT_LOCALE;
const md = new Marked({ gfm: true });
md.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = `${renderLang === DEFAULT_LOCALE ? '' : `${renderLang}-`}${slugify(text)}`;
      return depth >= 2 && depth <= 3
        ? `<h${depth} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="#">#</a></h${depth}>\n`
        : `<h${depth}>${text}</h${depth}>\n`;
    },
    checkbox({ checked }) {
      return `<input type="checkbox" disabled aria-hidden="true"${checked ? " checked" : ""}> `;
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

const pathFor = (page) => (page === 'index' ? '' : `${page}/`);
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

// ---------- novedades automáticas: una por cada PR mergeado a main
let autoUpdates = [];
try {
  const manualPrs = new Set(content[DEFAULT_LOCALE].updatesList.map((u) => u.data.pr).filter(Boolean));
  autoUpdates = (await fetchMergedEntries()).filter((e) => !manualPrs.has(e.url));
  console.log(`Novedades automáticas: ${autoUpdates.length} PR mergeado(s).`);
} catch (err) {
  console.warn(`AVISO: no se pudieron traer los PR de GitHub (${err.message}). Se publican solo las novedades escritas a mano.`);
}
const latestUpdate = [...content[DEFAULT_LOCALE].updatesList.map((u) => String(u.data.date)), ...autoUpdates.map((e) => e.date)]
  .sort()
  .at(-1);
if (latestUpdate) for (const l of LOCALES) content[l].updates.data.updated = latestUpdate;

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

// ---------- SEO: rangos de título y descripción (Google corta lo que se pasa)
const TITLE_MAX = 60;
const DESC_MIN = 150;
const DESC_MAX = 160;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const titleFor = (l, page, data) => {
  const full = `${norm(data.title)} · ${ui[l].titleSuffix}`;
  return page === 'index' || full.length > TITLE_MAX ? norm(data.title) : full;
};
for (const l of LOCALES) {
  const docs = [
    ...PAGES.map((p) => [p, `content/${l}/${p}.md`, content[l][p]]),
    ...content[l].manualsList.map((m) => ['manuals', `content/${l}/manuals/${m.slug}.md`, m]),
  ];
  for (const [page, label, doc] of docs) {
    if (!doc?.data?.title) continue;
    const t = titleFor(l, page, doc.data);
    const d = norm(doc.data.description);
    if (t.length > TITLE_MAX) fail(`${label}: el título mide ${t.length} caracteres (máximo ${TITLE_MAX})`);
    if (d.length < DESC_MIN || d.length > DESC_MAX) fail(`${label}: la descripción mide ${d.length} caracteres (debe medir entre ${DESC_MIN} y ${DESC_MAX})`);
  }
}

if (problems.length) {
  console.error(`El sitio no se generó:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

// ---------- bloques especiales del Markdown
const inLang = (l) => (l === DEFAULT_LOCALE ? '' : `${l}-`);

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

const liveBlock = (kind, l, group, link) =>
  `<div class="live panel" data-live="${kind}" aria-live="polite" aria-busy="true" ${Object.entries(ui[l][group])
    .map(([k, v]) => `data-${k}="${escapeHtml(v)}"`)
    .join(' ')}><p class="muted">${escapeHtml(ui[l][group].loading)}</p></div>
<p class="live__more"><a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui[l][group].all)}</a></p>`;

function updatesBlock(l) {
  const u = ui[l].updates;
  const days = new Map();
  const day = (date) => days.get(date) ?? days.set(date, { manual: [], auto: [] }).get(date);
  for (const m of content[l].updatesList) day(String(m.data.date)).manual.push(m);
  for (const a of autoUpdates) day(a.date).auto.push(a);
  if (!days.size) return `<p class="muted">${escapeHtml(u.empty)}</p>`;

  const manual = ({ slug, data, body }) => `<article class="update" id="${inLang(l)}${escapeHtml(slug)}">
  <h3>${escapeHtml(data.title)}</h3>
  <p class="update__for"><span class="pill">${escapeHtml(u.for)}: ${escapeHtml(data.audience)}</span></p>
  ${md.parse(body)}
  ${data.pr ? `<p><a href="${escapeHtml(data.pr)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u.pr)}</a></p>` : ''}
</article>`;
  const auto = (e) => {
    const lang = e.text[l] === e.text.es && l !== 'es' && !e.translated ? ' lang="es"' : '';
    return `<li class="change"><span${lang}>${escapeHtml(e.text[l])}</span> <a class="change__pr" href="${escapeHtml(e.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(u.pr)} #${e.number}">#${e.number}</a></li>`;
  };

  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(
      ([date, { manual: m, auto: a }]) => `<section class="update-day" aria-labelledby="${inLang(l)}d-${date}">
  <h2 class="update-day__date" id="${inLang(l)}d-${date}">${fmtDate(l, date)}</h2>
  ${m.map(manual).join('\n')}
  ${a.length ? `<ul class="changes">${a.map(auto).join('')}</ul>` : ''}
</section>`,
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
      ({ slug, data }) => `<a class="card-link" href="${root}${pathFor('manuals')}${slug}/">
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
    [...new Set([...MAIN_NAV, ...FOOTER_NAV])].map((p) => {
      const d = content[l][p].data;
      return `<a class="card-link" href="${root}${pathFor(p)}"><h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.description)}</p></a>`;
    }),
  );
}

const TEMPLE_PHOTO = {
  src: 'https://www.churchofjesuschrist.org/imgs/41239702d14611ecbf48eeeeac1e3d15a6d07055/full/500%2C/0/default',
  page: 'https://www.churchofjesuschrist.org/media/image/quito-ecuador-temple-4123970',
};
const CHURCH_LANG = { es: 'spa', pt: 'por', en: 'eng' };

function templePhotoBlock(l) {
  const t = ui[l].templePhoto;
  return `<figure class="photo">
  <img src="${TEMPLE_PHOTO.src}" alt="${escapeHtml(t.alt)}" width="500" height="334" loading="lazy" decoding="async" referrerpolicy="no-referrer">
  <figcaption>${escapeHtml(t.caption)} · <a href="${TEMPLE_PHOTO.page}?lang=${CHURCH_LANG[l]}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.credit)}<span class="ext" aria-hidden="true">↗</span></a></figcaption>
</figure>`;
}

function contactFormBlock(l) {
  const c = ui[l].contactForm;
  const id = (k) => `cf-${l}-${k}`;
  const msgs = Object.entries(c.errors)
    .map(([k, v]) => `data-msg-${k}="${escapeHtml(v)}"`)
    .join(' ');
  return `<form class="contact-form" data-contact data-lang="${l}" data-sitekey="${RECAPTCHA_SITE_KEY}" data-policy="${escapeHtml(content[l].privacy.data.updated)}" action="/api/contact.php" method="post" novalidate hidden data-msg-ok="${escapeHtml(c.ok)}" data-msg-sending="${escapeHtml(c.sending)}" ${msgs}>
  <div class="field"><label for="${id('name')}">${escapeHtml(c.name)}</label><input id="${id('name')}" name="name" type="text" required minlength="2" maxlength="100" autocomplete="name"></div>
  <div class="field"><label for="${id('email')}">${escapeHtml(c.email)}</label><input id="${id('email')}" name="email" type="email" required maxlength="254" autocomplete="email"></div>
  <div class="field"><label for="${id('message')}">${escapeHtml(c.message)}</label><textarea id="${id('message')}" name="message" rows="6" required minlength="10" maxlength="2000"></textarea><p class="field__hint" data-counter data-template="${escapeHtml(c.counter)}"></p></div>
  <p class="contact-form__warning">${escapeHtml(c.memberData)}</p>
  <div class="field field--trap" aria-hidden="true"><label for="${id('website')}">${escapeHtml(c.trap)}</label><input id="${id('website')}" name="website" type="text" tabindex="-1" autocomplete="off"></div>
  <p class="contact-form__notice">${escapeHtml(c.notice)} <a href="../privacy/">${escapeHtml(c.policy)}</a></p>
  <label class="check"><input name="consent" type="checkbox" required><span>${escapeHtml(c.consent)}</span></label>
  <button type="submit" class="button">${escapeHtml(c.send)}</button>
  <p class="contact-form__status" data-status role="status" aria-live="polite"></p>
  <p class="contact-form__recaptcha">${escapeHtml(c.recaptcha.before)} <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">${escapeHtml(c.recaptcha.privacy)}</a> ${escapeHtml(c.recaptcha.and)} <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">${escapeHtml(c.recaptcha.terms)}</a> ${escapeHtml(c.recaptcha.after)}</p>
</form>`;
}

function renderBody(l, rel, body, prefix = '') {
  renderLang = l;
  let html = prefix + md.parse(body);
  const blocks = {
    '<!-- roadmap -->': () => liveBlock('roadmap', l, 'roadmap', `${REPO}/milestones?state=all`),
    '<!-- contributors -->': () => liveBlock('contributors', l, 'contributors', `${REPO}/graphs/contributors`),
    '<!-- team-profiles -->': () => teamBlock(l),
    '<!-- updates -->': () => updatesBlock(l),
    '<!-- manuals -->': () => manualsBlock(l, rel),
    '<!-- docs-index -->': () => docsIndexBlock(l, rel),
    '<!-- contact-form -->': () => contactFormBlock(l),
    '<!-- temple-photo -->': () => templePhotoBlock(l),
  };
  for (const [mark, fn] of Object.entries(blocks)) if (html.includes(mark)) html = html.replace(mark, () => fn());
  renderLang = DEFAULT_LOCALE;
  return html;
}

// ---------- páginas: una URL por página, con los tres idiomas dentro
const layout = readFileSync(join(here, 'layout.html'), 'utf8');
const written = [];

const textIn = (get) => LOCALES.map((l) => `<span data-l="${l}" lang="${l}">${escapeHtml(get(l))}</span>`).join('');
const labelIn = (get) =>
  `aria-label="${escapeHtml(get(DEFAULT_LOCALE))}" ${LOCALES.map((l) => `data-aria-${l}="${escapeHtml(get(l))}"`).join(' ')}`;
const ldJson = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const CSATEAM = { '@type': 'Organization', name: 'CSATeam OpenSource (Calling Support App Team)', url: `${SITE_URL}/team/` };

function structuredData(page, rel, es) {
  const blocks = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'CallingSupportApp', url: `${SITE_URL}/`, inLanguage: LOCALES },
    {
      '@context': 'https://schema.org',
      ...CSATEAM,
      logo: `${SITE_URL}/assets/icon-512.png`,
      email: 'devteam@callingsupportapp.org',
      sameAs: [REPO],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'CallingSupportApp',
      description: norm(content[DEFAULT_LOCALE].index.data.description),
      codeRepository: REPO,
      license: 'https://opensource.org/licenses/MIT',
      programmingLanguage: 'TypeScript',
      author: CSATEAM,
    },
  ];
  if (page === 'manuals' && rel !== pathFor('manuals')) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: ui[DEFAULT_LOCALE].nav.index, item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: ui[DEFAULT_LOCALE].nav.manuals, item: `${SITE_URL}/${pathFor('manuals')}` },
        { '@type': 'ListItem', position: 3, name: norm(es.title), item: `${SITE_URL}/${rel}` },
      ],
    });
  }
  return blocks.map(ldJson).join('\n  ');
}


function assertNoLocalePaths(rel, html) {
  for (const [, href] of html.matchAll(/href="([^"]*)"/g)) {
    if (/^(https?:|mailto:|#|\/\/)/.test(href)) continue;
    if (href.split(/[/?#]/).some((seg) => LOCALES.includes(seg))) {
      console.error(`${rel || '/'}: enlace interno con prefijo de idioma (${href}). Cada página tiene una sola URL.`);
      process.exit(1);
    }
  }
}

function writePage({ page, rel, docs, root = rootFor(rel) }) {
  const navItem = (p) => `<li><a href="${root}${pathFor(p)}"${p === page ? ' aria-current="page"' : ''}>${textIn((l) => ui[l].nav[p])}</a></li>`;
  const es = docs[DEFAULT_LOCALE].data;
  const articles = LOCALES.map((l) => {
    const { data, body, prefix = '' } = docs[l];
    const updated = data.updated ? `<p class="doc__updated">${escapeHtml(ui[l].updated)}: ${fmtDate(l, data.updated)}</p>` : '';
    return `<article class="doc" data-l="${l}" lang="${l}">
      <header class="doc__header">
        <h1>${escapeHtml(data.title)}</h1>
        <p class="doc__lead">${escapeHtml(data.description)}</p>
        ${updated}
      </header>
      <div class="prose">
        ${renderBody(l, rel, body, prefix)}
      </div>
    </article>`;
  }).join('\n    ');
  const values = {
    root,
    'site.url': SITE_URL,
    'url.self': `${SITE_URL}/${rel}`,
    'page.fullTitle': escapeHtml(titleFor(DEFAULT_LOCALE, page, es)),
    'page.description': escapeHtml(norm(es.description)),
    ogLocale: escapeHtml(ui[DEFAULT_LOCALE].ogLocale),
    ogLocaleAlternates: LOCALES.filter((l) => l !== DEFAULT_LOCALE)
      .map((l) => `<meta property="og:locale:alternate" content="${escapeHtml(ui[l].ogLocale)}">`)
      .join('\n  '),
    ogImageAlt: escapeHtml(ui[DEFAULT_LOCALE].ogImageAlt),
    ogType: page === 'manuals' && rel !== pathFor('manuals') ? 'article' : 'website',
    jsonld: structuredData(page, rel, es),
    i18nAttrs: LOCALES.map(
      (l) => `data-title-${l}="${escapeHtml(titleFor(l, page, docs[l].data))}" data-desc-${l}="${escapeHtml(docs[l].data.description)}"`,
    ).join(' '),
    navDesktop: NAV.map((n) =>
      n.page
        ? navItem(n.page)
        : `<li class="nav__group"><details class="nav__drop"><summary${n.items.includes(page) ? ' class="is-current"' : ''}>${textIn((l) => ui[l].navGroups[n.group])}</summary><ul class="nav__sub">${n.items.map(navItem).join('')}</ul></details></li>`,
    ).join('\n            '),
    navMobile: NAV.map((n) =>
      n.page
        ? navItem(n.page)
        : `<li><span class="nav__heading" role="heading" aria-level="2">${textIn((l) => ui[l].navGroups[n.group])}</span><ul class="nav__sub">${n.items.map(navItem).join('')}</ul></li>`,
    ).join('\n            '),
    footerNav: FOOTER_NAV.map(navItem).join('\n        '),
    articles,
    'a.brand': labelIn((l) => `CallingSupportApp — ${ui[l].home}`),
    'a.menu': labelIn((l) => ui[l].menu),
    'a.language': labelIn((l) => ui[l].language),
    'a.githubFab': labelIn((l) => ui[l].githubFab),
    pageScripts: page === 'contact' ? `<script src="${root}assets/contact.js" defer></script>` : '',
    learnMore: LOCALES.map((l) => {
      const m = ui[l].learnMore;
      return `<p class="footer__learn" data-l="${l}" lang="${l}">${escapeHtml(m.text)} <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.link)}<span class="ext" aria-hidden="true">↗</span></a></p>`;
    }).join('\n      '),
    ...Object.fromEntries(Object.keys(uiFlat[DEFAULT_LOCALE]).map((k) => [`t.${k}`, textIn((l) => uiFlat[l][k])])),
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
  assertNoLocalePaths(rel, html);
  const final =
    page === '404'
      ? html
          .replace(/\n\s*<link rel="(canonical|alternate)"[^>]*>/g, '')
          .replace(/\n\s*<meta property="og:url"[^>]*>/, '')
          .replace('<meta name="description"', '<meta name="robots" content="noindex">\n  <meta name="description"')
      : html;
  mkdirSync(join(out, rel), { recursive: true });
  writeFileSync(join(out, rel, 'index.html'), final);
  written.push(rel);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const perLocale = (fn) => Object.fromEntries(LOCALES.map((l) => [l, fn(l)]));

for (const p of PAGES) writePage({ page: p, rel: pathFor(p), docs: perLocale((l) => content[l][p]) });

for (const { slug } of content[DEFAULT_LOCALE].manualsList) {
  const rel = `${pathFor('manuals')}${slug}/`;
  writePage({
    page: 'manuals',
    rel,
    docs: perLocale((l) => {
      const m = content[l].manualsList.find((x) => x.slug === slug);
      const back = `<p class="back"><a href="${rootFor(rel)}${pathFor('manuals')}">← ${escapeHtml(ui[l].manuals.back)}</a></p>\n`;
      return { data: m.data, body: m.body, prefix: back };
    }),
  });
}

// 404: el servidor la sirve en cualquier ruta, por eso usa rutas absolutas
writePage({
  page: '404',
  rel: '404/',
  root: '/',
  docs: perLocale((l) => ({
    data: { title: ui[l].notFound.title, description: ui[l].notFound.description },
    body: '',
    prefix: `<p><a href="/">${escapeHtml(ui[l].notFound.home)}</a></p>`,
  })),
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
const urls = written.map((rel) => `  <url>\n    <loc>${SITE_URL}/${rel}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`);
writeFileSync(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(
  `Sitio generado en _site/: ${written.length} páginas, cada una con ${LOCALES.join(', ')}; ${profiles.length} perfil(es), ${content.es.updatesList.length} novedad(es), ${content.es.manualsList.length} manual(es).`,
);
