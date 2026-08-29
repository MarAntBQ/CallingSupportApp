import api from './axios';
import type {
  ConsejoBarrioItem,
  CreateUsuarioPayload,
  EmailLogItem,
  Llamamiento,
  Organizacion,
  PermisoLlamamiento,
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

export const listarLlamamientos = async (): Promise<Llamamiento[]> =>
  (await api.get<Llamamiento[]>('/llamamientos')).data;

export const crearLlamamiento = async (organizacionId: number, nombre: string): Promise<Llamamiento> =>
  (await api.post<Llamamiento>('/llamamientos', { organizacionId, nombre })).data;

export const actualizarLlamamiento = async (
  id: number,
  payload: { nombre?: string; activo?: boolean },
): Promise<Llamamiento> => (await api.patch<Llamamiento>(`/llamamientos/${id}`, payload)).data;

export const listarUsuarios = async (): Promise<UsuarioAdmin[]> => (await api.get<UsuarioAdmin[]>('/usuarios')).data;

export const crearUsuario = async (payload: CreateUsuarioPayload): Promise<UsuarioAdmin> =>
  (await api.post<UsuarioAdmin>('/usuarios', payload)).data;

export const actualizarUsuario = async (id: number, payload: UpdateUsuarioPayload): Promise<UsuarioAdmin> =>
  (await api.patch<UsuarioAdmin>(`/usuarios/${id}`, payload)).data;

export const restablecerPassword = async (id: number): Promise<{ password: string }> =>
  (await api.post<{ password: string }>(`/usuarios/${id}/restablecer-password`)).data;

export const listarConsejoBarrio = async (): Promise<ConsejoBarrioItem[]> =>
  (await api.get<ConsejoBarrioItem[]>('/consejo-barrio')).data;

export const listarModuloLlamamientos = async (): Promise<Record<string, PermisoLlamamiento[]>> =>
  (await api.get<Record<string, PermisoLlamamiento[]>>('/modulo-llamamientos')).data;

export interface PermisoLlamamientoPayload {
  llamamientoId: number;
  puedeLeer: boolean;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  puedeNotificar: boolean;
}

export const fijarModuloLlamamientos = async (
  moduloClave: string,
  permisos: PermisoLlamamientoPayload[],
): Promise<void> => {
  await api.post('/modulo-llamamientos', { moduloClave, permisos });
};

export const listarEmailLogs = async (): Promise<EmailLogItem[]> => (await api.get<EmailLogItem[]>('/mail/logs')).data;

export const listarSesiones = async (): Promise<SessionItem[]> => (await api.get<SessionItem[]>('/sessions')).data;

export const revocarSesion = async (id: number): Promise<void> => {
  await api.patch(`/sessions/${id}/revoke`);
};

export const revocarOtrasSesiones = async (): Promise<{ revocadas: number }> =>
  (await api.post<{ revocadas: number }>('/sessions/revoke-all-others')).data;
