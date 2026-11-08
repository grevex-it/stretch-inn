// Adaptador Drizzle de los planes y sus precios por sede. Corre dentro de enContexto: RLS limita
// al centro (y a las sedes visibles en los precios).
import { obtenerCentro } from "@app/centros";
import type { Transaccion } from "@app/plataforma";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import type { RepositorioAbonos } from "../aplicacion/puertos.ts";
import { planes, preciosDeSede } from "./esquema.ts";

const ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires";

type RepositorioPlanes = Pick<
  RepositorioAbonos,
  | "zonaHoraria"
  | "planes"
  | "preciosDeSede"
  | "plan"
  | "crearPlan"
  | "actualizarPlan"
  | "fijarActivo"
  | "fijarPrecioDeSede"
  | "precioDeSede"
>;

const columnas = {
  id: planes.id,
  nombre: planes.nombre,
  clasesPorSemana: planes.clasesPorSemana,
  precio: planes.precio,
  activo: planes.activo,
  version: planes.version,
};

export function repositorioPlanes(tx: Transaccion): RepositorioPlanes {
  return {
    async zonaHoraria() {
      return (await obtenerCentro(tx))?.zonaHoraria ?? ZONA_POR_DEFECTO;
    },
    async planes({ pagina, porPagina }) {
      const elementos = await tx
        .select(columnas)
        .from(planes)
        .orderBy(asc(planes.nombre), asc(planes.id))
        .limit(porPagina)
        .offset((pagina - 1) * porPagina);
      const [total] = await tx.select({ total: count() }).from(planes);
      return { pagina, porPagina, total: total?.total ?? 0, elementos };
    },
    preciosDeSede: (planIds) => preciosDe(tx, planIds),
    async plan(id) {
      const [fila] = await tx.select(columnas).from(planes).where(eq(planes.id, id));
      return fila;
    },
    async crearPlan(datos) {
      const [fila] = await tx
        .insert(planes)
        .values({ ...datos, centroId: sql`app_centro_actual()` })
        .returning({ id: planes.id });
      if (fila === undefined) throw new Error("No se pudo crear el plan.");
      return fila;
    },
    async actualizarPlan(id, version, datos) {
      const [fila] = await tx
        .update(planes)
        .set({ ...datos, version: sql`${planes.version} + 1` })
        .where(and(eq(planes.id, id), eq(planes.version, version)))
        .returning({ version: planes.version });
      return fila?.version;
    },
    async fijarActivo(id, activo) {
      await tx.update(planes).set({ activo }).where(eq(planes.id, id));
    },
    fijarPrecioDeSede: (planId, sedeId, precio) => fijarPrecio(tx, planId, sedeId, precio),
    async precioDeSede(planId, sedeId) {
      const [fila] = await tx
        .select({ precio: preciosDeSede.precio })
        .from(preciosDeSede)
        .where(and(eq(preciosDeSede.planId, planId), eq(preciosDeSede.sedeId, sedeId)));
      return fila?.precio;
    },
  };
}

async function preciosDe(
  tx: Transaccion,
  planIds: readonly string[],
): ReturnType<RepositorioAbonos["preciosDeSede"]> {
  const resultado: Awaited<ReturnType<RepositorioAbonos["preciosDeSede"]>> = new Map(
    planIds.map((id) => [id, []]),
  );
  if (planIds.length === 0) return resultado;
  const filas = await tx
    .select({
      planId: preciosDeSede.planId,
      sedeId: preciosDeSede.sedeId,
      precio: preciosDeSede.precio,
    })
    .from(preciosDeSede)
    .where(inArray(preciosDeSede.planId, [...planIds]))
    .orderBy(asc(preciosDeSede.sedeId));
  for (const { planId, sedeId, precio } of filas) resultado.get(planId)?.push({ sedeId, precio });
  return resultado;
}

async function fijarPrecio(
  tx: Transaccion,
  ...[planId, sedeId, precio]: Parameters<RepositorioAbonos["fijarPrecioDeSede"]>
): Promise<void> {
  const donde = and(eq(preciosDeSede.planId, planId), eq(preciosDeSede.sedeId, sedeId));
  if (precio === null) {
    await tx.delete(preciosDeSede).where(donde);
    return;
  }
  await tx
    .insert(preciosDeSede)
    .values({ planId, sedeId, precio, centroId: sql`app_centro_actual()` })
    .onConflictDoUpdate({
      target: [preciosDeSede.planId, preciosDeSede.sedeId],
      set: { precio },
    });
}
