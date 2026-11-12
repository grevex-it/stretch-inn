// Arma el login y las sesiones con sus adaptadores, a mano (ver docs/decisiones/0003 y 0017).
import { obtenerCentro } from "@app/centros";
import { enContexto, type Base } from "@app/plataforma";
import * as casos from "./aplicacion/acceso.ts";
import type { Acceso, Claves } from "./aplicacion/puertos-acceso.ts";
import { crearLimiteDeIntentos, type OpcionesLimite } from "./dominio/intentos.ts";
import { hashDeToken, hashearClave, nuevoToken, verificarClave } from "./infraestructura/claves.ts";
import { repositorioAcceso } from "./infraestructura/repositorio-acceso.ts";

export interface OpcionesAcceso {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
  limite?: OpcionesLimite;
}

const claves: Claves = {
  hashear: hashearClave,
  verificar: verificarClave,
  nuevoToken,
  hashDeToken,
};

/**
 * Una instancia por proceso: el límite de intentos vive en su memoria (0013). Cuentas y sesiones
 * no necesitan contexto; lo del centro se lee con las funciones de alcance mínimo.
 */
export function crearAcceso(base: Base, opciones: OpcionesAcceso = {}): Acceso {
  const deps: casos.DependenciasAcceso = {
    repo: repositorioAcceso(base),
    claves,
    limite: crearLimiteDeIntentos(opciones.limite),
    ahora: opciones.ahora ?? (() => new Date()),
    hashDeRelleno: hashearClave("relleno para emails que no existen"),
  };
  return {
    entrar: (datos) => casos.entrar(deps, datos),
    resolver: (token) => casos.resolver(deps, token),
    centros: async (sesion) =>
      (await deps.repo.centrosDe(sesion.cuentaId)).map(({ centroId, nombre }) => ({
        id: centroId,
        nombre,
      })),
    sedes: async ({ cuentaId, centro }) =>
      centro === null
        ? []
        : deps.repo.nombresDeSedes(cuentaId, centro.contexto.centroId, centro.sedes),
    zonaHoraria: async ({ centro }) =>
      centro === null
        ? null
        : ((await enContexto(base, centro.contexto, obtenerCentro))?.zonaHoraria ?? null),
    elegirCentro: (sesion, centroId) => casos.elegirCentro(deps, sesion, centroId),
    elegirSede: (sesion, sede) => casos.elegirSede(deps, sesion, sede),
    salir: (sesion) => deps.repo.revocar(sesion.sesionId, deps.ahora()),
    cambiarClave: (sesion, datos) => casos.cambiarClave(deps, sesion, datos),
  };
}
