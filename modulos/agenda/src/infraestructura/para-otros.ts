// Lo que agenda les da a otros módulos (asistencia), con la Transaccion de enContexto: RLS limita
// al centro y a las sedes visibles. Son lecturas: nadie escribe en las tablas de agenda (regla 4).
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, eq, gt, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import type { PaginaDe } from "../aplicacion/puertos.ts";
import { clases, inscripciones, ocurrencias } from "./esquema.ts";

const MAXIMO_POR_CONSULTA = 100;

/** Una fecha concreta con su clase. */
export interface FechaParaOtros {
  id: string;
  claseId: string;
  sedeId: string;
  nombre: string;
  /** La fecha local del centro, AAAA-MM-DD. */
  fecha: string;
  empiezaEn: Date;
  terminaEn: Date;
  cancelada: boolean;
}

export async function obtenerFecha(
  tx: Transaccion,
  id: string,
): Promise<FechaParaOtros | undefined> {
  const [fila] = await tx
    .select({
      id: ocurrencias.id,
      claseId: ocurrencias.claseId,
      sedeId: ocurrencias.sedeId,
      nombre: clases.nombre,
      fecha: ocurrencias.fecha,
      empiezaEn: ocurrencias.empiezaEn,
      terminaEn: ocurrencias.terminaEn,
      cancelada: ocurrencias.cancelada,
    })
    .from(ocurrencias)
    .innerJoin(clases, eq(clases.id, ocurrencias.claseId))
    .where(eq(ocurrencias.id, id));
  return fila;
}

/** Vigente en ese momento: ya se había inscripto y todavía no se había dado de baja. */
function vigenteEn(claseId: string, momento: Date): SQL | undefined {
  return and(
    eq(inscripciones.claseId, claseId),
    lte(inscripciones.creadaEn, momento),
    or(isNull(inscripciones.bajaEn), gt(inscripciones.bajaEn, momento)),
  );
}

/** Los alumnos con inscripción vigente en la clase en ese momento, por orden de inscripción. */
export async function inscriptosEnFecha(
  tx: Transaccion,
  filtro: { claseId: string; momento: Date; pagina: number; porPagina: number },
): Promise<PaginaDe<{ alumnoId: string }>> {
  const { claseId, momento, pagina, porPagina } = filtro;
  const donde = vigenteEn(claseId, momento);
  const elementos = await tx
    .select({ alumnoId: inscripciones.alumnoId })
    .from(inscripciones)
    .where(donde)
    .orderBy(asc(inscripciones.creadaEn), asc(inscripciones.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);
  const [total] = await tx.select({ total: count() }).from(inscripciones).where(donde);
  return { pagina, porPagina, total: total?.total ?? 0, elementos };
}

/** Cuáles de esos alumnos tenían inscripción vigente en la clase en ese momento. */
export async function estabanInscriptos(
  tx: Transaccion,
  { claseId, momento, alumnoIds }: { claseId: string; momento: Date; alumnoIds: readonly string[] },
): Promise<Set<string>> {
  if (alumnoIds.length > MAXIMO_POR_CONSULTA) {
    throw new Error(
      `estabanInscriptos acepta hasta ${String(MAXIMO_POR_CONSULTA)} alumnos por consulta.`,
    );
  }
  if (alumnoIds.length === 0) return new Set();
  const filas = await tx
    .select({ alumnoId: inscripciones.alumnoId })
    .from(inscripciones)
    .where(and(vigenteEn(claseId, momento), inArray(inscripciones.alumnoId, [...alumnoIds])));
  return new Set(filas.map((f) => f.alumnoId));
}
