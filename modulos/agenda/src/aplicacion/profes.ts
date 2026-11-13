// Casos de uso de los profes de la agenda (0022): el fijo de cada sede y el reemplazo en una
// fecha. Verlos pide ver la agenda en la sede; cambiarlos, gestionarla.
import { falla, ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { GESTIONAR, VER } from "../dominio/permisos.ts";
import { PROFE_INVALIDO, puedeEn, SIN_PERMISO } from "./clases.ts";
import type { ErrorDeAgenda, RepositorioAgenda } from "./puertos.ts";

export async function deSede(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  { sedeId }: { sedeId: string },
): Promise<Resultado<string | null, ErrorDeAgenda>> {
  if (!puedeEn(quien, VER, sedeId)) return SIN_PERMISO;
  return ok((await repo.profeDeSede(sedeId)) ?? null);
}

/** Un usuario activo del centro, o null: sin profe fijo. */
export async function fijarDeSede(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  { sedeId, profeId }: { sedeId: string; profeId: string | null },
): Promise<Resultado<null, ErrorDeAgenda>> {
  if (!puedeEn(quien, GESTIONAR, sedeId)) return SIN_PERMISO;
  if (profeId !== null && !(await repo.profeValido(profeId))) return PROFE_INVALIDO;
  await repo.guardarProfeDeSede(sedeId, profeId);
  return ok(null);
}

/**
 * El reemplazo de una fecha; con null, vuelve a ser del profe de la clase. Vale también para una
 * fecha pasada: es para corregir quién la dio, y eso es lo que se le paga (0022).
 */
export async function fijarDeFecha(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  { id, profeId }: { id: string; profeId: string | null },
): Promise<Resultado<null, ErrorDeAgenda>> {
  const fecha = await repo.fecha(id);
  if (fecha === undefined) return falla("fecha-inexistente", "Esa fecha no existe.");
  if (!puedeEn(quien, GESTIONAR, fecha.sedeId)) return SIN_PERMISO;
  if (profeId !== null && !(await repo.profeValido(profeId))) return PROFE_INVALIDO;
  await repo.fijarProfeDeFecha(id, profeId);
  return ok(null);
}
