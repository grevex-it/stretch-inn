// Equipo del centro (ver docs/decisiones/0017): lista, alta, reset de clave y bloqueo.
import { z } from "zod";
import { numeroDePagina, paginaDe, POR_PAGINA } from "./paginas.ts";

/** Query de una lista: `?pagina=N`, desde 1. */
export const pedidoDePagina = z
  .object({ pagina: numeroDePagina })
  .transform(({ pagina }) => ({ pagina, porPagina: POR_PAGINA }));

export const pedidoDeAlta = z.object({
  nombre: z.string().trim().min(1, "Escribí el nombre.").max(100, "El nombre es muy largo."),
  email: z.string().trim().pipe(z.email("Ingresá un email válido.")),
  rolId: z.uuid("Elegí un rol."),
  sedeIds: z.array(z.uuid()).min(1, "Elegí al menos una sede."),
});

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
