// Lo que abonos les da a otros módulos (caja), con la Transaccion de enContexto: RLS limita al
// centro y a las sedes visibles. Abonos escribe en sus propias tablas (regla 4).
import { falla, ok, type Resultado } from "@app/nucleo";
import type { Transaccion } from "@app/plataforma";
import type { Cuota } from "../aplicacion/puertos.ts";
import { repositorioCuotas } from "./repositorio-cuotas.ts";

/** La cuota vigente (sin anular), o undefined. */
export async function obtenerCuota(tx: Transaccion, id: string): Promise<Cuota | undefined> {
  return repositorioCuotas(tx).cuota(id);
}

/**
 * Marca la cuota pagada con el pago de caja, en la transacción del cobro: la toma con `for
 * update`, así dos cobros de la misma cuota no la pagan dos veces.
 */
export async function registrarPago(
  tx: Transaccion,
  { cuotaId, pagoId, en }: { cuotaId: string; pagoId: string; en: Date },
): Promise<Resultado<null, "cuota-inexistente" | "cuota-pagada">> {
  const repo = repositorioCuotas(tx);
  const cuota = await repo.cuota(cuotaId, true);
  if (cuota === undefined) return falla("cuota-inexistente", "Esa cuota no existe o se anuló.");
  if (cuota.pagadaEn !== null) return falla("cuota-pagada", "Esa cuota ya está pagada.");
  await repo.marcarPagada(cuotaId, pagoId, en);
  return ok(null);
}
