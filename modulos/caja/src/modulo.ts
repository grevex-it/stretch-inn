// Arma la caja con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre en su
// transacción con el contexto de quien la pide: el pago, la cuota pagada y el evento van juntos.
import { enContexto, type Base, type Cola } from "@app/plataforma";
import * as cobros from "./aplicacion/cobros.ts";
import type { Caja } from "./aplicacion/puertos.ts";
import { repositorioCaja } from "./infraestructura/repositorio.ts";

export interface OpcionesCaja {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
  /** La cola para publicar PagoRegistrado. Sin cola no se publica (solo en tests). */
  cola?: Cola;
}

export function crearCaja(base: Base, opciones: OpcionesCaja = {}): Caja {
  const ahora = opciones.ahora ?? (() => new Date());
  const repo = (tx: Parameters<typeof repositorioCaja>[0]) => repositorioCaja(tx, opciones.cola);
  return {
    cobrarCuota: (quien, cobro) =>
      enContexto(base, quien, (tx) => cobros.cobrarCuota(repo(tx), quien, ahora(), cobro)),
    anular: (quien, anulacion) =>
      enContexto(base, quien, (tx) => cobros.anular(repo(tx), quien, ahora(), anulacion)),
    delDia: (quien, filtro) =>
      enContexto(base, quien, (tx) => cobros.delDia(repo(tx), quien, filtro)),
  };
}
