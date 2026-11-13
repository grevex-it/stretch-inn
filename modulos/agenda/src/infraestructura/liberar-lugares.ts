// La baja de un alumno libera sus lugares fijos (0019). La llama personas al dar de baja, en la
// misma transacción. Corre con RLS: libera los lugares de las sedes visibles de quien da la baja.
import type { Transaccion } from "@app/plataforma";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { clases, inscripciones } from "./esquema.ts";

const vigentesDe = (alumnoId: string) =>
  and(eq(inscripciones.alumnoId, alumnoId), isNull(inscripciones.bajaEn));

/**
 * Da de baja las inscripciones vigentes del alumno y descuenta cada una de su clase. Devuelve
 * cuántas liberó: repetirla no tiene efecto doble. Toma las clases en orden de id antes de tocar
 * nada, igual que inscribir (clase primero), para no cruzarse en un deadlock.
 */
export async function liberarLugares(
  tx: Transaccion,
  { alumnoId, ahora }: { alumnoId: string; ahora: Date },
): Promise<number> {
  const deLasClases = tx
    .select({ id: inscripciones.claseId })
    .from(inscripciones)
    .where(vigentesDe(alumnoId));
  await tx
    .select({ id: clases.id })
    .from(clases)
    .where(inArray(clases.id, deLasClases))
    .orderBy(asc(clases.id))
    .for("update");
  const liberadas = await tx
    .update(inscripciones)
    .set({ bajaEn: ahora })
    .where(vigentesDe(alumnoId))
    .returning({ claseId: inscripciones.claseId });
  if (liberadas.length === 0) return 0;
  // Un alumno tiene a lo sumo una inscripción vigente por clase: cada clase pierde un lugar.
  await tx
    .update(clases)
    .set({ inscriptos: sql`${clases.inscriptos} - 1` })
    .where(
      inArray(
        clases.id,
        liberadas.map((l) => l.claseId),
      ),
    );
  return liberadas.length;
}
