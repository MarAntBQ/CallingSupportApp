import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SOURCE_LOCALE = 'es';

export const DEFAULT_MESSAGES_DIR = fileURLToPath(new URL('../messages', import.meta.url));

export function flattenKeys(messages, prefix = '') {
  if (messages === null || typeof messages !== 'object' || Array.isArray(messages)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? flattenKeys(value, path)
      : [path];
  });
}

export function compareKeys(source, target) {
  const sourceKeys = new Set(flattenKeys(source));
  const targetKeys = new Set(flattenKeys(target));
  return {
    missing: [...sourceKeys].filter((key) => !targetKeys.has(key)).sort(),
    extra: [...targetKeys].filter((key) => !sourceKeys.has(key)).sort(),
  };
}

export function checkMessagesDir(dir = DEFAULT_MESSAGES_DIR, sourceLocale = SOURCE_LOCALE) {
  const read = (locale) => JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'));
  const locales = readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
  const source = read(sourceLocale);
  const problems = locales
    .filter((locale) => locale !== sourceLocale)
    .map((locale) => ({ locale, ...compareKeys(source, read(locale)) }))
    .filter(({ missing, extra }) => missing.length > 0 || extra.length > 0);
  return { locales, problems };
}

export function formatProblems(problems) {
  return problems
    .flatMap(({ locale, missing, extra }) => [
      ...missing.map((key) => `${locale}.json: falta la clave "${key}"`),
      ...extra.map((key) => `${locale}.json: sobra la clave "${key}" (no existe en ${SOURCE_LOCALE}.json)`),
    ])
    .join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_MESSAGES_DIR;
  const { locales, problems } = checkMessagesDir(dir);
  if (problems.length > 0) {
    console.error(formatProblems(problems));
    process.exit(1);
  }
  console.log(`Idiomas completos: ${locales.join(', ')}`);
}
