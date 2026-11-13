// Las camas de una sede: el tope del cupo de todas sus clases (12/11, docs/pendientes.md). Puro.
import { falla, ok, type Resultado } from "@app/nucleo";

export type ErrorDeCamas =
  "camas-invalidas" | "cupo-mayor-que-camas" | "camas-menos-que-inscriptos";

const CAMAS_MAXIMAS = 500;

/** Entre 1 y 500, o null: sin tope. */
export function limpiarCamas(camas: number | null): Resultado<number | null, ErrorDeCamas> {
  if (camas === null || (Number.isInteger(camas) && camas >= 1 && camas <= CAMAS_MAXIMAS)) {
    return ok(camas);
  }
  return falla("camas-invalidas", "Las camas van de 1 a 500.");
}

/** El cupo de una clase no pasa las camas de su sede (sin camas configuradas, no hay tope). */
export function cupoEnCamas(
  cupo: number,
  camas: number | undefined,
): Resultado<null, ErrorDeCamas> {
  if (camas === undefined || cupo <= camas) return ok(null);
  return falla(
    "cupo-mayor-que-camas",
    `La sede tiene ${String(camas)} camas: el cupo no puede ser mayor.`,
  );
}

/** Bajar las camas no puede dejar afuera a los fijos de ninguna clase. */
export function camasPosibles(
  camas: number,
  clases: readonly { nombre: string; inscriptos: number }[],
): Resultado<null, ErrorDeCamas> {
  const llena = clases.find((c) => c.inscriptos > camas);
  if (llena === undefined) return ok(null);
  return falla(
    "camas-menos-que-inscriptos",
    `${llena.nombre} tiene ${String(llena.inscriptos)} fijos: las camas no pueden ser menos.`,
  );
}
