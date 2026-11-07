// Arma la agenda con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre en
// su transacción con el contexto de quien la pide.
import { enContexto, type Base } from "@app/plataforma";
import * as clases from "./aplicacion/clases.ts";
import * as fechas from "./aplicacion/fechas.ts";
import type { Agenda } from "./aplicacion/puertos.ts";
import { repositorioAgenda } from "./infraestructura/repositorio.ts";

export interface OpcionesAgenda {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
}

export function crearAgenda(base: Base, opciones: OpcionesAgenda = {}): Agenda {
  const ahora = opciones.ahora ?? (() => new Date());
  return {
    clases: (quien, filtro) =>
      enContexto(base, quien, (tx) => clases.listar(repositorioAgenda(tx), quien, filtro)),
    crearClase: (quien, clase) =>
      enContexto(base, quien, (tx) => clases.crear(repositorioAgenda(tx), quien, clase)),
    editarClase: (quien, clase) =>
      enContexto(base, quien, (tx) => clases.editar(repositorioAgenda(tx), quien, ahora(), clase)),
    fijarActiva: (quien, cambio) =>
      enContexto(base, quien, (tx) =>
        clases.fijarActiva(repositorioAgenda(tx), quien, ahora(), cambio),
      ),
    semana: (quien, filtro) =>
      enContexto(base, quien, (tx) => fechas.semana(repositorioAgenda(tx), quien, filtro)),
    fijarCancelada: (quien, cambio) =>
      enContexto(base, quien, (tx) =>
        fechas.fijarCancelada(repositorioAgenda(tx), quien, ahora(), cambio),
      ),
  };
}
