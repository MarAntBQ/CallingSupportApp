import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarUsuario,
  crearUsuario,
  listarOrganizaciones,
  listarRoles,
} from '../../../lib/admin';
import type { UsuarioAdmin } from '../../../types';

interface Props {
  usuario: UsuarioAdmin | null;
  onClose: () => void;
}

export const UsuarioModal = ({ usuario, onClose }: Props) => {
  const queryClient = useQueryClient();
  const esEdicion = !!usuario;

  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: listarRoles });
  const { data: organizaciones } = useQuery({ queryKey: ['organizaciones'], queryFn: listarOrganizaciones });

  const [nombres, setNombres] = useState(usuario?.nombres ?? '');
  const [apellidos, setApellidos] = useState(usuario?.apellidos ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '');
  const [roleId, setRoleId] = useState<number | ''>(usuario?.roleId ?? '');
  const [estado, setEstado] = useState(usuario?.estado ?? 'activo');
  const [llamamiento, setLlamamiento] = useState(usuario?.llamamiento ?? '');
  const [organizacionIds, setOrganizacionIds] = useState<number[]>(usuario?.organizaciones.map((o) => o.id) ?? []);
  const [error, setError] = useState('');

  const toggleOrg = (id: number) => {
    setOrganizacionIds((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (esEdicion) {
        return actualizarUsuario(usuario.id, {
          roleId: roleId || undefined,
          estado,
          organizacionIds,
          llamamiento: llamamiento || undefined,
        });
      }
      return crearUsuario({
        nombres,
        apellidos,
        email,
        telefono: telefono || undefined,
        roleId: roleId as number,
        organizacionIds,
        llamamiento: llamamiento || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['consejo-barrio'] });
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo guardar el usuario.'));
    },
  });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-[var(--surface)] shadow-lg">
        <div className="shrink-0 border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text)]">
            {esEdicion ? 'Editar usuario' : 'Crear usuario'}
          </h2>
          {!esEdicion && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Se genera una contraseña temporal y se le envía por correo.
            </p>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!esEdicion && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Nombres</label>
                  <input
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Apellidos</label>
                  <input
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Correo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Teléfono (opcional)</label>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
                />
              </div>
            </>
          )}

          {esEdicion && (
            <div className="rounded-lg bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text-muted)]">
              {usuario.nombres} {usuario.apellidos} · {usuario.email}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">
              Llamamiento <span className="text-[var(--text-muted)]">(opcional)</span>
            </label>
            <input
              value={llamamiento}
              onChange={(e) => setLlamamiento(e.target.value)}
              placeholder="Ej. Presidenta, 1er consejero, Secretario…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Solo para mostrar quién es quién — el rol de abajo decide el nivel de acceso.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Rol</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
            >
              <option value="">Selecciona…</option>
              {(roles ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>

          {esEdicion && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as typeof estado)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sage-600)] focus:ring-2 focus:ring-[var(--sage-600)]/25"
              >
                <option value="activo">Activo</option>
                <option value="pendiente">Pendiente</option>
                <option value="suspendido">Suspendido</option>
              </select>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium text-[var(--text)]">Organizaciones</p>
            <div className="grid grid-cols-2 gap-2">
              {(organizaciones ?? []).map((org) => (
                <label
                  key={org.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  <input
                    type="checkbox"
                    checked={organizacionIds.includes(org.id)}
                    onChange={() => toggleOrg(org.id)}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sage-600)]"
                  />
                  {org.nombre}
                </label>
              ))}
            </div>
          </div>
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
            disabled={mutation.isPending || !roleId || (!esEdicion && (!nombres || !apellidos || !email))}
            onClick={() => mutation.mutate()}
            className="rounded-lg bg-[var(--brown-700)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brown-500)] disabled:opacity-60"
          >
            {mutation.isPending ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  );
};
