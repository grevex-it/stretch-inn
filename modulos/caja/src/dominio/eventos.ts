// Los eventos que emite la caja (0003). Viajan por la cola como JSON: fechas en ISO (UTC).
import type { Dinero } from "@app/nucleo";
import type { Medio } from "./cobro.ts";

export const EVENTO_PAGO_REGISTRADO = "caja.pago-registrado";

/** Un pago nuevo de caja. Se publica una sola vez por pago (clave de idempotencia: el pago). */
export interface PagoRegistrado {
  pagoId: string;
  centroId: string;
  sedeId: string;
  alumnoId: string;
  cuotaId: string;
  monto: Dinero;
  medio: Medio;
  /** ISO, en UTC. */
  registradoEn: string;
}
