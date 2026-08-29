import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { actualizarParticipanteTemplo } from '../../../lib/templo';
import { ORDENANZAS, GENEROS, calcularCostoParticipante, type Ordenanza, type Genero } from '../../../types';
import { formatFecha } from '../../../lib/format';
import { AbonosSection } from './AbonosSection';
import type { TemploParticipante, TemploViaje } from '../../../types';

const schema = z.object({
  cedulaOPasaporte: z.string().min(3, 'Requerido'),
  fechaNacimiento: z.string().min(1, 'Requerido'),
  nombreCompleto: z.string().min(3, 'Requerido'),
  telefono: z.string().min(6, 'Requerido'),
  email: z.string().email('Correo inválido'),
  genero: z.enum(GENEROS, { message: 'Selecciona el género' }),
  vaEnTransporte: z.boolean(),
  necesitaHospedaje: z.boolean(),
  quiereDesayuno: z.boolean(),
  quiereAlmuerzo: z.boolean(),
  ordenanzas: z.array(z.enum(ORDENANZAS)),
});

type FormValues = z.infer<typeof schema>;

interface InscripcionMeta {
  id: number;
  createdAt: string;
  ip: string | null;
  consentimiento: boolean;
  policyVersion: string;
}

interface Props {
  participante: TemploParticipante;
  inscripcion: InscripcionMeta;
  viaje: TemploViaje;
  onClose: () => void;
}

export const ParticipanteModal = ({ participante, inscripcion, viaje, onClose }: Props) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cedulaOPasaporte: participante.cedulaOPasaporte,
      fechaNacimiento: participante.fechaNacimiento,
      nombreCompleto: participante.nombreCompleto,
      telefono: participante.telefono,
      email: participante.email,
      genero: participante.genero as Genero,
      vaEnTransporte: participante.vaEnTransporte,
      necesitaHospedaje: participante.necesitaHospedaje,
      quiereDesayuno: participante.quiereDesayuno,
      quiereAlmuerzo: participante.quiereAlmuerzo,
      ordenanzas: (participante.ordenanzas ? participante.ordenanzas.split(', ').filter(Boolean) : []) as Ordenanza[],
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => actualizarParticipanteTemplo(participante.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] });
      onClose();
    },
  });

  const [vaEnTransporte, quiereDesayuno, quiereAlmuerzo] = watch([
    'vaEnTransporte',
    'quiereDesayuno',
    'quiereAlmuerzo',
  ]);
  const costoEnVivo = calcularCostoParticipante(viaje, { vaEnTransporte, quiereDesayuno, quiereAlmuerzo });

  const mensajeError = (() => {
    if (!mutation.isError) return null;
    const err = mutation.error as { response?: { data?: { message?: string | string[] } } };
    const msg = err.response?.data?.message;
    return Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo guardar el cambio.');
  })();

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-[var(--surface)] shadow-lg">
        <div className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text)]">Detalle del participante</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Inscripción #{inscripcion.id} enviada el {formatFecha(inscripcion.createdAt)} · consentimiento{' '}
            {inscripcion.consentimiento ? 'otorgado' : 'no registrado'} (política {inscripcion.policyVersion}) · IP{' '}
            {inscripcion.ip ?? 'no registrada'}
          </p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4" noValidate>
          {mensajeError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {mensajeError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Cédula o pasaporte</label>
              <input
                {...register('cedulaOPasaporte')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
              {errors.cedulaOPasaporte && <p className="mt-1 text-xs text-red-500">{errors.cedulaOPasaporte.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Fecha de nacimiento</label>
              <input
                type="date"
                {...register('fechaNacimiento')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
              {errors.fechaNacimiento && <p className="mt-1 text-xs text-red-500">{errors.fechaNacimiento.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Nombre completo</label>
            <input
              {...register('nombreCompleto')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
            {errors.nombreCompleto && <p className="mt-1 text-xs text-red-500">{errors.nombreCompleto.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Teléfono</label>
              <input
                {...register('telefono')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
              {errors.telefono && <p className="mt-1 text-xs text-red-500">{errors.telefono.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Email</label>
              <input
                {...register('email')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Género</label>
            <select
              {...register('genero')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            >
              {GENEROS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['vaEnTransporte', 'Transporte'],
                ['necesitaHospedaje', 'Hospedaje'],
                ['quiereDesayuno', 'Desayuno'],
                ['quiereAlmuerzo', 'Almuerzo'],
              ] as const
            ).map(([campo, label]) => (
              <label
                key={campo}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <input
                  type="checkbox"
                  {...register(campo)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                />
                {label}
              </label>
            ))}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-[var(--text)]">Ordenanzas</p>
            <div className="grid grid-cols-2 gap-2">
              {ORDENANZAS.map((ord) => (
                <label
                  key={ord}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  <input
                    type="checkbox"
                    value={ord}
                    {...register('ordenanzas')}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                  />
                  {ord}
                </label>
              ))}
            </div>
          </div>
        </form>

        <AbonosSection participante={participante} costoTotal={costoEnVivo} />
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
            disabled={mutation.isPending}
            onClick={handleSubmit((data) => mutation.mutate(data))}
            className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};
