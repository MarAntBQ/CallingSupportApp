import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listarConsejoBarrio } from '../../lib/admin';
import { ModuleBreadcrumb } from '../../components/ui/ModuleBreadcrumb';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StatusViews';

export const ConsejoBarrioPage = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['consejo-barrio'], queryFn: listarConsejoBarrio });

  return (
    <div className="space-y-6">
      <div>
        <ModuleBreadcrumb modulo="Administración" submodulo="Consejo de barrio" />
        <h1 className="text-xl font-semibold text-[var(--text)]">Consejo de barrio</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Líderes por organización — haz clic en un nombre para editar su cuenta.
        </p>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="No se pudo cargar el consejo de barrio." />}
      {data && data.length === 0 && <EmptyState message="No hay organizaciones registradas." />}

      {data &&
        data.map(({ organizacion, lideres }) => (
          <div key={organizacion.id}>
            <h2 className="mb-2 text-lg text-[var(--text)]">{organizacion.nombre}</h2>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <th className="px-4 py-3">Llamamiento</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {lideres.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--text-muted)]">{l.llamamiento || '—'}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/usuarios?editar=${l.id}`}
                          className="font-medium text-[var(--brown-700)] hover:text-[var(--sage-600)] hover:underline"
                        >
                          {l.apellidos}, {l.nombres}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{l.email}</td>
                    </tr>
                  ))}
                  {lideres.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 italic text-[var(--text-muted)]">
                        Sin líder asignado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
};
