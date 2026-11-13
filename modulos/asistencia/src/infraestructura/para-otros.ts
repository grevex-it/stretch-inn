// Lo que asistencia le da a otros módulos (agenda), con la Transaccion de enContexto: RLS limita
// al centro y a las sedes visibles. Asistencia lee y bloquea lo suyo; nadie escribe sus tablas.
import type { Transaccion } from "@app/plataforma";
import { and, count, inArray, isNull, sql } from "drizzle-orm";
import { avisosDeAusencia, recuperaciones } from "./esquema.ts";

const MAXIMO_POR_CONSULTA = 100;

/** Cuántas filas vigentes tiene cada fecha en una tabla, en una sola consulta. */
async function porFecha(
  tx: Transaccion,
  tabla: typeof recuperaciones | typeof avisosDeAusencia,
  anulada: typeof recuperaciones.anuladaEn | typeof avisosDeAusencia.anuladoEn,
  ids: string[],
): Promise<Map<string, number>> {
  const filas = await tx
    .select({ id: tabla.ocurrenciaId, total: count() })
    .from(tabla)
    .where(and(inArray(tabla.ocurrenciaId, ids), isNull(anulada)))
    .groupBy(tabla.ocurrenciaId);
  return new Map(filas.map((f) => [f.id, f.total]));
}

/**
 * Cuántos lugares ocupan de más las recuperaciones en cada fecha: las recuperaciones vigentes
 * menos los avisos vigentes. Solo vuelven las fechas donde sobran. Toma cada fecha con el mismo
 * bloqueo que recuperar y avisar, en orden, hasta el fin de la transacción: así agenda puede
 * inscribir a un fijo sin que una recuperación le gane el lugar en el medio (0013).
 */
export async function ocupadasDeMas(
  tx: Transaccion,
  { ocurrenciaIds }: { ocurrenciaIds: readonly string[] },
): Promise<Map<string, number>> {
  if (ocurrenciaIds.length > MAXIMO_POR_CONSULTA) {
    throw new Error(`ocupadasDeMas acepta hasta ${String(MAXIMO_POR_CONSULTA)} fechas.`);
  }
  if (ocurrenciaIds.length === 0) return new Map();
  const ids = [...new Set(ocurrenciaIds)].sort();
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(id, 0))
        from unnest(${`{${ids.join(",")}}`}::text[]) as id order by id`,
  );
  const reservas = await porFecha(tx, recuperaciones, recuperaciones.anuladaEn, ids);
  const avisos = await porFecha(tx, avisosDeAusencia, avisosDeAusencia.anuladoEn, ids);
  const ocupadas = new Map<string, number>();
  for (const [id, total] of reservas) {
    const deMas = total - (avisos.get(id) ?? 0);
    if (deMas > 0) ocupadas.set(id, deMas);
  }
  return ocupadas;
}
