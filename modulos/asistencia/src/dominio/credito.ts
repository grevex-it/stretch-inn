// Hasta cuándo vale el crédito de un aviso de ausencia (0019). Puro. Todo aviso antes del inicio
// da crédito: no hay anticipación mínima.

/** [SUPUESTO] Sin abono vigente, el crédito vale 4 semanas desde la fecha a la que se faltó. */
const SIN_ABONO_MS = 28 * 24 * 60 * 60_000;

/** El crédito vence cuando termina el abono del alumno en el que se faltó. */
export function venceEl(empiezaEn: Date, finDelAbono: Date | undefined): Date {
  if (finDelAbono !== undefined && finDelAbono > empiezaEn) return finDelAbono;
  return new Date(empiezaEn.getTime() + SIN_ABONO_MS);
}
