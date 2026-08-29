import { useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInscripcionesTemplo, listarViajesTemplo, crearInscripcionAdminTemplo } from '../../../lib/templo';
import {
  ORDENANZAS,
  GENEROS,
  EDAD_MINIMA_ORDENANZAS,
  campoCupoOrdenanza,
  calcularEdad,
  normalizarCedula,
  type Ordenanza,
  type Genero,
} from '../../../types';
import { formatFecha } from '../../../lib/format';
import { LoadingState } from '../../../components/ui/StatusViews';
import type { TemploViaje } from '../../../types';

const POLICY_VERSION = '2026-08';

const participanteSchema = z.object({
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

const formSchema = z
  .object({
    viajeId: z.number({ message: 'Selecciona un viaje' }),
    participantes: z.array(participanteSchema).min(1),
    consentimiento: z.boolean().refine((v) => v === true, {
      message: 'Confirma que cuentas con el consentimiento del titular',
    }),
  })
  .superRefine((data, ctx) => {
    const vistas = new Set<string>();
    data.participantes.forEach((p, index) => {
      const normalizada = normalizarCedula(p.cedulaOPasaporte);
      if (!normalizada) return;
      if (vistas.has(normalizada)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Esta cédula o pasaporte ya está en otro participante de este envío.',
          path: ['participantes', index, 'cedulaOPasaporte'],
        });
      } else {
        vistas.add(normalizada);
      }
    });
  });

type FormValues = z.infer<typeof formSchema>;

const participanteVacio = {
  cedulaOPasaporte: '',
  fechaNacimiento: '',
  nombreCompleto: '',
  telefono: '',
  email: '',
  genero: undefined as unknown as Genero,
  vaEnTransporte: false,
  necesitaHospedaje: false,
  quiereDesayuno: false,
  quiereAlmuerzo: false,
  ordenanzas: [] as Ordenanza[],
};

function calcularCosto(viaje: TemploViaje, p: { vaEnTransporte: boolean; quiereDesayuno: boolean; quiereAlmuerzo: boolean }): number {
  let total = 0;
  if (viaje.incluyeDesayuno && p.quiereDesayuno) total += parseFloat(viaje.costoDesayuno);
  if (viaje.incluyeAlmuerzo && p.quiereAlmuerzo) total += parseFloat(viaje.costoAlmuerzo);
  if (p.vaEnTransporte) total += parseFloat(viaje.costoTransporte);
  return total;
}

interface Props {
  viajeIdInicial: number | null;
  onClose: () => void;
}

