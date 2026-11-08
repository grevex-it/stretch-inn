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
