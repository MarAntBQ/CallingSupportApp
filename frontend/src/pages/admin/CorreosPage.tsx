import { useQuery } from '@tanstack/react-query';
import { listarEmailLogs } from '../../lib/admin';
import { formatFecha } from '../../lib/format';
import { ModuleBreadcrumb } from '../../components/ui/ModuleBreadcrumb';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StatusViews';

export const CorreosPage = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['email-logs'], queryFn: listarEmailLogs });

  return (
    <div className="space-y-4">
      <div>
        <ModuleBreadcrumb modulo="Administración" submodulo="Correos enviados" />
        <h1 className="text-xl font-semibold text-[var(--text)]">Correos enviados</h1>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="No se pudo cargar el historial de correos." />}
      {data && data.length === 0 && <EmptyState message="Todavía no se ha enviado ningún correo." />}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Para</th>
                <th className="px-4 py-3">Asunto</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log) => (
                <tr key={log.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 text-[var(--text-muted)]">{formatFecha(log.createdAt)}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{log.source}</td>
                  <td className="px-4 py-3 text-[var(--text)]">{log.emailTo}</td>
                  <td className="px-4 py-3 text-[var(--text)]">{log.emailSubject}</td>
                  <td className="px-4 py-3">
                    {log.success ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-[var(--success)]">
                        Enviado
                      </span>
                    ) : (
                      <span
                        className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-[var(--danger)]"
                        title={log.errorMessage ?? undefined}
                      >
                        Falló
                      </span>
                    )}
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
