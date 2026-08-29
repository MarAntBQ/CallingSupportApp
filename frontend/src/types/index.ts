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

export const EDAD_MINIMA_ORDENANZAS = 11;

export function calcularEdad(fechaNacimiento: string, fechaReferencia: string): number {
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  const referencia = new Date(fechaReferencia + 'T00:00:00');
  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const cumpleAnios = new Date(referencia.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
  if (referencia < cumpleAnios) edad--;
  return edad;
}

// Debe coincidir EXACTO con calcularCostoTotal del backend (templo.service.ts) —
// se usa para mostrar el costo en vivo mientras se edita, antes de guardar.
export function calcularCostoParticipante(
  viaje: {
    incluyeDesayuno: boolean;
    incluyeAlmuerzo: boolean;
    costoTransporte: string;
    costoDesayuno: string;
    costoAlmuerzo: string;
  },
  p: { vaEnTransporte: boolean; quiereDesayuno: boolean; quiereAlmuerzo: boolean },
): number {
  let total = 0;
  if (viaje.incluyeDesayuno && p.quiereDesayuno) total += parseFloat(viaje.costoDesayuno);
  if (viaje.incluyeAlmuerzo && p.quiereAlmuerzo) total += parseFloat(viaje.costoAlmuerzo);
  if (p.vaEnTransporte) total += parseFloat(viaje.costoTransporte);
  return total;
}

// Solo un punto de partida — el formulario público guarda el nombre en un
// solo campo, así que esto es una adivinanza (convención EC: apellidos
// primero) para prellenar, siempre revisable/editable antes de guardar.
export function separarNombreCompleto(nombreCompleto: string): { apellidos: string; nombres: string } {
  const palabras = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return { apellidos: palabras[0] ?? '', nombres: '' };
  const mitad = Math.ceil(palabras.length / 2);
  return {
    apellidos: palabras.slice(0, mitad).join(' '),
    nombres: palabras.slice(mitad).join(' '),
  };
}

// ---------- Tipos del panel de administración ----------

export type TipoAbono = 'donativo_iglesia' | 'pagado_persona';

export interface TemploCobrador {
  id: number;
  nombre: string;
  activo: boolean;
  createdAt: string;
}

export interface TemploAbono {
  id: number;
  fecha: string;
  valor: string;
  tipo: TipoAbono;
  cobrador: TemploCobrador | null;
  createdAt: string;
}

export type RolHabitacion = 'lider' | 'huesped';

export interface TemploHabitacion {
  id: number;
  numero: string;
  createdAt: string;
}

export interface TemploParticipante {
  id: number;
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
  ordenanzas: string;
  aprobado: boolean;
  costoTotal: string;
  subioIda: boolean;
  subioRegreso: boolean;
  desayunoEntregado: boolean;
  almuerzoEntregado: boolean;
  abonos: TemploAbono[];
  habitacion: TemploHabitacion | null;
  rolHabitacion: RolHabitacion | null;
  apellidos: string | null;
  nombres: string | null;
  nacionalidad: string | null;
}

export interface TemploViaje {
  id: number;
  fecha: string;
  fechaLimiteInscripcion: string;
  fechaConfirmada: boolean;
  incluyeTransporte: boolean;
  incluyeHospedaje: boolean;
  incluyeDesayuno: boolean;
  incluyeAlmuerzo: boolean;
  cuposTransporte: number;
  cuposHospedaje: number;
  costoTransporte: string;
  costoDesayuno: string;
  costoAlmuerzo: string;
  cuposBaptisterioHombres: number;
  cuposBaptisterioMujeres: number;
  cuposIniciatoriasHombres: number;
  cuposIniciatoriasMujeres: number;
  cuposInvestiduraHombres: number;
  cuposInvestiduraMujeres: number;
  cuposSellamientoHombres: number;
  cuposSellamientoMujeres: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemploInscripcion {
  id: number;
  ip: string | null;
  consentimiento: boolean;
  policyVersion: string;
  createdAt: string;
  viaje: TemploViaje;
  participantes: TemploParticipante[];
}

export interface UpdateViajePayload {
  fecha?: string;
  fechaLimiteInscripcion?: string;
  fechaConfirmada?: boolean;
  incluyeTransporte?: boolean;
  incluyeHospedaje?: boolean;
  incluyeDesayuno?: boolean;
  incluyeAlmuerzo?: boolean;
  costoTransporte?: number;
  costoDesayuno?: number;
  costoAlmuerzo?: number;
  cuposTransporte?: number;
  cuposHospedaje?: number;
  cuposBaptisterioHombres?: number;
  cuposBaptisterioMujeres?: number;
  cuposIniciatoriasHombres?: number;
  cuposIniciatoriasMujeres?: number;
  cuposInvestiduraHombres?: number;
  cuposInvestiduraMujeres?: number;
  cuposSellamientoHombres?: number;
  cuposSellamientoMujeres?: number;
  activo?: boolean;
}

export type CreateViajePayload = Omit<UpdateViajePayload, 'fecha' | 'fechaLimiteInscripcion'> & {
  fecha: string;
  fechaLimiteInscripcion: string;
};

export interface UpdateParticipantePayload {
  cedulaOPasaporte?: string;
  fechaNacimiento?: string;
  nombreCompleto?: string;
  telefono?: string;
  email?: string;
  genero?: string;
  vaEnTransporte?: boolean;
  necesitaHospedaje?: boolean;
  quiereDesayuno?: boolean;
  quiereAlmuerzo?: boolean;
  ordenanzas?: string[];
}

// ---------- Administración: usuarios, roles, organizaciones ----------

export interface Role {
  id: number;
  nombre: string;
  nivel: number;
}

export interface Organizacion {
  id: number;
  nombre: string;
  activo: boolean;
}

export type EstadoUsuario = 'pendiente' | 'activo' | 'suspendido';

export interface UsuarioAdmin {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  llamamiento: string | null;
  roleId: number;
  role: Role;
  estado: EstadoUsuario;
  createdAt: string;
  organizaciones: Organizacion[];
}

export interface CreateUsuarioPayload {
  nombres: string;
  apellidos: string;
  email: string;
  telefono?: string;
  roleId: number;
  organizacionIds?: number[];
  llamamiento?: string;
}

export interface UpdateUsuarioPayload {
  roleId?: number;
  estado?: EstadoUsuario;
  organizacionIds?: number[];
  llamamiento?: string;
}

export interface ConsejoBarrioItem {
  organizacion: Organizacion;
  lideres: UsuarioAdmin[];
}

export interface EmailLogItem {
  id: number;
  source: string;
  emailTo: string;
  emailSubject: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

export interface SessionItem {
  id: number;
  userId: number | null;
  nombre: string | null;
  email: string | null;
  expiration: string;
}

export interface UpdateProfilePayload {
  nombres?: string;
  apellidos?: string;
  telefono?: string;
}
