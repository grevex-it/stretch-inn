// Lo que identidad les da a otros módulos, con la Transaccion de enContexto: RLS limita al centro.
// Son lecturas: nadie escribe en las tablas de identidad (regla 4).
import type { Transaccion } from "@app/plataforma";
import { inArray } from "drizzle-orm";
import { usuarios } from "./esquema.ts";

const MAXIMO_POR_CONSULTA = 100;

/** Un integrante del equipo del centro: lo que hace falta para mostrarlo y validarlo. */
export interface UsuarioDelCentro {
  id: string;
  nombre: string;
  activo: boolean;
}

/**
 * Los usuarios del centro con esos ids, en una sola consulta (hasta 100): para que agenda y
 * personas muestren y validen un profe (0022). Los ids que no son del centro no vuelven.
 */
export async function obtenerUsuarios(
  tx: Transaccion,
  ids: readonly string[],
): Promise<UsuarioDelCentro[]> {
  if (ids.length > MAXIMO_POR_CONSULTA) {
    throw new Error(
      `obtenerUsuarios acepta hasta ${String(MAXIMO_POR_CONSULTA)} ids por consulta.`,
    );
  }
  if (ids.length === 0) return [];
  return tx
    .select({ id: usuarios.id, nombre: usuarios.nombre, activo: usuarios.activo })
    .from(usuarios)
    .where(inArray(usuarios.id, [...ids]));
}
