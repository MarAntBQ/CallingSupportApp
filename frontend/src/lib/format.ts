export function formatFecha(fecha: string | null): string {
  if (!fecha) return '—';
  try {
    // Una fecha "pura" (YYYY-MM-DD, sin hora) se interpreta como UTC medianoche —
    // en zonas horarias negativas eso corre el día visible hacia atrás. Forzamos
    // hora local cuando no viene hora explícita.
    const conHora = fecha.includes('T') ? fecha : `${fecha}T00:00:00`;
    return new Date(conHora).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return fecha;
  }
}
