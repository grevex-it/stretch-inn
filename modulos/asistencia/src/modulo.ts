// Arma la asistencia con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre
// en su transacción con el contexto de quien la pide.
import { enContexto, type Base } from "@app/plataforma";
import * as avisos from "./aplicacion/avisos.ts";
import * as creditos from "./aplicacion/creditos.ts";
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
    avisar: (quien, aviso) =>
      enContexto(base, quien, (tx) =>
        avisos.avisar(repositorioAsistencia(tx), quien, ahora(), aviso),
      ),
    creditos: (quien, filtro) =>
      enContexto(base, quien, (tx) =>
        creditos.deAlumno(repositorioAsistencia(tx), quien, ahora(), filtro),
      ),
    anularAviso: (quien, aviso) =>
      enContexto(base, quien, (tx) =>
        avisos.anular(repositorioAsistencia(tx), quien, ahora(), aviso),
      ),
  };
}
