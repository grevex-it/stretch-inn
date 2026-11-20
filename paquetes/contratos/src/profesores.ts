// Los profes y sus tarifas por clase (0024). Montos en pesos enteros (0009). Las reglas (niveles,
// vigencia, sin aumentos hacia atrás) las aplica el módulo profesores.
import { z } from "zod";
import { numeroDePagina, paginaDe, POR_PAGINA } from "./paginas.ts";

export const TIPOS_DE_PROFE = ["empleado", "socio"] as const;

/** Respuesta de GET /profesores: el equipo activo del centro con el tipo de cada uno. */
export const paginaDeProfesConTipo = paginaDe(
  z.object({ id: z.uuid(), nombre: z.string(), tipo: z.enum(TIPOS_DE_PROFE) }),
);

/** Cuerpo de PUT /profesores/:id/tipo. */
export const pedidoDeTipoDeProfe = z.object({
  tipo: z.enum(TIPOS_DE_PROFE, "El profe es empleado o socio."),
});

/** Query de GET /profesores/tarifas: `?sede&pagina`; sin sede, las de todo el centro. */
export const pedidoDeTarifas = z
  .object({ pagina: numeroDePagina, sede: z.uuid("Esa sede no existe.").optional() })
  .transform(({ pagina, sede }) => ({ pagina, porPagina: POR_PAGINA, sedeId: sede ?? null }));

/** Cuerpo de POST /profesores/tarifas: el alcance (null: todos), el monto por clase y desde cuándo. */
export const pedidoDeTarifa = z.object({
  sedeId: z.uuid("Esa sede no existe.").nullable(),
  profeId: z.uuid("Ese profe no existe.").nullable(),
  monto: z.number("Escribí el monto por clase.").int("El monto va en pesos enteros, sin centavos."),
  desde: z.iso.date("Revisá desde qué día rige."),
});

export const tarifa = z.object({
  id: z.uuid(),
  sedeId: z.uuid().nullable(),
  profeId: z.uuid().nullable(),
  monto: z.number().int(),
  desde: z.string(),
  /** null mientras no la reemplace otra del mismo alcance. */
  hasta: z.string().nullable(),
});

export const paginaDeTarifas = paginaDe(tarifa);

export type PaginaDeProfesConTipo = z.infer<typeof paginaDeProfesConTipo>;
export type PedidoDeTarifa = z.infer<typeof pedidoDeTarifa>;
export type Tarifa = z.infer<typeof tarifa>;
export type PaginaDeTarifas = z.infer<typeof paginaDeTarifas>;
