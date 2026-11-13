// Adaptador Drizzle de las camas de cada sede. Corre dentro de enContexto: RLS limita al centro y a
// las sedes visibles.
import type { Transaccion } from "@app/plataforma";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { RepositorioAgenda } from "../aplicacion/puertos.ts";
import { camasDeSede, clases } from "./esquema.ts";

type RepositorioCamas = Pick<
  RepositorioAgenda,
  "camas" | "bloquearCamas" | "guardarCamas" | "clasesPorEncimaDe" | "bajarCupos"
>;

export function repositorioCamas(tx: Transaccion): RepositorioCamas {
  return {
    async camas(sedeId) {
      const [fila] = await tx
        .select({ camas: camasDeSede.camas })
        .from(camasDeSede)
        .where(eq(camasDeSede.sedeId, sedeId));
      return fila?.camas;
    },
    async bloquearCamas(sedeId) {
      // Cambiar las camas de una sede va de a uno, haya fila o no.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`camas:${sedeId}`}, 0))`,
      );
    },
    async guardarCamas(sedeId, camas) {
      if (camas === null) {
        await tx.delete(camasDeSede).where(eq(camasDeSede.sedeId, sedeId));
        return;
      }
      await tx
        .insert(camasDeSede)
        .values({ sedeId, camas, centroId: sql`app_centro_actual()` })
        .onConflictDoUpdate({ target: camasDeSede.sedeId, set: { camas } });
    },
    async clasesPorEncimaDe(sedeId, camas) {
      return tx
        .select({ id: clases.id, nombre: clases.nombre, inscriptos: clases.inscriptos })
        .from(clases)
        .where(and(eq(clases.sedeId, sedeId), gt(clases.cupo, camas)))
        .orderBy(asc(clases.id))
        .for("update");
    },
    async bajarCupos(ids, camas) {
      if (ids.length === 0) return;
      await tx
        .update(clases)
        .set({ cupo: camas, version: sql`${clases.version} + 1` })
        .where(inArray(clases.id, [...ids]));
    },
  };
}
