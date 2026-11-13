// Arma los gastos con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre en
// su transacción con el contexto de quien la pide.
import { enContexto, type Base } from "@app/plataforma";
import * as casos from "./aplicacion/gastos.ts";
import type { Gastos } from "./aplicacion/puertos.ts";
import { repositorioGastos } from "./infraestructura/repositorio.ts";

export interface OpcionesGastos {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
}

export function crearGastos(base: Base, opciones: OpcionesGastos = {}): Gastos {
  const ahora = opciones.ahora ?? (() => new Date());
  return {
    cargar: (quien, gasto) =>
      enContexto(base, quien, (tx) => casos.cargar(repositorioGastos(tx), quien, ahora(), gasto)),
    anular: (quien, anulacion) =>
      enContexto(base, quien, (tx) =>
        casos.anular(repositorioGastos(tx), quien, ahora(), anulacion),
      ),
    delPeriodo: (quien, filtro) =>
      enContexto(base, quien, (tx) => casos.delPeriodo(repositorioGastos(tx), quien, filtro)),
  };
}
