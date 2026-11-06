// Equipo del centro (ver docs/decisiones/0017): lista, alta, reset de clave y bloqueo.
import { z } from "zod";

/** Ninguna lista sin paginar (regla 8): siempre de a 50. */
const POR_PAGINA = 50;

/** Query de una lista: `?pagina=N`, desde 1. */
export const pedidoDePagina = z
  .object({
    pagina: z.coerce.number().int().min(1, "La página arranca en 1.").default(1),
  })
  .transform(({ pagina }) => ({ pagina, porPagina: POR_PAGINA }));

export const pedidoDeAlta = z.object({
  nombre: z.string().trim().min(1, "Escribí el nombre.").max(100, "El nombre es muy largo."),
  email: z.string().trim().pipe(z.email("Ingresá un email válido.")),
  rolId: z.uuid("Elegí un rol."),
  sedeIds: z.array(z.uuid()).min(1, "Elegí al menos una sede."),
});

function paginaDe<T extends z.ZodType>(elemento: T) {
  return z.object({
    pagina: z.number().int(),
    porPagina: z.number().int(),
    total: z.number().int(),
    elementos: z.array(elemento),
  });
}

export const paginaDeEquipo = paginaDe(
  z.object({
    id: z.uuid(),
    nombre: z.string(),
    email: z.string(),
    activo: z.boolean(),
    /** Solo las de las sedes que ve quien consulta. */
    asignaciones: z.array(z.object({ sedeId: z.uuid(), rolId: z.uuid(), rol: z.string() })),
  }),
);

export const paginaDeRoles = paginaDe(z.object({ id: z.uuid(), nombre: z.string() }));

/** La clave temporal se muestra una sola vez. Es null si la cuenta ya existía (se vinculó). */
export const altaHecha = z.object({ usuarioId: z.uuid(), claveTemporal: z.string().nullable() });

export const claveGenerada = z.object({ claveTemporal: z.string() });

export type PedidoDeAlta = z.infer<typeof pedidoDeAlta>;
export type PaginaDeEquipo = z.infer<typeof paginaDeEquipo>;
export type PaginaDeRoles = z.infer<typeof paginaDeRoles>;
export type AltaHecha = z.infer<typeof altaHecha>;
export type ClaveGenerada = z.infer<typeof claveGenerada>;
