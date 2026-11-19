// El profe asignado de cada alumno (0022): un integrante activo del equipo, que es de identidad.
// Se lee por su index.ts (regla 4), de a una página y sin N+1.
import { listarUsuariosActivos, obtenerUsuarios } from "@app/identidad";
import type { Transaccion } from "@app/plataforma";
import type { Alumno } from "./tipos.ts";

/** Los integrantes activos del equipo, para elegir el profe de un alumno. */
export function listarProfes(tx: Transaccion, pagina: { pagina: number; porPagina: number }) {
  return listarUsuariosActivos(tx, pagina);
}

/** Cada alumno con el nombre de su profe (null si no tiene), en una sola consulta. */
export async function conNombreDeProfe<T extends Pick<Alumno, "profeId">>(
  tx: Transaccion,
  alumnos: readonly T[],
): Promise<(T & { profeNombre: string | null })[]> {
  const ids = [...new Set(alumnos.flatMap((a) => (a.profeId === null ? [] : [a.profeId])))];
  const nombres = new Map((await obtenerUsuarios(tx, ids)).map((u) => [u.id, u.nombre]));
  return alumnos.map((a) => ({
    ...a,
    profeNombre: a.profeId === null ? null : (nombres.get(a.profeId) ?? null),
  }));
}
