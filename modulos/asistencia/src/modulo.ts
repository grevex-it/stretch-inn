// Arma la asistencia con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre
// en su transacción con el contexto de quien la pide.
import { enContexto, type Base } from "@app/plataforma";
import * as planillas from "./aplicacion/planilla.ts";
import type { Asistencia } from "./aplicacion/puertos.ts";
import { repositorioAsistencia } from "./infraestructura/repositorio.ts";

export interface OpcionesAsistencia {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
}

export function crearAsistencia(base: Base, opciones: OpcionesAsistencia = {}): Asistencia {
  const ahora = opciones.ahora ?? (() => new Date());
  return {
    planilla: (quien, filtro) =>
      enContexto(base, quien, (tx) => planillas.planilla(repositorioAsistencia(tx), quien, filtro)),
    tomar: (quien, pedido) =>
      enContexto(base, quien, (tx) =>
        planillas.tomar(repositorioAsistencia(tx), quien, ahora(), pedido),
      ),
  };
}
