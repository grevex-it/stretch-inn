// Cuántos lugares tiene una fecha para recuperar y cuándo se puede reservar uno. Puro: la cuenta
// llega ya leída, con la fecha tomada (la carrera la resuelve el bloqueo, 0013).
import { falla, ok, type Resultado } from "@app/nucleo";
import { puedeAvisar, type ErrorDeAviso } from "./aviso.ts";

export type ErrorDeRecuperacion = ErrorDeAviso | "sin-lugar";

/** Los que avisaron dejan su lugar; cada recuperación ocupa uno. Nunca negativo. */
export function lugaresLibres({
  cupo,
  inscriptos,
  avisos,
  recuperaciones,
}: {
  cupo: number;
  inscriptos: number;
  avisos: number;
  recuperaciones: number;
}): number {
  return Math.max(0, cupo - inscriptos + avisos - recuperaciones);
}

/** Como un aviso (antes del inicio, no cancelada), y además con un lugar libre. */
export function puedeRecuperar(
  fecha: { cancelada: boolean; empiezaEn: Date },
  ahora: Date,
  libres: number,
): Resultado<null, ErrorDeRecuperacion> {
  const regla = puedeAvisar(fecha, ahora);
  if (!regla.ok) return regla;
  if (libres <= 0) return falla("sin-lugar", "No quedan lugares para recuperar en esa fecha.");
  return ok(null);
}
