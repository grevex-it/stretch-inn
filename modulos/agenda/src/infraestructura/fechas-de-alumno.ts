// Las fechas del horario fijo de un alumno en una sede, para otros módulos (abonos, 0020): cada
// fecha gasta una clase del abono. Corre con la Transaccion de enContexto (RLS). Arma a pedido las
// fechas que falten, como la semana de una sede: agenda escribe solo en sus propias tablas.
import type { Transaccion } from "@app/plataforma";
import { and, asc, eq, gt, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { localAUtc, ocurrenciasDeLaSemana, sumarDias } from "../dominio/ocurrencias.ts";
import { clases, inscripciones, ocurrencias } from "./esquema.ts";
import { repositorioAgenda } from "./repositorio.ts";

const MAXIMO_DE_FECHAS = 100;
/** Un tope de búsqueda, por si casi todas las fechas están canceladas. */
const SEMANAS_COMO_MUCHO = 104;

/** Una fecha concreta del horario fijo del alumno. */
export interface FechaDeAlumno {
  id: string;
  claseId: string;
  /** La fecha local del centro, AAAA-MM-DD. */
  fecha: string;
  empiezaEn: Date;
  terminaEn: Date;
}

interface Inscripcion {
  claseId: string;
  desde: Date;
  hasta: Date | null;
  activa: boolean;
  claseCreadaEn: Date;
  dia: number;
  hora: string;
  duracionMinutos: number;
}

/** Sus inscripciones en la sede que siguen vigentes en algún momento desde `inicio`. */
function inscripcionesDesde(tx: Transaccion, alumnoId: string, sedeId: string, inicio: Date) {
  return tx
    .select({
      claseId: inscripciones.claseId,
      desde: inscripciones.creadaEn,
      hasta: inscripciones.bajaEn,
      activa: clases.activa,
      claseCreadaEn: clases.creadoEn,
      dia: clases.dia,
      hora: clases.hora,
      duracionMinutos: clases.duracionMinutos,
    })
    .from(inscripciones)
    .innerJoin(clases, eq(clases.id, inscripciones.claseId))
    .where(
      and(
        eq(inscripciones.alumnoId, alumnoId),
        eq(inscripciones.sedeId, sedeId),
        or(isNull(inscripciones.bajaEn), gt(inscripciones.bajaEn, inicio)),
      ),
    );
}

/** Si alguna de sus inscripciones en esa clase estaba vigente al empezar la fecha. */
const vigente = (suyas: readonly Inscripcion[], claseId: string, empiezaEn: Date) =>
  suyas.some(
    (s) =>
      s.claseId === claseId && s.desde <= empiezaEn && (s.hasta === null || s.hasta > empiezaEn),
  );

/**
 * Las primeras `cantidad` fechas de su horario fijo en la sede desde el día `desde`, en orden.
 * No cuentan las canceladas ni las de clases en las que no estaba inscripto en ese momento.
 */
export async function fechasDeAlumno(
  tx: Transaccion,
  pedido: { alumnoId: string; sedeId: string; desde: string; cantidad: number },
): Promise<FechaDeAlumno[]> {
  const { alumnoId, sedeId, desde, cantidad } = pedido;
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAXIMO_DE_FECHAS) {
    throw new Error(`fechasDeAlumno pide entre 1 y ${String(MAXIMO_DE_FECHAS)} fechas.`);
  }
  const repo = repositorioAgenda(tx);
  const zona = await repo.zonaHoraria();
  const suyas = await inscripcionesDesde(tx, alumnoId, sedeId, localAUtc(desde, "00:00", zona));
  if (suyas.length === 0) return [];
  const claseIds = [...new Set(suyas.map((s) => s.claseId))];
  const encontradas: FechaDeAlumno[] = [];
  // De a tramos de semanas: dos consultas por tramo, no una por fecha (regla 8).
  for (let semana = 0; encontradas.length < cantidad && semana < SEMANAS_COMO_MUCHO;) {
    const tramo = Math.max(1, Math.ceil((cantidad - encontradas.length) / claseIds.length));
    const inicio = sumarDias(desde, semana * 7);
    const fin = sumarDias(desde, (semana + tramo) * 7 - 1);
    await repo.guardarFechas(armar(suyas, inicio, tramo, zona, sedeId));
    const filas = await tx
      .select({
        id: ocurrencias.id,
        claseId: ocurrencias.claseId,
        fecha: ocurrencias.fecha,
        empiezaEn: ocurrencias.empiezaEn,
        terminaEn: ocurrencias.terminaEn,
      })
      .from(ocurrencias)
      .where(
        and(
          inArray(ocurrencias.claseId, claseIds),
          gte(ocurrencias.fecha, inicio),
          lte(ocurrencias.fecha, fin),
          eq(ocurrencias.cancelada, false),
        ),
      )
      .orderBy(asc(ocurrencias.empiezaEn), asc(ocurrencias.id));
    encontradas.push(...filas.filter((f) => vigente(suyas, f.claseId, f.empiezaEn)));
    semana += tramo;
  }
  return encontradas.slice(0, cantidad);
}

/** Las fechas de esas semanas de sus clases activas, sin fechas anteriores al alta de la clase. */
function armar(
  suyas: readonly Inscripcion[],
  inicio: string,
  semanas: number,
  zona: string,
  sedeId: string,
) {
  const activas = new Map(suyas.filter((s) => s.activa).map((s) => [s.claseId, s]));
  return [...activas.values()].flatMap((clase) =>
    Array.from({ length: semanas }, (_, i) =>
      ocurrenciasDeLaSemana(clase, sumarDias(inicio, i * 7), zona),
    )
      .flat()
      .filter((ocurrencia) => ocurrencia.terminaEn > clase.claseCreadaEn)
      .map((ocurrencia) => ({ ...ocurrencia, claseId: clase.claseId, sedeId })),
  );
}
