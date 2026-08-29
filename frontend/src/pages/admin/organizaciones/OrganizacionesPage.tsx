import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarOrganizacion,
  crearLlamamiento,
  crearOrganizacion,
  fijarModuloLlamamientos,
  listarLlamamientos,
  listarModuloLlamamientos,
  listarOrganizaciones,
  type PermisoLlamamientoPayload,
} from '../../../lib/admin';
import { Card } from '../../../components/ui/Card';
import { ModuleBreadcrumb } from '../../../components/ui/ModuleBreadcrumb';
import { LoadingState, ErrorState } from '../../../components/ui/StatusViews';

// Módulos que existen en el sistema — a medida que se agreguen más, se
// suman acá (mismo espíritu que RUTA_POR_MODULO en AdminHome). "usuarios"
// cubre administrar usuarios/organizaciones/llamamientos y esta misma
// matriz de permisos — todo pasa por acá, el único bypass incondicional es
// SuperAdmin (ver NIVEL_SUPERADMIN).
const MODULOS = [
  { clave: 'viaje_templo', nombre: 'Viaje al Templo' },
  { clave: 'usuarios', nombre: 'Administración de Usuarios' },
];

export const OrganizacionesPage = () => {
  const queryClient = useQueryClient();
  const { data: organizaciones, isLoading, isError } = useQuery({
    queryKey: ['organizaciones'],
    queryFn: listarOrganizaciones,
  });
  const { data: llamamientos } = useQuery({
    queryKey: ['llamamientos'],
    queryFn: listarLlamamientos,
  });
  const { data: moduloLlamamientos } = useQuery({
    queryKey: ['modulo-llamamientos'],
    queryFn: listarModuloLlamamientos,
  });

  const [nombreNuevo, setNombreNuevo] = useState('');
  const [nuevoLlamamiento, setNuevoLlamamiento] = useState<Record<number, string>>({});

  const crear = useMutation({
    mutationFn: () => crearOrganizacion(nombreNuevo.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizaciones'] });
      setNombreNuevo('');
    },
  });

  const toggleActivo = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) => actualizarOrganizacion(id, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizaciones'] }),
  });

  const crearLlamamientoMut = useMutation({
    mutationFn: ({ organizacionId, nombre }: { organizacionId: number; nombre: string }) =>
      crearLlamamiento(organizacionId, nombre),
    onSuccess: (_, { organizacionId }) => {
      queryClient.invalidateQueries({ queryKey: ['llamamientos'] });
      setNuevoLlamamiento((prev) => ({ ...prev, [organizacionId]: '' }));
    },
  });

  const fijarPermiso = useMutation({
    mutationFn: ({ moduloClave, permisos }: { moduloClave: string; permisos: PermisoLlamamientoPayload[] }) =>
      fijarModuloLlamamientos(moduloClave, permisos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modulo-llamamientos'] }),
  });

  type Accion = 'puedeLeer' | 'puedeCrear' | 'puedeEditar' | 'puedeEliminar';

  // El backend reemplaza el set completo de permisos de un módulo, así que
  // cada click reconstruye el arreglo entero a partir de lo que ya está
  // guardado + el cambio puntual — uno por LLAMAMIENTO, no por organización.
  const togglePermiso = (moduloClave: string, llamamientoId: number, accion: Accion) => {
    const actuales = moduloLlamamientos?.[moduloClave] ?? [];
    const permisos: PermisoLlamamientoPayload[] = (llamamientos ?? [])
      .filter((l) => l.activo)
      .map((l) => {
        const existente = actuales.find((p) => p.llamamientoId === l.id);
        const base: PermisoLlamamientoPayload = {
          llamamientoId: l.id,
          puedeLeer: existente?.puedeLeer ?? false,
          puedeCrear: existente?.puedeCrear ?? false,
          puedeEditar: existente?.puedeEditar ?? false,
          puedeEliminar: existente?.puedeEliminar ?? false,
        };
        if (l.id === llamamientoId) base[accion] = !base[accion];
        return base;
      })
      .filter((p) => p.puedeLeer || p.puedeCrear || p.puedeEditar || p.puedeEliminar);
    fijarPermiso.mutate({ moduloClave, permisos });
  };

  return (
    <div className="space-y-6">
      <div>
        <ModuleBreadcrumb modulo="Administración" submodulo="Organizaciones" />
        <h1 className="text-xl font-semibold text-[var(--text)]">Organizaciones, llamamientos y permisos</h1>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="No se pudo cargar el catálogo de organizaciones." />}

      {organizaciones && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Catálogo de organizaciones</h3>
          <div className="mb-4 space-y-2">
            {organizaciones.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between rounded-lg bg-[var(--bg)] px-3 py-2 text-sm"
              >
                <span className={org.activo ? 'text-[var(--text)]' : 'text-[var(--text-muted)] line-through'}>
                  {org.nombre}
                </span>
                <button
                  type="button"
                  onClick={() => toggleActivo.mutate({ id: org.id, activo: !org.activo })}
                  disabled={toggleActivo.isPending}
                  className="text-xs font-medium text-[var(--brown-700)] hover:underline disabled:opacity-60"
                >
                  {org.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Nombre de la organización"
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
            <button
              type="button"
              disabled={!nombreNuevo.trim() || crear.isPending}
              onClick={() => crear.mutate()}
              className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
            >
              + Agregar
            </button>
          </div>
        </Card>
      )}

      {organizaciones && (
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Llamamientos</h3>
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            Cargos dentro de cada organización (ej. Obispado → "Obispo", "Secretario Financiero"). Los permisos de
            cada módulo se otorgan sobre un llamamiento puntual, no sobre toda la organización.
          </p>
          <div className="space-y-4">
            {organizaciones
              .filter((o) => o.activo)
              .map((org) => (
                <div key={org.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="mb-2 text-sm font-medium text-[var(--text)]">{org.nombre}</p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {(llamamientos ?? [])
                      .filter((l) => l.organizacionId === org.id)
                      .map((l) => (
                        <span
                          key={l.id}
                          className={`rounded-full border border-[var(--border)] px-3 py-1 text-xs ${
                            l.activo ? 'text-[var(--text)]' : 'text-[var(--text-muted)] line-through'
                          }`}
                        >
                          {l.nombre}
                        </span>
                      ))}
                    {(llamamientos ?? []).filter((l) => l.organizacionId === org.id).length === 0 && (
                      <span className="text-xs text-[var(--text-muted)]">Sin llamamientos todavía.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={nuevoLlamamiento[org.id] ?? ''}
                      onChange={(e) => setNuevoLlamamiento((prev) => ({ ...prev, [org.id]: e.target.value }))}
                      placeholder="Ej. Secretario Financiero"
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                    />
                    <button
                      type="button"
                      disabled={!nuevoLlamamiento[org.id]?.trim() || crearLlamamientoMut.isPending}
                      onClick={() =>
                        crearLlamamientoMut.mutate({ organizacionId: org.id, nombre: nuevoLlamamiento[org.id].trim() })
                      }
                      className="rounded-lg bg-[var(--brown-700)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {organizaciones && (
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Permisos de módulos</h3>
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            Qué puede hacer cada llamamiento en cada módulo — el permiso es específico al cargo, no a toda la
            organización (ej. el Obispo puede tener acceso completo y el Secretario Financiero del mismo Obispado
            ninguno, salvo que se le otorgue).
          </p>
          <div className="space-y-6">
            {MODULOS.map((mod) => {
              const permisos = moduloLlamamientos?.[mod.clave] ?? [];
              return (
                <div key={mod.clave}>
                  <p className="mb-2 text-sm font-medium text-[var(--text)]">{mod.nombre}</p>
                  {(llamamientos ?? []).filter((l) => l.activo).length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Primero crea llamamientos arriba para poder asignarles permisos.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            <th className="px-3 py-2">Organización</th>
                            <th className="px-3 py-2">Llamamiento</th>
                            <th className="px-3 py-2 text-center">Leer</th>
                            <th className="px-3 py-2 text-center">Crear</th>
                            <th className="px-3 py-2 text-center">Editar</th>
                            <th className="px-3 py-2 text-center">Eliminar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(llamamientos ?? [])
                            .filter((l) => l.activo)
                            .map((l) => {
                              const p = permisos.find((x) => x.llamamientoId === l.id);
                              return (
                                <tr key={l.id} className="border-b border-[var(--border)] last:border-0">
                                  <td className="px-3 py-2 text-[var(--text-muted)]">{l.organizacion.nombre}</td>
                                  <td className="px-3 py-2 text-[var(--text)]">{l.nombre}</td>
                                  {(['puedeLeer', 'puedeCrear', 'puedeEditar', 'puedeEliminar'] as const).map(
                                    (accion) => (
                                      <td key={accion} className="px-3 py-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={p?.[accion] ?? false}
                                          onChange={() => togglePermiso(mod.clave, l.id, accion)}
                                          disabled={fijarPermiso.isPending}
                                          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                                        />
                                      </td>
                                    ),
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
