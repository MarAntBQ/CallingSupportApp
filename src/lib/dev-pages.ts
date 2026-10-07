const PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];

export const DEV_PAGE_EXTENSION = 'dev.tsx';

export function devPagesEnabled(env: { NODE_ENV?: string; VERCEL_ENV?: string }) {
  return env.NODE_ENV === 'development' || env.VERCEL_ENV === 'preview';
}

export function pageExtensionsFor(env: { NODE_ENV?: string; VERCEL_ENV?: string }) {
  return devPagesEnabled(env) ? [DEV_PAGE_EXTENSION, ...PAGE_EXTENSIONS] : PAGE_EXTENSIONS;
}
