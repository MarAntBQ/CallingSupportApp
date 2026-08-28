export const ORDENANZAS = ['Baptisterio', 'Iniciatorias', 'Investidura', 'Sellamiento'] as const;
export type Ordenanza = (typeof ORDENANZAS)[number];

export const GENEROS = ['Hombre', 'Mujer'] as const;
export type Genero = (typeof GENEROS)[number];

// Nombre del campo de cupos en TemploViaje para cada combinación
// ordenanza+género — ej. Baptisterio + Hombre -> cuposBaptisterioHombres.
export function campoCupoOrdenanza(ordenanza: Ordenanza, genero: Genero): string {
  return `cupos${ordenanza}${genero === 'Hombre' ? 'Hombres' : 'Mujeres'}`;
}

// Edad mínima para tener recomendación limitada del templo (ordenanzas).
export const EDAD_MINIMA_ORDENANZAS = 11;

// Edad al día del viaje (no a hoy) — un niño que cumple la edad mínima justo
// antes del viaje ya califica.
export function calcularEdad(fechaNacimiento: string, fechaReferencia: string): number {
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  const referencia = new Date(fechaReferencia + 'T00:00:00');
  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const cumpleAnios = new Date(referencia.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
  if (referencia < cumpleAnios) edad--;
  return edad;
}

// La cédula/pasaporte es única por viaje — se normaliza quitando guiones,
// espacios y puntos para que "0000000000" y "000000000-0" se traten como
// el mismo documento.
export function normalizarCedula(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
