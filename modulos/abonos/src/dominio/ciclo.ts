// El ciclo de una cuota (0019): el abono dura 4 semanas desde el día en que empieza, y el
// siguiente empieza el día en que termina este. Los días van en la zona del centro. Puro.

const DIAS_DEL_CICLO = 28;

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

/** El día en que termina el ciclo que empieza `desde` (y empieza el siguiente). */
export function finDelCiclo(desde: string): string {
  const dia = new Date(`${desde}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + DIAS_DEL_CICLO);
  return dia.toISOString().slice(0, 10);
}
