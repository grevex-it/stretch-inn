// Casos de uso de las camas de cada sede: el tope del cupo de sus clases (12/11). Verlas pide
// ver la agenda en la sede; cambiarlas, gestionarla.
import { ok, type ContextoCentro, type Resultado } from "@app/nucleo";
import { camasPosibles, limpiarCamas } from "../dominio/camas.ts";
import { entraEnLasFechas } from "../dominio/inscripcion.ts";
import { GESTIONAR, VER } from "../dominio/permisos.ts";
import { puedeEn, SIN_PERMISO } from "./clases.ts";
import type { ErrorDeAgenda, RepositorioAgenda } from "./puertos.ts";

export async function camas(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  { sedeId }: { sedeId: string },
): Promise<Resultado<number | null, ErrorDeAgenda>> {
  if (!puedeEn(quien, VER, sedeId)) return SIN_PERMISO;
  return ok((await repo.camas(sedeId)) ?? null);
}

/**
 * Al bajarlas, las clases con más cupo bajan con ellas: todas o ninguna. No bajan si dejan afuera
 * a los fijos de una clase o a las recuperaciones de una fecha futura.
 */
export async function fijar(
  repo: RepositorioAgenda,
  quien: ContextoCentro,
  ahora: Date,
  { sedeId, camas: pedidas }: { sedeId: string; camas: number | null },
): Promise<Resultado<null, ErrorDeAgenda>> {
  if (!puedeEn(quien, GESTIONAR, sedeId)) return SIN_PERMISO;
  const limpias = limpiarCamas(pedidas);
  if (!limpias.ok) return limpias;
  const nuevas = limpias.valor;
  await repo.bloquearCamas(sedeId);
  if (nuevas !== null) {
    const porEncima = await repo.clasesPorEncimaDe(sedeId, nuevas);
    const fijos = camasPosibles(nuevas, porEncima);
    if (!fijos.ok) return fijos;
    const ids = porEncima.map((c) => c.id);
    const masOcupada = await repo.masOcupadaFutura(ids, ahora);
    const inscriptos = porEncima.find((c) => c.id === masOcupada?.claseId)?.inscriptos ?? 0;
    const enLasFechas = entraEnLasFechas(nuevas, inscriptos, masOcupada);
    if (!enLasFechas.ok) return enLasFechas;
    await repo.bajarCupos(ids, nuevas);
  }
  await repo.guardarCamas(sedeId, nuevas);
  return ok(null);
}
