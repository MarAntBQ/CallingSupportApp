import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import pt from '../../messages/pt.json';
import { controllerConfigured, ONLINE_RESOURCES_HANDBOOK_URL, POLICY_SECTIONS, recaptchaEnabled } from './privacy-policy';

const ALL = { es, pt, en };

describe('política de datos', () => {
  it('tiene los 17 puntos, con título y texto, en los tres idiomas', () => {
    expect(POLICY_SECTIONS).toHaveLength(17);
    for (const [locale, messages] of Object.entries(ALL)) {
      for (const section of POLICY_SECTIONS) {
        const entry = messages.privacyPolicy.sections[section];
        expect(entry.title, `${locale} ${section}`).toMatch(new RegExp(`^${section.slice(1)}\\. `));
        expect(entry.body.length, `${locale} ${section}`).toBeGreaterThan(5);
      }
    }
  });

  it('no contiene datos fijos de una unidad ni de una persona', () => {
    const text = JSON.stringify(ALL).toLowerCase();
    for (const forbidden of ['laureles', 'marantbq', 'bustillos', 'noticiaslaureles']) expect(text).not.toContain(forbidden);
  });

  it('nombra a Google solo si hay clave secreta de reCAPTCHA', () => {
    expect(recaptchaEnabled({})).toBe(false);
    expect(recaptchaEnabled({ RECAPTCHA_SECRET_KEY: '   ' })).toBe(false);
    expect(recaptchaEnabled({ RECAPTCHA_SECRET_KEY: 'clave' })).toBe(true);
    for (const messages of Object.values(ALL)) {
      expect(messages.privacyPolicy.sections.s10.body).not.toMatch(/google/i);
      expect(messages.privacyPolicy.sections.s10.google).toMatch(/google/i);
    }
  });

  it('el responsable está configurado solo con nombre y correo', () => {
    expect(controllerConfigured({ name: 'Obispado de prueba', email: 'obispado@example.com' })).toBe(true);
    expect(controllerConfigured({ name: 'Obispado de prueba', email: null })).toBe(false);
    expect(controllerConfigured({ name: null, email: 'obispado@example.com' })).toBe(false);
  });

  it('el aviso de no oficial cita el Manual General 38.8.21.2 y enlaza a esa sección', () => {
    for (const messages of Object.values(ALL)) expect(messages.privacyPolicy.notOfficial).toContain('38.8.21.2');
    for (const url of Object.values(ONLINE_RESOURCES_HANDBOOK_URL)) expect(url).toMatch(/38-church-policies-and-guidelines\?lang=\w+#title_number158$/);
  });

  it('dice que los avisos no llevan información confidencial ni nombres', () => {
    expect(es.privacyPolicy.sections.s2.notices).toMatch(/sin nombres ni datos/);
    expect(es.privacyPolicy.sections.s2.notices).toMatch(/nunca llevan información confidencial o delicada/);
  });
});
