// Arma los roles a medida y los permisos de cada integrante con sus adaptadores, a mano (ver
// docs/decisiones/0003 y 0007). Cada operación corre en su transacción con el contexto de quien la
// pide. Lo que puede sacar permisos va con punto de guardado: si deja al centro sin nadie con
// acceso total, se deshace entero.
import type { ContextoCentro, Resultado } from "@app/nucleo";
import { conPuntoDeGuardado, enContexto, type Base } from "@app/plataforma";
import { cambiarSinPerderAccesoTotal } from "./aplicacion/casos-de-uso.ts";
import * as integrantes from "./aplicacion/permisos-de-usuarios.ts";
import type { ErrorDeRoles, RepositorioRoles, Roles } from "./aplicacion/puertos-roles.ts";
import * as casos from "./aplicacion/roles.ts";
import type { Catalogo } from "./dominio/catalogo.ts";
import { repositorioRoles } from "./infraestructura/repositorio-roles.ts";

export interface OpcionesRoles {
  /** El catálogo completo del sistema: lo arma la API con la sección de cada módulo. */
  catalogo: Catalogo;
}

type Trabajo<T> = (repo: RepositorioRoles) => Promise<Resultado<T, ErrorDeRoles>>;

export function crearRoles(base: Base, { catalogo }: OpcionesRoles): Roles {
  const en = <T>(quien: ContextoCentro, trabajo: Trabajo<T>) =>
    enContexto(base, quien, (tx) => trabajo(repositorioRoles(tx)));
  const sinPerderAccesoTotal = <T>(quien: ContextoCentro, trabajo: Trabajo<T>) =>
    enContexto(base, quien, (tx) => {
      const repo = repositorioRoles(tx);
      return conPuntoDeGuardado(tx, () =>
        cambiarSinPerderAccesoTotal(repo, catalogo, () => trabajo(repo)),
      );
    });
  return {
    catalogo: () => catalogo.secciones,
    rol: (quien, rolId) => en(quien, (repo) => casos.rol(repo, rolId)),
    crearRol: (quien, rol) => en(quien, (repo) => casos.crearRol(repo, catalogo, quien, rol)),
    editarRol: (quien, rol) =>
      sinPerderAccesoTotal(quien, (repo) => casos.editarRol(repo, catalogo, quien, rol)),
    borrarRol: (quien, rolId) => en(quien, (repo) => casos.borrarRol(repo, rolId)),
    permisosDe: (quien, usuarioId) =>
      en(quien, (repo) => integrantes.permisosDe(repo, quien, usuarioId)),
    asignar: (quien, usuarioId, asignacion) =>
      en(quien, (repo) => integrantes.asignar(repo, catalogo, quien, { ...asignacion, usuarioId })),
    quitarAsignacion: (quien, usuarioId, asignacion) =>
      sinPerderAccesoTotal(quien, (repo) =>
        integrantes.quitarAsignacion(repo, catalogo, quien, { ...asignacion, usuarioId }),
      ),
    ajustar: (quien, usuarioId, ajuste) =>
      sinPerderAccesoTotal(quien, (repo) =>
        integrantes.ajustar(repo, catalogo, quien, { ...ajuste, usuarioId }),
      ),
    quitarAjuste: (quien, usuarioId, ajuste) =>
      sinPerderAccesoTotal(quien, (repo) =>
        integrantes.quitarAjuste(repo, catalogo, quien, { ...ajuste, usuarioId }),
      ),
  };
}
