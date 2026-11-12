// Caja: cobrar cuotas con clave de idempotencia (regla 7), anular pagos y el día de caja de una
// sede. Montos en pesos enteros (0009). Las reglas las aplica el módulo caja.
import { z } from "zod";
import { numeroDePagina, paginaDe, POR_PAGINA } from "./paginas.ts";

const medio = z.enum(["efectivo", "transferencia"], "Elegí el medio de pago.");

/** Cuerpo de POST /caja/cobros. La clave la arma el panel, una por intento de cobro. */
export const pedidoDeCobro = z.object({
  cuotaId: z.uuid("Esa cuota no existe."),
  medio,
  claveIdempotencia: z
    .string("Falta la clave del cobro: volvé a intentarlo.")
    .min(8, "Falta la clave del cobro: volvé a intentarlo.")
    .max(100, "Falta la clave del cobro: volvé a intentarlo."),
});

/** Respuesta de POST /caja/cobros: `repetido` si el mismo cobro ya se había hecho. */
export const cobroHecho = z.object({
  id: z.uuid(),
  monto: z.number().int(),
  repetido: z.boolean(),
});

/** Cuerpo de POST /caja/pagos/:id/anulacion. */
export const pedidoDeAnulacion = z.object({
  motivo: z.string().max(500, "El motivo es muy largo."),
});

/** Query del día de caja: `?sede=uuid&dia=AAAA-MM-DD&pagina=N`. */
export const pedidoDelDia = z
  .object({
    pagina: numeroDePagina,
    sede: z.uuid("Esa sede no existe."),
    dia: z.iso.date("Revisá el día."),
  })
  .transform(({ pagina, sede, dia }) => ({ pagina, porPagina: POR_PAGINA, sedeId: sede, dia }));

export const pago = z.object({
  id: z.uuid(),
  sedeId: z.uuid(),
  alumnoId: z.uuid(),
  cuotaId: z.uuid(),
  monto: z.number().int(),
  medio,
  /** En UTC. */
  registradoEn: z.iso.datetime(),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
});

/** Respuesta de GET /caja/pagos: los pagos del día (el más nuevo primero) y lo cobrado. */
export const diaDeCaja = paginaDe(pago).extend({
  /** La suma de los pagos del día sin los anulados. */
  cobrado: z.number().int(),
});

export type PedidoDeCobro = z.infer<typeof pedidoDeCobro>;
export type Pago = z.infer<typeof pago>;
export type DiaDeCaja = z.infer<typeof diaDeCaja>;
