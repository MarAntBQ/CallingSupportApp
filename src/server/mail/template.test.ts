import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import pt from '../../../messages/pt.json';
import { EMAIL_COLORS } from './email-colors';
import { buildBrandedEmail, escapeHtml } from './template';

const labels = { signature: 'Atentamente, Barrio de Prueba', footer: '© 2026 Barrio de Prueba', notOfficial: 'No es oficial.' };

describe('plantilla de correo', () => {
  it('tabla de 560 px con el nombre de la unidad en el encabezado, la firma, el pie y el preheader oculto', () => {
    const html = buildBrandedEmail('Asunto', '<p>Hola</p>', 'Barrio de Prueba', 'Resumen corto', labels);
    expect(html).toContain('max-width:560px');
    expect(html).toContain('>Barrio de Prueba</td>');
    expect(html).toContain('Atentamente, Barrio de Prueba');
    expect(html).toContain('© 2026 Barrio de Prueba');
    expect(html).toContain('No es oficial.');
    expect(html).toMatch(/display:none[^>]*>Resumen corto</);
    expect(html).toContain(EMAIL_COLORS.primary);
  });

  it('escapa el nombre de la unidad, el asunto, el preheader y las etiquetas', () => {
    const html = buildBrandedEmail('<b>x</b>', '', '<script>alert(1)</script>', '"><img>', { ...labels, signature: '<i>firma</i>' });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<i>firma</i>');
    expect(html).toContain('&lt;script&gt;');
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});

describe('los correos avisan y enlazan, sin datos de terceros (Manual General 38.8.21.2)', () => {
  const ALLOWED_PLACEHOLDERS = new Set(['unitName', 'year', 'link', 'code', 'minutes', 'date', 'activity']);

  function placeholders(value: unknown): string[] {
    if (typeof value === 'string') return [...value.matchAll(/\{(\w+)/g)].map((match) => match[1]!);
    if (value && typeof value === 'object') return Object.values(value).flatMap(placeholders);
    return [];
  }

  it('ningún texto de correo usa un dato de una persona (nombre, teléfono, correo, cédula, salud)', () => {
    for (const messages of [es, pt, en]) {
      const used = placeholders(messages.emails);
      expect(used.filter((name) => !ALLOWED_PLACEHOLDERS.has(name))).toEqual([]);
    }
  });

  it('ningún texto de correo trae escrito un correo o un teléfono', () => {
    const strings = (value: unknown): string[] =>
      typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
    for (const messages of [es, pt, en]) {
      const offenders = strings(messages.emails).filter((text) => /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s().-]{6,}\d/.test(text));
      expect(offenders).toEqual([]);
    }
  });

  it('el detector marca un dato de una persona', () => {
    expect(placeholders({ aviso: 'Nueva inscripción de {firstName} ({phone})' })).toEqual(['firstName', 'phone']);
  });
});
