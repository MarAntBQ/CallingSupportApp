import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', '..', '_site');
const LOCALES = ['es', 'pt', 'en'];
const TITLE_MAX = 60;
const DESC_MIN = 150;
const DESC_MAX = 160;

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = (html, name) => decode((html.match(new RegExp(`${name}="([^"]*)"`)) || [])[1] || '');
const count = (html, re) => (html.match(re) || []).length;

function pages(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'assets' ? [] : pages(p);
    return f === 'index.html' ? [p] : [];
  });
}

const problems = [];
const rows = [];
for (const file of pages(site).sort()) {
  const url = `/${relative(site, file).split(sep).join('/').replace(/index\.html$/, '')}`;
  const html = readFileSync(file, 'utf8');
  for (const l of LOCALES) {
    const t = attr(html, `data-title-${l}`);
    const d = attr(html, `data-desc-${l}`);
    const ok = t.length > 0 && t.length <= TITLE_MAX && d.length >= DESC_MIN && d.length <= DESC_MAX;
    rows.push(`${ok ? 'ok' : '!!'}  t=${String(t.length).padStart(2)}  d=${String(d.length).padStart(3)}  ${l}  ${url}`);
    if (!ok) problems.push(`${url} (${l}): título ${t.length}, descripción ${d.length}`);
  }
  for (const [label, re] of [
    ['canonical', /<link rel="canonical"/g],
    ['description', /<meta name="description"/g],
    ['og:url', /<meta property="og:url"/g],
    ['og:image', /<meta property="og:image"/g],
    ['<title>', /<title>/g],
  ]) {
    const n = count(html, re);
    if (n !== 1) problems.push(`${url}: ${label} aparece ${n} veces (debe ser 1)`);
  }
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(json);
    } catch (e) {
      problems.push(`${url}: JSON-LD inválido (${e.message})`);
    }
  }
  if (!html.includes('application/ld+json')) problems.push(`${url}: sin JSON-LD`);
}

console.log(rows.join('\n'));
console.log(`\n${rows.length} combinaciones página × idioma revisadas.`);
if (problems.length) {
  console.error(`\n${problems.length} problema(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('Sin problemas: títulos ≤ 60, descripciones 150–160, etiquetas únicas y JSON-LD válido.');
