import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loginSchema, setupSchema } from '@/lib/validation/auth';
import { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from './crypto';
import { readCookie } from './session';

const validSetup = {
  unitType: 'ward',
  unitName: 'Barrio Los Pinos',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  password: 'contraseña-larga',
  bishopApproved: true,
  bishopApprovedBy: 'Obispo de prueba',
  bishopApprovedOn: '2026-01-15',
  privacyConsent: true,
  locale: 'es',
};

describe('tokens de sesión', () => {
  it('genera 32 bytes aleatorios en base64url', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('guarda el SHA-256 del token, no el token', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hashSessionToken(token)).not.toContain(token);
  });
});

describe('contraseñas', () => {
  it('verifica con bcrypt costo 12 y rechaza la incorrecta o un hash ausente', async () => {
    const hash = await hashPassword('secreta-123');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword('secreta-123', hash)).toBe(true);
    expect(await verifyPassword('otra', hash)).toBe(false);
    expect(await verifyPassword('secreta-123', null)).toBe(false);
  }, 20_000);
});

describe('validación', () => {
  it('normaliza el correo a minúsculas', () => {
    expect(loginSchema.parse({ email: '  JUAN@EJEMPLO.COM ', password: 'x' }).email).toBe('juan@ejemplo.com');
  });

  it('el setup exige la aprobación del obispo, quién aprobó y la fecha', () => {
    expect(setupSchema.safeParse(validSetup).success).toBe(true);
    for (const missing of ['bishopApproved', 'bishopApprovedBy', 'bishopApprovedOn', 'privacyConsent', 'locale'] as const) {
      const input = { ...validSetup, [missing]: undefined };
      const result = setupSchema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path[0])).toContain(missing);
    }
    expect(setupSchema.safeParse({ ...validSetup, bishopApproved: false }).success).toBe(false);
    expect(setupSchema.safeParse({ ...validSetup, privacyConsent: false }).success).toBe(false);
    expect(setupSchema.safeParse({ ...validSetup, locale: 'fr' }).success).toBe(false);
  });

  it('exige tipo y nombre de la unidad, y rechaza el nombre oficial de la Iglesia', () => {
    expect(setupSchema.safeParse({ ...validSetup, unitType: 'stake' }).success).toBe(false);
    expect(setupSchema.safeParse({ ...validSetup, unitName: ' ' }).success).toBe(false);
    const official = setupSchema.safeParse({ ...validSetup, unitName: 'Rama Iglesia de Jesucristo' });
    expect(official.success).toBe(false);
    expect(official.error?.issues[0]).toMatchObject({ path: ['unitName'], message: 'official_name' });
  });

  it('rechaza una fecha de aprobación futura y una contraseña corta', () => {
    expect(setupSchema.safeParse({ ...validSetup, bishopApprovedOn: '2999-01-01' }).success).toBe(false);
    expect(setupSchema.safeParse({ ...validSetup, password: '1234567' }).success).toBe(false);
  });
});

describe('readCookie', () => {
  const request = (cookie?: string) => new Request('http://localhost/', { headers: cookie ? { cookie } : {} });

  it('lee la cookie pedida entre varias', () => {
    expect(readCookie(request('a=1; csa_session=abc; b=2'), 'csa_session')).toBe('abc');
  });

  it('ignora una cookie malformada en vez de fallar', () => {
    expect(readCookie(request('csa_session=%'), 'csa_session')).toBeNull();
    expect(readCookie(request('csa_session=%E0%A4%A'), 'csa_session')).toBeNull();
  });

  it('devuelve null si no está o no hay cabecera', () => {
    expect(readCookie(request('a=1'), 'csa_session')).toBeNull();
    expect(readCookie(request(), 'csa_session')).toBeNull();
  });
});
