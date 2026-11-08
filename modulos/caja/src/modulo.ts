// Arma la caja con sus adaptadores, a mano (ver docs/decisiones/0003). Cada operación corre en su
// transacción con el contexto de quien la pide: el pago y la cuota pagada van juntos o ninguno.
import { enContexto, type Base } from "@app/plataforma";
import * as cobros from "./aplicacion/cobros.ts";
import type { Caja } from "./aplicacion/puertos.ts";
import { repositorioCaja } from "./infraestructura/repositorio.ts";

export interface OpcionesCaja {
  /** Reloj; en los tests se adelanta a mano. */
  ahora?: () => Date;
}

export function crearCaja(base: Base, opciones: OpcionesCaja = {}): Caja {
  const ahora = opciones.ahora ?? (() => new Date());
  return {
    cobrarCuota: (quien, cobro) =>
      enContexto(base, quien, (tx) =>
        cobros.cobrarCuota(repositorioCaja(tx), quien, ahora(), cobro),
      ),
    anular: (quien, anulacion) =>
      enContexto(base, quien, (tx) =>
        cobros.anular(repositorioCaja(tx), quien, ahora(), anulacion),
      ),
    delDia: (quien, filtro) =>
      enContexto(base, quien, (tx) => cobros.delDia(repositorioCaja(tx), quien, filtro)),
  };
}
