// Adaptador Drizzle de las inscripciones. Corre dentro de enContexto: RLS limita al centro y a
// las sedes visibles. El alumno se lee por la API pública de personas (regla 4).
import { obtenerAlumno } from "@app/personas";
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { RepositorioInscripciones } from "../aplicacion/puertos.ts";
import { clases, inscripciones } from "./esquema.ts";

export function repositorioInscripciones(tx: Transaccion): RepositorioInscripciones {
  return {
    async alumno(id) {
      const alumno = await obtenerAlumno(tx, id);
      return alumno === undefined ? undefined : { activo: alumno.activo };
    },
    async inscribir({ claseId, sedeId, alumnoId }) {
      // El índice único parcial (clase, alumno vigente) es la barrera: si choca, no hay fila.
      const [fila] = await tx
        .insert(inscripciones)
        .values({ claseId, sedeId, alumnoId, centroId: sql`app_centro_actual()` })
        .onConflictDoNothing()
        .returning({ id: inscripciones.id });
      return fila?.id;
    },
    async sumarInscriptos(claseId, cuantos) {
      await tx
        .update(clases)
        .set({ inscriptos: sql`${clases.inscriptos} + ${cuantos}` })
        .where(eq(clases.id, claseId));
    },
    async vigente(id) {
      const [fila] = await tx
        .select({ claseId: inscripciones.claseId })
        .from(inscripciones)
        .where(and(eq(inscripciones.id, id), isNull(inscripciones.bajaEn)));
      return fila;
    },
    async darDeBaja(id, ahora) {
      const filas = await tx
        .update(inscripciones)
        .set({ bajaEn: ahora })
        .where(and(eq(inscripciones.id, id), isNull(inscripciones.bajaEn)))
        .returning({ id: inscripciones.id });
      return filas.length > 0;
    },
    deAlumno: (filtro) => deAlumno(tx, filtro),
  };
}

const columnasDeClase = {
  id: clases.id,
  sedeId: clases.sedeId,
  nombre: clases.nombre,
  dia: clases.dia,
  hora: clases.hora,
  duracionMinutos: clases.duracionMinutos,
  cupo: clases.cupo,
  inscriptos: clases.inscriptos,
  activa: clases.activa,
  version: clases.version,
};

/** Las inscripciones vigentes de un alumno, en las sedes pedidas, con su clase. */
async function deAlumno(
  tx: Transaccion,
  { alumnoId, sedeIds, pagina, porPagina }: Parameters<RepositorioInscripciones["deAlumno"]>[0],
): ReturnType<RepositorioInscripciones["deAlumno"]> {
  if (sedeIds.length === 0) return { pagina, porPagina, total: 0, elementos: [] };
  const donde = and(
    eq(inscripciones.alumnoId, alumnoId),
    isNull(inscripciones.bajaEn),
    inArray(inscripciones.sedeId, [...sedeIds]),
  );
  const elementos = await tx
    .select({ id: inscripciones.id, clase: columnasDeClase })
    .from(inscripciones)
    .innerJoin(clases, eq(clases.id, inscripciones.claseId))
    .where(donde)
    .orderBy(asc(clases.dia), asc(clases.hora), asc(inscripciones.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);
  const [total] = await tx.select({ total: count() }).from(inscripciones).where(donde);
  return { pagina, porPagina, total: total?.total ?? 0, elementos };
}
