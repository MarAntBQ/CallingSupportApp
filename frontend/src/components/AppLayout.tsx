import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearSession, getUsuario } from '../lib/auth';
import api from '../lib/axios';

const NAV_ITEMS = [{ to: '/admin/templo', label: 'Viaje al Templo', moduloClave: 'viaje_templo' }];

export const AppLayout = () => {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const modulosPermitidos = usuario?.modulosPermitidos ?? [];
  const navItems = NAV_ITEMS.filter((item) => modulosPermitidos.includes(item.moduloClave));

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
          {navItems.map((item) => (
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
          <span className="text-sm text-[var(--text-muted)]">
            {usuario ? `${usuario.nombres} ${usuario.apellidos} · ${usuario.role}` : ''}
          </span>
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
