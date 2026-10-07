import { describe, expect, it } from 'vitest';
import {
  canonicalTimeZone,
  configSchema,
  LOGO_MAX_DATA_URL_LENGTH,
  logoSchema,
  timeZoneOptions,
  unitInitials,
} from './config';

const valid = {
  unitName: 'Barrio de Prueba',
  allowRegistration: false,
  timezone: 'America/Guayaquil',
  defaultLocale: 'es',
  contact: 'barrio.prueba@example.com',
  controller: { name: 'Obispado de prueba', email: 'Obispado@Example.com', city: 'Quito, Ecuador', website: '' },
  retentionMonths: 12,
  policyVersion: '2026-10',
};

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('configuración: validación compartida', () => {
  it('acepta una configuración válida y normaliza correo y vacíos', () => {
    const parsed = configSchema.parse(valid);
    expect(parsed.controller.email).toBe('obispado@example.com');
    expect(parsed.controller.website).toBeNull();
  });

  it('rechaza el nombre oficial de la Iglesia en el nombre y en el contacto', () => {
    for (const field of ['unitName', 'contact'] as const) {
      const result = configSchema.safeParse({ ...valid, [field]: 'Barrio Iglesia de Jesucristo Centro' });
      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(expect.objectContaining({ path: [field], message: 'official_name' }));
    }
  });

  it('exige el contacto de la instalación', () => {
    expect(configSchema.safeParse({ ...valid, contact: '  ' }).success).toBe(false);
  });

  it('acepta solo zonas IANA válidas y guarda el nombre canónico', () => {
    expect(configSchema.parse({ ...valid, timezone: 'america/bogota' }).timezone).toBe('America/Bogota');
    const bad = configSchema.safeParse({ ...valid, timezone: 'Marte/Olympus' });
    expect(bad.error!.issues).toContainEqual(expect.objectContaining({ path: ['timezone'], message: 'invalid_timezone' }));
    expect(canonicalTimeZone('UTC')).toBe('UTC');
  });

  it('la lista de zonas son las de América más UTC', () => {
    const zones = timeZoneOptions();
    expect(zones).toContain('America/Guayaquil');
    expect(zones).toContain('UTC');
    expect(zones.every((zone) => zone === 'UTC' || zone.startsWith('America/'))).toBe(true);
  });

  it('el sitio web solo con http o https y el correo del responsable válido', () => {
    expect(configSchema.safeParse({ ...valid, controller: { ...valid.controller, website: 'javascript:alert(1)' } }).success).toBe(false);
    expect(configSchema.safeParse({ ...valid, controller: { ...valid.controller, website: 'ftp://example.com' } }).success).toBe(false);
    expect(configSchema.parse({ ...valid, controller: { ...valid.controller, website: 'https://example.com' } }).controller.website).toBe(
      'https://example.com',
    );
    expect(configSchema.safeParse({ ...valid, controller: { ...valid.controller, email: 'no-es-correo' } }).success).toBe(false);
  });

  it('meses de retención entre 1 y 120, enteros', () => {
    for (const months of [0, 121, 1.5]) expect(configSchema.safeParse({ ...valid, retentionMonths: months }).success).toBe(false);
    expect(configSchema.safeParse({ ...valid, retentionMonths: 120 }).success).toBe(true);
  });

  it('PATCH no acepta el logo ni campos desconocidos', () => {
    expect(configSchema.safeParse({ ...valid, logoDataUrl: PNG }).success).toBe(false);
    expect(configSchema.safeParse({ ...valid, controller: { ...valid.controller, phone: '1' } }).success).toBe(false);
  });
});

describe('logo', () => {
  it('acepta png, jpeg, jpg, svg y webp en base64, con la confirmación', () => {
    for (const type of ['png', 'jpeg', 'jpg', 'svg+xml', 'webp']) {
      expect(logoSchema.safeParse({ logoDataUrl: `data:image/${type};base64,AAAA`, notOfficialLogo: true }).success).toBe(true);
    }
  });

  it('rechaza lo que no es una imagen permitida', () => {
    for (const logoDataUrl of [
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/gif;base64,R0lGOD',
      'data:image/png,iVBORw0KGgo',
      'https://example.com/logo.png',
      'data:image/png;base64,abc<script>',
    ]) {
      expect(logoSchema.safeParse({ logoDataUrl, notOfficialLogo: true }).success).toBe(false);
    }
  });

  it('rechaza un data URL de más de 3.000.000 caracteres', () => {
    const big = `data:image/png;base64,${'A'.repeat(LOGO_MAX_DATA_URL_LENGTH)}`;
    expect(logoSchema.safeParse({ logoDataUrl: big, notOfficialLogo: true }).success).toBe(false);
  });

  it('exige confirmar que no es el logotipo de la Iglesia, salvo para quitarlo', () => {
    const result = logoSchema.safeParse({ logoDataUrl: PNG });
    expect(result.error!.issues).toContainEqual(expect.objectContaining({ path: ['notOfficialLogo'], message: 'required' }));
    expect(logoSchema.safeParse({ logoDataUrl: PNG, notOfficialLogo: false }).success).toBe(false);
    expect(logoSchema.safeParse({ logoDataUrl: null }).success).toBe(true);
  });
});

describe('iniciales del logo neutro', () => {
  it('toma la primera y la última palabra', () => {
    expect(unitInitials('Barrio de Prueba')).toBe('BP');
    expect(unitInitials('rama ñandú')).toBe('RÑ');
    expect(unitInitials('Laureles')).toBe('L');
    expect(unitInitials('  ')).toBe('');
  });
});
