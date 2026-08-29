import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/StatusViews';
import {
  listarHabitacionesTemplo,
  crearHabitacionTemplo,
  eliminarHabitacionTemplo,
  asignarHabitacionTemplo,
} from '../../../lib/templo';
import { ExcelHabitacionesModal } from './ExcelHabitacionesModal';
import type { RolHabitacion, TemploParticipante, TemploViaje } from '../../../types';

const extraerMensaje = (err: unknown, fallback: string): string => {
  const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
  const msg = axiosErr.response?.data?.message;
  return Array.isArray(msg) ? msg.join(' ') : (msg ?? fallback);
};

export const HabitacionesViaje = ({
  viaje,
  participantes,
}: {
  viaje: TemploViaje;
  participantes: TemploParticipante[];
}) => {
  const queryClient = useQueryClient();
  const { data: habitaciones } = useQuery({
    queryKey: ['templo-habitaciones', viaje.id],
    queryFn: () => listarHabitacionesTemplo(viaje.id),
    enabled: viaje.incluyeHospedaje,
  });

  const [nuevoNumero, setNuevoNumero] = useState('');
  const [error, setError] = useState('');
  const [mostrarExcel, setMostrarExcel] = useState(false);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['templo-habitaciones', viaje.id] });
    queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] });
  };

  const crearHab = useMutation({
    mutationFn: (numero: string) => crearHabitacionTemplo(viaje.id, numero),
    onSuccess: () => {
      setNuevoNumero('');
      setError('');
      invalidar();
    },
    onError: (err) => setError(extraerMensaje(err, 'No se pudo crear la habitación.')),
  });

  const eliminarHab = useMutation({
    mutationFn: (id: number) => eliminarHabitacionTemplo(id),
    onSuccess: () => {
      setError('');
      invalidar();
    },
    onError: (err) => setError(extraerMensaje(err, 'No se pudo eliminar la habitación.')),
  });

  const asignar = useMutation({
    mutationFn: (vars: { participanteId: number; habitacionId: number | null; rolHabitacion?: RolHabitacion }) =>
      asignarHabitacionTemplo(vars.participanteId, {
        habitacionId: vars.habitacionId,
        rolHabitacion: vars.rolHabitacion,
      }),
    onSuccess: () => {
      setError('');
      invalidar();
    },
    onError: (err) => setError(extraerMensaje(err, 'No se pudo actualizar la asignación.')),
  });

  const necesitanHospedaje = participantes.filter((p) => p.aprobado && p.necesitaHospedaje);
  const sinAsignar = necesitanHospedaje.filter((p) => !p.habitacion);

  const ocupantesDe = (habitacionId: number) => necesitanHospedaje.filter((p) => p.habitacion?.id === habitacionId);

  if (!viaje.incluyeHospedaje) {
    return <EmptyState message="Este viaje no incluye hospedaje — no hace falta gestionar habitaciones." />;
  }

  const ocupantesAsignados = necesitanHospedaje.filter((p) => p.habitacion);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {(habitaciones ?? []).length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setMostrarExcel(true)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:border-[var(--sage-600)] hover:bg-[var(--sage-600)]/10"
          >
            Generar Excel de habitaciones
          </button>
        </div>
      )}

      {mostrarExcel && (
        <ExcelHabitacionesModal viaje={viaje} ocupantes={ocupantesAsignados} onClose={() => setMostrarExcel(false)} />
      )}

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Agregar habitación</h3>
        <div className="flex gap-2">
          <input
            value={nuevoNumero}
            onChange={(e) => setNuevoNumero(e.target.value)}
            placeholder="Número de habitación (ej. 206)"
            className="flex-1 max-w-xs rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
          />
          <button
            type="button"
            disabled={!nuevoNumero.trim() || crearHab.isPending}
            onClick={() => crearHab.mutate(nuevoNumero.trim())}
            className="rounded-lg bg-[var(--brown-700)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            + Agregar
          </button>
        </div>
      </Card>

      {sinAsignar.length > 0 && (
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">
            Sin asignar <span className="font-normal text-[var(--text-muted)]">({sinAsignar.length})</span>
          </h3>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Clic en el número de habitación para asignar directo — las habitaciones llenas aparecen deshabilitadas.
          </p>
          <div className="space-y-2">
            {sinAsignar.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg)] px-3 py-2"
              >
                <span className="text-sm font-medium text-[var(--text)]">{p.nombreCompleto}</span>
                <div className="flex flex-wrap gap-1.5">
                  {(habitaciones ?? []).length === 0 && (
                    <span className="text-xs text-[var(--text-muted)]">Crea una habitación primero</span>
                  )}
                  {(habitaciones ?? []).map((h) => {
                    const ocupantes = ocupantesDe(h.id).length;
                    const llena = ocupantes >= 6;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        disabled={llena || asignar.isPending}
                        onClick={() => asignar.mutate({ participanteId: p.id, habitacionId: h.id })}
                        title={llena ? `Habitación ${h.numero} ya tiene 6 personas` : `Asignar a habitación ${h.numero}`}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          llena
                            ? 'cursor-not-allowed border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] opacity-50'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--sage-600)] hover:bg-[var(--sage-600)]/10'
                        }`}
                      >
                        {h.numero} · {ocupantes}/6
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!habitaciones || habitaciones.length === 0 ? (
        <EmptyState message="Todavía no hay habitaciones creadas para este viaje." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {habitaciones.map((h) => {
            const ocupantes = ocupantesDe(h.id);
            const lideres = ocupantes.filter((p) => p.rolHabitacion === 'lider').length;
            return (
              <Card key={h.id}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text)]">Habitación {h.numero}</h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        ocupantes.length >= 6
                          ? 'bg-green-50 text-[var(--success)]'
                          : 'bg-[var(--warning)]/10 text-[var(--warning)]'
                      }`}
                    >
                      {ocupantes.length}/6
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminarHab.mutate(h.id)}
                      className="text-xs font-medium text-[var(--danger)] hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                {lideres > 0 && (
                  <p className="mb-2 text-xs text-[var(--text-muted)]">
                    {lideres} líder{lideres === 1 ? '' : 'es'} a cargo
                  </p>
                )}
                {ocupantes.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">Sin ocupantes todavía.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {ocupantes.map((p) => {
                      const esLider = p.rolHabitacion === 'lider';
                      const puedeSerLider = esLider || lideres < 2;
                      return (
                        <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-[var(--text)]">
                            {esLider && (
                              <span className="mr-1 rounded bg-[var(--sage-600)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--sage-600)]">
                                LÍDER
                              </span>
                            )}
                            {p.nombreCompleto}
                          </span>
                          <div className="flex shrink-0 gap-2">
                            {puedeSerLider && (
                              <button
                                type="button"
                                disabled={asignar.isPending}
                                onClick={() =>
                                  asignar.mutate({
                                    participanteId: p.id,
                                    habitacionId: h.id,
                                    rolHabitacion: esLider ? 'huesped' : 'lider',
                                  })
                                }
                                className="text-xs font-medium text-[var(--brown-700)] hover:underline disabled:opacity-60"
                              >
                                {esLider ? 'Quitar líder' : 'Hacer líder'}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={asignar.isPending}
                              onClick={() => asignar.mutate({ participanteId: p.id, habitacionId: null })}
                              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-60"
                            >
                              Quitar
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
