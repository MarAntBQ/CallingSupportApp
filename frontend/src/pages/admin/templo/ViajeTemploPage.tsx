import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInscripcionesTemplo, aprobarParticipanteTemplo } from '../../../lib/templo';
import { formatFecha } from '../../../lib/format';
import { useConfig } from '../../../lib/useConfig';
import { Card } from '../../../components/ui/Card';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/StatusViews';
import { ModuleBreadcrumb } from '../../../components/ui/ModuleBreadcrumb';
import { ParticipanteModal } from './ParticipanteModal';
import { ViajeModal } from './ViajeModal';
import { ReportesViaje } from './ReportesViaje';
import { NuevaInscripcionModal } from './NuevaInscripcionModal';
import { HabitacionesViaje } from './HabitacionesViaje';
import type { TemploInscripcion, TemploParticipante, TemploViaje } from '../../../types';

interface InscripcionMeta {
  id: number;
  createdAt: string;
  ip: string | null;
  consentimiento: boolean;
  policyVersion: string;
}

interface ParticipanteConMeta extends TemploParticipante {
  inscripcion: InscripcionMeta;
}

interface ViajeGrupo {
  viaje: TemploViaje;
  participantes: ParticipanteConMeta[];
}

function agruparPorViaje(inscripciones: TemploInscripcion[]): ViajeGrupo[] {
  const mapa = new Map<number, ViajeGrupo>();
  for (const insc of inscripciones) {
    const inscripcionMeta: InscripcionMeta = {
      id: insc.id,
      createdAt: insc.createdAt,
      ip: insc.ip,
      consentimiento: insc.consentimiento,
      policyVersion: insc.policyVersion,
    };
    const conMeta: ParticipanteConMeta[] = insc.participantes.map((p) => ({ ...p, inscripcion: inscripcionMeta }));

    const existente = mapa.get(insc.viaje.id);
    if (existente) {
      existente.participantes.push(...conMeta);
    } else {
      mapa.set(insc.viaje.id, { viaje: insc.viaje, participantes: conMeta });
    }
  }
  return Array.from(mapa.values()).sort((a, b) => (a.viaje.fecha < b.viaje.fecha ? 1 : -1));
}

type Tab = 'pendientes' | 'aprobados' | 'todos';
type Vista = 'participantes' | 'habitaciones' | 'reportes';

const serviciosDe = (p: TemploParticipante): string =>
  [
    p.vaEnTransporte && 'Transporte',
    p.necesitaHospedaje && 'Hospedaje',
    p.quiereDesayuno && 'Desayuno',
    p.quiereAlmuerzo && 'Almuerzo',
  ]
    .filter(Boolean)
    .join(' · ') || '—';

const ViajeCard = ({
  grupo,
  seleccionado,
  onClick,
}: {
  grupo: ViajeGrupo;
  seleccionado: boolean;
  onClick: () => void;
}) => {
  const aprobados = grupo.participantes.filter((p) => p.aprobado).length;
  const pendientes = grupo.participantes.length - aprobados;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[220px] flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
        seleccionado
          ? 'border-[var(--brown-700)] bg-[var(--brown-700)] text-white'
          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brown-500)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${seleccionado ? 'text-white' : 'text-[var(--text)]'}`}>
          {formatFecha(grupo.viaje.fecha)}
        </span>
        <div className="flex gap-1.5">
          {!grupo.viaje.fechaConfirmada && (
            <span className="rounded-full bg-[var(--text-muted)] px-2 py-0.5 text-[10px] font-bold text-white">
              POR CONFIRMAR
            </span>
          )}
          {grupo.viaje.activo && (
            <span className="rounded-full bg-[var(--sage-600)] px-2 py-0.5 text-[10px] font-bold text-white">
              ACTIVO
            </span>
          )}
        </div>
      </div>
      <div className={`flex items-center gap-3 text-xs ${seleccionado ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
        <span>{grupo.participantes.length} inscritos</span>
        <span className="text-[var(--success)]">{aprobados} aprobados</span>
        <span className="text-[var(--warning)]">{pendientes} pendientes</span>
      </div>
    </button>
  );
};

