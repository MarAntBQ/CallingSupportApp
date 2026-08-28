export const ORDENANZAS = ['Baptisterio', 'Iniciatorias', 'Investidura', 'Sellamiento'] as const;
export type Ordenanza = (typeof ORDENANZAS)[number];

export const GENEROS = ['Hombre', 'Mujer'] as const;
export type Genero = (typeof GENEROS)[number];

export interface ParticipanteInput {
  cedulaOPasaporte: string;
  fechaNacimiento: string;
  nombreCompleto: string;
  telefono: string;
  email: string;
  genero: Genero | '';
  vaEnTransporte: boolean;
  necesitaHospedaje: boolean;
  quiereDesayuno: boolean;
  quiereAlmuerzo: boolean;
  ordenanzas: Ordenanza[];
}

export interface CreateInscripcionPayload {
  participantes: ParticipanteInput[];
  recaptchaToken: string | null;
}

export interface ViajeActivo {
  id: number;
  fecha: string;
  fechaLimiteInscripcion: string;
  fechaConfirmada: boolean;
  incluyeTransporte: boolean;
  incluyeHospedaje: boolean;
  incluyeDesayuno: boolean;
  incluyeAlmuerzo: boolean;
  costoTransporte: number;
  costoDesayuno: number;
  costoAlmuerzo: number;
  inscripcionesAbiertas: boolean;
  cuposRestantes: Record<string, number>;
}

export function calcularCosto(
  viaje: ViajeActivo,
  vaEnTransporte: boolean,
  quiereDesayuno: boolean,
  quiereAlmuerzo: boolean,
): number {
  let total = 0;
  if (viaje.incluyeDesayuno && quiereDesayuno) total += viaje.costoDesayuno;
  if (viaje.incluyeAlmuerzo && quiereAlmuerzo) total += viaje.costoAlmuerzo;
  if (vaEnTransporte) total += viaje.costoTransporte;
  return total;
}

export function campoCupoOrdenanza(ordenanza: Ordenanza, genero: Genero): string {
  return `cupos${ordenanza}${genero === 'Hombre' ? 'Hombres' : 'Mujeres'}`;
}

// La cédula/pasaporte es única por viaje — se normaliza quitando guiones,
// espacios y puntos para que "0000000000" y "000000000-0" se traten como
// el mismo documento. Debe coincidir EXACTO con el backend (templo.constants.ts).
export function normalizarCedula(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
