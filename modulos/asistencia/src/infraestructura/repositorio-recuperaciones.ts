// Adaptador Drizzle de las recuperaciones y de los lugares de cada fecha. Corre dentro de
// enContexto: RLS limita al centro y a las sedes visibles.
import { inscriptosEnFecha } from "@app/agenda";
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, eq, gt, inArray, isNull, notExists, sql } from "drizzle-orm";
import type { RepositorioAsistencia } from "../aplicacion/puertos.ts";
import { avisosDeAusencia, creditos, recuperaciones } from "./esquema.ts";

type RepositorioRecuperaciones = Pick<
  RepositorioAsistencia,
  | "bloquearFecha"
  | "cuentaDeLugares"
  | "creditoParaUsar"
  | "recuperar"
  | "recuperacion"
  | "anularRecuperacion"
  | "recuperan"
  | "recuperanEntre"
  | "creditoUsado"
>;

const vigentes = (ocurrenciaId: string) =>
  and(eq(recuperaciones.ocurrenciaId, ocurrenciaId), isNull(recuperaciones.anuladaEn));

/** El crédito no tiene una recuperación vigente. */
export const sinUsar = (tx: Transaccion) =>
  notExists(
    tx
      .select({ uno: sql`1` })
      .from(recuperaciones)
      .where(and(eq(recuperaciones.creditoId, creditos.id), isNull(recuperaciones.anuladaEn))),
  );

export function repositorioRecuperaciones(tx: Transaccion): RepositorioRecuperaciones {
  return {
    async bloquearFecha(id) {
      // Bloqueo de la transacción por fecha: reservar, anular y avisar van de a uno (0013).
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    },
    cuentaDeLugares: (fecha) => cuentaDeLugares(tx, fecha),
    creditoParaUsar: (filtro) => creditoParaUsar(tx, filtro),
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
    async creditoUsado(avisoId) {
      const [fila] = await tx
        .select({ uno: sql`1` })
        .from(recuperaciones)
        .innerJoin(creditos, eq(creditos.id, recuperaciones.creditoId))
        .where(and(eq(creditos.avisoId, avisoId), isNull(recuperaciones.anuladaEn)));
      return fila !== undefined;
    },
  };
}

/** Vigente al empezar la fecha y sin usar; queda tomado hasta el fin de la transacción. */
async function creditoParaUsar(
  tx: Transaccion,
  { alumnoId, sedeId, empiezaEn, ahora }: Parameters<RepositorioAsistencia["creditoParaUsar"]>[0],
): ReturnType<RepositorioAsistencia["creditoParaUsar"]> {
  const [fila] = await tx
    .select({ id: creditos.id })
    .from(creditos)
    .where(
      and(
        eq(creditos.alumnoId, alumnoId),
        eq(creditos.sedeId, sedeId),
        isNull(creditos.anuladoEn),
        gt(creditos.venceEn, ahora > empiezaEn ? ahora : empiezaEn),
        sinUsar(tx),
      ),
    )
    .orderBy(asc(creditos.venceEn), asc(creditos.id))
    .limit(1)
    .for("update");
  return fila;
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
  ...[fecha, { alumnoId, creditoId }, registro]: Parameters<RepositorioAsistencia["recuperar"]>
): Promise<string | undefined> {
  const [fila] = await tx
    .insert(recuperaciones)
    .values({
      centroId: sql`app_centro_actual()`,
      sedeId: fecha.sedeId,
      ocurrenciaId: fecha.id,
      alumnoId,
      creditoId,
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
    .select({ alumnoId: recuperaciones.alumnoId })
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