const ParticipanteRow = ({
  p,
  seleccionado,
  onToggleSeleccion,
  onCambiarAprobado,
  onVerDetalle,
  cargando,
}: {
  p: ParticipanteConMeta;
  seleccionado: boolean;
  onToggleSeleccion: () => void;
  onCambiarAprobado: (id: number, aprobado: boolean) => void;
  onVerDetalle: () => void;
  cargando: boolean;
}) => (
  <tr className={`border-b border-[var(--border)] last:border-0 ${seleccionado ? 'bg-[var(--sage-600)]/5' : ''}`}>
    <td className="py-3 pl-1 pr-2 align-top">
      <input
        type="checkbox"
        checked={seleccionado}
        onChange={onToggleSeleccion}
        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
      />
    </td>
    <td className="py-3 pr-4 align-top">
      <button
        type="button"
        onClick={onVerDetalle}
        className="text-left text-sm font-medium text-[var(--brown-700)] hover:text-[var(--sage-600)] hover:underline"
      >
        {p.nombreCompleto}
      </button>
      <p className="text-xs text-[var(--text-muted)]">
        {p.cedulaOPasaporte} · {p.genero}
      </p>
    </td>
    <td className="py-3 pr-4 align-top text-xs text-[var(--text-muted)]">
      <p>{p.telefono}</p>
      <p>{p.email}</p>
    </td>
    <td className="py-3 pr-4 align-top text-xs text-[var(--text-muted)]">{p.ordenanzas || '—'}</td>
    <td className="py-3 pr-4 align-top text-xs text-[var(--text-muted)]">{serviciosDe(p)}</td>
    <td className="py-3 pr-4 align-top text-sm font-semibold text-[var(--text)]">
      ${parseFloat(p.costoTotal).toFixed(2)}
    </td>
    <td className="py-3 pr-4 align-top">
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          p.aprobado ? 'bg-green-50 text-[var(--success)]' : 'bg-[var(--warning)]/10 text-[var(--warning)]'
        }`}
      >
        {p.aprobado ? 'Aprobado' : 'Pendiente'}
      </span>
    </td>
    <td className="py-3 text-right align-top">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onVerDetalle}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg)]"
        >
          Detalle
        </button>
        {p.aprobado ? (
          <button
            type="button"
            disabled={cargando}
            onClick={() => onCambiarAprobado(p.id, false)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-red-50 disabled:opacity-60"
          >
            Desaprobar
          </button>
        ) : (
          <button
            type="button"
            disabled={cargando}
            onClick={() => onCambiarAprobado(p.id, true)}
            className="rounded-lg bg-[var(--brown-700)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            Aprobar
          </button>
        )}
      </div>
    </td>
  </tr>
);

export const ViajeTemploPage = () => {
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const [viajeId, setViajeId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('pendientes');
  const [vista, setVista] = useState<Vista>('participantes');
  const [participanteDetalle, setParticipanteDetalle] = useState<ParticipanteConMeta | null>(null);
  const [editandoViaje, setEditandoViaje] = useState(false);
  const [creandoViaje, setCreandoViaje] = useState(false);
  const [inscribiendo, setInscribiendo] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['templo-inscripciones'],
    queryFn: getInscripcionesTemplo,
  });

  const grupos = useMemo(() => agruparPorViaje(data ?? []), [data]);

  useEffect(() => {
    if (viajeId === null && grupos.length > 0) {
      setViajeId(grupos.find((g) => g.viaje.activo)?.viaje.id ?? grupos[0].viaje.id);
    }
  }, [grupos, viajeId]);

  useEffect(() => {
    setSeleccionados(new Set());
  }, [viajeId, tab]);

  const mutation = useMutation({
    mutationFn: ({ id, aprobado }: { id: number; aprobado: boolean }) => aprobarParticipanteTemplo(id, aprobado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] }),
  });

  const mutationMasiva = useMutation({
    mutationFn: async ({ ids, aprobado }: { ids: number[]; aprobado: boolean }) => {
      await Promise.all(ids.map((id) => aprobarParticipanteTemplo(id, aprobado)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templo-inscripciones'] });
      setSeleccionados(new Set());
    },
  });

  if (isLoading) return <LoadingState label="Cargando viajes al templo…" />;
  if (isError || !data) return <ErrorState message="No se pudo cargar el listado de inscripciones." />;

  const grupoActual = grupos.find((g) => g.viaje.id === viajeId) ?? null;
  const participantesFiltrados = (grupoActual?.participantes ?? []).filter((p) => {
    if (tab === 'pendientes') return !p.aprobado;
    if (tab === 'aprobados') return p.aprobado;
    return true;
  });

  const todosSeleccionados =
    participantesFiltrados.length > 0 && participantesFiltrados.every((p) => seleccionados.has(p.id));
  const algunosSeleccionados = participantesFiltrados.some((p) => seleccionados.has(p.id));

  if (headerCheckboxRef.current) {
    headerCheckboxRef.current.indeterminate = algunosSeleccionados && !todosSeleccionados;
  }

  const toggleSeleccionTodos = () => {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (todosSeleccionados) {
        participantesFiltrados.forEach((p) => nuevo.delete(p.id));
      } else {
        participantesFiltrados.forEach((p) => nuevo.add(p.id));
      }
      return nuevo;
    });
  };

  const toggleSeleccion = (id: number) => {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ModuleBreadcrumb modulo="Iglesia" submodulo="Templo e Historia Familiar" />
          <h1 className="text-xl font-semibold text-[var(--text)]">Viaje al Templo</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Inscripciones{config?.nombreUnidad ? ` de ${config.nombreUnidad}` : ''} — aprueba, edita datos y genera
            reportes de transporte, alimentación y ordenanzas.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setInscribiendo(true)}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg)]"
          >
            Nueva inscripción
          </button>
          <button
            type="button"
            onClick={() => setCreandoViaje(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--brown-700)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brown-500)]"
          >
            Nuevo viaje
          </button>
        </div>
      </div>

      {grupos.length === 0 ? (
        <EmptyState message="Todavía no hay inscripciones registradas." />
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {grupos.map((g) => (
              <ViajeCard
                key={g.viaje.id}
                grupo={g}
                seleccionado={g.viaje.id === viajeId}
                onClick={() => setViajeId(g.viaje.id)}
              />
            ))}
          </div>

          {grupoActual && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVista('participantes')}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      vista === 'participantes'
                        ? 'bg-[var(--sage-600)] text-white'
                        : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--bg)]'
                    } border border-[var(--border)]`}
                  >
                    Participantes
                  </button>
                  <button
                    type="button"
                    onClick={() => setVista('habitaciones')}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      vista === 'habitaciones'
                        ? 'bg-[var(--sage-600)] text-white'
                        : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--bg)]'
                    } border border-[var(--border)]`}
                  >
                    Habitaciones
                  </button>
                  <button
                    type="button"
                    onClick={() => setVista('reportes')}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      vista === 'reportes'
                        ? 'bg-[var(--sage-600)] text-white'
                        : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--bg)]'
                    } border border-[var(--border)]`}
                  >
                    Reportes
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setEditandoViaje(true)}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg)]"
                >
                  Editar viaje
                </button>
              </div>

              {vista === 'reportes' ? (
                <ReportesViaje viaje={grupoActual.viaje} participantes={grupoActual.participantes} />
              ) : vista === 'habitaciones' ? (
                <HabitacionesViaje viaje={grupoActual.viaje} participantes={grupoActual.participantes} />
              ) : (
                <Card>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                      {(['pendientes', 'aprobados', 'todos'] as Tab[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTab(t)}
                          className={`rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors ${
                            tab === t
                              ? 'bg-[var(--brown-700)] text-white'
                              : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--bg)]'
                          }`}
                        >
                          {t === 'pendientes' ? 'Pendientes' : t === 'aprobados' ? 'Aprobados' : 'Todos'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      Plazo de inscripción: {formatFecha(grupoActual.viaje.fechaLimiteInscripcion)}
                    </p>
                  </div>

                  {seleccionados.size > 0 && (
                    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--sage-600)] bg-[var(--sage-600)]/10 px-4 py-2.5">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {seleccionados.size} seleccionado{seleccionados.size === 1 ? '' : 's'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={mutationMasiva.isPending}
                          onClick={() => mutationMasiva.mutate({ ids: Array.from(seleccionados), aprobado: true })}
                          className="rounded-lg bg-[var(--brown-700)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
                        >
                          Aprobar seleccionados
                        </button>
                        <button
                          type="button"
                          disabled={mutationMasiva.isPending}
                          onClick={() => mutationMasiva.mutate({ ids: Array.from(seleccionados), aprobado: false })}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-red-50 disabled:opacity-60"
                        >
                          Desaprobar seleccionados
                        </button>
                      </div>
                    </div>
                  )}

                  {participantesFiltrados.length === 0 ? (
                    <EmptyState
                      message={
                        tab === 'pendientes'
                          ? 'No hay inscripciones pendientes por aprobar.'
                          : tab === 'aprobados'
                            ? 'Todavía no hay participantes aprobados.'
                            : 'Sin participantes.'
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            <th className="py-2 pl-1 pr-2">
                              <input
                                ref={headerCheckboxRef}
                                type="checkbox"
                                checked={todosSeleccionados}
                                onChange={toggleSeleccionTodos}
                                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                              />
                            </th>
                            <th className="py-2 pr-4">Participante</th>
                            <th className="py-2 pr-4">Contacto</th>
                            <th className="py-2 pr-4">Ordenanzas</th>
                            <th className="py-2 pr-4">Servicios</th>
                            <th className="py-2 pr-4">Costo</th>
                            <th className="py-2 pr-4">Estado</th>
                            <th className="py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {participantesFiltrados.map((p) => (
                            <ParticipanteRow
                              key={p.id}
                              p={p}
                              seleccionado={seleccionados.has(p.id)}
                              onToggleSeleccion={() => toggleSeleccion(p.id)}
                              cargando={mutation.isPending}
                              onCambiarAprobado={(id, aprobado) => mutation.mutate({ id, aprobado })}
                              onVerDetalle={() => setParticipanteDetalle(p)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
        </>
      )}

      {participanteDetalle && grupoActual && (
        <ParticipanteModal
          participante={participanteDetalle}
          inscripcion={participanteDetalle.inscripcion}
          viaje={grupoActual.viaje}
          onClose={() => setParticipanteDetalle(null)}
        />
      )}

      {editandoViaje && grupoActual && (
        <ViajeModal viaje={grupoActual.viaje} onClose={() => setEditandoViaje(false)} />
      )}

      {creandoViaje && (
        <ViajeModal
          viaje={null}
          onClose={() => setCreandoViaje(false)}
          onCreado={(nuevoId) => {
            setCreandoViaje(false);
            setViajeId(nuevoId);
          }}
        />
      )}

      {inscribiendo && (
        <NuevaInscripcionModal viajeIdInicial={viajeId} onClose={() => setInscribiendo(false)} />
      )}
    </div>
  );
};
