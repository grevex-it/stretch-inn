// Adaptador Drizzle de las cuotas de toda una sede: impagas y renovación del mes. Corre dentro de
// enContexto (RLS). Los alumnos se leen por la API pública de personas (regla 4).
import { pesos } from "@app/nucleo";
import { obtenerAlumnos } from "@app/personas";
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, eq, gt, isNull, sql, sum } from "drizzle-orm";
import type { RepositorioAbonos } from "../aplicacion/puertos.ts";
import { cuotas, planes, preciosDeSede } from "./esquema.ts";

type RepositorioSede = Pick<
  RepositorioAbonos,
  "cuotasImpagas" | "alumnos" | "cuotasARenovar" | "generarCuotas"
>;

const columnas = {
  id: cuotas.id,
  alumnoId: cuotas.alumnoId,
  planId: cuotas.planId,
  sedeId: cuotas.sedeId,
  periodo: cuotas.periodo,
  monto: cuotas.monto,
  pagadaEn: cuotas.pagadaEn,
};

/** Una tanda de cuotas vigentes del mes, por alumno, con el plan y su precio de hoy en la sede. */
async function aRenovar(
  tx: Transaccion,
  { sedeId, periodo, despuesDe, limite }: Parameters<RepositorioAbonos["cuotasARenovar"]>[0],
) {
  const filas = await tx
    .select({
      alumnoId: cuotas.alumnoId,
      planId: cuotas.planId,
      planActivo: planes.activo,
      precio: planes.precio,
      precioDeSede: preciosDeSede.precio,
    })
    .from(cuotas)
    .innerJoin(planes, eq(planes.id, cuotas.planId))
    .leftJoin(
      preciosDeSede,
      and(eq(preciosDeSede.planId, cuotas.planId), eq(preciosDeSede.sedeId, cuotas.sedeId)),
    )
    .where(
      and(
        eq(cuotas.sedeId, sedeId),
        eq(cuotas.periodo, periodo),
        isNull(cuotas.anuladaEn),
        despuesDe === undefined ? undefined : gt(cuotas.alumnoId, despuesDe),
      ),
    )
    .orderBy(asc(cuotas.alumnoId))
    .limit(limite);
  return filas.map((fila) => ({ ...fila, precioDeSede: fila.precioDeSede ?? undefined }));
}

export function repositorioSede(tx: Transaccion): RepositorioSede {
  return {
    async cuotasImpagas({ sedeId, periodo, pagina, porPagina }) {
      const donde = and(
        eq(cuotas.sedeId, sedeId),
        isNull(cuotas.pagadaEn),
        isNull(cuotas.anuladaEn),
        periodo === undefined ? undefined : eq(cuotas.periodo, periodo),
      );
      const elementos = await tx
        .select(columnas)
        .from(cuotas)
        .where(donde)
        .orderBy(asc(cuotas.periodo), asc(cuotas.creadaEn), asc(cuotas.id))
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
    cuotasARenovar: (filtro) => aRenovar(tx, filtro),

    async generarCuotas(nuevas) {
      // El índice único parcial (alumno, mes vigente) deja afuera a quien ya tenía la cuota.
      const filas = await tx
        .insert(cuotas)
        .values(nuevas.map((cuota) => ({ ...cuota, centroId: sql`app_centro_actual()` })))
        .onConflictDoNothing()
        .returning({ id: cuotas.id });
      return filas.length;
    },
  };
}
