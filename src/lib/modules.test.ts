import { describe, expect, it } from 'vitest';
import { moduleHome } from './modules';

describe('moduleHome', () => {
  it('lleva a la primera pantalla de los módulos permitidos, en el orden de MODULES', () => {
    expect(moduleHome(['callings', 'temple-trips'])).toBe('/admin/temple-trips');
    expect(moduleHome(['users'])).toBe('/admin/users');
    expect(moduleHome(['callings'])).toBe('/admin/organizations');
    expect(moduleHome(['self-reliance'])).toBe('/admin/self-reliance');
    expect(moduleHome(['camps'])).toBe('/admin/camps');
  });

  it('con solo el módulo permissions aterriza en /admin/organizations (la v1 lo dejaba sin destino)', () => {
    expect(moduleHome(['permissions'])).toBe('/admin/organizations');
  });

  it('sin módulos no hay destino', () => {
    expect(moduleHome([])).toBeNull();
  });
});
