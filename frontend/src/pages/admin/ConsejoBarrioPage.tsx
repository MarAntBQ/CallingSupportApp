import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listarConsejoBarrio } from '../../lib/admin';
import { ModuleBreadcrumb } from '../../components/ui/ModuleBreadcrumb';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StatusViews';
import { useTableControls } from '../../lib/use-table-controls';
import { TableToolbar, SortHeader, TablePagination } from '../../components/TableControls';
import type { ConsejoBarrioItem } from '../../types';

type Lider = ConsejoBarrioItem['lideres'][number];

// Cada organización necesita su propio useTableControls — no se puede
// llamar el hook dentro del .map() del padre.
function OrganizacionTabla({ lideres }: { lideres: Lider[] }) {
  const table = useTableControls(lideres, {
    search: (l) => `${l.nombres} ${l.apellidos} ${l.email} ${l.llamamiento ?? ''}`,
    defaultSortKey: 'nombre',
    sortAccessors: {
      llamamiento: (l) => l.llamamiento ?? '',
      nombre: (l) => `${l.apellidos} ${l.nombres}`,
      correo: (l) => l.email,
    },
    pageSize: 25,
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <TableToolbar table={table} placeholder="Buscar…" />
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <SortHeader table={table} colKey="llamamiento" label="Llamamiento" />
            <SortHeader table={table} colKey="nombre" label="Nombre" />
            <SortHeader table={table} colKey="correo" label="Correo" />
          </tr>
        </thead>
        <tbody>
          {table.view.map((l) => (
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
          {table.view.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-3 italic text-[var(--text-muted)]">
                Sin líder asignado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <TablePagination table={table} />
    </div>
  );
}

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
            <OrganizacionTabla lideres={lideres} />
          </div>
        ))}
    </div>
  );
};
