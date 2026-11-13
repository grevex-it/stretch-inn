// Abonos: planes del centro, precios por sede y cuotas de los alumnos: paquetes de clases
// (0020). Los montos van en pesos enteros (0009). Las reglas las aplica el módulo abonos.
import { z } from "zod";
import { numeroDePagina, paginaDe, POR_PAGINA } from "./paginas.ts";

const pesos = z
  .number("Revisá el precio.")
  .int("El precio va en pesos, sin centavos.")
  .positive("El precio tiene que ser mayor que cero.");

export const fichaDePlan = z.object({
  nombre: z.string().max(100, "El nombre es muy largo."),
  /** Cuántas clases trae el paquete (0020): 4 el abono, 1 la clase suelta. */
  clases: z
    .number("Revisá las clases del abono.")
    .int("El abono tiene entre 1 y 100 clases.")
    .min(1, "El abono tiene entre 1 y 100 clases.")
    .max(100, "El abono tiene entre 1 y 100 clases."),
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

/** Cuerpo de POST /abonos/cuotas: un paquete de clases desde `desde` (sin él, sigue al abono anterior o arranca hoy). */
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
  clases: z.number().int(),
});

export const cuota = z.object({
  id: z.uuid(),
  alumnoId: z.uuid(),
  planId: z.uuid(),
  sedeId: z.uuid(),
  /** Desde qué día cuenta, AAAA-MM-DD: cada fecha del horario fijo gasta una clase (0020). */
  desde: z.string(),
  /** Cuántas clases trae. */
  clases: z.number().int(),
  monto: z.number().int(),
  /** En UTC; null mientras no se pagó. */
  pagadaEn: z.iso.datetime().nullable(),
  /** El pago de caja que la saldó: con ese id se anula desde la ficha (0019). */
  pagoId: z.uuid().nullable(),
});

/** Respuesta de GET /alumnos/:id/cuotas: la más nueva primero. */
export const paginaDeCuotas = paginaDe(cuota);

/** Query de GET /abonos/cuotas/impagas: `?sede&pagina`. */
export const pedidoDeImpagas = z
  .object({ pagina: numeroDePagina, sede: z.uuid("Esa sede no existe.") })
  .transform(({ pagina, sede }) => ({ pagina, porPagina: POR_PAGINA, sedeId: sede }));

export const cuotaImpaga = cuota.omit({ pagadaEn: true, pagoId: true }).extend({
  /** null si el alumno ya no está en el centro. */
  alumno: z.object({ nombre: z.string(), apellido: z.string(), activo: z.boolean() }).nullable(),
});

/** Respuesta de GET /abonos/cuotas/impagas: la más vieja primero, y lo que suman todas. */
export const paginaDeImpagas = paginaDe(cuotaImpaga).extend({ adeudado: z.number().int() });

/** Query de GET /alumnos/:id/abono: `?sede`. */
export const pedidoDeAbonoDelAlumno = z
  .object({ sede: z.uuid("Esa sede no existe.") })
  .transform(({ sede }) => ({ sedeId: sede }));

/**
 * Respuesta de GET /alumnos/:id/abono: el abono que empezó más tarde en la sede, con las clases
 * que le quedan (cada fecha que terminó gastó una, 0020). Sin montos: lo ve también el profe.
 */
export const abonoDelAlumno = z.object({
  abono: z
    .object({
      cuotaId: z.uuid(),
      desde: z.string(),
      clases: z.number().int(),
      usadas: z.number().int(),
      restantes: z.number().int(),
      /** En UTC: el final de su última clase; null si no le alcanzan las fechas del horario fijo. */
      fin: z.iso.datetime().nullable(),
      pagada: z.boolean(),
    })
    .nullable(),
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
export type AbonoDelAlumno = z.infer<typeof abonoDelAlumno>;
