// Arma la gestión del equipo con sus adaptadores, a mano (ver docs/decisiones/0003 y 0017). Cada
// operación corre en su transacción con el contexto de quien la pide.
import { conPuntoDeGuardado, enContexto, type Base } from "@app/plataforma";
import * as casos from "./aplicacion/equipo.ts";
import type { Equipo } from "./aplicacion/puertos-equipo.ts";
import { claveTemporal, hashearClave } from "./infraestructura/claves.ts";
import { repositorioEquipo } from "./infraestructura/repositorio-equipo.ts";

export interface OpcionesEquipo {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
}

export function crearEquipo(base: Base, opciones: OpcionesEquipo = {}): Equipo {
  const deps: casos.DependenciasEquipo = {
    hashear: hashearClave,
    claveTemporal,
    ahora: opciones.ahora ?? (() => new Date()),
  };
  return {
    listar: (quien, pagina) =>
      enContexto(base, quien, (tx) => casos.listar(repositorioEquipo(tx), pagina)),
    roles: (quien, pagina) => enContexto(base, quien, (tx) => repositorioEquipo(tx).roles(pagina)),
    // Con punto de guardado: si el alta falla a mitad de camino, no queda nada a medias.
    darDeAlta: (quien, datos) =>
      enContexto(base, quien, (tx) =>
        conPuntoDeGuardado(tx, () => casos.darDeAlta(repositorioEquipo(tx), deps, quien, datos)),
      ),
    resetearClave: (quien, usuarioId) =>
      enContexto(base, quien, (tx) =>
        casos.resetearClave(repositorioEquipo(tx), deps, quien, usuarioId),
      ),
    bloquear: (quien, usuarioId) =>
      enContexto(base, quien, (tx) =>
        casos.fijarActivo(repositorioEquipo(tx), deps, quien, { usuarioId, activo: false }),
      ),
    reactivar: (quien, usuarioId) =>
      enContexto(base, quien, (tx) =>
        casos.fijarActivo(repositorioEquipo(tx), deps, quien, { usuarioId, activo: true }),
      ),
  };
}
