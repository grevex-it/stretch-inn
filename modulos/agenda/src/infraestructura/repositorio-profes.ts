// Adaptador Drizzle de los profes de la agenda (0022): el fijo de cada sede y el de cada fecha.
// El profe es un usuario del equipo, leído por la API pública de identidad (regla 4).
import { obtenerUsuarios } from "@app/identidad";
import type { Transaccion } from "@app/plataforma";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import type { RepositorioAgenda } from "../aplicacion/puertos.ts";
import { ocurrencias, profesDeSede } from "./esquema.ts";

type RepositorioProfes = Pick<
  RepositorioAgenda,
  "profeValido" | "profeDeSede" | "guardarProfeDeSede" | "fijarProfeDeFecha" | "congelarProfe"
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
