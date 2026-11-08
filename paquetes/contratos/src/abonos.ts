// Abonos: planes del centro, precios por sede y cuotas mensuales de los alumnos. Los montos van
// en pesos enteros (0009). Las reglas las aplica el módulo abonos.
import { z } from "zod";
import { paginaDe } from "./paginas.ts";

const pesos = z
  .number("Revisá el precio.")
  .int("El precio va en pesos, sin centavos.")
  .positive("El precio tiene que ser mayor que cero.");

export const fichaDePlan = z.object({
  nombre: z.string().max(100, "El nombre es muy largo."),
  clasesPorSemana: z.number("Revisá las clases por semana.").int("Revisá las clases por semana."),
  precio: pesos,
});

/** La edición lleva la versión que vio quien edita (0013). */
export const edicionDePlan = fichaDePlan.extend({ version: z.number().int() });

export const plan = fichaDePlan.extend({
  id: z.uuid(),
  activo: z.boolean(),
  version: z.number().int(),
  /** Las sedes con precio propio; las demás usan el general. */
  preciosDeSede: z.array(z.object({ sedeId: z.uuid(), precio: z.number().int() })),
});

export const paginaDePlanes = paginaDe(plan);
export const planCreado = z.object({ id: z.uuid() });
export const planEditado = z.object({ version: z.number().int() });

/** Cuerpo de PUT /abonos/planes/:id/sedes/:sedeId/precio. */
export const pedidoDePrecioDeSede = z.object({ precio: pesos });

/** Cuerpo de POST /abonos/cuotas. Sin período, el mes actual del centro. */
export const pedidoDeCuota = z.object({
  alumnoId: z.uuid("Ese alumno no existe."),
  planId: z.uuid("Ese plan no existe."),
  sedeId: z.uuid("Esa sede no existe."),
  periodo: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes va como AAAA-MM.")
    .optional(),
});

export const cuotaGenerada = z.object({
  id: z.uuid(),
  monto: z.number().int(),
  periodo: z.string(),
});

export const cuota = z.object({
  id: z.uuid(),
  alumnoId: z.uuid(),
  planId: z.uuid(),
  sedeId: z.uuid(),
  /** AAAA-MM. */
  periodo: z.string(),
  monto: z.number().int(),
  /** En UTC; null mientras no se pagó. */
  pagadaEn: z.iso.datetime().nullable(),
});

/** Respuesta de GET /alumnos/:id/cuotas: la más nueva primero. */
export const paginaDeCuotas = paginaDe(cuota);

export type FichaDePlan = z.infer<typeof fichaDePlan>;
export type EdicionDePlan = z.infer<typeof edicionDePlan>;
export type Plan = z.infer<typeof plan>;
export type PaginaDePlanes = z.infer<typeof paginaDePlanes>;
export type PedidoDeCuota = z.infer<typeof pedidoDeCuota>;
export type Cuota = z.infer<typeof cuota>;
export type PaginaDeCuotas = z.infer<typeof paginaDeCuotas>;
