// Adaptador Drizzle de los gastos. Corre dentro de enContexto: RLS limita al centro y a las sedes
// visibles, así que acá no se filtra por centro a mano.
import { pesos } from "@app/nucleo";
import type { Transaccion } from "@app/plataforma";
import { and, between, count, desc, eq, isNull, sql, sum } from "drizzle-orm";
import type { RepositorioGastos } from "../aplicacion/puertos.ts";
import { gastos } from "./esquema.ts";

const columnas = {
  id: gastos.id,
  sedeId: gastos.sedeId,
  fecha: gastos.fecha,
  monto: gastos.monto,
  categoria: gastos.categoria,
  medio: gastos.medio,
  descripcion: gastos.descripcion,
  registradoEn: gastos.registradoEn,
  anuladoEn: gastos.anuladoEn,
  motivoAnulacion: gastos.motivoAnulacion,
};

export function repositorioGastos(tx: Transaccion): RepositorioGastos {
  return {
    async gastoPorClave(clave) {
      const [fila] = await tx
        .select(columnas)
        .from(gastos)
        .where(eq(gastos.claveIdempotencia, clave));
      return fila;
    },
    async cargar({ clave, ...gasto }, registro) {
      // La clave única por centro es la barrera: el mismo gasto repetido no deja dos filas.
      const [fila] = await tx
        .insert(gastos)
        .values({
          ...gasto,
          centroId: sql`app_centro_actual()`,
          claveIdempotencia: clave,
          registradoPorTipo: registro.tipo,
          registradoPorId: registro.id,
          registradoEn: registro.en,
        })
        .onConflictDoNothing()
        .returning({ id: gastos.id });
      return fila?.id;
    },
    async gasto(id) {
      const [fila] = await tx.select(columnas).from(gastos).where(eq(gastos.id, id)).for("update");
      return fila;
    },
    async anular(id, motivo, registro) {
      await tx
        .update(gastos)
        .set({
          anuladoEn: registro.en,
          anuladoPorTipo: registro.tipo,
          anuladoPorId: registro.id,
          motivoAnulacion: motivo,
        })
        .where(and(eq(gastos.id, id), isNull(gastos.anuladoEn)));
    },
    delPeriodo: (filtro) => delPeriodo(tx, filtro),
  };
}

async function delPeriodo(
  tx: Transaccion,
  { sedeId, desde, hasta, pagina, porPagina }: Parameters<RepositorioGastos["delPeriodo"]>[0],
): ReturnType<RepositorioGastos["delPeriodo"]> {
  const donde = and(eq(gastos.sedeId, sedeId), between(gastos.fecha, desde, hasta));
  const elementos = await tx
    .select(columnas)
    .from(gastos)
    .where(donde)
    .orderBy(desc(gastos.fecha), desc(gastos.registradoEn), desc(gastos.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);
  const [totales] = await tx.select({ total: count() }).from(gastos).where(donde);
  const [vigentes] = await tx
    .select({ gastado: sum(gastos.monto).mapWith(Number) })
    .from(gastos)
    .where(and(donde, isNull(gastos.anuladoEn)));
  return {
    pagina,
    porPagina,
    total: totales?.total ?? 0,
    elementos,
    gastado: pesos(vigentes?.gastado ?? 0),
  };
}
