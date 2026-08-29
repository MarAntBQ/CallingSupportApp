import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarOrganizacion,
  crearOrganizacion,
  fijarModuloOrganizaciones,
  listarModuloOrganizaciones,
  listarOrganizaciones,
} from '../../../lib/admin';
import { Card } from '../../../components/ui/Card';
import { ModuleBreadcrumb } from '../../../components/ui/ModuleBreadcrumb';
import { LoadingState, ErrorState } from '../../../components/ui/StatusViews';

// Módulos que existen en el sistema — a medida que se agreguen más, se
// suman acá (mismo espíritu que RUTA_POR_MODULO en AdminHome).
const MODULOS = [{ clave: 'viaje_templo', nombre: 'Viaje al Templo' }];

export const OrganizacionesPage = () => {
  const queryClient = useQueryClient();
  const { data: organizaciones, isLoading, isError } = useQuery({
    queryKey: ['organizaciones'],
    queryFn: listarOrganizaciones,
  });
  const { data: moduloOrg } = useQuery({
    queryKey: ['modulo-organizaciones'],
    queryFn: listarModuloOrganizaciones,
  });

  const [nombreNuevo, setNombreNuevo] = useState('');

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

  const fijarPermiso = useMutation({
    mutationFn: ({ moduloClave, organizacionIds }: { moduloClave: string; organizacionIds: number[] }) =>
      fijarModuloOrganizaciones(moduloClave, organizacionIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modulo-organizaciones'] }),
  });

  const toggleModuloOrg = (moduloClave: string, organizacionId: number) => {
    const actuales = (moduloOrg?.[moduloClave] ?? []).map((o) => o.id);
    const nuevos = actuales.includes(organizacionId)
      ? actuales.filter((id) => id !== organizacionId)
      : [...actuales, organizacionId];
    fijarPermiso.mutate({ moduloClave, organizacionIds: nuevos });
  };

  return (
    <div className="space-y-6">
      <div>
        <ModuleBreadcrumb modulo="Administración" submodulo="Organizaciones" />
        <h1 className="text-xl font-semibold text-[var(--text)]">Organizaciones y permisos</h1>
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
          <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Permisos de módulos</h3>
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            Qué organizaciones pueden administrar cada módulo — un Líder solo ve lo que su organización tiene
            marcado aquí.
          </p>
          <div className="space-y-4">
            {MODULOS.map((mod) => {
              const habilitadas = (moduloOrg?.[mod.clave] ?? []).map((o) => o.id);
              return (
                <div key={mod.clave}>
                  <p className="mb-2 text-sm font-medium text-[var(--text)]">{mod.nombre}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {organizaciones
                      .filter((o) => o.activo)
                      .map((org) => (
                        <label
                          key={org.id}
                          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                        >
                          <input
                            type="checkbox"
                            checked={habilitadas.includes(org.id)}
                            onChange={() => toggleModuloOrg(mod.clave, org.id)}
                            disabled={fijarPermiso.isPending}
                            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                          />
                          {org.nombre}
                        </label>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
