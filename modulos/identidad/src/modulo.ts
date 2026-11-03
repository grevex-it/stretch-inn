// Conecta los casos de uso con el repositorio de Drizzle, a mano (ver docs/decisiones/0003).
// Todo recibe la Transaccion de enContexto.
import type { ContextoCentro, Permiso, Resultado } from "@app/nucleo";
import { conPuntoDeGuardado, type Transaccion } from "@app/plataforma";
import * as casos from "./aplicacion/casos-de-uso.ts";
import type { NuevaAsignacion, NuevoAjuste } from "./aplicacion/puertos.ts";
import type { Catalogo } from "./dominio/catalogo.ts";
import type { PermisosPorSede } from "./dominio/permisos.ts";
import { repositorioIdentidad } from "./infraestructura/repositorio.ts";

type ResultadoDePermisos<T> = Promise<Resultado<T, casos.ErrorDePermisos>>;

/** Permisos efectivos de una cuenta en un centro. Sirve para armar el ContextoCentro. */
export function cargarPermisos(
  tx: Transaccion,
  cuentaId: string,
  centroId: string,
): Promise<PermisosPorSede> {
  return casos.cargarPermisos(repositorioIdentidad(tx), cuentaId, centroId);
}

export function crearRol(
  tx: Transaccion,
  quien: ContextoCentro,
  rol: { nombre: string; permisos: readonly Permiso[] },
): ResultadoDePermisos<{ id: string }> {
  return casos.crearRol(repositorioIdentidad(tx), quien, rol);
}

export function asignarRol(
  tx: Transaccion,
  quien: ContextoCentro,
  asignacion: NuevaAsignacion,
): ResultadoDePermisos<null> {
  return casos.asignarRol(repositorioIdentidad(tx), quien, asignacion);
}

/** Quita un rol en una sede; no deja al centro sin nadie con acceso total. */
export function quitarAsignacion(
  tx: Transaccion,
  asignacion: NuevaAsignacion,
  catalogo: Catalogo,
): ResultadoDePermisos<null> {
  const repo = repositorioIdentidad(tx);
  return conPuntoDeGuardado(tx, () =>
    casos.cambiarSinPerderAccesoTotal(repo, catalogo, () =>
      casos.quitarAsignacion(repo, asignacion),
    ),
  );
}

/** Da un permiso extra o quita uno en una sede; no deja al centro sin acceso total. */
export function ajustarPermiso(
  tx: Transaccion,
  quien: ContextoCentro,
  ajuste: NuevoAjuste,
  catalogo: Catalogo,
): ResultadoDePermisos<null> {
  const repo = repositorioIdentidad(tx);
  return conPuntoDeGuardado(tx, () =>
    casos.cambiarSinPerderAccesoTotal(repo, catalogo, () =>
      casos.ajustarPermiso(repo, quien, ajuste),
    ),
  );
}
