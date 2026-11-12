// Adaptador Drizzle de las recuperaciones y de los lugares de cada fecha. Corre dentro de
// enContexto: RLS limita al centro y a las sedes visibles.
import { inscriptosEnFecha } from "@app/agenda";
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type { RepositorioAsistencia } from "../aplicacion/puertos.ts";
import { avisosDeAusencia, recuperaciones } from "./esquema.ts";

type RepositorioRecuperaciones = Pick<
  RepositorioAsistencia,
  | "bloquearFecha"
  | "cuentaDeLugares"
  | "recuperar"
  | "recuperacion"
  | "anularRecuperacion"
  | "recuperan"
  | "recuperanEntre"
  | "bloquearAlumno"
  | "recuperacionesEntre"
>;

const vigentes = (ocurrenciaId: string) =>
  and(eq(recuperaciones.ocurrenciaId, ocurrenciaId), isNull(recuperaciones.anuladaEn));

/** Lo que hace falta para el máximo de recuperaciones por abono (0020). */
function porAlumno(
  tx: Transaccion,
): Pick<RepositorioAsistencia, "bloquearAlumno" | "recuperacionesEntre"> {
  return {
    async bloquearAlumno(alumnoId) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`rec:${alumnoId}`}, 0))`,
      );
    },
    async recuperacionesEntre({ alumnoId, sedeId, desde, hasta }) {
      const [fila] = await tx
        .select({ total: count() })
        .from(recuperaciones)
        .where(
          and(
            eq(recuperaciones.alumnoId, alumnoId),
            eq(recuperaciones.sedeId, sedeId),
            isNull(recuperaciones.anuladaEn),
            gte(recuperaciones.empiezaEn, desde),
            lt(recuperaciones.empiezaEn, hasta),
          ),
        );
      return fila?.total ?? 0;
    },
  };
}

export function repositorioRecuperaciones(tx: Transaccion): RepositorioRecuperaciones {
  return {
    async bloquearFecha(id) {
      // Bloqueo de la transacción por fecha: reservar, anular y avisar van de a uno (0013).
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    },
    cuentaDeLugares: (fecha) => cuentaDeLugares(tx, fecha),
    recuperar: (fecha, reserva, registro) => recuperar(tx, fecha, reserva, registro),
    async recuperacion(id) {
      const [fila] = await tx
        .select({ ocurrenciaId: recuperaciones.ocurrenciaId })
        .from(recuperaciones)
        .where(and(eq(recuperaciones.id, id), isNull(recuperaciones.anuladaEn)));
      return fila;
    },
    async anularRecuperacion(id, ahora) {
      const filas = await tx
        .update(recuperaciones)
        .set({ anuladaEn: ahora })
        .where(and(eq(recuperaciones.id, id), isNull(recuperaciones.anuladaEn)))
        .returning({ id: recuperaciones.id });
      return filas.length > 0;
    },
    recuperan: (filtro) => recuperan(tx, filtro),
    async recuperanEntre(ocurrenciaId, alumnoIds) {
      if (alumnoIds.length === 0) return new Set();
      const filas = await tx
        .select({ alumnoId: recuperaciones.alumnoId })
        .from(recuperaciones)
        .where(and(vigentes(ocurrenciaId), inArray(recuperaciones.alumnoId, [...alumnoIds])));
      return new Set(filas.map((f) => f.alumnoId));
    },
    ...porAlumno(tx),
  };
}

async function cuentaDeLugares(
  tx: Transaccion,
  ...[{ id, claseId, empiezaEn }]: Parameters<RepositorioAsistencia["cuentaDeLugares"]>
): ReturnType<RepositorioAsistencia["cuentaDeLugares"]> {
  const inscriptos = await inscriptosEnFecha(tx, {
    claseId,
    momento: empiezaEn,
    pagina: 1,
    porPagina: 1,
  });
  const [avisos] = await tx
    .select({ total: count() })
    .from(avisosDeAusencia)
    .where(and(eq(avisosDeAusencia.ocurrenciaId, id), isNull(avisosDeAusencia.anuladoEn)));
  const [reservas] = await tx.select({ total: count() }).from(recuperaciones).where(vigentes(id));
  return {
    inscriptos: inscriptos.total,
    avisos: avisos?.total ?? 0,
    recuperaciones: reservas?.total ?? 0,
  };
}

/** Los índices únicos parciales son la barrera: si choca, no hay fila. */
async function recuperar(
  tx: Transaccion,
  ...[fecha, { alumnoId }, registro]: Parameters<RepositorioAsistencia["recuperar"]>
): Promise<string | undefined> {
  const [fila] = await tx
    .insert(recuperaciones)
    .values({
      centroId: sql`app_centro_actual()`,
      sedeId: fecha.sedeId,
      ocurrenciaId: fecha.id,
      alumnoId,
      empiezaEn: fecha.empiezaEn,
      reservadaPorTipo: registro.tipo,
      reservadaPorId: registro.id,
      reservadaEn: registro.en,
    })
    .onConflictDoNothing()
    .returning({ id: recuperaciones.id });
  return fila?.id;
}

async function recuperan(
  tx: Transaccion,
  { ocurrenciaId, pagina, porPagina }: Parameters<RepositorioAsistencia["recuperan"]>[0],
): ReturnType<RepositorioAsistencia["recuperan"]> {
  const elementos = await tx
    .select({ alumnoId: recuperaciones.alumnoId, recuperacionId: recuperaciones.id })
    .from(recuperaciones)
    .where(vigentes(ocurrenciaId))
    .orderBy(asc(recuperaciones.reservadaEn), asc(recuperaciones.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);
  const [total] = await tx
    .select({ total: count() })
    .from(recuperaciones)
    .where(vigentes(ocurrenciaId));
  return { pagina, porPagina, total: total?.total ?? 0, elementos };
}
