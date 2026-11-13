// Cuándo se puede avisar (o anular) una ausencia. Puro: la fecha llega ya leída de agenda.
// Si el aviso da derecho a recuperar, y con cuánta anticipación, lo deciden los créditos.
import { falla, ok, type Resultado } from "@app/nucleo";

export type ErrorDeAviso = "fecha-cancelada" | "clase-empezada";

/** Hasta el inicio de la clase, y nunca en una fecha cancelada. */
export function puedeAvisar(
  fecha: { cancelada: boolean; empiezaEn: Date },
  ahora: Date,
): Resultado<null, ErrorDeAviso> {
  if (fecha.cancelada) return falla("fecha-cancelada", "Esa fecha está cancelada.");
  if (ahora.getTime() >= fecha.empiezaEn.getTime()) {
    return falla("clase-empezada", "La clase ya empezó: la ausencia se avisa antes.");
  }
  return ok(null);
}

/** El período de un viaje (0022): dos días AAAA-MM-DD, el primero antes o igual que el segundo. */
export function periodoValido(desde: string, hasta: string): boolean {
  const dia = /^\d{4}-\d{2}-\d{2}$/;
  return dia.test(desde) && dia.test(hasta) && desde <= hasta;
}

/** Las fechas que se pueden avisar del período: hasta el último día y que todavía no empezaron. */
export function fechasDelPeriodo<F extends { fecha: string; empiezaEn: Date }>(
  fechas: readonly F[],
  hasta: string,
  ahora: Date,
): F[] {
  return fechas.filter((f) => f.fecha <= hasta && f.empiezaEn.getTime() > ahora.getTime());
}
