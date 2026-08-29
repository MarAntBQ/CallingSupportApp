const TOKEN_KEY = 'token';
const USUARIO_KEY = 'usuario';

export interface UsuarioSesion {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  role: string;
  modulosPermitidos: string[];
}

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const getUsuario = (): UsuarioSesion | null => {
  const raw = localStorage.getItem(USUARIO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UsuarioSesion;
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => !!getToken();

// Los únicos roles con nivel >= NIVEL_ADMIN_TOTAL en el seed fijo — evita
// pedirle nivel numérico al backend solo para decidir qué mostrar en el nav
// (la seguridad real la sigue haciendo @RequiereAdminGlobal en la API).
export const esAdminGlobal = (usuario: UsuarioSesion | null): boolean =>
  usuario?.role === 'SuperAdmin' || usuario?.role === 'Obispado';

export const setSession = (token: string, usuario: UsuarioSesion): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
};

export const clearSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USUARIO_KEY);
};
