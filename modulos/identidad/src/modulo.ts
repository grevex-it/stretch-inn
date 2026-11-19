// Conecta los casos de uso con el repositorio de Drizzle, a mano (ver docs/decisiones/0003).
// Todo recibe la Transaccion de enContexto.
import type { Transaccion } from "@app/plataforma";
import * as casos from "./aplicacion/casos-de-uso.ts";
import type { PermisosPorSede } from "./dominio/permisos.ts";
import { repositorioIdentidad } from "./infraestructura/repositorio.ts";

/** Permisos efectivos de una cuenta en un centro. Sirve para armar el ContextoCentro. */
export function cargarPermisos(
  tx: Transaccion,
  cuentaId: string,
  centroId: string,
): Promise<PermisosPorSede> {
  return casos.cargarPermisos(repositorioIdentidad(tx), cuentaId, centroId);
}
