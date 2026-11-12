// Los días de las cuotas, en la zona del centro. Puro. El abono es un paquete de clases (0020):
// cuándo termina lo dicen las fechas del horario fijo del alumno, que da agenda.

/** El día local del centro en ese instante, AAAA-MM-DD. */
export function diaDe(instante: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

/** AAAA-MM-DD y un día que existe en el calendario. */
export function esDia(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  return new Date(`${texto}T00:00:00Z`).toISOString().startsWith(texto);
}

/** El día siguiente: el abono nuevo empieza después de la última clase del anterior. */
export function diaSiguiente(dia: string): string {
  const siguiente = new Date(`${dia}T00:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  return siguiente.toISOString().slice(0, 10);
}
