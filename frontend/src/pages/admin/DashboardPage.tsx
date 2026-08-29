import { useQuery } from '@tanstack/react-query';
import { listarUsuarios } from '../../lib/admin';
import { getInscripcionesTemplo, listarViajesTemplo } from '../../lib/templo';
import { Card } from '../../components/ui/Card';
import { ModuleBreadcrumb } from '../../components/ui/ModuleBreadcrumb';
import { LoadingState } from '../../components/ui/StatusViews';
import { getUsuario } from '../../lib/auth';

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <Card>
    <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">{value}</p>
    <p className="mt-1 text-sm text-[var(--text-muted)]">{label}</p>
    {sub && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>}
  </Card>
);

export const DashboardPage = () => {
  const usuario = getUsuario();
  const { data: usuarios, isLoading: cargandoUsuarios } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios });
  const { data: viajes, isLoading: cargandoViajes } = useQuery({ queryKey: ['templo-viajes'], queryFn: listarViajesTemplo });
  const { data: inscripciones, isLoading: cargandoInscripciones } = useQuery({
    queryKey: ['templo-inscripciones'],
    queryFn: getInscripcionesTemplo,
  });

  const cargando = cargandoUsuarios || cargandoViajes || cargandoInscripciones;

  const participantes = (inscripciones ?? []).flatMap((i) => i.participantes);
  const pendientes = participantes.filter((p) => !p.aprobado).length;
  const viajeActivo = (viajes ?? []).find((v) => v.activo);
  const totalRecaudar = participantes.filter((p) => p.aprobado).reduce((sum, p) => sum + parseFloat(p.costoTotal), 0);
  const totalAbonado = participantes
    .filter((p) => p.aprobado)
    .flatMap((p) => p.abonos ?? [])
    .reduce((sum, a) => sum + parseFloat(a.valor), 0);

  const usuariosActivos = (usuarios ?? []).filter((u) => u.estado === 'activo').length;
  const usuariosPendientes = (usuarios ?? []).filter((u) => u.estado === 'pendiente').length;
  const porRol = new Map<string, number>();
  for (const u of usuarios ?? []) {
    porRol.set(u.role.nombre, (porRol.get(u.role.nombre) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <ModuleBreadcrumb modulo="Administración" submodulo="Dashboard" />
        <h1 className="text-xl font-semibold text-[var(--text)]">
          Hola, {usuario?.nombres ?? ''} 👋
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Resumen general del barrio.</p>
      </div>

      {cargando && <LoadingState />}

      {!cargando && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Usuarios totales" value={usuarios?.length ?? 0} sub={`${usuariosActivos} activos`} />
            <StatCard label="Registros pendientes" value={usuariosPendientes} sub="Verificación de correo" />
            <StatCard label="Viajes al templo" value={viajes?.length ?? 0} sub={viajeActivo ? 'Hay uno activo' : 'Ninguno activo'} />
            <StatCard label="Participantes por aprobar" value={pendientes} sub="Viaje al Templo" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Usuarios por rol</h3>
              {porRol.size === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Sin datos.</p>
              ) : (
                <ul className="space-y-2">
                  {[...porRol.entries()].map(([rol, cantidad]) => (
                    <li key={rol} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-muted)]">{rol}</span>
                      <span className="font-semibold tabular-nums text-[var(--text)]">{cantidad}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Viaje al Templo — dinero</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Total a recaudar</span>
                  <span className="font-semibold tabular-nums text-[var(--text)]">${totalRecaudar.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Abonado</span>
                  <span className="font-semibold tabular-nums text-[var(--success)]">${totalAbonado.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Saldo pendiente</span>
                  <span className="font-semibold tabular-nums text-[var(--warning)]">
                    ${(totalRecaudar - totalAbonado).toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>

            {viajeActivo && (
              <Card>
                <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Viaje activo</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {viajeActivo.fechaConfirmada ? 'Fecha confirmada' : 'Fecha por confirmar'}:{' '}
                  <span className="font-medium text-[var(--text)]">{viajeActivo.fecha}</span>
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Inscripciones hasta <span className="font-medium text-[var(--text)]">{viajeActivo.fechaLimiteInscripcion}</span>
                </p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
};
