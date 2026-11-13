// Los gastos de cada sede (0022): cargarlos con clave de idempotencia (regla 7), anularlos con
// motivo y los de un período. Montos en pesos enteros (0009).
import { z } from "zod";
import { numeroDePagina, paginaDe, POR_PAGINA } from "./paginas.ts";

/** **[SUPUESTO]** Las categorías de Stretch Inn (iguales a las de `gastos`). */
export const CATEGORIAS_DE_GASTO = [
  "alquiler",
  "servicios",
  "sueldos",
  "insumos",
  "mantenimiento",
  "impuestos",
  "otros",
] as const;

/** Cuerpo de POST /gastos. La clave la arma el panel, una por intento de carga. */
export const pedidoDeGasto = z.object({
  sedeId: z.uuid("Esa sede no existe."),
  fecha: z.iso.date("Revisá la fecha del gasto."),
  monto: z.number("Escribí el monto.").int("El monto va en pesos enteros, sin centavos."),
  categoria: z.enum(CATEGORIAS_DE_GASTO, "Elegí la categoría."),
  medio: z.enum(["efectivo", "transferencia"], "Elegí el medio de pago."),
  descripcion: z.string().max(500, "La descripción es muy larga."),
  claveIdempotencia: z.string().min(8).max(100),
});

/** Respuesta de POST /gastos: 201, o 200 con `repetido` si la clave ya se había usado. */
export const gastoCargado = z.object({ id: z.uuid(), repetido: z.boolean() });

/** Query de GET /gastos: `?sede&desde&hasta&pagina` (los días, inclusive). */
export const pedidoDeGastos = z
  .object({
    pagina: numeroDePagina,
    sede: z.uuid("Esa sede no existe."),
    desde: z.iso.date("Revisá el día de inicio."),
    hasta: z.iso.date("Revisá el día de fin."),
  })
  .transform(({ pagina, sede, desde, hasta }) => ({
    pagina,
    porPagina: POR_PAGINA,
    sedeId: sede,
    desde,
    hasta,
  }));

export const gasto = z.object({
  id: z.uuid(),
  sedeId: z.uuid(),
  fecha: z.string(),
  monto: z.number().int(),
  categoria: z.enum(CATEGORIAS_DE_GASTO),
  medio: z.enum(["efectivo", "transferencia"]),
  descripcion: z.string(),
  /** En UTC. */
  registradoEn: z.iso.datetime(),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
});

/** Respuesta de GET /gastos: el más nuevo primero, y lo gastado sin los anulados. */
export const paginaDeGastos = paginaDe(gasto).extend({ gastado: z.number().int() });

export type PedidoDeGasto = z.infer<typeof pedidoDeGasto>;
export type Gasto = z.infer<typeof gasto>;
export type PaginaDeGastos = z.infer<typeof paginaDeGastos>;
