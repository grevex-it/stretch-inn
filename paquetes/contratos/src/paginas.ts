// Ninguna lista sin paginar (regla 8 de AGENTS.md): toda lista viaja como una página.
import { z } from "zod";

/** Siempre de a 50. */
export const POR_PAGINA = 50;

/** El número de página de la query: `?pagina=N`, desde 1. */
export const numeroDePagina = z.coerce.number().int().min(1, "La página arranca en 1.").default(1);

/** `{ pagina, porPagina, total, elementos }`. */
export function paginaDe<T extends z.ZodType>(elemento: T) {
  return z.object({
    pagina: z.number().int(),
    porPagina: z.number().int(),
    total: z.number().int(),
    elementos: z.array(elemento),
  });
}
