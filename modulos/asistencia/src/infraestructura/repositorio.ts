// Adaptador Drizzle de la asistencia. Corre dentro de enContexto: RLS limita al centro y a las
// sedes visibles. La fecha y los inscriptos se leen de agenda y los alumnos de personas, por su
// API pública (regla 4).
import { estabanInscriptos, inscriptosEnFecha, obtenerFecha } from "@app/agenda";
import { obtenerAlumnos } from "@app/personas";
import type { Transaccion } from "@app/plataforma";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { RepositorioAsistencia } from "../aplicacion/puertos.ts";
import { asistencias } from "./esquema.ts";
import { repositorioAvisos } from "./repositorio-avisos.ts";
import { repositorioCreditos } from "./repositorio-creditos.ts";
import { repositorioRecuperaciones } from "./repositorio-recuperaciones.ts";

export function repositorioAsistencia(tx: Transaccion): RepositorioAsistencia {
  return {
    ...repositorioAvisos(tx),
    ...repositorioCreditos(tx),
    ...repositorioRecuperaciones(tx),
    fecha: (id) => obtenerFecha(tx, id),
    inscriptos: (filtro) => inscriptosEnFecha(tx, filtro),
    estabanInscriptos: (filtro) => estabanInscriptos(tx, filtro),
    async alumnos(ids) {
      const alumnos = await obtenerAlumnos(tx, ids);
      return new Map(
        alumnos.map(({ id, nombre, apellido, activo }) => [id, { nombre, apellido, activo }]),
      );
    },
    async marcas(ocurrenciaId, alumnoIds) {
      if (alumnoIds.length === 0) return new Map();
      const filas = await tx
        .select({ alumnoId: asistencias.alumnoId, estado: asistencias.estado })
        .from(asistencias)
        .where(
          and(
            eq(asistencias.ocurrenciaId, ocurrenciaId),
            inArray(asistencias.alumnoId, [...alumnoIds]),
          ),
        );
      return new Map(filas.map((f) => [f.alumnoId, f.estado]));
    },
    guardar: (fecha, marcas, registro) => guardar(tx, fecha, marcas, registro),
  };
}

/** Una fila por alumno y fecha (índice único): corregir reemplaza la marca anterior. */
async function guardar(
  tx: Transaccion,
  ...[fecha, marcas, registro]: Parameters<RepositorioAsistencia["guardar"]>
): Promise<void> {
  await tx
    .insert(asistencias)
    .values(
      marcas.map(({ alumnoId, estado }) => ({
        centroId: sql`app_centro_actual()`,
        sedeId: fecha.sedeId,
        ocurrenciaId: fecha.id,
        alumnoId,
        estado,
        registradaPorTipo: registro.tipo,
        registradaPorId: registro.id,
        registradaEn: registro.en,
      })),
    )
    .onConflictDoUpdate({
      target: [asistencias.ocurrenciaId, asistencias.alumnoId],
      set: {
        estado: sql`excluded.estado`,
        registradaPorTipo: sql`excluded.registrada_por_tipo`,
        registradaPorId: sql`excluded.registrada_por_id`,
        registradaEn: sql`excluded.registrada_en`,
      },
    });
}
