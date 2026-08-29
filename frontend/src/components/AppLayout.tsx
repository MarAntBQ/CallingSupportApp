import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearSession, esAdminGlobal, getUsuario } from '../lib/auth';
import api from '../lib/axios';

const NAV_MODULOS = [
  { to: '/admin/templo', label: 'Viaje al Templo', moduloClave: 'viaje_templo' },
  { to: '/admin/usuarios', label: 'Usuarios', moduloClave: 'usuarios' },
  { to: '/admin/organizaciones', label: 'Organizaciones', moduloClave: 'usuarios' },
  { to: '/admin/consejo-barrio', label: 'Consejo de barrio', moduloClave: 'usuarios' },
];

const NAV_ADMIN = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/correos', label: 'Correos enviados' },
  { to: '/admin/sesiones', label: 'Sesiones activas' },
];

export const AppLayout = () => {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const modulosPermitidos = usuario?.modulosPermitidos ?? [];
  const esAdmin = esAdminGlobal(usuario);
  const navModulos = NAV_MODULOS.filter((item) => modulosPermitidos.includes(item.moduloClave));

  const cerrarSesion = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Si el logout en el servidor falla (red caída, etc.) igual cerramos
      // la sesión localmente — el token expira solo más adelante.
    }
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--text)]">CSApp</p>
          <p className="text-xs text-[var(--text-muted)]">by MarAntBQ.dev</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {esAdmin &&
            NAV_ADMIN.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--brown-700)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          {esAdmin && navModulos.length > 0 && <div className="my-2 border-t border-[var(--border)]" />}
          {navModulos.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--brown-700)] text-white'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
          <NavLink
            to="/admin/perfil"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
          >
            {usuario ? `${usuario.nombres} ${usuario.apellidos} · ${usuario.role}` : ''}
          </NavLink>
          <button
            type="button"
            onClick={cerrarSesion}
            className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--danger)]"
          >
            Cerrar sesión
          </button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
