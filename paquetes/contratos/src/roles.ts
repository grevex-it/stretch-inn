// Roles a medida, asignaciones por sede y ajustes individuales del equipo (ver docs/decisiones/0007).
import { z } from "zod";

const FORMA = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

/** Un permiso del catálogo, con la forma modulo.accion (el tipo Permiso de @app/nucleo). */
const permiso = z.custom<`${string}.${string}`>(
  (valor) => typeof valor === "string" && FORMA.test(valor),
  "Ese permiso no existe.",
);

export const pedidoDeRol = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Escribí el nombre del rol.")
    .max(60, "El nombre del rol es muy largo."),
  permisos: z.array(permiso).max(500),
});

export const edicionDeRol = pedidoDeRol.extend({ version: z.number().int().min(1) });

export const rolCreado = z.object({ id: z.uuid() });
export const rolEditado = z.object({ version: z.number().int() });

/** Un rol con sus permisos. `plantilla` dice de qué plantilla salió: esos no se editan. */
export const fichaDeRol = z.object({
  id: z.uuid(),
  nombre: z.string(),
  plantilla: z.string().nullable(),
  permisos: z.array(permiso),
  version: z.number().int(),
});

/** Las secciones del catálogo, para armar la matriz de permisos. */
export const catalogoDePermisos = z.object({
  secciones: z.array(
    z.object({
      seccion: z.string(),
      permisos: z.array(z.object({ permiso, descripcion: z.string() })),
    }),
  ),
});

export const pedidoDeAsignacion = z.object({
  sedeId: z.uuid("Elegí la sede."),
  rolId: z.uuid("Elegí un rol."),
});

export const pedidoDeAjuste = z.object({
  sedeId: z.uuid("Elegí la sede."),
  permiso,
  tipo: z.enum(["extra", "quitado"]),
});

/**
 * Los roles de un integrante en las sedes que ve quien consulta y, por permiso, de dónde viene:
 * de qué roles, si tiene un ajuste y si al final lo tiene (gana el quitado). `enOtrasSedes`: si
 * tiene más en sedes que quien consulta no ve ahora (por ejemplo, con una sede activa).
 */
export const permisosDeIntegrante = z.object({
  asignaciones: z.array(z.object({ sedeId: z.uuid(), rolId: z.uuid(), rol: z.string() })),
  permisos: z.array(
    z.object({
      sedeId: z.uuid(),
      permiso,
      roles: z.array(z.string()),
      ajuste: z.enum(["extra", "quitado"]).nullable(),
      efectivo: z.boolean(),
    }),
  ),
  enOtrasSedes: z.boolean(),
  /** Si son los permisos de quien consulta: nadie se cambia los suyos. */
  esQuienConsulta: z.boolean(),
});

export type PedidoDeRol = z.infer<typeof pedidoDeRol>;
export type EdicionDeRol = z.infer<typeof edicionDeRol>;
export type FichaDeRol = z.infer<typeof fichaDeRol>;
export type CatalogoDePermisos = z.infer<typeof catalogoDePermisos>;
export type PedidoDeAsignacion = z.infer<typeof pedidoDeAsignacion>;
export type PedidoDeAjuste = z.infer<typeof pedidoDeAjuste>;
export type PermisosDeIntegrante = z.infer<typeof permisosDeIntegrante>;
