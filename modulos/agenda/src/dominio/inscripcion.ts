// Cuándo se puede inscribir a un alumno en una clase y cuándo se puede bajar el cupo. Puro: los
// datos llegan ya leídos, con la clase bloqueada (la carrera la resuelve la base, 0013).
import { falla, ok, type Resultado } from "@app/nucleo";

export type ErrorDeInscripcion =
  | "clase-completa"
  | "clase-inactiva"
  | "alumno-inexistente"
  | "alumno-de-baja"
  | "cupo-menor-que-inscriptos"
  | "fecha-completa";

export function puedeInscribirse(
  clase: { activa: boolean; cupo: number; inscriptos: number },
  alumno: { activo: boolean } | undefined,
): Resultado<null, ErrorDeInscripcion> {
  if (alumno === undefined)
    return falla("alumno-inexistente", "Ese alumno no existe en el centro.");
  if (!alumno.activo) return falla("alumno-de-baja", "Ese alumno está de baja: reactivalo antes.");
  if (!clase.activa) return falla("clase-inactiva", "Esa clase está de baja.");
  if (clase.inscriptos >= clase.cupo) return falla("clase-completa", "La clase está completa.");
  return ok(null);
}

/** El cupo nuevo de una clase no puede dejar afuera a nadie que ya está inscripto. */
export function cupoPosible(cupo: number, inscriptos: number): Resultado<null, ErrorDeInscripcion> {
  if (cupo < inscriptos) {
    return falla(
      "cupo-menor-que-inscriptos",
      `Ya hay ${String(inscriptos)} inscriptos: el cupo no puede ser menor.`,
    );
  }
  return ok(null);
}

/**
 * Los fijos más las recuperaciones de más de la fecha futura más ocupada no pueden pasar el cupo:
 * la recuperación ya tiene su lugar reservado en esa fecha.
 */
export function entraEnLasFechas(
  cupo: number,
  fijos: number,
  masOcupada: { fecha: string; deMas: number } | undefined,
): Resultado<null, ErrorDeInscripcion> {
  if (masOcupada === undefined || fijos + masOcupada.deMas <= cupo) return ok(null);
  const [anio, mes, dia] = masOcupada.fecha.split("-");
  return falla(
    "fecha-completa",
    `El ${dia ?? ""}/${mes ?? ""}/${anio ?? ""} no queda lugar: lo ocupan recuperaciones.`,
  );
}
