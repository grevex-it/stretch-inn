// Cuándo se puede tomar asistencia de una fecha y qué marcas son válidas. Puro: la fecha llega ya
// leída de agenda.
import { falla, ok, type Resultado } from "@app/nucleo";

export type Estado = "presente" | "ausente";

export interface Marca {
  alumnoId: string;
  estado: Estado;
}

export type ErrorDePlanilla =
  | "fecha-cancelada"
  | "todavia-no-empieza"
  | "marcas-vacias"
  | "marcas-repetidas"
  | "demasiadas-marcas";

/** La recepción puede marcar en la puerta: desde una hora antes del inicio. */
const ANTICIPACION_MS = 60 * 60_000;
const MAXIMO_DE_MARCAS = 100;

/** Desde una hora antes del inicio y sin límite después (para corregir). Nunca si se canceló. */
export function puedeTomar(
  fecha: { cancelada: boolean; empiezaEn: Date },
  ahora: Date,
): Resultado<null, ErrorDePlanilla> {
  if (fecha.cancelada) return falla("fecha-cancelada", "Esa fecha está cancelada.");
  if (ahora.getTime() < fecha.empiezaEn.getTime() - ANTICIPACION_MS) {
    return falla(
      "todavia-no-empieza",
      "Todavía falta para esta clase: la asistencia se toma desde una hora antes.",
    );
  }
  return ok(null);
}

/** De 1 a 100 marcas, una por alumno. */
export function limpiarMarcas(marcas: readonly Marca[]): Resultado<Marca[], ErrorDePlanilla> {
  if (marcas.length === 0) return falla("marcas-vacias", "Marcá al menos un alumno.");
  if (marcas.length > MAXIMO_DE_MARCAS) {
    return falla(
      "demasiadas-marcas",
      `Se pueden guardar hasta ${String(MAXIMO_DE_MARCAS)} alumnos por vez.`,
    );
  }
  if (new Set(marcas.map((m) => m.alumnoId)).size !== marcas.length) {
    return falla("marcas-repetidas", "Hay un alumno marcado dos veces.");
  }
  return ok([...marcas]);
}
