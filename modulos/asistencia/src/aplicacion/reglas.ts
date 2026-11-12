// Casos de uso de las reglas de recuperación de cada sede (0020): verlas con el permiso de ver la
// asistencia en la sede, y cambiarlas con el de configurarla.
import { falla, id, ok, puede, type ContextoCentro, type Resultado } from "@app/nucleo";
import { CONFIGURAR, VER } from "../dominio/permisos.ts";
import { limpiarReglas, REGLAS_POR_DEFECTO, type ReglasDeRecuperacion } from "../dominio/reglas.ts";
import type { ErrorDeAsistencia, RepositorioAsistencia } from "./puertos.ts";

const SIN_PERMISO = falla("sin-permiso", "No tenés permiso para hacer esto en esa sede.");

/** Sin configurar, las de por defecto (las de Río Tercero). */
export async function reglas(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  { sedeId }: { sedeId: string },
): Promise<Resultado<ReglasDeRecuperacion, ErrorDeAsistencia>> {
  if (!puede(quien, VER, id<"Sede">(sedeId))) return SIN_PERMISO;
  return ok((await repo.reglas(sedeId)) ?? REGLAS_POR_DEFECTO);
}

export async function fijar(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  { sedeId, ...cambio }: ReglasDeRecuperacion & { sedeId: string },
): Promise<Resultado<null, ErrorDeAsistencia>> {
  if (!puede(quien, CONFIGURAR, id<"Sede">(sedeId))) return SIN_PERMISO;
  const limpias = limpiarReglas(cambio);
  if (!limpias.ok) return limpias;
  await repo.guardarReglas(sedeId, limpias.valor);
  return ok(null);
}
