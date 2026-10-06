const fs = require('node:fs');
const path = require('node:path');

const MAX_BODY = 600;
const BANNED_TITLES = /\b(l[ií]der|lider|leader|fundador|fundadora|founder|creador|creadora|criador|criadora|creator|jefe|jefa|chefe|boss)\b/i;
const SENSITIVE = [
  { name: 'teléfono', re: /\+?\d[\d\s().-]{7,}\d/ },
  { name: 'correo', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
];
const LOCALES = ['es', 'pt', 'en'];

function parseProfile(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('falta el frontmatter entre líneas ---');
  const data = {};
  let listKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && listKey) {
      data[listKey].push(item[1].trim());
      continue;
    }
    const kv = line.match(/^([a-z]+):\s*(.*)$/);
    if (!kv) throw new Error(`línea no válida en el frontmatter: "${raw}"`);
    const [, key, value] = kv;
    if (value === '') {
      data[key] = [];
      listKey = key;
    } else if (/^\[.*\]$/.test(value)) {
      data[key] = value.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      listKey = null;
    } else {
      data[key] = value.trim();
      listKey = null;
    }
  }
  return { data, body: m[2].trim() };
}

function validateProfile(fileName, text) {
  const errors = [];
  let parsed;
  try {
    parsed = parseProfile(text);
  } catch (e) {
    return [e.message];
  }
  const { data, body } = parsed;
  const user = path.basename(fileName, '.md');
  if (!data.name || typeof data.name !== 'string') errors.push('falta "name"');
  if (!data.github) errors.push('falta "github"');
  else if (data.github !== user) errors.push(`"github" (${data.github}) no coincide con el archivo (${user}.md)`);
  if (data.languages && (!Array.isArray(data.languages) || data.languages.some((l) => !LOCALES.includes(l)))) {
    errors.push(`"languages" solo admite ${LOCALES.join(', ')}`);
  }
  if (data.since && !/^\d{4}-\d{2}$/.test(data.since)) errors.push('"since" debe tener el formato AAAA-MM');
  if (data.links && (!Array.isArray(data.links) || data.links.some((u) => !/^https:\/\//.test(u)))) {
    errors.push('"links" debe ser una lista de URLs https://');
  }
  if (!body) errors.push('falta el texto del perfil');
  if (body.length > MAX_BODY) errors.push(`el texto tiene ${body.length} caracteres (máximo ${MAX_BODY})`);
  const all = `${data.name || ''}\n${body}`;
  const title = all.match(BANNED_TITLES);
  if (title) errors.push(`no se usan títulos de jerarquía ("${title[0]}"): en CSATeam todos somos colaboradores`);
  for (const s of SENSITIVE) if (s.re.test(body)) errors.push(`el texto parece tener un ${s.name}; no publiques datos sensibles`);
  return errors;
}

function profileFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => path.join(dir, f));
}

module.exports = { parseProfile, validateProfile, profileFiles, MAX_BODY };
