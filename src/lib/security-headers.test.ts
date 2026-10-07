import { describe, expect, it } from 'vitest';
import { buildCsp, STATIC_SECURITY_HEADERS } from './security-headers';

function directive(csp: string, name: string) {
  return csp.split('; ').find((part) => part.startsWith(`${name} `)) ?? '';
}

describe('Content-Security-Policy', () => {
  const production = buildCsp('abc123');

  it('solo ejecuta scripts del propio sitio con el nonce de la petición, sin unsafe-inline ni unsafe-eval', () => {
    const scripts = directive(production, 'script-src');
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain('unsafe-inline');
    expect(scripts).not.toContain('unsafe-eval');
  });

  it('no deja incrustar la app en otro sitio ni cargar objetos', () => {
    expect(directive(production, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(production, 'object-src')).toBe("object-src 'none'");
    expect(directive(production, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(production, 'form-action')).toBe("form-action 'self'");
    expect(production).toContain('upgrade-insecure-requests');
  });

  it('en desarrollo permite unsafe-eval (lo pide React) y no fuerza https', () => {
    const development = buildCsp('n', { development: true });
    expect(directive(development, 'script-src')).toContain("'unsafe-eval'");
    expect(development).not.toContain('upgrade-insecure-requests');
  });

  it('solo en las previews de Vercel admite la barra de comentarios', () => {
    expect(production).not.toContain('vercel.live');
    expect(directive(buildCsp('n', { vercelPreview: true }), 'script-src')).toContain('https://vercel.live');
  });
});

describe('cabeceras fijas', () => {
  it('incluye HSTS de dos años, nosniff, DENY y una política de permisos cerrada', () => {
    const headers = Object.fromEntries(STATIC_SECURITY_HEADERS.map(({ key, value }) => [key, value]));
    expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });
});
