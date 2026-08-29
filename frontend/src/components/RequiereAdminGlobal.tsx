import type { ReactNode } from 'react';
import { esAdminGlobal, getUsuario } from '../lib/auth';

// Espejo del guard del backend (@RequiereAdminGlobal) — mismo espíritu que
// RequiereModulo: evita mostrar una pantalla que de todos modos la API
// rechazaría con 403.
export const RequiereAdminGlobal = ({ children }: { children: ReactNode }) => {
  if (!esAdminGlobal(getUsuario())) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="text-lg font-semibold text-[var(--text)]">Sin acceso</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Solo el Obispado puede administrar esto.</p>
      </div>
    );
  }

  return <>{children}</>;
};
