// Adaptador Drizzle de las camas de cada sede. Corre dentro de enContexto: RLS limita al centro y a
// las sedes visibles.
import type { Transaccion } from "@app/plataforma";
import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { RepositorioAgenda } from "../aplicacion/puertos.ts";
import { camasDeSede, clases } from "./esquema.ts";

type BloqueosDeCamas = Pick<RepositorioAgenda, "bloquearCamas" | "compartirCamas">;

type RepositorioCamas = BloqueosDeCamas &
  Pick<
    RepositorioAgenda,
    "camas" | "guardarCamas" | "clasesPorEncimaDe" | "bajarCupos" | "subirCupos"
  >;

const claveDeCamas = (sedeId: string) => `camas:${sedeId}`;

/** Un bloqueo por sede, haya fila de camas o no: exclusivo para cambiarlas, compartido para leerlas. */
function bloqueosDeCamas(tx: Transaccion): BloqueosDeCamas {
  return {
    async bloquearCamas(sedeId) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${claveDeCamas(sedeId)}, 0))`,
      );
    },
    async compartirCamas(sedeId) {
      await tx.execute(
        sql`select pg_advisory_xact_lock_shared(hashtextextended(${claveDeCamas(sedeId)}, 0))`,
      );
    },
  };
}

export function repositorioCamas(tx: Transaccion): RepositorioCamas {
  return {
    ...bloqueosDeCamas(tx),
    async camas(sedeId) {
      const [fila] = await tx
        .select({ camas: camasDeSede.camas })
        .from(camasDeSede)
        .where(eq(camasDeSede.sedeId, sedeId));
      return fila?.camas;
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
    async subirCupos(sedeId, camas) {
      await tx
        .update(clases)
        .set({ cupo: camas, version: sql`${clases.version} + 1` })
        .where(and(eq(clases.sedeId, sedeId), lt(clases.cupo, camas)));
    },
  };
}
