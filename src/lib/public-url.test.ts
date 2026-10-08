import { describe, expect, it } from 'vitest';
import { canonicalBaseUrl } from './public-url';

describe('canonicalBaseUrl', () => {
  it('usa APP_URL y, si no está, la primera de APP_ORIGINS; sin barra ni ruta', () => {
    expect(canonicalBaseUrl({ APP_URL: 'https://staging.example.com/', NODE_ENV: 'production' })).toBe('https://staging.example.com');
    expect(canonicalBaseUrl({ APP_ORIGINS: ' https://demo.example.com , https://otro.example.com', NODE_ENV: 'production' })).toBe('https://demo.example.com');
    expect(canonicalBaseUrl({ APP_URL: 'https://a.example.com/admin', APP_ORIGINS: 'https://b.example.com' })).toBe('https://a.example.com');
  });

  it('sin configuración, o con http o basura en producción, no hay URL: nunca se usa el Host de la petición', () => {
    expect(canonicalBaseUrl({ NODE_ENV: 'production' })).toBeNull();
    expect(canonicalBaseUrl({ APP_URL: 'http://staging.example.com', NODE_ENV: 'production' })).toBeNull();
    expect(canonicalBaseUrl({ APP_URL: 'no es una url', NODE_ENV: 'production' })).toBeNull();
    expect(canonicalBaseUrl({ APP_URL: 'http://localhost:3000', NODE_ENV: 'development' })).toBe('http://localhost:3000');
  });
});
