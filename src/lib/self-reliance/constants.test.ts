import { describe, expect, it } from 'vitest';
import { isOfficialUrl, withChurchLang } from './constants';

describe('isOfficialUrl', () => {
  it('reconoce los dominios oficiales y sus subdominios', () => {
    expect(isOfficialUrl('https://www.churchofjesuschrist.org/life/self-reliance/courses')).toBe(true);
    expect(isOfficialUrl('https://englishconnect.org')).toBe(true);
    expect(isOfficialUrl('https://www.byupathway.org/')).toBe(true);
  });

  it('no se deja engañar por dominios parecidos ni por el dominio en la ruta', () => {
    expect(isOfficialUrl('https://churchofjesuschrist.org.example.com')).toBe(false);
    expect(isOfficialUrl('https://fakechurchofjesuschrist.org')).toBe(false);
    expect(isOfficialUrl('https://example.com/churchofjesuschrist.org')).toBe(false);
    expect(isOfficialUrl('no es una url')).toBe(false);
  });
});

describe('withChurchLang', () => {
  it('agrega lang=spa, por o eng según el idioma en los enlaces de churchofjesuschrist.org', () => {
    const url = 'https://www.churchofjesuschrist.org/life/self-reliance/courses';
    expect(withChurchLang(url, 'es')).toBe(`${url}?lang=spa`);
    expect(withChurchLang(url, 'pt')).toBe(`${url}?lang=por`);
    expect(withChurchLang(url, 'en')).toBe(`${url}?lang=eng`);
  });

  it('reemplaza un lang que ya traía el enlace y conserva los demás parámetros', () => {
    expect(withChurchLang('https://www.churchofjesuschrist.org/study?lang=eng&id=3', 'pt')).toBe(
      'https://www.churchofjesuschrist.org/study?lang=por&id=3',
    );
  });

  it('no toca otros dominios, aunque sean oficiales', () => {
    expect(withChurchLang('https://englishconnect.org', 'pt')).toBe('https://englishconnect.org');
    expect(withChurchLang('https://example.com/a', 'es')).toBe('https://example.com/a');
  });
});
