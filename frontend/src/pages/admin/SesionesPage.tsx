import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listarSesiones, revocarOtrasSesiones, revocarSesion } from '../../lib/admin';
import { ModuleBreadcrumb } from '../../components/ui/ModuleBreadcrumb';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StatusViews';

export const SesionesPage = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ['sesiones'], queryFn: listarSesiones });

  const revocar = useMutation({
    mutationFn: (id: number) => revocarSesion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sesiones'] }),
  });

  const revocarOtras = useMutation({
    mutationFn: revocarOtrasSesiones,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sesiones'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <ModuleBreadcrumb modulo="Administración" submodulo="Sesiones activas" />
          <h1 className="text-xl font-semibold text-[var(--text)]">Sesiones activas</h1>
        </div>
        <button
          type="button"
          disabled={revocarOtras.isPending}
          onClick={() => revocarOtras.mutate()}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg)] disabled:opacity-60"
        >
          Cerrar todas las demás sesiones
        </button>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="No se pudo cargar la lista de sesiones." />}
      {data && data.length === 0 && <EmptyState message="No hay sesiones activas." />}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Expira</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{s.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(s.expiration).toLocaleString('es-EC')}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={revocar.isPending}
                      onClick={() => revocar.mutate(s.id)}
                      className="text-xs font-medium text-[var(--danger)] hover:underline disabled:opacity-60"
                    >
                      Revocar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
