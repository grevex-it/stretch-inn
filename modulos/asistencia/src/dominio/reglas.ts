// Las reglas de recuperación de una sede (0020), que el centro ajusta desde el panel. Puro.
import { falla, ok, type Resultado } from "@app/nucleo";

export interface ReglasDeRecuperacion {
  /** Cuántos minutos antes de la clase hay que anotarse a recuperar. */
  anticipacionMinutos: number;
  /** Cuántas recuperaciones se pueden hacer por abono. */
  maximoPorAbono: number;
  /** Si se puede recuperar sin un abono vigente. */
  sinAbono: boolean;
}

/** Las de una sede sin configurar: las de Río Tercero (0020). */
export const REGLAS_POR_DEFECTO: ReglasDeRecuperacion = {
  anticipacionMinutos: 0,
  maximoPorAbono: 4,
  sinAbono: false,
};

const UNA_SEMANA_EN_MINUTOS = 7 * 24 * 60;
const MAXIMO_POR_ABONO = 100;

const entre = (valor: number, desde: number, hasta: number) =>
  Number.isInteger(valor) && valor >= desde && valor <= hasta;

export function limpiarReglas(
  reglas: ReglasDeRecuperacion,
): Resultado<ReglasDeRecuperacion, "reglas-invalidas"> {
  const { anticipacionMinutos, maximoPorAbono, sinAbono } = reglas;
  if (!entre(anticipacionMinutos, 0, UNA_SEMANA_EN_MINUTOS)) {
    return falla("reglas-invalidas", "La anticipación va en minutos enteros, de 0 a una semana.");
  }
  if (!entre(maximoPorAbono, 0, MAXIMO_POR_ABONO)) {
    return falla("reglas-invalidas", "El máximo por abono va de 0 a 100 recuperaciones.");
  }
  return ok({ anticipacionMinutos, maximoPorAbono, sinAbono });
}

/** Si todavía se puede anotar a recuperar en una clase que empieza `empiezaEn`. */
export function aTiempo(empiezaEn: Date, ahora: Date, anticipacionMinutos: number): boolean {
  const faltan = empiezaEn.getTime() - ahora.getTime();
  return faltan > 0 && faltan >= anticipacionMinutos * 60_000;
}
