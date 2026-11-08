// Adaptador Drizzle de los créditos de recuperación. Corre dentro de enContexto: RLS limita al
// centro y a las sedes visibles.
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, eq, gt, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { RepositorioAsistencia } from "../aplicacion/puertos.ts";
import { creditos } from "./esquema.ts";

type RepositorioCreditos = Pick<
  RepositorioAsistencia,
  "crearCredito" | "anularCreditoDeAviso" | "creditos"
>;

/** Vigente: no anulado y sin vencer. */
const vigente = (ahora: Date): SQL | undefined =>
  and(isNull(creditos.anuladoEn), gt(creditos.venceEn, ahora));

export function repositorioCreditos(tx: Transaccion): RepositorioCreditos {
  return {
    async crearCredito({ avisoId, alumnoId, sedeId, ocurrenciaId, venceEn }) {
      await tx
        .insert(creditos)
        .values({
          centroId: sql`app_centro_actual()`,
          sedeId,
          alumnoId,
          avisoId,
          ocurrenciaId,
          venceEn,
        })
        .onConflictDoNothing();
    },
    async anularCreditoDeAviso(avisoId, ahora) {
      await tx
        .update(creditos)
        .set({ anuladoEn: ahora })
        .where(and(eq(creditos.avisoId, avisoId), isNull(creditos.anuladoEn)));
    },
    async creditos({ alumnoId, sedeIds, ahora, pagina, porPagina }) {
      if (sedeIds.length === 0) return { pagina, porPagina, total: 0, elementos: [] };
      const donde = and(
        eq(creditos.alumnoId, alumnoId),
        inArray(creditos.sedeId, [...sedeIds]),
        vigente(ahora),
      );
      const elementos = await tx
        .select({
          id: creditos.id,
          sedeId: creditos.sedeId,
          ocurrenciaId: creditos.ocurrenciaId,
          venceEn: creditos.venceEn,
        })
        .from(creditos)
        .where(donde)
        .orderBy(asc(creditos.venceEn), asc(creditos.id))
        .limit(porPagina)
        .offset((pagina - 1) * porPagina);
      const [total] = await tx.select({ total: count() }).from(creditos).where(donde);
      return { pagina, porPagina, total: total?.total ?? 0, elementos };
    },
  };
}
