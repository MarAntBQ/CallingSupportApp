import api from './axios';
import type {
  CreateViajePayload,
  RolHabitacion,
  TemploAbono,
  TemploCobrador,
  TemploHabitacion,
  TemploInscripcion,
  TemploViaje,
  TipoAbono,
  UpdateParticipantePayload,
  UpdateViajePayload,
} from '../types';

export const getInscripcionesTemplo = async (): Promise<TemploInscripcion[]> => {
  const { data } = await api.get<TemploInscripcion[]>('/templo/inscripciones');
  return data;
};

export const aprobarParticipanteTemplo = async (id: number, aprobado: boolean): Promise<void> => {
  await api.patch(`/templo/participantes/${id}/aprobar`, { aprobado });
};

export const actualizarParticipanteTemplo = async (
  id: number,
  payload: UpdateParticipantePayload,
): Promise<void> => {
  await api.patch(`/templo/participantes/${id}`, payload);
};

export interface LogisticaPayload {
  subioIda?: boolean;
  subioRegreso?: boolean;
  desayunoEntregado?: boolean;
  almuerzoEntregado?: boolean;
}

export const actualizarLogisticaTemplo = async (id: number, payload: LogisticaPayload): Promise<void> => {
  await api.patch(`/templo/participantes/${id}/logistica`, payload);
};

export const listarViajesTemplo = async (): Promise<TemploViaje[]> => {
  const { data } = await api.get<TemploViaje[]>('/templo/viajes');
  return data;
};

export const crearViajeTemplo = async (payload: CreateViajePayload): Promise<TemploViaje> => {
  const { data } = await api.post<TemploViaje>('/templo/viajes', payload);
  return data;
};

export const actualizarViajeTemplo = async (id: number, payload: UpdateViajePayload): Promise<TemploViaje> => {
  const { data } = await api.patch<TemploViaje>(`/templo/viajes/${id}`, payload);
  return data;
};

export interface ParticipanteInscripcionAdmin {
  cedulaOPasaporte: string;
  fechaNacimiento: string;
  nombreCompleto: string;
  telefono: string;
  email: string;
  genero: string;
  vaEnTransporte: boolean;
  necesitaHospedaje: boolean;
  quiereDesayuno: boolean;
  quiereAlmuerzo: boolean;
  ordenanzas: string[];
}

export const crearInscripcionAdminTemplo = async (payload: {
  viajeId: number;
  participantes: ParticipanteInscripcionAdmin[];
  consentimiento: boolean;
  policyVersion: string;
}): Promise<{ id: number }> => {
  const { data } = await api.post<{ id: number }>('/templo/inscripciones/admin', payload);
  return data;
};

// ---------- Cobradores ----------

export const listarCobradoresTemplo = async (): Promise<TemploCobrador[]> => {
  const { data } = await api.get<TemploCobrador[]>('/templo/cobradores');
  return data;
};

export const crearCobradorTemplo = async (nombre: string): Promise<TemploCobrador> => {
  const { data } = await api.post<TemploCobrador>('/templo/cobradores', { nombre });
  return data;
};

export const actualizarCobradorTemplo = async (
  id: number,
  payload: { nombre?: string; activo?: boolean },
): Promise<TemploCobrador> => {
  const { data } = await api.patch<TemploCobrador>(`/templo/cobradores/${id}`, payload);
  return data;
};

// ---------- Abonos ----------

export interface AbonoPayload {
  fecha: string;
  valor: number;
  tipo: TipoAbono;
  cobradorId?: number;
}

export const crearAbonoTemplo = async (participanteId: number, payload: AbonoPayload): Promise<TemploAbono> => {
  const { data } = await api.post<TemploAbono>(`/templo/participantes/${participanteId}/abonos`, payload);
  return data;
};

export const eliminarAbonoTemplo = async (id: number): Promise<void> => {
  await api.delete(`/templo/abonos/${id}`);
};

// ---------- Habitaciones ----------

export const listarHabitacionesTemplo = async (viajeId: number): Promise<TemploHabitacion[]> => {
  const { data } = await api.get<TemploHabitacion[]>(`/templo/viajes/${viajeId}/habitaciones`);
  return data;
};

export const crearHabitacionTemplo = async (viajeId: number, numero: string): Promise<TemploHabitacion> => {
  const { data } = await api.post<TemploHabitacion>(`/templo/viajes/${viajeId}/habitaciones`, { numero });
  return data;
};

export const eliminarHabitacionTemplo = async (id: number): Promise<void> => {
  await api.delete(`/templo/habitaciones/${id}`);
};

export const asignarHabitacionTemplo = async (
  participanteId: number,
  payload: { habitacionId: number | null; rolHabitacion?: RolHabitacion | null },
): Promise<void> => {
  await api.patch(`/templo/participantes/${participanteId}/habitacion`, payload);
};

export const actualizarDatosTemploParticipante = async (
  participanteId: number,
  payload: { apellidos?: string; nombres?: string; nacionalidad?: string },
): Promise<void> => {
  await api.patch(`/templo/participantes/${participanteId}/datos-templo`, payload);
};

export const descargarExcelHabitacionesTemplo = async (viajeId: number, nombreArchivo: string): Promise<void> => {
  const { data } = await api.get(`/templo/viajes/${viajeId}/habitaciones/excel`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([data]));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.URL.revokeObjectURL(url);
};
