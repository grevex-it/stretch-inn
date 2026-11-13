// Adaptador Drizzle de los avisos de ausencia. Corre dentro de enContexto: RLS limita al centro y
// a las sedes visibles.
import { fechasDeAlumno } from "@app/agenda";
import type { Transaccion } from "@app/plataforma";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { RepositorioAsistencia } from "../aplicacion/puertos.ts";
import { avisosDeAusencia } from "./esquema.ts";

type RepositorioAvisos = Pick<
  RepositorioAsistencia,
  "avisos" | "avisar" | "aviso" | "anularAviso" | "fechasDeAlumno" | "avisarVarias"
>;

/** Un viaje no pasa de 100 fechas de su horario fijo (casi dos años, una vez por semana). */
const FECHAS_DE_UN_VIAJE = 100;

export function repositorioAvisos(tx: Transaccion): RepositorioAvisos {
  const vigente = (id: string) =>
    and(eq(avisosDeAusencia.id, id), isNull(avisosDeAusencia.anuladoEn));
  return {
    async avisos(ocurrenciaId, alumnoIds) {
      if (alumnoIds.length === 0) return new Map();
      const filas = await tx
        .select({ id: avisosDeAusencia.id, alumnoId: avisosDeAusencia.alumnoId })
        .from(avisosDeAusencia)
        .where(
          and(
            eq(avisosDeAusencia.ocurrenciaId, ocurrenciaId),
            inArray(avisosDeAusencia.alumnoId, [...alumnoIds]),
            isNull(avisosDeAusencia.anuladoEn),
          ),
        );
      return new Map(filas.map((f) => [f.alumnoId, f.id]));
    },
    avisar: (fecha, alumnoId, registro) => avisar(tx, fecha, alumnoId, registro),
    ...paraViajes(tx),
    async aviso(id) {
      const [fila] = await tx
        .select({ ocurrenciaId: avisosDeAusencia.ocurrenciaId })
        .from(avisosDeAusencia)
        .where(vigente(id));
      return fila;
    },
    async anularAviso(id, ahora) {
      const filas = await tx
        .update(avisosDeAusencia)
        .set({ anuladoEn: ahora })
        .where(vigente(id))
        .returning({ id: avisosDeAusencia.id });
      return filas.length > 0;
    },
  };
}

/** El viaje (0022): las fechas de su horario fijo y los avisos de todas juntas. */
function paraViajes(
  tx: Transaccion,
): Pick<RepositorioAsistencia, "fechasDeAlumno" | "avisarVarias"> {
  return {
    async fechasDeAlumno(pedido) {
      const fechas = await fechasDeAlumno(tx, { ...pedido, cantidad: FECHAS_DE_UN_VIAJE });
      return fechas.map(({ id, fecha, empiezaEn }) => ({ id, fecha, empiezaEn }));
    },
    async avisarVarias(fechas, alumnoId, registro) {
      if (fechas.length === 0) return 0;
      // El índice único parcial (fecha, alumno vigente) deja afuera las que ya tenían aviso.
      const filas = await tx
        .insert(avisosDeAusencia)
        .values(
          fechas.map((fecha) => ({
            centroId: sql`app_centro_actual()`,
            sedeId: fecha.sedeId,
            ocurrenciaId: fecha.id,
            alumnoId,
            avisadoPorTipo: registro.tipo,
            avisadoPorId: registro.id,
            avisadoEn: registro.en,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: avisosDeAusencia.id });
      return filas.length;
    },
  };
}

/** El índice único parcial (fecha, alumno vigente) es la barrera: si choca, no hay fila. */
async function avisar(
  tx: Transaccion,
  ...[fecha, alumnoId, registro]: Parameters<RepositorioAsistencia["avisar"]>
): Promise<string | undefined> {
  const [fila] = await tx
    .insert(avisosDeAusencia)
    .values({
      centroId: sql`app_centro_actual()`,
      sedeId: fecha.sedeId,
      ocurrenciaId: fecha.id,
      alumnoId,
      avisadoPorTipo: registro.tipo,
      avisadoPorId: registro.id,
      avisadoEn: registro.en,
    })
    .onConflictDoNothing()
    .returning({ id: avisosDeAusencia.id });
  return fila?.id;
}
