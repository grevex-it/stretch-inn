// Abonos: planes del centro, precios por sede y cuotas de los alumnos por ciclo de 4 semanas
// (0019). Los montos van en pesos enteros (0009). Las reglas las aplica el módulo abonos.
import { z } from "zod";
import { numeroDePagina, paginaDe, POR_PAGINA } from "./paginas.ts";

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

/** Un día del calendario, AAAA-MM-DD, en la zona del centro. */
const dia = z.iso.date("El día va como AAAA-MM-DD.");

/** Cuerpo de POST /abonos/cuotas: un ciclo de 4 semanas desde `desde` (sin él, hoy). */
export const pedidoDeCuota = z.object({
  alumnoId: z.uuid("Ese alumno no existe."),
  planId: z.uuid("Ese plan no existe."),
  sedeId: z.uuid("Esa sede no existe."),
  desde: dia.optional(),
});

export const cuotaGenerada = z.object({
  id: z.uuid(),
  monto: z.number().int(),
  desde: z.string(),
  hasta: z.string(),
});

export const cuota = z.object({
  id: z.uuid(),
  alumnoId: z.uuid(),
  planId: z.uuid(),
  sedeId: z.uuid(),
  /** El primer día del ciclo de 4 semanas, AAAA-MM-DD. */
  desde: z.string(),
  /** El día en que termina y empieza el siguiente. */
  hasta: z.string(),
  monto: z.number().int(),
  /** En UTC; null mientras no se pagó. */
  pagadaEn: z.iso.datetime().nullable(),
});

/** Respuesta de GET /alumnos/:id/cuotas: la más nueva primero. */
export const paginaDeCuotas = paginaDe(cuota);

/** Query de GET /abonos/cuotas/impagas: `?sede&pagina`. */
export const pedidoDeImpagas = z
  .object({ pagina: numeroDePagina, sede: z.uuid("Esa sede no existe.") })
  .transform(({ pagina, sede }) => ({ pagina, porPagina: POR_PAGINA, sedeId: sede }));

export const cuotaImpaga = cuota.omit({ pagadaEn: true }).extend({
  /** null si el alumno ya no está en el centro. */
  alumno: z.object({ nombre: z.string(), apellido: z.string(), activo: z.boolean() }).nullable(),
});

/** Respuesta de GET /abonos/cuotas/impagas: la más vieja primero, y lo que suman todas. */
export const paginaDeImpagas = paginaDe(cuotaImpaga).extend({ adeudado: z.number().int() });

/** Cuerpo de POST /abonos/cuotas/renovacion: los ciclos que terminaron hasta `dia` (sin él, hoy). */
export const pedidoDeRenovacion = z.object({
  sedeId: z.uuid("Esa sede no existe."),
  dia: dia.optional(),
});

/** Respuesta de POST /abonos/cuotas/renovacion: cuántas se generaron y cuántas no, y por qué. */
export const renovacionHecha = z.object({
  dia: z.string(),
  generadas: z.number().int(),
  alumnosDeBaja: z.number().int(),
  planesDeBaja: z.number().int(),
});

export type FichaDePlan = z.infer<typeof fichaDePlan>;
export type EdicionDePlan = z.infer<typeof edicionDePlan>;
export type Plan = z.infer<typeof plan>;
export type PaginaDePlanes = z.infer<typeof paginaDePlanes>;
export type PedidoDeCuota = z.infer<typeof pedidoDeCuota>;
export type Cuota = z.infer<typeof cuota>;
export type PaginaDeCuotas = z.infer<typeof paginaDeCuotas>;
export type CuotaImpaga = z.infer<typeof cuotaImpaga>;
export type PaginaDeImpagas = z.infer<typeof paginaDeImpagas>;
export type PedidoDeRenovacion = z.infer<typeof pedidoDeRenovacion>;
export type RenovacionHecha = z.infer<typeof renovacionHecha>;
