// Arma el módulo de profesores con sus adaptadores, a mano (ver docs/decisiones/0003). Cada
// operación corre en su transacción con el contexto de quien la pide.
import { enContexto, type Base } from "@app/plataforma";
import type { Profesores } from "./aplicacion/puertos.ts";
import * as casos from "./aplicacion/tarifas.ts";
import { repositorioProfesores } from "./infraestructura/repositorio.ts";

export interface OpcionesProfesores {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
}

export function crearProfesores(base: Base, opciones: OpcionesProfesores = {}): Profesores {
  const ahora = opciones.ahora ?? (() => new Date());
  const con = <T>(
    quien: Parameters<typeof enContexto>[1],
    uso: (repo: ReturnType<typeof repositorioProfesores>) => Promise<T>,
  ) => enContexto(base, quien, (tx) => uso(repositorioProfesores(tx)));
  return {
    profes: (quien, pagina) => con(quien, (repo) => casos.profes(repo, quien, pagina)),
    fijarTipo: (quien, cambio) => con(quien, (repo) => casos.fijarTipo(repo, quien, cambio)),
    tarifas: (quien, filtro) => con(quien, (repo) => casos.tarifas(repo, quien, filtro)),
    fijarTarifa: (quien, tarifa) =>
      con(quien, (repo) => casos.fijarTarifa(repo, quien, ahora(), tarifa)),
  };
}
