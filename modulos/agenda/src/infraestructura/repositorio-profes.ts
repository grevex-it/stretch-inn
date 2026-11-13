// Adaptador Drizzle de los profes de la agenda (0022): el fijo de cada sede y el de cada fecha.
// El profe es un usuario del equipo, leído por la API pública de identidad (regla 4).
import { obtenerUsuarios } from "@app/identidad";
import type { Transaccion } from "@app/plataforma";
import { and, between, count, eq, isNull, lte, sql } from "drizzle-orm";
import type { RepositorioAgenda } from "../aplicacion/puertos.ts";
import { clases, ocurrencias, profesDeSede } from "./esquema.ts";

type RepositorioProfes = Pick<
  RepositorioAgenda,
  | "profeValido"
  | "profeDeSede"
  | "guardarProfeDeSede"
  | "fijarProfeDeFecha"
  | "congelarProfe"
  | "dictadas"
  | "nombresDeProfes"
>;

export function repositorioProfes(tx: Transaccion): RepositorioProfes {
  return {
    async profeValido(id) {
      const [usuario] = await obtenerUsuarios(tx, [id]);
      return usuario?.activo === true;
    },
    async profeDeSede(sedeId) {
      const [fila] = await tx
        .select({ profeId: profesDeSede.profeId })
        .from(profesDeSede)
        .where(eq(profesDeSede.sedeId, sedeId));
      return fila?.profeId;
    },
    async guardarProfeDeSede(sedeId, profeId) {
      if (profeId === null) {
        await tx.delete(profesDeSede).where(eq(profesDeSede.sedeId, sedeId));
        return;
      }
      await tx
        .insert(profesDeSede)
        .values({ sedeId, profeId, centroId: sql`app_centro_actual()` })
        .onConflictDoUpdate({ target: profesDeSede.sedeId, set: { profeId } });
    },
    async fijarProfeDeFecha(id, profeId) {
      await tx.update(ocurrencias).set({ profeId }).where(eq(ocurrencias.id, id));
    },
    ...paraElPago(tx),
    async congelarProfe(claseId, profeId, ahora) {
      if (profeId === null) return;
      await tx
        .update(ocurrencias)
        .set({ profeId })
        .where(
          and(
            eq(ocurrencias.claseId, claseId),
            isNull(ocurrencias.profeId),
            lte(ocurrencias.empiezaEn, ahora),
          ),
        );
    },
  };
}

/** Para pagarles por clase (0022): las fechas dadas por cada profe y sus nombres. */
function paraElPago(tx: Transaccion): Pick<RepositorioAgenda, "dictadas" | "nombresDeProfes"> {
  return {
    async nombresDeProfes(ids) {
      const usuarios = await obtenerUsuarios(tx, ids);
      return new Map(usuarios.map((u) => [u.id, u.nombre]));
    },
    async dictadas({ sedeId, desde, hasta, ahora }) {
      const profe = sql<string | null>`coalesce(${ocurrencias.profeId}, ${clases.profeId})`;
      return tx
        .select({ profeId: profe, clases: count() })
        .from(ocurrencias)
        .innerJoin(clases, eq(clases.id, ocurrencias.claseId))
        .where(
          and(
            eq(ocurrencias.sedeId, sedeId),
            between(ocurrencias.fecha, desde, hasta),
            eq(ocurrencias.cancelada, false),
            lte(ocurrencias.terminaEn, ahora),
          ),
        )
        .groupBy(profe);
    },
  };
}
