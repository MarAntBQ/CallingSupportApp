import api from './axios';
import type {
  ConsejoBarrioItem,
  CreateUsuarioPayload,
  EmailLogItem,
  Organizacion,
  PermisoModulo,
  Role,
  SessionItem,
  UpdateUsuarioPayload,
  UsuarioAdmin,
} from '../types';

export const listarRoles = async (): Promise<Role[]> => (await api.get<Role[]>('/roles')).data;

export const listarOrganizaciones = async (): Promise<Organizacion[]> =>
  (await api.get<Organizacion[]>('/organizaciones')).data;

export const crearOrganizacion = async (nombre: string): Promise<Organizacion> =>
  (await api.post<Organizacion>('/organizaciones', { nombre })).data;

export const actualizarOrganizacion = async (
  id: number,
  payload: { nombre?: string; activo?: boolean },
): Promise<Organizacion> => (await api.patch<Organizacion>(`/organizaciones/${id}`, payload)).data;

export const listarUsuarios = async (): Promise<UsuarioAdmin[]> => (await api.get<UsuarioAdmin[]>('/usuarios')).data;

export const crearUsuario = async (payload: CreateUsuarioPayload): Promise<UsuarioAdmin> =>
  (await api.post<UsuarioAdmin>('/usuarios', payload)).data;

export const actualizarUsuario = async (id: number, payload: UpdateUsuarioPayload): Promise<UsuarioAdmin> =>
  (await api.patch<UsuarioAdmin>(`/usuarios/${id}`, payload)).data;

export const listarConsejoBarrio = async (): Promise<ConsejoBarrioItem[]> =>
  (await api.get<ConsejoBarrioItem[]>('/consejo-barrio')).data;

export const listarModuloOrganizaciones = async (): Promise<Record<string, PermisoModulo[]>> =>
  (await api.get<Record<string, PermisoModulo[]>>('/modulo-organizaciones')).data;

export interface PermisoOrganizacionPayload {
  organizacionId: number;
  puedeLeer: boolean;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}

export const fijarModuloOrganizaciones = async (
  moduloClave: string,
  permisos: PermisoOrganizacionPayload[],
): Promise<void> => {
  await api.post('/modulo-organizaciones', { moduloClave, permisos });
};

export const listarEmailLogs = async (): Promise<EmailLogItem[]> => (await api.get<EmailLogItem[]>('/mail/logs')).data;

export const listarSesiones = async (): Promise<SessionItem[]> => (await api.get<SessionItem[]>('/sessions')).data;

export const revocarSesion = async (id: number): Promise<void> => {
  await api.patch(`/sessions/${id}/revoke`);
};

export const revocarOtrasSesiones = async (): Promise<{ revocadas: number }> =>
  (await api.post<{ revocadas: number }>('/sessions/revoke-all-others')).data;
