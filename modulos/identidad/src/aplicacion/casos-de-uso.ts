// Cálculo de los permisos efectivos y el control del acceso total (ver docs/decisiones/0007 y
// 0017). Los roles, las asignaciones y los ajustes están en roles.ts y permisos-de-usuarios.ts.
import { falla, id, type Resultado } from "@app/nucleo";
import type { Catalogo } from "../dominio/catalogo.ts";
import { permisosEfectivos, tieneAccesoTotal, type PermisosPorSede } from "../dominio/permisos.ts";
import type { FilaDePermiso, FilaDePermisoDeUsuario, RepositorioIdentidad } from "./puertos.ts";

/** Permisos efectivos a partir de las filas de roles y ajustes. */
export function efectivosDe(filas: readonly FilaDePermiso[]): PermisosPorSede {
  return permisosEfectivos(
    filas
      .filter((fila) => fila.origen === "rol")
      .map((fila) => ({ sedeId: id<"Sede">(fila.sedeId), permisosDelRol: [fila.permiso] })),
    filas.flatMap((fila) =>
      fila.origen === "rol"
        ? []
        : [{ sedeId: id<"Sede">(fila.sedeId), permiso: fila.permiso, tipo: fila.origen }],
    ),
  );
}

export async function cargarPermisos(
  repo: RepositorioIdentidad,
  cuentaId: string,
  centroId: string,
): Promise<PermisosPorSede> {
  return efectivosDe(await repo.permisosDe(cuentaId, centroId));
}

function conAccesoTotal(
  filas: readonly FilaDePermisoDeUsuario[],
  sedesDelCentro: readonly string[],
  catalogo: Catalogo,
): number {
  const sedes = sedesDelCentro.map((sede) => id<"Sede">(sede));
  const porUsuario = new Map<string, FilaDePermisoDeUsuario[]>();
  for (const fila of filas)
    porUsuario.set(fila.usuarioId, [...(porUsuario.get(fila.usuarioId) ?? []), fila]);
  return [...porUsuario.values()].filter((propias) =>
    tieneAccesoTotal(efectivosDe(propias), catalogo.todos, sedes),
  ).length;
}

/**
 * Hace el cambio y verifica después que siga habiendo alguien con acceso total (0007, regla 2).
 * Se llama dentro de conPuntoDeGuardado: si devuelve falla, el cambio se deshace.
 */
export async function cambiarSinPerderAccesoTotal<T, Codigo extends string>(
  repo: Pick<RepositorioIdentidad, "sedesDelCentro" | "permisosDelCentro">,
  catalogo: Catalogo,
  cambio: () => Promise<Resultado<T, Codigo>>,
): Promise<Resultado<T, Codigo | "ultimo-acceso-total">> {
  const sedes = await repo.sedesDelCentro();
  const antes = conAccesoTotal(await repo.permisosDelCentro(), sedes, catalogo);
  const resultado = await cambio();
  if (!resultado.ok) return resultado;
  if (antes > 0 && conAccesoTotal(await repo.permisosDelCentro(), sedes, catalogo) === 0) {
    return falla(
      "ultimo-acceso-total",
      "Tiene que quedar al menos un usuario con acceso total al centro.",
    );
  }
  return resultado;
}
