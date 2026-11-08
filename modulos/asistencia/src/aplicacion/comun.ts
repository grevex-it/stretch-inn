// Lo que comparten los casos de uso: la fecha con el permiso en su sede y quién registra.
import {
  falla,
  id,
  ok,
  puede,
  type ContextoCentro,
  type Permiso,
  type Resultado,
} from "@app/nucleo";
import type { ErrorDeAsistencia, Fecha, Registro, RepositorioAsistencia } from "./puertos.ts";

const SIN_PERMISO = falla("sin-permiso", "No tenés permiso para hacer esto en esa sede.");
const INEXISTENTE = falla("fecha-inexistente", "Esa fecha no existe.");

/** La fecha, si existe y quien pide tiene el permiso en su sede. */
export async function fechaCon(
  repo: RepositorioAsistencia,
  quien: ContextoCentro,
  permiso: Permiso,
  fechaId: string,
): Promise<Resultado<Fecha, ErrorDeAsistencia>> {
  const fecha = await repo.fecha(fechaId);
  if (fecha === undefined) return INEXISTENTE;
  if (!puede(quien, permiso, id<"Sede">(fecha.sedeId))) return SIN_PERMISO;
  return ok(fecha);
}

export function registroDe(quien: ContextoCentro, en: Date): Registro {
  const { actor } = quien;
  return actor.tipo === "usuario"
    ? { tipo: "usuario", id: actor.usuarioId, en }
    : { tipo: "soporte", id: actor.operadorId, en };
}
