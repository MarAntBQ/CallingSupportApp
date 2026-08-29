import type { ReactNode } from 'react';
import { getUsuario } from '../lib/auth';

// Espejo del guard del backend (@RequiereModulo) — la seguridad real la
// hace la API; esto solo evita mostrarle a un Miembro sin acceso una
// pantalla de administración que de todos modos le devolvería 403.
export const RequiereModulo = ({ clave, children }: { clave: string; children: ReactNode }) => {
  const usuario = getUsuario();
  const permitido = (usuario?.modulosPermitidos ?? []).includes(clave);

  if (!permitido) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="text-lg font-semibold text-[var(--text)]">Sin acceso</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">No tienes permiso para administrar este módulo.</p>
      </div>
    );
  }

  return <>{children}</>;
};
