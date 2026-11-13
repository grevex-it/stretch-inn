// Adaptador Drizzle de las cuotas de toda una sede: las impagas. Corre dentro de enContexto (RLS).
// Los alumnos se leen por la API pública de personas (regla 4).
import { pesos } from "@app/nucleo";
import { obtenerAlumnos } from "@app/personas";
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, eq, isNull, sum } from "drizzle-orm";
import type { RepositorioAbonos } from "../aplicacion/puertos.ts";
import { cuotas } from "./esquema.ts";

type RepositorioSede = Pick<RepositorioAbonos, "cuotasImpagas" | "alumnos">;

const columnas = {
  id: cuotas.id,
  alumnoId: cuotas.alumnoId,
  planId: cuotas.planId,
  sedeId: cuotas.sedeId,
  desde: cuotas.desde,
  clases: cuotas.clases,
  monto: cuotas.monto,
  pagadaEn: cuotas.pagadaEn,
  pagoId: cuotas.pagoId,
};

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
  };
}
