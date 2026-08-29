import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import { getRecaptchaToken, preloadRecaptcha } from '../lib/recaptcha';
import {
  ORDENANZAS,
  GENEROS,
  campoCupoOrdenanza,
  calcularCosto,
  normalizarCedula,
  type Ordenanza,
  type Genero,
  type ViajeActivo,
} from '../types';
import { POLICY_VERSION } from '../lib/responsable';
import { Footer } from '../components/Footer';
import { useConfig } from '../lib/useConfig';
import logoMark from '../assets/los-laureles-logo.png';

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
    participantes: z.array(participanteSchema).min(1),
    consentimiento: z.boolean().refine((v) => v === true, {
      message: 'Debes dar tu consentimiento para poder enviar el formulario',
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
          message: 'Esta cédula o pasaporte ya está registrada en otro participante de este formulario.',
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
  ordenanzas: [],
};

// Antes de poder agregar otro participante, el actual debe tener llenos sus
// datos básicos — evita filas a medio llenar mientras se sigue agregando.
function participanteCompleto(p: Partial<FormValues['participantes'][number]> | undefined): boolean {
  return !!(
    p?.cedulaOPasaporte?.trim() &&
    p?.fechaNacimiento?.trim() &&
    p?.nombreCompleto?.trim() &&
    p?.telefono?.trim() &&
    p?.email?.trim() &&
    p?.genero
  );
}

function formatFecha(fecha: string): string {
  try {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-EC', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
}

// Edad del participante al día del viaje (no a hoy) — así un niño que cumple
// 11 justo antes del viaje ya califica para ordenanzas.
function calcularEdad(fechaNacimiento: string, fechaReferencia: string): number | null {
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  const referencia = new Date(fechaReferencia + 'T00:00:00');
  if (isNaN(nacimiento.getTime()) || isNaN(referencia.getTime())) return null;

  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const cumpleAnios = new Date(referencia.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
  if (referencia < cumpleAnios) edad--;
  return edad;
}

const EDAD_MINIMA_ORDENANZAS = 11;

export const InscripcionPage = () => {
  const { data: config } = useConfig();
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => preloadRecaptcha(), []);

  const {
    data: viaje,
    isLoading: cargandoViaje,
    isError: errorViaje,
  } = useQuery<ViajeActivo>({
    queryKey: ['viaje-activo'],
    queryFn: async () => (await api.get('/templo/viaje-activo')).data,
    retry: false,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { participantes: [participanteVacio], consentimiento: false },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'participantes' });
  const participantesActuales = watch('participantes');
  const puedeAgregarParticipante = (participantesActuales ?? []).every(participanteCompleto);

  // Si cambia la fecha de nacimiento o el género y el participante deja de
  // calificar (menor de 11 años, o sin género), se limpian las ordenanzas ya
  // marcadas para que no queden seleccionadas "a escondidas".
  useEffect(() => {
    if (!viaje) return;
    participantesActuales?.forEach((p, index) => {
      if (!p?.ordenanzas?.length) return;
      const edad = p.fechaNacimiento ? calcularEdad(p.fechaNacimiento, viaje.fecha) : null;
      const elegible = !!p.genero && edad !== null && edad >= EDAD_MINIMA_ORDENANZAS;
      if (!elegible) {
        setValue(`participantes.${index}.ordenanzas`, []);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(participantesActuales?.map((p) => [p?.fechaNacimiento, p?.genero]))]);

  // Verifica en vivo contra el backend si la cédula ya tiene una inscripción
  // registrada para este viaje (de un envío anterior, no de este formulario).
  const [cedulasRegistradas, setCedulasRegistradas] = useState<Record<number, boolean>>({});
  const cedulasSerializadas = JSON.stringify(participantesActuales?.map((p) => p?.cedulaOPasaporte) ?? []);

  useEffect(() => {
    const lista = participantesActuales ?? [];
    const timer = setTimeout(() => {
      Promise.all(
        lista.map(async (p, index) => {
          const normalizada = normalizarCedula(p?.cedulaOPasaporte ?? '');
          if (normalizada.length < 3) return [index, false] as const;
          try {
            const { data } = await api.get<{ registrada: boolean }>('/templo/viaje-activo/verificar-cedula', {
              params: { cedula: normalizada },
            });
            return [index, data.registrada] as const;
          } catch {
            return [index, false] as const;
          }
        }),
      ).then((resultados) => {
        setCedulasRegistradas(Object.fromEntries(resultados.filter(([, registrada]) => registrada)));
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cedulasSerializadas]);

  const hayCedulasConflictivas = (participantesActuales ?? []).some((p, index) => {
    const normalizada = normalizarCedula(p?.cedulaOPasaporte ?? '');
    if (!normalizada) return false;
    const duplicadaEnEnvio = (participantesActuales ?? []).some(
      (p2, i2) => i2 !== index && normalizarCedula(p2?.cedulaOPasaporte ?? '') === normalizada,
    );
    return duplicadaEnEnvio || !!cedulasRegistradas[index];
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const recaptchaToken = await getRecaptchaToken('inscripcion_viaje_templo');
      return api.post('/templo/inscripciones', {
        participantes: data.participantes,
        consentimiento: data.consentimiento,
        policyVersion: POLICY_VERSION,
        recaptchaToken,
      });
    },
    onSuccess: () => setEnviado(true),
    onError: (err: any) => {
      setError(err.response?.data?.message || 'No se pudo enviar la inscripción. Intenta de nuevo.');
    },
  });

  if (enviado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-[var(--success)]">
            ✓
          </div>
          <h1 className="text-lg font-semibold text-[var(--text)]">¡Inscripción recibida!</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Gracias por registrarte para el Viaje para Adorar en el Templo. Nos pondremos en contacto contigo con
            más detalles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={config?.logoDataUrl || logoMark}
            alt={config?.nombreUnidad || 'Logo'}
            className="mb-3 h-32 w-32 object-contain"
          />
          <h1 className="text-2xl font-semibold text-[var(--text)]">Inscripción — Viaje para Adorar en el Templo</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--text-muted)]">
            "Todo ser humano que viene a la tierra es el producto de generaciones de padres... nuestros anhelos
            innatos por tener conexiones familiares se hacen realidad cuando nos entrelazamos con nuestros
            antepasados mediante las ordenanzas sagradas del templo." — Presidente Russell M. Nelson
          </p>
          <p className="mt-3 max-w-lg text-xs italic text-[var(--text-muted)]">
            Esta no es una página oficial de{' '}
            <a
              href="https://www.churchofjesuschrist.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              La Iglesia de Jesucristo de los Santos de los Últimos Días
            </a>
            . Es una herramienta creada por el Barrio Los Laureles para organizar este viaje.
          </p>
        </div>

        {cargandoViaje && (
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
            Cargando información del viaje…
          </div>
        )}

        {errorViaje && (
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
            No hay ningún viaje al templo activo en este momento. Vuelve a intentarlo más tarde.
          </div>
        )}

        {viaje && !viaje.inscripcionesAbiertas && (
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
            El plazo de inscripción para el viaje del {formatFecha(viaje.fecha)} ya venció.
          </div>
        )}

        {viaje && viaje.inscripcionesAbiertas && (
          <>
            <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text)]">
              <p className="font-semibold text-[var(--brown-700)]">
                {viaje.fechaConfirmada ? `Viaje del ${formatFecha(viaje.fecha)}` : 'Viaje — fecha por confirmar'}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Inscríbete antes del {formatFecha(viaje.fechaLimiteInscripcion)}. Incluye:{' '}
                {[
                  viaje.incluyeTransporte && 'transporte',
                  viaje.incluyeHospedaje && 'hospedaje',
                  viaje.incluyeDesayuno && 'desayuno',
                  viaje.incluyeAlmuerzo && 'almuerzo',
                ]
                  .filter(Boolean)
                  .join(', ') || 'sin servicios adicionales configurados'}
                .
              </p>
            </div>

            <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Tus datos se usan para organizar el Viaje para Adorar en el Templo. Al final del formulario debes dar
              tu consentimiento explícito para poder enviarlo — ver el detalle completo en la{' '}
              <Link to="/politica-datos" className="underline">
                Política de Protección de Datos Personales
              </Link>
              .
            </div>

            <form
              onSubmit={handleSubmit((data) => {
                setError('');
                mutation.mutate(data);
              })}
              className="space-y-6"
              noValidate
            >
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {fields.map((field, index) => {
                const generoActual = participantesActuales?.[index]?.genero as Genero | undefined;
                const fechaNacimientoActual = participantesActuales?.[index]?.fechaNacimiento;
                const edadActual = fechaNacimientoActual
                  ? calcularEdad(fechaNacimientoActual, viaje.fecha)
                  : null;
                const faltaFechaNacimiento = edadActual === null;
                const menorDeEdadOrdenanzas = edadActual !== null && edadActual < EDAD_MINIMA_ORDENANZAS;
                const cedulaActual = normalizarCedula(participantesActuales?.[index]?.cedulaOPasaporte ?? '');
                const cedulaDuplicada =
                  cedulaActual.length > 0 &&
                  (participantesActuales ?? []).some(
                    (p, i) => i !== index && normalizarCedula(p?.cedulaOPasaporte ?? '') === cedulaActual,
                  );
                const cedulaYaRegistrada = !cedulaDuplicada && !!cedulasRegistradas[index];
                return (
                  <div
                    key={field.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--brown-700)]">
                        Participante {index + 1}
                      </h2>
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

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Campo
                        label="Cédula o pasaporte"
                        error={
                          errors.participantes?.[index]?.cedulaOPasaporte?.message ||
                          (cedulaDuplicada
                            ? 'Esta cédula o pasaporte ya está registrada en otro participante de este formulario.'
                            : cedulaYaRegistrada
                              ? 'Ya existe un registro para este viaje con esta cédula o pasaporte. Si necesitas hacer un cambio, comunícate con la Presidencia del Quórum de Élderes o la Presidencia de la Sociedad de Socorro.'
                              : undefined)
                        }
                      >
                        <input
                          {...register(`participantes.${index}.cedulaOPasaporte`, {
                            onChange: (e) => {
                              const limpio = normalizarCedula(e.target.value);
                              if (limpio !== e.target.value) {
                                setValue(`participantes.${index}.cedulaOPasaporte`, limpio);
                              }
                            },
                          })}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        />
                      </Campo>

                      <Campo
                        label="Fecha de nacimiento"
                        error={errors.participantes?.[index]?.fechaNacimiento?.message}
                      >
                        <input
                          type="date"
                          {...register(`participantes.${index}.fechaNacimiento`)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        />
                      </Campo>

                      <Campo
                        label="Nombre completo"
                        className="sm:col-span-2"
                        error={errors.participantes?.[index]?.nombreCompleto?.message}
                      >
                        <input
                          {...register(`participantes.${index}.nombreCompleto`)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        />
                      </Campo>

                      <Campo label="Teléfono" error={errors.participantes?.[index]?.telefono?.message}>
                        <input
                          type="tel"
                          {...register(`participantes.${index}.telefono`)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        />
                      </Campo>

                      <Campo label="Email" error={errors.participantes?.[index]?.email?.message}>
                        <input
                          type="email"
                          {...register(`participantes.${index}.email`)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        />
                      </Campo>

                      <Campo label="Género" error={errors.participantes?.[index]?.genero?.message}>
                        <select
                          {...register(`participantes.${index}.genero`)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                        >
                          <option value="">Selecciona…</option>
                          {GENEROS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </Campo>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {viaje.incluyeTransporte && (
                        <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              {...register(`participantes.${index}.vaEnTransporte`)}
                              disabled={(viaje.cuposRestantes.transporte ?? 0) <= 0}
                              className="h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--sage-600)]"
                            />
                            Viaja en el transporte del barrio
                          </span>
                          <CupoBadge restantes={viaje.cuposRestantes.transporte} />
                        </label>
                      )}

                      {viaje.incluyeHospedaje && (
                        <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              {...register(`participantes.${index}.necesitaHospedaje`)}
                              disabled={(viaje.cuposRestantes.hospedaje ?? 0) <= 0}
                              className="h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--sage-600)]"
                            />
                            Necesita hospedaje
                          </span>
                          <CupoBadge restantes={viaje.cuposRestantes.hospedaje} />
                        </label>
                      )}

                      {viaje.incluyeDesayuno && (
                        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                          <input
                            type="checkbox"
                            {...register(`participantes.${index}.quiereDesayuno`)}
                            className="h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--sage-600)]"
                          />
                          ¿Desea desayuno?
                        </label>
                      )}

                      {viaje.incluyeAlmuerzo && (
                        <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                          <input
                            type="checkbox"
                            {...register(`participantes.${index}.quiereAlmuerzo`)}
                            className="h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--sage-600)]"
                          />
                          ¿Desea almuerzo?
                        </label>
                      )}
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-sm font-medium text-[var(--text)]">
                        Ordenanzas{' '}
                        <span className="text-[var(--text-muted)]">
                          (opcional — déjalo vacío si aún no tiene la edad para ingresar al templo)
                        </span>
                      </p>
                      {faltaFechaNacimiento ? (
                        <p className="mb-2 text-xs text-[var(--text-muted)]">
                          Ingresa primero la fecha de nacimiento para ver si califica para ordenanzas.
                        </p>
                      ) : menorDeEdadOrdenanzas ? (
                        <p className="mb-2 text-xs text-[var(--text-muted)]">
                          Debe tener al menos {EDAD_MINIMA_ORDENANZAS} años (a la fecha del viaje) para participar en
                          ordenanzas del templo.
                        </p>
                      ) : (
                        !generoActual && (
                          <p className="mb-2 text-xs text-[var(--text-muted)]">
                            Selecciona primero el género para ver los cupos disponibles.
                          </p>
                        )
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ORDENANZAS.map((ord) => {
                          const restantesOrd = generoActual
                            ? viaje.cuposRestantes[campoCupoOrdenanza(ord as Ordenanza, generoActual)]
                            : undefined;
                          const sinCupo =
                            !generoActual || faltaFechaNacimiento || menorDeEdadOrdenanzas || (restantesOrd ?? 0) <= 0;
                          return (
                            <label
                              key={ord}
                              className={`flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm ${sinCupo ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'}`}
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  value={ord}
                                  disabled={sinCupo}
                                  {...register(`participantes.${index}.ordenanzas`)}
                                  className="h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--sage-600)]"
                                />
                                {ord}
                              </span>
                              {generoActual && !faltaFechaNacimiento && !menorDeEdadOrdenanzas && (
                                <CupoBadge restantes={restantesOrd} />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <p className="mt-4 text-right text-sm font-semibold text-[var(--brown-700)]">
                      Costo de este participante: $
                      {calcularCosto(
                        viaje,
                        !!participantesActuales?.[index]?.vaEnTransporte,
                        !!participantesActuales?.[index]?.quiereDesayuno,
                        !!participantesActuales?.[index]?.quiereAlmuerzo,
                      ).toFixed(2)}
                    </p>
                  </div>
                );
              })}

              <button
                type="button"
                disabled={!puedeAgregarParticipante}
                onClick={() =>
                  append({
                    ...participanteVacio,
                    telefono: participantesActuales?.[0]?.telefono ?? '',
                    email: participantesActuales?.[0]?.email ?? '',
                  })
                }
                className="w-full rounded-xl border-2 border-dashed border-[var(--border)] py-3 text-sm font-medium text-[var(--brown-700)] hover:border-[var(--sage-600)] hover:text-[var(--sage-600)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--brown-700)]"
              >
                + Agregar otro participante
              </button>
              {!puedeAgregarParticipante && (
                <p className="text-center text-xs text-[var(--text-muted)]">
                  Completa cédula, fecha de nacimiento, nombre, teléfono, email y género de este participante antes
                  de agregar otro.
                </p>
              )}

              <div className="flex items-center justify-between rounded-xl bg-[var(--brown-700)] px-5 py-4 text-white">
                <span className="text-sm font-medium">Total a pagar</span>
                <span className="text-xl font-bold">
                  $
                  {(participantesActuales ?? [])
                    .reduce(
                      (sum, p) =>
                        sum + calcularCosto(viaje, !!p?.vaEnTransporte, !!p?.quiereDesayuno, !!p?.quiereAlmuerzo),
                      0,
                    )
                    .toFixed(2)}
                </span>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <label className="flex items-start gap-2.5 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    {...register('consentimiento')}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                  />
                  <span>
                    Autorizo el tratamiento de estos datos personales, incluidas las ordenanzas seleccionadas, de
                    acuerdo con la{' '}
                    <Link to="/politica-datos" className="underline">
                      Política de Protección de Datos Personales
                    </Link>
                    . Si estoy registrando a un menor de edad, confirmo ser su padre, madre o tutor legal y consiento
                    en su representación.
                  </span>
                </label>
                {errors.consentimiento && (
                  <p className="mt-1.5 text-xs text-red-500">{errors.consentimiento.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={mutation.isPending || hayCedulasConflictivas}
                className="w-full rounded-xl bg-[var(--brown-700)] py-3.5 text-base font-semibold text-white transition-colors hover:bg-[var(--brown-500)] disabled:opacity-60"
              >
                {mutation.isPending ? 'Enviando…' : 'Inscribirse'}
              </button>

              <p className="text-center text-xs leading-relaxed text-[var(--text-muted)]">
                Este sitio está protegido por reCAPTCHA; aplican la Política de Privacidad y los Términos de
                Servicio de Google.
              </p>
            </form>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

const CupoBadge = ({ restantes }: { restantes: number | undefined }) => {
  const n = restantes ?? 0;
  if (n <= 0) {
    return <span className="shrink-0 whitespace-nowrap text-xs font-medium text-[var(--danger)]">sin cupos</span>;
  }
  return (
    <span className="shrink-0 whitespace-nowrap text-xs text-[var(--text-muted)]">
      {n} disponible{n === 1 ? '' : 's'}
    </span>
  );
};

const Campo = ({
  label,
  error,
  className = '',
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={className}>
    <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);
