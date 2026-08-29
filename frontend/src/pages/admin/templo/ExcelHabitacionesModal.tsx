import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { actualizarDatosTemploParticipante, descargarExcelHabitacionesTemplo } from '../../../lib/templo';
import { separarNombreCompleto } from '../../../types';
import type { TemploParticipante, TemploViaje } from '../../../types';

interface FilaDatos {
  apellidos: string;
  nombres: string;
  nacionalidad: string;
}

interface Props {
  viaje: TemploViaje;
  ocupantes: TemploParticipante[];
  onClose: () => void;
}

export const ExcelHabitacionesModal = ({ viaje, ocupantes, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<Record<number, FilaDatos>>(() => {
    const inicial: Record<number, FilaDatos> = {};
    for (const p of ocupantes) {
      const sugerido = separarNombreCompleto(p.nombreCompleto);
      inicial[p.id] = {
        apellidos: p.apellidos ?? sugerido.apellidos,
        nombres: p.nombres ?? sugerido.nombres,
        nacionalidad: p.nacionalidad ?? 'Ecuatoriana',
      };
    }
    return inicial;
  });

  const actualizarCampo = (id: number, campo: keyof FilaDatos, valor: string) => {
    setDatos((actual) => ({ ...actual, [id]: { ...actual[id], [campo]: valor } }));
  };

  const guardarYDescargar = useMutation({
    mutationFn: async () => {
      await Promise.all(
        ocupantes.map((p) => actualizarDatosTemploParticipante(p.id, datos[p.id])),
      );
      await descargarExcelHabitacionesTemplo(viaje.id, `habitaciones-viaje-${viaje.id}.xlsx`);
    },
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] });
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo generar el Excel.'));
    },
  });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-[var(--surface)] shadow-lg">
        <div className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text)]">Revisar datos antes de generar el Excel</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Apellidos y Nombres se separaron automáticamente como referencia — revisa y corrige antes de guardar.
            Una vez guardados, no hace falta repetirlo la próxima vez.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          {ocupantes.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No hay nadie asignado a una habitación todavía — asigna primero desde "Sin asignar".
            </p>
          ) : (
            ocupantes.map((p) => (
              <div key={p.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="mb-2 text-sm font-medium text-[var(--text)]">
                  {p.nombreCompleto}{' '}
                  <span className="font-normal text-[var(--text-muted)]">
                    · Habitación {p.habitacion?.numero} · {p.rolHabitacion === 'lider' ? 'Líder' : 'Huésped'}
                  </span>
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text)]">Apellidos</label>
                    <input
                      value={datos[p.id]?.apellidos ?? ''}
                      onChange={(e) => actualizarCampo(p.id, 'apellidos', e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text)]">Nombres</label>
                    <input
                      value={datos[p.id]?.nombres ?? ''}
                      onChange={(e) => actualizarCampo(p.id, 'nombres', e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text)]">Nacionalidad</label>
                    <input
                      value={datos[p.id]?.nacionalidad ?? ''}
                      onChange={(e) => actualizarCampo(p.id, 'nacionalidad', e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={ocupantes.length === 0 || guardarYDescargar.isPending}
            onClick={() => guardarYDescargar.mutate()}
            className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {guardarYDescargar.isPending ? 'Generando…' : 'Guardar y descargar Excel'}
          </button>
        </div>
      </div>
    </div>
  );
};
