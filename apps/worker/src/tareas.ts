// Las tareas que procesa el worker. Cada manejador se puede ejecutar dos veces sin efecto doble
// (regla 7): pg-boss reintenta lo que falla y, agotados los reintentos, lo deja en fallidos.
import { EVENTO_PAGO_REGISTRADO } from "@app/caja";
import { declararTarea, trabajar, type Cola, type Logger } from "@app/plataforma";

/** Lo mínimo que tiene que traer el evento para procesarlo; si no, falla y se reintenta. */
function datosDelPago(datos: unknown): { pagoId: string; monto: number } & Record<string, unknown> {
  if (typeof datos !== "object" || datos === null) throw new Error("PagoRegistrado sin datos.");
  const { pagoId, monto } = datos as Record<string, unknown>;
  if (typeof pagoId !== "string" || typeof monto !== "number") {
    throw new Error("PagoRegistrado mal formado: faltan pagoId o monto.");
  }
  return { ...(datos as Record<string, unknown>), pagoId, monto };
}

/**
 * Declara las colas y empieza a procesarlas. Hoy PagoRegistrado solo queda registrado en el log
 * (es idempotente): mensajería y reportes se suman acá cuando existan.
 */
export async function registrarTareas(cola: Cola, logger: Logger): Promise<void> {
  await declararTarea(cola, EVENTO_PAGO_REGISTRADO);
  await trabajar(cola, EVENTO_PAGO_REGISTRADO, (datos) => {
    const pago = datosDelPago(datos);
    logger.info({ evento: EVENTO_PAGO_REGISTRADO, ...pago }, "Pago registrado.");
    return Promise.resolve();
  });
}
