import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { actualizarViajeTemplo, crearViajeTemplo } from '../../../lib/templo';
import { ORDENANZAS, GENEROS, campoCupoOrdenanza } from '../../../types';
import type { TemploViaje } from '../../../types';

const schema = z.object({
  fecha: z.string().min(1, 'Requerido'),
  fechaLimiteInscripcion: z.string().min(1, 'Requerido'),
  fechaConfirmada: z.boolean(),
  activo: z.boolean(),
  incluyeTransporte: z.boolean(),
  incluyeHospedaje: z.boolean(),
  incluyeDesayuno: z.boolean(),
  incluyeAlmuerzo: z.boolean(),
  costoTransporte: z.number().min(0),
  costoDesayuno: z.number().min(0),
  costoAlmuerzo: z.number().min(0),
  cuposTransporte: z.number().int().min(0),
  cuposHospedaje: z.number().int().min(0),
  cuposBaptisterioHombres: z.number().int().min(0),
  cuposBaptisterioMujeres: z.number().int().min(0),
  cuposIniciatoriasHombres: z.number().int().min(0),
  cuposIniciatoriasMujeres: z.number().int().min(0),
  cuposInvestiduraHombres: z.number().int().min(0),
  cuposInvestiduraMujeres: z.number().int().min(0),
  cuposSellamientoHombres: z.number().int().min(0),
  cuposSellamientoMujeres: z.number().int().min(0),
});

type FormValues = z.infer<typeof schema>;

const VALORES_NUEVO_VIAJE: FormValues = {
  fecha: '',
  fechaLimiteInscripcion: '',
  fechaConfirmada: true,
  activo: false,
  incluyeTransporte: false,
  incluyeHospedaje: false,
  incluyeDesayuno: false,
  incluyeAlmuerzo: false,
  costoTransporte: 0,
  costoDesayuno: 0,
  costoAlmuerzo: 0,
  cuposTransporte: 0,
  cuposHospedaje: 0,
  cuposBaptisterioHombres: 0,
  cuposBaptisterioMujeres: 0,
  cuposIniciatoriasHombres: 0,
  cuposIniciatoriasMujeres: 0,
  cuposInvestiduraHombres: 0,
  cuposInvestiduraMujeres: 0,
  cuposSellamientoHombres: 0,
  cuposSellamientoMujeres: 0,
};

interface Props {
  viaje: TemploViaje | null;
  onClose: () => void;
  onCreado?: (id: number) => void;
}

export const ViajeModal = ({ viaje, onClose, onCreado }: Props) => {
  const queryClient = useQueryClient();
  const esEdicion = !!viaje;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: viaje
      ? {
          fecha: viaje.fecha,
          fechaLimiteInscripcion: viaje.fechaLimiteInscripcion,
          fechaConfirmada: viaje.fechaConfirmada,
          activo: viaje.activo,
          incluyeTransporte: viaje.incluyeTransporte,
          incluyeHospedaje: viaje.incluyeHospedaje,
          incluyeDesayuno: viaje.incluyeDesayuno,
          incluyeAlmuerzo: viaje.incluyeAlmuerzo,
          costoTransporte: parseFloat(viaje.costoTransporte),
          costoDesayuno: parseFloat(viaje.costoDesayuno),
          costoAlmuerzo: parseFloat(viaje.costoAlmuerzo),
          cuposTransporte: viaje.cuposTransporte,
          cuposHospedaje: viaje.cuposHospedaje,
          cuposBaptisterioHombres: viaje.cuposBaptisterioHombres,
          cuposBaptisterioMujeres: viaje.cuposBaptisterioMujeres,
          cuposIniciatoriasHombres: viaje.cuposIniciatoriasHombres,
          cuposIniciatoriasMujeres: viaje.cuposIniciatoriasMujeres,
          cuposInvestiduraHombres: viaje.cuposInvestiduraHombres,
          cuposInvestiduraMujeres: viaje.cuposInvestiduraMujeres,
          cuposSellamientoHombres: viaje.cuposSellamientoHombres,
          cuposSellamientoMujeres: viaje.cuposSellamientoMujeres,
        }
      : VALORES_NUEVO_VIAJE,
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => (esEdicion ? actualizarViajeTemplo(viaje.id, data) : crearViajeTemplo(data)),
    onSuccess: (nuevoViaje) => {
      queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] });
      if (!esEdicion) onCreado?.(nuevoViaje.id);
      onClose();
    },
  });

  const mensajeError = (() => {
    if (!mutation.isError) return null;
    const err = mutation.error as { response?: { data?: { message?: string | string[] } } };
    const msg = err.response?.data?.message;
    return Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo guardar el viaje.');
  })();

  const numberField = (name: keyof FormValues, label: string, step = '1') => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">{label}</label>
      <input
        type="number"
        step={step}
        {...register(name, { valueAsNumber: true })}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
      />
      {errors[name] && <p className="mt-1 text-xs text-red-500">{errors[name]?.message as string}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-[var(--surface)] shadow-lg">
        <div className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text)]">
            {esEdicion ? 'Editar viaje al templo' : 'Nuevo viaje al templo'}
          </h2>
        </div>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="flex-1 space-y-6 overflow-y-auto px-6 py-5"
          noValidate
        >
          {mensajeError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {mensajeError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
                Fecha del viaje <span className="text-[var(--text-muted)]">(o estimada, si aún no es firme)</span>
              </label>
              <input
                type="date"
                {...register('fecha')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
              {errors.fecha && <p className="mt-1 text-xs text-red-500">{errors.fecha.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Fecha límite de inscripción</label>
              <input
                type="date"
                {...register('fechaLimiteInscripcion')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              />
              {errors.fechaLimiteInscripcion && (
                <p className="mt-1 text-xs text-red-500">{errors.fechaLimiteInscripcion.message}</p>
              )}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              {...register('fechaConfirmada')}
              className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
            />
            <span>
              Fecha confirmada
              <span className="block text-xs font-normal text-[var(--text-muted)]">
                Desmarca esto para "congelar" el viaje — el público verá "fecha por confirmar" en vez de la fecha
                exacta, pero los cupos y la edad mínima de ordenanzas se siguen validando con la fecha de arriba.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              {...register('activo')}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
            />
            Viaje activo (el formulario público apunta a este)
          </label>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--text)]">Servicios incluidos y costo por persona</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    {...register('incluyeTransporte')}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                  />
                  Transporte
                </label>
                {numberField('costoTransporte', 'Costo transporte ($)', '0.01')}
                {numberField('cuposTransporte', 'Cupos de transporte')}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    {...register('incluyeHospedaje')}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                  />
                  Hospedaje
                </label>
                {numberField('cuposHospedaje', 'Cupos de hospedaje')}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    {...register('incluyeDesayuno')}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                  />
                  Desayuno
                </label>
                {numberField('costoDesayuno', 'Costo desayuno ($)', '0.01')}
                <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    {...register('incluyeAlmuerzo')}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                  />
                  Almuerzo
                </label>
                {numberField('costoAlmuerzo', 'Costo almuerzo ($)', '0.01')}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--text)]">Cupos por ordenanza y género</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ORDENANZAS.map((ord) => (
                <div key={ord} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{ord}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {GENEROS.map((genero) =>
                      numberField(
                        campoCupoOrdenanza(ord, genero) as keyof FormValues,
                        genero === 'Hombre' ? 'Hombres' : 'Mujeres',
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

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
            {mutation.isPending ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear viaje'}
          </button>
        </div>
      </div>
    </div>
  );
};