export const NuevaInscripcionModal = ({ viajeIdInicial, onClose }: Props) => {
  const queryClient = useQueryClient();
  const { data: viajes, isLoading: cargandoViajes } = useQuery({
    queryKey: ['templo-viajes'],
    queryFn: listarViajesTemplo,
  });
  const { data: inscripciones } = useQuery({
    queryKey: ['templo-inscripciones'],
    queryFn: getInscripcionesTemplo,
  });

  const [error, setError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      viajeId: viajeIdInicial ?? undefined,
      participantes: [participanteVacio],
      consentimiento: false,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'participantes' });
  const viajeIdActual = watch('viajeId');
  const participantesActuales = watch('participantes');

  const viaje = viajes?.find((v) => v.id === viajeIdActual) ?? null;

  const cuposRestantes = useMemo(() => {
    if (!viaje) return null;
    const aprobados = (inscripciones ?? [])
      .filter((i) => i.viaje.id === viaje.id)
      .flatMap((i) => i.participantes)
      .filter((p) => p.aprobado);

    const restantes: Record<string, number> = {
      transporte: viaje.cuposTransporte - aprobados.filter((p) => p.vaEnTransporte).length,
      hospedaje: viaje.cuposHospedaje - aprobados.filter((p) => p.necesitaHospedaje).length,
    };
    for (const ord of ORDENANZAS) {
      for (const genero of GENEROS) {
        const campo = campoCupoOrdenanza(ord, genero);
        const ocupado = aprobados.filter(
          (p) => p.genero === genero && p.ordenanzas.split(', ').filter(Boolean).includes(ord),
        ).length;
        restantes[campo] = (viaje as unknown as Record<string, number>)[campo] - ocupado;
      }
    }
    return restantes;
  }, [viaje, inscripciones]);

  const cedulasYaEnViaje = useMemo(() => {
    if (!viaje) return new Set<string>();
    return new Set(
      (inscripciones ?? [])
        .filter((i) => i.viaje.id === viaje.id)
        .flatMap((i) => i.participantes)
        .map((p) => normalizarCedula(p.cedulaOPasaporte)),
    );
  }, [viaje, inscripciones]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      crearInscripcionAdminTemplo({
        viajeId: data.viajeId,
        participantes: data.participantes,
        consentimiento: data.consentimiento,
        policyVersion: POLICY_VERSION,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] });
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo registrar la inscripción.'));
    },
  });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-[var(--surface)] shadow-lg">
        <div className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text)]">Nueva inscripción</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Registrada por ti desde el panel — sin límite de fecha, pero los cupos siguen aplicando igual.
          </p>
        </div>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
          noValidate
        >
          {(error || mutation.isError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error || 'No se pudo registrar la inscripción.'}
            </div>
          )}

          {cargandoViajes ? (
            <LoadingState label="Cargando viajes…" />
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Viaje</label>
              <select
                {...register('viajeId', { valueAsNumber: true })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              >
                <option value="">Selecciona…</option>
                {(viajes ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {formatFecha(v.fecha)}
                    {!v.fechaConfirmada ? ' (por confirmar)' : ''}
                    {v.activo ? ' — activo' : ''}
                  </option>
                ))}
              </select>
              {errors.viajeId && <p className="mt-1 text-xs text-red-500">{errors.viajeId.message}</p>}
            </div>
          )}

          {viaje && (
            <>
              {fields.map((field, index) => {
                const p = participantesActuales?.[index];
                const generoActual = p?.genero as Genero | undefined;
                const fechaNacimientoActual = p?.fechaNacimiento;
                const edadActual = fechaNacimientoActual ? calcularEdad(fechaNacimientoActual, viaje.fecha) : null;
                const faltaFecha = edadActual === null;
                const menorDeEdad = edadActual !== null && edadActual < EDAD_MINIMA_ORDENANZAS;
                const cedulaActual = normalizarCedula(p?.cedulaOPasaporte ?? '');
                const cedulaDuplicada =
                  cedulaActual.length > 0 &&
                  ((participantesActuales ?? []).some(
                    (p2, i2) => i2 !== index && normalizarCedula(p2?.cedulaOPasaporte ?? '') === cedulaActual,
                  ) ||
                    cedulasYaEnViaje.has(cedulaActual));

                return (
                  <div key={field.id} className="rounded-xl border border-[var(--border)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Participante {index + 1}
                      </h3>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-xs font-medium text-[var(--danger)] hover:underline"
                        >
                          Quitar
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[var(--text)]">Cédula o pasaporte</label>
                        <input
                          {...register(`participantes.${index}.cedulaOPasaporte`, {
                            onChange: (e) => {
                              const limpio = normalizarCedula(e.target.value);
                              if (limpio !== e.target.value) {
                                setValue(`participantes.${index}.cedulaOPasaporte`, limpio);
                              }
                            },
                          })}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        />
                        {(errors.participantes?.[index]?.cedulaOPasaporte || cedulaDuplicada) && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.participantes?.[index]?.cedulaOPasaporte?.message ||
                              'Ya existe un participante con esta cédula en este viaje.'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[var(--text)]">Fecha de nacimiento</label>
                        <input
                          type="date"
                          {...register(`participantes.${index}.fechaNacimiento`)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-[var(--text)]">Nombre completo</label>
                      <input
                        {...register(`participantes.${index}.nombreCompleto`)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                      />
                      {errors.participantes?.[index]?.nombreCompleto && (
                        <p className="mt-1 text-xs text-red-500">{errors.participantes[index]?.nombreCompleto?.message}</p>
                      )}
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[var(--text)]">Teléfono</label>
                        <input
                          {...register(`participantes.${index}.telefono`)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[var(--text)]">Email</label>
                        <input
                          {...register(`participantes.${index}.email`)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-[var(--text)]">Género</label>
                      <select
                        {...register(`participantes.${index}.genero`)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                      >
                        <option value="">Selecciona…</option>
                        {GENEROS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {viaje.incluyeTransporte && (
                        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)]">
                          <input
                            type="checkbox"
                            {...register(`participantes.${index}.vaEnTransporte`)}
                            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                          />
                          Transporte
                        </label>
                      )}
                      {viaje.incluyeHospedaje && (
                        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)]">
                          <input
                            type="checkbox"
                            {...register(`participantes.${index}.necesitaHospedaje`)}
                            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                          />
                          Hospedaje
                        </label>
                      )}
                      {viaje.incluyeDesayuno && (
                        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)]">
                          <input
                            type="checkbox"
                            {...register(`participantes.${index}.quiereDesayuno`)}
                            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                          />
                          Desayuno
                        </label>
                      )}
                      {viaje.incluyeAlmuerzo && (
                        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text)]">
                          <input
                            type="checkbox"
                            {...register(`participantes.${index}.quiereAlmuerzo`)}
                            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                          />
                          Almuerzo
                        </label>
                      )}
                    </div>

                    <div className="mt-3">
                      <p className="mb-1 text-xs font-medium text-[var(--text)]">
                        Ordenanzas{' '}
                        <span className="font-normal text-[var(--text-muted)]">(opcional — menores sin edad, dejar vacío)</span>
                      </p>
                      {faltaFecha ? (
                        <p className="mb-1 text-xs text-[var(--text-muted)]">Ingresa la fecha de nacimiento primero.</p>
                      ) : menorDeEdad ? (
                        <p className="mb-1 text-xs text-[var(--text-muted)]">
                          No tiene la edad mínima ({EDAD_MINIMA_ORDENANZAS} años) para ordenanzas.
                        </p>
                      ) : !generoActual ? (
                        <p className="mb-1 text-xs text-[var(--text-muted)]">Selecciona el género primero.</p>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        {ORDENANZAS.map((ord) => {
                          const restanteOrd =
                            generoActual && cuposRestantes ? cuposRestantes[campoCupoOrdenanza(ord, generoActual)] : undefined;
                          const sinCupo = faltaFecha || menorDeEdad || !generoActual || (restanteOrd ?? 0) <= 0;
                          return (
                            <label
                              key={ord}
                              className={`flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs ${
                                sinCupo ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  value={ord}
                                  disabled={sinCupo}
                                  {...register(`participantes.${index}.ordenanzas`)}
                                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                                />
                                {ord}
                              </span>
                              {generoActual && !faltaFecha && !menorDeEdad && (
                                <span>{restanteOrd ?? 0} disp.</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <p className="mt-3 text-right text-sm font-semibold text-[var(--text)]">
                      Costo: $
                      {calcularCosto(viaje, {
                        vaEnTransporte: !!p?.vaEnTransporte,
                        quiereDesayuno: !!p?.quiereDesayuno,
                        quiereAlmuerzo: !!p?.quiereAlmuerzo,
                      }).toFixed(2)}
                    </p>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => append(participanteVacio)}
                className="w-full rounded-xl border-2 border-dashed border-[var(--border)] py-3 text-sm font-medium text-[var(--text-muted)] hover:border-[var(--sage-600)] hover:text-[var(--sage-600)]"
              >
                + Agregar otro participante
              </button>

              <div className="flex items-center justify-between rounded-lg bg-[var(--brown-700)] px-4 py-3 text-white">
                <span className="text-sm font-medium">Total a pagar</span>
                <span className="text-lg font-semibold tabular-nums">
                  $
                  {(participantesActuales ?? [])
                    .reduce(
                      (sum, p) =>
                        sum +
                        calcularCosto(viaje, {
                          vaEnTransporte: !!p?.vaEnTransporte,
                          quiereDesayuno: !!p?.quiereDesayuno,
                          quiereAlmuerzo: !!p?.quiereAlmuerzo,
                        }),
                      0,
                    )
                    .toFixed(2)}
                </span>
              </div>

              <label className="flex items-start gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  {...register('consentimiento')}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                />
                Confirmo que cuento con el consentimiento del titular (o de su padre/madre/tutor si es menor) para
                registrar estos datos.
              </label>
              {errors.consentimiento && <p className="text-xs text-red-500">{errors.consentimiento.message}</p>}
            </>
          )}
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
            disabled={mutation.isPending || !viaje}
            onClick={handleSubmit((data) => mutation.mutate(data))}
            className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {mutation.isPending ? 'Guardando…' : 'Registrar inscripción'}
          </button>
        </div>
      </div>
    </div>
  );
};
