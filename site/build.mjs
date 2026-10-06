import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://callingsupportapp.marantbq.dev';
const LOCALES = ['es', 'pt', 'en'];
const DEFAULT_LOCALE = 'es';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '_site');

const pathFor = (locale) => (locale === DEFAULT_LOCALE ? '' : `${locale}/`);
const absoluteUrl = (locale) => `${SITE_URL}/${pathFor(locale)}`;

function flatten(obj, prefix = '', acc = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, path, acc);
    else acc[path] = String(value);
  }
  return acc;
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dictionaries = Object.fromEntries(
  LOCALES.map((l) => [l, flatten(JSON.parse(readFileSync(join(here, 'i18n', `${l}.json`), 'utf8')))]),
);

const allKeys = new Set(LOCALES.flatMap((l) => Object.keys(dictionaries[l])));
const problems = [];
for (const l of LOCALES) {
  for (const k of allKeys) if (!(k in dictionaries[l])) problems.push(`${l}: falta "${k}"`);
}
if (problems.length) {
  console.error(`Claves de idioma incompletas:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const template = readFileSync(join(here, 'template.html'), 'utf8');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const locale of LOCALES) {
  const root = locale === DEFAULT_LOCALE ? '' : '../';
  const values = {
    ...Object.fromEntries(Object.entries(dictionaries[locale]).map(([k, v]) => [k, escapeHtml(v)])),
    lang: locale,
    root,
    langPath: pathFor(locale),
    'url.self': absoluteUrl(locale),
    ...Object.fromEntries(LOCALES.map((l) => [`url.${l}`, absoluteUrl(l)])),
    ...Object.fromEntries(LOCALES.map((l) => [`switch.${l}`, `${root}${pathFor(l)}` || './'])),
    ...Object.fromEntries(LOCALES.map((l) => [`current.${l}`, l === locale ? 'aria-current="true"' : ''])),
  };

  const missing = new Set();
  const html = template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    if (key in values) return values[key];
    missing.add(key);
    return '';
  });
  if (missing.size) {
    console.error(`La plantilla usa claves que no existen (${locale}): ${[...missing].join(', ')}`);
    process.exit(1);
  }

  const dir = join(out, pathFor(locale));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

cpSync(join(here, 'assets'), join(out, 'assets'), { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const links = LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${absoluteUrl(l)}"/>`).join('\n');
writeFileSync(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LOCALES.map((l) => `  <url>\n    <loc>${absoluteUrl(l)}</loc>\n    <lastmod>${today}</lastmod>\n${links}\n  </url>`).join('\n')}
</urlset>
`,
);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
writeFileSync(join(out, '.nojekyll'), '');

if (!existsSync(join(out, 'index.html'))) process.exit(1);
console.log(`Sitio generado en _site/ (${LOCALES.join(', ')}), ${allKeys.size} claves por idioma.`);
