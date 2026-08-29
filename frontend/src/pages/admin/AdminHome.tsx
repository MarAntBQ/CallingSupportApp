import { Navigate } from 'react-router-dom';
import { esAdminGlobal, getUsuario } from '../../lib/auth';

// Mapea moduloClave -> ruta de administración. A medida que se agreguen
// módulos nuevos, se agregan acá — mismo espíritu que NAV_ITEMS en AppLayout.
const RUTA_POR_MODULO: Record<string, string> = {
  viaje_templo: '/admin/templo',
  usuarios: '/admin/usuarios',
};

export const AdminHome = () => {
  const usuario = getUsuario();

  if (esAdminGlobal(usuario)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const primerModulo = (usuario?.modulosPermitidos ?? []).find((clave) => RUTA_POR_MODULO[clave]);

  if (primerModulo) {
    return <Navigate to={RUTA_POR_MODULO[primerModulo]} replace />;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h1 className="text-lg font-semibold text-[var(--text)]">Sin módulos asignados</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Tu cuenta no tiene ningún módulo de administración asignado todavía. Contacta al Obispado si crees que
        deberías tener acceso.
      </p>
    </div>
  );
};
