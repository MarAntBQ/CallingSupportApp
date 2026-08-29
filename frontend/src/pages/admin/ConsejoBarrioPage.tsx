import { useQuery } from '@tanstack/react-query';
import { listarConsejoBarrio } from '../../lib/admin';
import { Card } from '../../components/ui/Card';
import { ModuleBreadcrumb } from '../../components/ui/ModuleBreadcrumb';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StatusViews';

export const ConsejoBarrioPage = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['consejo-barrio'], queryFn: listarConsejoBarrio });

  return (
    <div className="space-y-4">
      <div>
        <ModuleBreadcrumb modulo="Administración" submodulo="Consejo de barrio" />
        <h1 className="text-xl font-semibold text-[var(--text)]">Consejo de barrio</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Líderes por organización, de un vistazo.</p>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="No se pudo cargar el consejo de barrio." />}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map(({ organizacion, lideres }) => (
            <Card key={organizacion.id}>
              <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">{organizacion.nombre}</h3>
              {lideres.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Sin líder asignado.</p>
              ) : (
                <ul className="space-y-2">
                  {lideres.map((l) => (
                    <li key={l.id} className="text-sm">
                      <p className="font-medium text-[var(--text)]">
                        {l.nombres} {l.apellidos}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{l.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
          {data.length === 0 && <EmptyState message="No hay organizaciones registradas." />}
        </div>
      )}
    </div>
  );
};
