import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listarUsuarios } from '../../../lib/admin';
import { ModuleBreadcrumb } from '../../../components/ui/ModuleBreadcrumb';
import { LoadingState, ErrorState } from '../../../components/ui/StatusViews';
import { useTableControls } from '../../../lib/use-table-controls';
import { TableToolbar, SortHeader, TablePagination } from '../../../components/TableControls';
import { UsuarioModal } from './UsuarioModal';
import type { UsuarioAdmin } from '../../../types';

const ESTADO_ESTILO: Record<string, string> = {
  activo: 'bg-green-50 text-[var(--success)]',
  pendiente: 'bg-[var(--warning)]/10 text-[var(--warning)]',
  suspendido: 'bg-red-50 text-[var(--danger)]',
};

type Tab = 'lideres' | 'todos';

// "Líder" en el sentido amplio de la pestaña: cualquiera con un rol
// administrativo — Miembro/Amigo de la Iglesia son las únicas cuentas sin
// ningún cargo, así que quedan solo en la pestaña "Todos".
const ES_ROL_LIDERAZGO = (rol: string) => rol !== 'Miembro' && rol !== 'Amigo de la Iglesia';

export const UsuariosPage = () => {
  const { data: usuarios, isLoading, isError } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios });
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [creando, setCreando] = useState(false);
  const [tab, setTab] = useState<Tab>('lideres');
  const [searchParams, setSearchParams] = useSearchParams();

  // Llegar desde Consejo de barrio con ?editar=<id> abre directo el modal de
  // edición de ese usuario, en vez de obligar a buscarlo en la tabla.
  useEffect(() => {
    const editarId = searchParams.get('editar');
    if (!editarId || !usuarios) return;
    const usuario = usuarios.find((u) => u.id === Number(editarId));
    if (usuario) setEditando(usuario);
    setSearchParams((prev) => {
      prev.delete('editar');
      return prev;
    });
  }, [searchParams, usuarios, setSearchParams]);

  const usuariosFiltrados = (usuarios ?? []).filter((u) =>
    tab === 'lideres' ? ES_ROL_LIDERAZGO(u.role.nombre) : true,
  );

  const table = useTableControls(usuariosFiltrados, {
    search: (u) =>
      `${u.nombres} ${u.apellidos} ${u.email} ${u.llamamiento ?? ''} ${u.role.nombre} ${u.organizaciones.map((o) => o.nombre).join(' ')}`,
    defaultSortKey: 'nombre',
    sortAccessors: {
      nombre: (u) => `${u.apellidos} ${u.nombres}`,
      llamamiento: (u) => u.llamamiento ?? '',
      correo: (u) => u.email,
      rol: (u) => u.role.nombre,
      organizaciones: (u) => u.organizaciones.map((o) => o.nombre).join(', '),
      estado: (u) => u.estado,
      telegram: (u) => (u.telegramVinculado ? 1 : 0),
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <ModuleBreadcrumb modulo="Administración" submodulo="Usuarios" />
          <h1 className="text-xl font-semibold text-[var(--text)]">Usuarios</h1>
        </div>
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="rounded-lg bg-[var(--brown-700)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brown-500)]"
        >
          + Crear usuario
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('lideres')}
          className={`rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'lideres'
              ? 'bg-[var(--brown-700)] text-white'
              : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--bg)]'
          }`}
        >
          Líderes
        </button>
        <button
          type="button"
          onClick={() => setTab('todos')}
          className={`rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'todos'
              ? 'bg-[var(--brown-700)] text-white'
              : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--bg)]'
          }`}
        >
          Todos
        </button>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="No se pudo cargar la lista de usuarios." />}

      {usuarios && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <TableToolbar table={table} placeholder="Buscar por nombre, correo, llamamiento…" />
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <SortHeader table={table} colKey="nombre" label="Nombre" />
                <SortHeader table={table} colKey="llamamiento" label="Llamamiento" />
                <SortHeader table={table} colKey="correo" label="Correo" />
                <SortHeader table={table} colKey="rol" label="Rol" />
                <SortHeader table={table} colKey="organizaciones" label="Organizaciones" />
                <SortHeader table={table} colKey="estado" label="Estado" />
                <SortHeader table={table} colKey="telegram" label="Telegram" />
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {table.view.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">
                    {u.nombres} {u.apellidos}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{u.llamamiento || '—'}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{u.email}</td>
                  <td className="px-4 py-3 text-[var(--text)]">{u.role.nombre}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {u.organizaciones.map((o) => o.nombre).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ESTADO_ESTILO[u.estado]}`}>
                      {u.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.telegramVinculado ? (
                      <span className="text-[var(--sage-600)]">Vinculado</span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditando(u)}
                      className="text-xs font-medium text-[var(--brown-700)] hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {table.view.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-[var(--text-muted)]">
                    No hay usuarios en esta vista.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination table={table} />
        </div>
      )}

      {(editando || creando) && (
        <UsuarioModal
          usuario={editando}
          onClose={() => {
            setEditando(null);
            setCreando(false);
          }}
        />
      )}
    </div>
  );
};
