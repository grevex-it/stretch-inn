// Adaptador Drizzle de las cuotas de toda una sede: impagas y renovación de los ciclos. Corre
// dentro de enContexto (RLS). Los alumnos se leen por la API pública de personas (regla 4).
import { pesos } from "@app/nucleo";
import { obtenerAlumnos } from "@app/personas";
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, desc, eq, gt, isNull, lte, sql, sum } from "drizzle-orm";
import type { RepositorioAbonos } from "../aplicacion/puertos.ts";
import { cuotas, planes, preciosDeSede } from "./esquema.ts";

type RepositorioSede = Pick<
  RepositorioAbonos,
  "cuotasImpagas" | "alumnos" | "ciclosARenovar" | "generarCuotas"
>;

const columnas = {
  id: cuotas.id,
  alumnoId: cuotas.alumnoId,
  planId: cuotas.planId,
  sedeId: cuotas.sedeId,
  desde: cuotas.desde,
  hasta: cuotas.hasta,
  monto: cuotas.monto,
  pagadaEn: cuotas.pagadaEn,
};

/**
 * Una tanda de alumnos de la sede cuyo último ciclo vigente en la sede terminó hasta `dia`, con
 * el plan y su precio de hoy en la sede.
 */
async function aRenovar(
  tx: Transaccion,
  { sedeId, dia, despuesDe, limite }: Parameters<RepositorioAbonos["ciclosARenovar"]>[0],
) {
  const ultimos = tx
    .selectDistinctOn([cuotas.alumnoId], {
      alumnoId: cuotas.alumnoId,
      planId: cuotas.planId,
      hasta: cuotas.hasta,
    })
    .from(cuotas)
    .where(
      and(
        eq(cuotas.sedeId, sedeId),
        isNull(cuotas.anuladaEn),
        despuesDe === undefined ? undefined : gt(cuotas.alumnoId, despuesDe),
      ),
    )
    .orderBy(asc(cuotas.alumnoId), desc(cuotas.desde))
    .as("ultimos");
  const filas = await tx
    .select({
      alumnoId: ultimos.alumnoId,
      planId: ultimos.planId,
      hasta: ultimos.hasta,
      planActivo: planes.activo,
      precio: planes.precio,
      precioDeSede: preciosDeSede.precio,
    })
    .from(ultimos)
    .innerJoin(planes, eq(planes.id, ultimos.planId))
    .leftJoin(
      preciosDeSede,
      and(eq(preciosDeSede.planId, ultimos.planId), eq(preciosDeSede.sedeId, sedeId)),
    )
    .where(lte(ultimos.hasta, dia))
    .orderBy(asc(ultimos.alumnoId))
    .limit(limite);
  return filas.map((fila) => ({ ...fila, precioDeSede: fila.precioDeSede ?? undefined }));
}

export function repositorioSede(tx: Transaccion): RepositorioSede {
  return {
    async cuotasImpagas({ sedeId, pagina, porPagina }) {
      const donde = and(
        eq(cuotas.sedeId, sedeId),
        isNull(cuotas.pagadaEn),
        isNull(cuotas.anuladaEn),
      );
      const elementos = await tx
        .select(columnas)
        .from(cuotas)
        .where(donde)
        .orderBy(asc(cuotas.desde), asc(cuotas.creadaEn), asc(cuotas.id))
        .limit(porPagina)
        .offset((pagina - 1) * porPagina);
      const [totales] = await tx
        .select({ total: count(), adeudado: sum(cuotas.monto).mapWith(Number) })
        .from(cuotas)
        .where(donde);
      const adeudado = pesos(totales?.adeudado ?? 0);
      return { pagina, porPagina, total: totales?.total ?? 0, adeudado, elementos };
    },
    async alumnos(ids) {
      const encontrados = await obtenerAlumnos(tx, ids);
      return new Map(
        encontrados.map(({ id, nombre, apellido, activo }) => [id, { nombre, apellido, activo }]),
      );
    },
    ciclosARenovar: (filtro) => aRenovar(tx, filtro),
    async generarCuotas(nuevas) {
      // El índice único parcial (alumno, desde vigente) deja afuera las que ya estaban.
      const filas = await tx
        .insert(cuotas)
        .values(nuevas.map((cuota) => ({ ...cuota, centroId: sql`app_centro_actual()` })))
        .onConflictDoNothing()
        .returning({ id: cuotas.id });
      return filas.length;
    },
  };
}
