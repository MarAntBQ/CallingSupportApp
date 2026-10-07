const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
const ROUTE_WRAPPERS = ['withAuth', 'publicRoute'];

function byPosition(source: string) {
  return (a: string, b: string) => source.indexOf(a) - source.indexOf(b);
}

export function findUnprotectedRoutes(source: string) {
  const found = new Set<string>();
  for (const method of METHODS) {
    if (new RegExp(String.raw`export\s+(?:async\s+)?function\s+${method}\b`).test(source)) found.add(method);
    if (new RegExp(String.raw`export\s+(?:let|var)\s+${method}\b`).test(source)) found.add(method);
    const constant = source.match(
      new RegExp(String.raw`export\s+const\s+${method}\s*=\s*([A-Za-z_$][\w$]*)?\s*(?:<[^()=;]*>)?\s*(\()?`),
    );
    if (constant && !(constant[2] && ROUTE_WRAPPERS.includes(constant[1] ?? ''))) found.add(method);
  }
  for (const block of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of block[1]!.split(',')) {
      const name = part.split(/\s+as\s+/).pop()?.trim();
      if (name && (METHODS as readonly string[]).includes(name)) found.add(name);
    }
  }
  return [...found].sort(byPosition(source));
}

export function findUnprotectedActions(source: string) {
  if (!/^\s*['"]use server['"]/.test(source)) return [];
  const found = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) found.add(match[1]!);
  for (const match of source.matchAll(/export\s+(?:let|var)\s+([A-Za-z_$][\w$]*)/g)) found.add(match[1]!);
  for (const match of source.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)?\s*(\()?/g)) {
    if (!(match[3] && match[2] === 'authedAction')) found.add(match[1]!);
  }
  return [...found].sort(byPosition(source));
}
