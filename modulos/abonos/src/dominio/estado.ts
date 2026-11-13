// Cuántas clases del abono se usaron y cuántas quedan. Puro. Cada fecha del horario fijo que ya
// terminó gasta una clase, haya venido o no (0020).

export interface EstadoDelAbono {
  usadas: number;
  restantes: number;
  /** El final de su última clase; null si no le alcanzan las fechas del horario fijo. */
  fin: Date | null;
}

/** `fechas`: las primeras del horario fijo desde que empieza el abono, en orden (hasta `clases`). */
export function estadoDelAbono(
  clases: number,
  fechas: readonly { terminaEn: Date }[],
  en: Date,
): EstadoDelAbono {
  const usadas = Math.min(clases, fechas.filter((f) => f.terminaEn <= en).length);
  const ultima = fechas.length === clases ? fechas.at(-1) : undefined;
  return { usadas, restantes: clases - usadas, fin: ultima?.terminaEn ?? null };
}
