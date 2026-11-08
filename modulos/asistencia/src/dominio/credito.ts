// Cuándo un aviso de ausencia da crédito para recuperar y hasta cuándo vale. Puro.
// [SUPUESTO] Hasta que Stretch Inn defina sus reglas (ver AGENTS.md, Pendientes).

/** [SUPUESTO] El aviso tiene que llegar con 2 horas de anticipación o más. */
const ANTICIPACION_MS = 2 * 60 * 60_000;
/** [SUPUESTO] El crédito vale 30 días desde la fecha a la que se faltó. */
const VIGENCIA_MS = 30 * 24 * 60 * 60_000;

export function daCredito(empiezaEn: Date, avisadoEn: Date): boolean {
  return empiezaEn.getTime() - avisadoEn.getTime() >= ANTICIPACION_MS;
}

export function venceEl(empiezaEn: Date): Date {
  return new Date(empiezaEn.getTime() + VIGENCIA_MS);
}
